// FILE OVERVIEW:
// Global authenticated user/session state shared across screens.
//
// DEBUG NOTES:
// Auth/session refresh and user-profile state bugs usually originate here.

import Foundation
import Combine
import Supabase
import Auth
import PostgREST
import Darwin
import MachO

@MainActor
final class AppState: ObservableObject {
    enum LoadingContext {
        case startup
        case signingIn
        case signingOut
    }

    // MARK: - Session/UI State

    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = true
    @Published var loadingContext: LoadingContext = .startup
    @Published var eduVerified: Bool? = nil
    @Published var userEmail: String? = nil
    @Published var userID: String? = nil
    @Published var userFirstName: String? = nil
    @Published var schoolDomain: String? = nil
    @Published var avatarURL: String? = nil
    @Published var pendingBusinessLookupKey: String? = nil
    @Published var authMethodDisplay: String = "Unknown"
    @Published var authMethodSymbol: String = "person.badge.shield.checkmark"

    private let authMethodDefaultsKey = "scheduleme_last_auth_method"

    /// Prefer the verified school domain from the API, fallback to .edu email.
    var resolvedSchoolDomain: String? {
        if let schoolDomain, !schoolDomain.isEmpty { return schoolDomain }
        guard let email = userEmail,
              let domain = email.split(separator: "@").last.map(String.init),
              domain.hasSuffix(".edu") else { return nil }
        return domain
    }

    private var authTask: Task<Void, Never>?
    private var authObserverStarted = false

    init() {
        // Observer starts lazily in bootstrap to keep launch path light.
    }

    func bootstrap(context: LoadingContext = .startup) async {
        // Cold-start hydration path used after launch and OAuth callback completion.
        startAuthObserverIfNeeded()
        loadingContext = context
        isLoading = true
        let startupSession = await initialSessionWithTimeout()
        let validatedSession = await validateSessionForStartup(startupSession)
        apply(session: validatedSession)
        await refreshEduVerification()
        await refreshProfile()
    }

    func signOut() async {
        loadingContext = .signingOut
        isLoading = true
        await PushNotificationManager.shared.unregisterCurrentTokenIfPossible()
        do {
            try await SupabaseManager.shared.client.auth.signOut()
        } catch {
            // Ignore for now
        }
        eduVerified = nil
        schoolDomain = nil
        userFirstName = nil
        UserDefaults.standard.removeObject(forKey: authMethodDefaultsKey)
        authMethodDisplay = "Unknown"
        authMethodSymbol = "person.badge.shield.checkmark"
    }

    func handleIncomingURL(_ url: URL) {
        if consumeBusinessDeepLink(url) {
            return
        }
        // OAuth deep-link callback entry.
        SupabaseManager.shared.handle(url)
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            await bootstrap(context: .signingIn)
        }
    }

    private func apply(session: Session?) {
        // Single fan-out point from auth session into UI-facing published fields.
        let previousUserID = userID
        let newUserID = session?.user.id.uuidString
        userEmail = session?.user.email
        userID = newUserID
        userFirstName = nil
        isAuthenticated = session != nil
        isLoading = false

        if session != nil {
            updateAuthMethodFromStoredHint()
        } else {
            authMethodDisplay = "Unknown"
            authMethodSymbol = "person.badge.shield.checkmark"
        }

        if session != nil {
            // Keep existing profile/EDU state across token refresh events for same user.
            // Only clear when account actually changes.
            if previousUserID != newUserID {
                if let previousUserID, let newUserID, previousUserID != newUserID {
                    Task {
                        await SecurityTelemetry.shared.recordSuspiciousSessionTransition(
                            previousUserID: previousUserID,
                            newUserID: newUserID
                        )
                    }
                }
                eduVerified = nil
                schoolDomain = nil
                avatarURL = nil
            }
            Task {
                await PushNotificationManager.shared.requestAuthorizationIfNeeded()
                await PushNotificationManager.shared.syncTokenIfPossible()
                await refreshEduVerification()
                await refreshProfile()
            }
        } else {
            eduVerified = nil
            schoolDomain = nil
            avatarURL = nil
            userFirstName = nil
        }
    }

    /// Parses scheduleMe deep links like:
    /// - https://usescheduleme.com/biz/<slug-or-id>
    /// - https://www.usescheduleme.com/biz/<slug-or-id>
    /// - scheduleme://biz/<slug-or-id>
    private func consumeBusinessDeepLink(_ url: URL) -> Bool {
        let host = url.host?.lowercased() ?? ""
        let pathParts = url.pathComponents.filter { $0 != "/" }

        if (host == "usescheduleme.com" || host == "www.usescheduleme.com"),
           pathParts.count >= 2,
           pathParts[0].lowercased() == "biz" {
            let lookupKey = pathParts[1]
            guard !lookupKey.isEmpty else { return false }
            pendingBusinessLookupKey = lookupKey
            return true
        }

        if url.scheme?.lowercased() == "scheduleme",
           let firstHostComponent = url.host,
           firstHostComponent.lowercased() == "biz" {
            if pathParts.count >= 1 {
                let lookupKey = pathParts[0]
                guard !lookupKey.isEmpty else { return false }
                pendingBusinessLookupKey = lookupKey
                return true
            }
        }

        return false
    }

    func refreshEduVerification() async {
        guard let userID else {
            eduVerified = nil
            schoolDomain = nil
            return
        }

        struct EduStatus: Decodable {
            let eduVerified: Bool?
            let schoolDomain: String?
            let schoolName: String?
            let schoolEmail: String?
            let campusKey: String?

            enum CodingKeys: String, CodingKey {
                case eduVerified = "edu_verified"
                case eduVerifiedCamel = "eduVerified"
                case isVerified = "is_verified"
                case isVerifiedCamel = "isVerified"
                case schoolDomain = "school_domain"
                case schoolDomainCamel = "schoolDomain"
                case schoolName = "school_name"
                case schoolEmail = "school_email"
                case campusKey = "campus_key"
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                eduVerified = AppState.decodeFlexibleBool(
                    container: container,
                    keys: [.eduVerified, .eduVerifiedCamel, .isVerified, .isVerifiedCamel]
                )
                schoolDomain = (try? container.decodeIfPresent(String.self, forKey: .schoolDomain))
                    ?? (try? container.decodeIfPresent(String.self, forKey: .schoolDomainCamel))
                schoolName = try? container.decodeIfPresent(String.self, forKey: .schoolName)
                schoolEmail = try? container.decodeIfPresent(String.self, forKey: .schoolEmail)
                campusKey = try? container.decodeIfPresent(String.self, forKey: .campusKey)
            }
        }

        struct EduStatusAPI: Decodable {
            let verified: Bool?
            let schoolDomain: String?
            let schoolName: String?
            let schoolEmail: String?
            let campusKey: String?

            enum CodingKeys: String, CodingKey {
                case verified
                case isVerified = "is_verified"
                case isVerifiedCamel = "isVerified"
                case eduVerified = "edu_verified"
                case eduVerifiedCamel = "eduVerified"
                case schoolDomain
                case schoolDomainSnake = "school_domain"
                case domain
                case schoolName = "school_name"
                case schoolEmail = "school_email"
                case campusKey = "campus_key"
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                verified = AppState.decodeFlexibleBool(
                    container: container,
                    keys: [.verified, .isVerified, .isVerifiedCamel, .eduVerified, .eduVerifiedCamel]
                )
                schoolDomain = try container.decodeIfPresent(String.self, forKey: .schoolDomain)
                    ?? container.decodeIfPresent(String.self, forKey: .schoolDomainSnake)
                    ?? container.decodeIfPresent(String.self, forKey: .domain)
                schoolName = try container.decodeIfPresent(String.self, forKey: .schoolName)
                schoolEmail = try container.decodeIfPresent(String.self, forKey: .schoolEmail)
                campusKey = try container.decodeIfPresent(String.self, forKey: .campusKey)
            }
        }

        var apiVerified: Bool?
        var apiDomain: String?
        var apiSchoolName: String?
        var apiSchoolEmail: String?
        var apiCampusKey: String?
        var profileVerified: Bool?
        var profileDomain: String?
        var profileSchoolName: String?
        var profileSchoolEmail: String?
        var profileCampusKey: String?

        // Prefer API-backed verification first (authoritative), then fallback below.
        do {
            let response: EduStatusAPI = try await APIClient.shared.get(
                path: "/api/edu-status",
                requiresAuth: true
            )
            apiVerified = response.verified
            apiDomain = response.schoolDomain?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            apiSchoolName = response.schoolName?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            apiSchoolEmail = response.schoolEmail?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            apiCampusKey = response.campusKey?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        } catch {
            // fall back to profile check below
        }

        let profileSelectCandidates = [
            "edu_verified,school_domain,school_name,school_email,campus_key",
            "edu_verified,school_domain,school_email,campus_key",
            "edu_verified,school_domain,school_email",
            "edu_verified,school_domain",
            "edu_verified"
        ]
        for selectClause in profileSelectCandidates {
            do {
                let response: PostgrestResponse<EduStatus> = try await SupabaseManager.shared.client
                    .from("profiles")
                    .select(selectClause)
                    .eq("id", value: userID)
                    .single()
                    .execute()
                profileVerified = response.value.eduVerified
                profileDomain = response.value.schoolDomain?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                profileSchoolName = response.value.schoolName?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                profileSchoolEmail = response.value.schoolEmail?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                profileCampusKey = response.value.campusKey?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                break
            } catch {
                continue
            }
        }

        let apiLooksIndeterminateFalse =
            apiVerified == false
            && (apiDomain?.isEmpty ?? true)
            && (apiSchoolName?.isEmpty ?? true)
            && (apiSchoolEmail?.isEmpty ?? true)
            && (apiCampusKey?.isEmpty ?? true)
        let hasAuthoritativeVerificationSource = profileVerified != nil
            || (!apiLooksIndeterminateFalse && apiVerified != nil)

        // Profile row is the source of truth for current user state if it exists.
        // This avoids temporary backend/API regressions from forcing verified users to "unverified".
        if let profileVerified {
            eduVerified = profileVerified
        } else if let apiVerified, !apiLooksIndeterminateFalse {
            eduVerified = apiVerified
        } else if eduVerified == nil {
            // First-time hydration fallback only. Keep existing value on transient read failures.
            eduVerified = false
        }

        let schoolEmailDomain: String? = {
            let email = profileSchoolEmail ?? apiSchoolEmail
            guard let email, let domain = email.split(separator: "@").last.map(String.init) else { return nil }
            return domain.hasSuffix(".edu") ? domain : nil
        }()

        let campusDomainFromKey: String? = {
            let key = profileCampusKey ?? apiCampusKey
            guard let key, !key.isEmpty else { return nil }
            return "\(key).edu"
        }()

        let schoolNameDomain: String? = {
            let raw = (profileSchoolName ?? apiSchoolName)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            guard let raw, !raw.isEmpty else { return nil }
            if raw.hasSuffix(".edu") { return raw }
            if raw.contains("@"), let domain = raw.split(separator: "@").last.map(String.init), domain.hasSuffix(".edu") {
                return domain
            }
            return nil
        }()

        let resolvedDomain = profileDomain
            ?? apiDomain
            ?? schoolNameDomain
            ?? schoolEmailDomain
            ?? campusDomainFromKey
            ?? resolvedSchoolDomain
        if let resolvedDomain, !resolvedDomain.isEmpty {
            schoolDomain = resolvedDomain
        } else if hasAuthoritativeVerificationSource, eduVerified != true {
            // Clear only when we can confidently determine user is not EDU verified.
            schoolDomain = nil
        }
    }

    private static func decodeFlexibleBool<K: CodingKey>(
        container: KeyedDecodingContainer<K>,
        keys: [K]
    ) -> Bool? {
        for key in keys {
            if let boolValue = try? container.decodeIfPresent(Bool.self, forKey: key) {
                return boolValue
            }
            if let intValue = try? container.decodeIfPresent(Int.self, forKey: key) {
                return intValue != 0
            }
            if let stringValue = try? container.decodeIfPresent(String.self, forKey: key) {
                let normalized = stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if ["true", "1", "yes", "y", "verified"].contains(normalized) { return true }
                if ["false", "0", "no", "n", "unverified"].contains(normalized) { return false }
            }
        }
        return nil
    }

    func refreshProfile() async {
        // Pull avatar URL used by top bar/account photo views.
        guard let userID else {
            avatarURL = nil
            return
        }

        struct ProfileRow: Decodable {
            let avatarURL: String?
            let name: String?
            let fullName: String?

            enum CodingKeys: String, CodingKey {
                case avatarURL = "avatar_url"
                case name
                case fullName = "full_name"
            }
        }

        do {
            let response: PostgrestResponse<ProfileRow>
            do {
                // Primary schema on consumer app profile table.
                response = try await SupabaseManager.shared.client
                    .from("profiles")
                    .select("avatar_url,name")
                    .eq("id", value: userID)
                    .single()
                    .execute()
            } catch {
                // Back-compat fallback for deployments still using full_name.
                response = try await SupabaseManager.shared.client
                    .from("profiles")
                    .select("avatar_url,full_name")
                    .eq("id", value: userID)
                    .single()
                    .execute()
            }
            avatarURL = response.value.avatarURL
            userFirstName = firstName(from: response.value.name)
                ?? firstName(from: response.value.fullName)
                ?? userFirstName
        } catch {
            avatarURL = nil
        }
    }

    private func firstName(from fullName: String?) -> String? {
        guard let raw = fullName?.trimmingCharacters(in: .whitespacesAndNewlines),
              raw.isEmpty == false else { return nil }
        guard let first = raw.split(separator: " ").first else { return nil }
        let normalized = String(first).trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized.capitalized
    }

    // MARK: - EDU Verification Code Flow

    func requestEduVerificationCode(email: String) async throws {
        struct LegacySendRequest: Encodable {
            let email: String
        }
        struct VerifyEduSendRequest: Encodable {
            let school_email: String
            let account_type: String
        }
        struct SendResponse: Decodable {
            let success: Bool?
            let ok: Bool?
            let error: String?
            let message: String?
        }

        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalizedEmail.hasSuffix(".edu") else {
            throw DataStoreError.server("Please use a valid .edu email.")
        }

        let candidatePaths = ["/api/verify-edu", "/api/edu/send-code", "/api/edu/request-code"]
        var lastError: Error?

        for path in candidatePaths {
            do {
                let response: SendResponse
                if path == "/api/verify-edu" {
                    response = try await APIClient.shared.send(
                        path: path,
                        method: "POST",
                        body: VerifyEduSendRequest(school_email: normalizedEmail, account_type: "consumer"),
                        requiresAuth: true
                    )
                } else {
                    response = try await APIClient.shared.send(
                        path: path,
                        method: "POST",
                        body: LegacySendRequest(email: normalizedEmail),
                        requiresAuth: true
                    )
                }
                if response.success == true || response.ok == true || response.error == nil {
                    return
                }
                throw DataStoreError.server(response.error ?? response.message ?? "Unable to send verification code.")
            } catch {
                if shouldTryNextEduPath(after: error) {
                    lastError = error
                    continue
                }
                throw friendlyEduSendError(from: error)
            }
        }

        throw friendlyEduSendError(from: lastError)
    }

    func confirmEduVerificationCode(code: String) async throws {
        struct LegacyVerifyRequest: Encodable {
            let code: String
        }
        struct VerifyEduCodeRequest: Encodable {
            let action: String
            let code: String
            let account_type: String
        }
        struct VerifyResponse: Decodable {
            let success: Bool?
            let ok: Bool?
            let verified: Bool?
            let schoolDomain: String?
            let error: String?
            let message: String?
        }

        let normalizedCode = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalizedCode.isEmpty == false else {
            throw DataStoreError.server("Enter the verification code.")
        }

        let candidatePaths = ["/api/verify-edu", "/api/edu/verify-code", "/api/edu/verify"]
        var lastError: Error?

        for path in candidatePaths {
            do {
                let response: VerifyResponse
                if path == "/api/verify-edu" {
                    response = try await APIClient.shared.send(
                        path: path,
                        method: "POST",
                        body: VerifyEduCodeRequest(action: "verify", code: normalizedCode, account_type: "consumer"),
                        requiresAuth: true
                    )
                } else {
                    response = try await APIClient.shared.send(
                        path: path,
                        method: "POST",
                        body: LegacyVerifyRequest(code: normalizedCode),
                        requiresAuth: true
                    )
                }

                if response.verified == true || response.success == true || response.ok == true {
                    if let responseDomain = response.schoolDomain, !responseDomain.isEmpty {
                        schoolDomain = responseDomain
                    }
                    await refreshEduVerification()
                    return
                }
                throw DataStoreError.server(response.error ?? response.message ?? "Verification failed.")
            } catch {
                if shouldTryNextEduPath(after: error) {
                    lastError = error
                    continue
                }
                throw error
            }
        }

        throw lastError ?? DataStoreError.server("Verification failed.")
    }

    private func friendlyEduSendError(from error: Error?) -> Error {
        guard let error else {
            return DataStoreError.server("Unable to send verification code right now.")
        }

        let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        let normalized = message.lowercased()

        if normalized.contains("already")
            && (normalized.contains("used") || normalized.contains("in use") || normalized.contains("exists") || normalized.contains("taken")) {
            return DataStoreError.server("This school email is already linked to another account. Use a different .edu email or contact support.")
        }

        if normalized.contains("status 404") || normalized.contains("not found") {
            return DataStoreError.server("EDU verification service is temporarily unavailable. Please try again in a moment.")
        }

        if normalized.contains("status 401") || normalized.contains("unauthorized") {
            return DataStoreError.server("Your session expired. Please sign in again and retry EDU verification.")
        }

        if normalized.contains("status 429") || normalized.contains("too many") {
            return DataStoreError.server("Too many verification attempts. Please wait a few minutes and try again.")
        }

        return DataStoreError.server(message)
    }

    private func shouldTryNextEduPath(after error: Error) -> Bool {
        let message = ((error as? LocalizedError)?.errorDescription ?? error.localizedDescription).lowercased()
        return message.contains("status 404") || message.contains("not found")
    }

    private func startAuthObserverIfNeeded() {
        guard !authObserverStarted else { return }
        authObserverStarted = true
        // Keep long-lived auth stream off launch-critical path.
        authTask = Task {
            for await state in SupabaseManager.shared.client.auth.authStateChanges {
                if [.initialSession, .signedIn, .signedOut, .tokenRefreshed].contains(state.event) {
                    apply(session: state.session)
                }
            }
        }
    }

    private func initialSessionWithTimeout() async -> Session? {
        await withTaskGroup(of: Session?.self) { group in
            group.addTask {
                try? await SupabaseManager.shared.client.auth.session
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(1.8))
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
    }

    /// Prevents transient "Home then onboarding" flash from stale/expired sessions at launch.
    private func validateSessionForStartup(_ session: Session?) async -> Session? {
        guard session != nil else { return nil }
        let tokenLooksValid = await withTaskGroup(of: Bool.self) { group in
            group.addTask {
                do {
                    _ = try await SupabaseManager.shared.accessToken()
                    return true
                } catch {
                    return false
                }
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(1.2))
                return false
            }
            let first = await group.next() ?? false
            group.cancelAll()
            return first
        }

        guard tokenLooksValid else {
            try? await SupabaseManager.shared.client.auth.signOut()
            return nil
        }
        return session
    }

    func setAuthMethodHint(_ method: String) {
        let normalized = method.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }
        UserDefaults.standard.set(normalized, forKey: authMethodDefaultsKey)
        updateAuthMethodFromStoredHint()
    }

    private func updateAuthMethodFromStoredHint() {
        let raw = UserDefaults.standard.string(forKey: authMethodDefaultsKey) ?? ""
        switch raw.lowercased() {
        case "google":
            authMethodDisplay = "Google"
            authMethodSymbol = "globe"
        case "apple":
            authMethodDisplay = "Apple"
            authMethodSymbol = "apple.logo"
        case "email":
            authMethodDisplay = "Email/password"
            authMethodSymbol = "envelope.badge"
        default:
            authMethodDisplay = "Unknown"
            authMethodSymbol = "person.badge.shield.checkmark"
        }
    }

    deinit {
        authTask?.cancel()
    }
}

// MARK: - Security Telemetry

actor SecurityTelemetry {
    static let shared = SecurityTelemetry()

    private var recentAuthFailures: [Date] = []
    private var didRunIntegrityCheck = false
    private let authBurstWindowSeconds: TimeInterval = 300
    private let authBurstThreshold = 5

    private init() {}

    func evaluateDeviceIntegrityIfNeeded() async {
        guard !didRunIntegrityCheck else { return }
        didRunIntegrityCheck = true

        let signals = DeviceIntegrityInspector.collectSignals()
        guard !signals.isEmpty else { return }

        await sendSecurityEvent(
            type: "device_integrity_signal",
            severity: "high",
            details: [
                "signals": signals.joined(separator: ","),
                "signal_count": "\(signals.count)"
            ]
        )
    }

    func recordAuthFailure(reason: String) async {
        let now = Date()
        recentAuthFailures.append(now)
        recentAuthFailures.removeAll { now.timeIntervalSince($0) > authBurstWindowSeconds }

        let normalizedReason = reason
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .prefix(80)

        await sendSecurityEvent(
            type: "auth_failure",
            severity: "medium",
            details: [
                "reason": String(normalizedReason),
                "window_failure_count": "\(recentAuthFailures.count)"
            ]
        )

        if recentAuthFailures.count >= authBurstThreshold {
            await sendSecurityEvent(
                type: "auth_failure_burst",
                severity: "high",
                details: [
                    "burst_count": "\(recentAuthFailures.count)",
                    "window_seconds": "\(Int(authBurstWindowSeconds))"
                ]
            )
            recentAuthFailures.removeAll()
        }
    }

    func recordAuthSuccess() {
        recentAuthFailures.removeAll()
    }

    func recordSuspiciousSessionTransition(previousUserID: String, newUserID: String) async {
        await sendSecurityEvent(
            type: "suspicious_session_change",
            severity: "high",
            details: [
                "previous_user_id_suffix": String(previousUserID.suffix(8)),
                "new_user_id_suffix": String(newUserID.suffix(8))
            ]
        )
    }

    private func sendSecurityEvent(type: String, severity: String, details: [String: String]) async {
        struct SecurityEventRequest: Encodable {
            let type: String
            let severity: String
            let platform: String
            let appVersion: String
            let build: String
            let details: [String: String]
            let occurredAt: String

            enum CodingKeys: String, CodingKey {
                case type
                case severity
                case platform
                case appVersion = "app_version"
                case build
                case details
                case occurredAt = "occurred_at"
            }
        }

        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "unknown"
        let payload = SecurityEventRequest(
            type: type,
            severity: severity,
            platform: "ios-consumer",
            appVersion: appVersion,
            build: build,
            details: details,
            occurredAt: ISO8601DateFormatter().string(from: Date())
        )

        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        guard let body = try? encoder.encode(payload) else { return }

        func makeRequest(url: URL) -> URLRequest {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
            return request
        }

        do {
            let primaryURL = URL(string: "https://www.usescheduleme.com/api/security-events")!
            _ = try await APIClient.shared.dataResponse(
                for: makeRequest(url: primaryURL),
                requiresAuth: false,
                category: .securityTelemetry
            )
        } catch {
            do {
                let fallbackURL = URL(string: "https://www.usescheduleme.com/api/mobile-security-event")!
                _ = try await APIClient.shared.dataResponse(
                    for: makeRequest(url: fallbackURL),
                    requiresAuth: false,
                    category: .securityTelemetry
                )
            } catch {
                // Best-effort only.
            }
        }
    }
}

private enum DeviceIntegrityInspector {
    nonisolated static func collectSignals() -> [String] {
        var signals: [String] = []
        if isDebuggerAttached() {
            signals.append("debugger_attached")
        }
        if hasSuspiciousDYLDInjection() {
            signals.append("dyld_injection")
        }
        let jailbreakSignals = jailbreakIndicators()
        signals.append(contentsOf: jailbreakSignals)
        let hookSignals = suspiciousHookingIndicators()
        signals.append(contentsOf: hookSignals)
        return Array(Set(signals)).sorted()
    }

    private nonisolated static func hasSuspiciousDYLDInjection() -> Bool {
        guard let value = getenv("DYLD_INSERT_LIBRARIES") else { return false }
        let injected = String(cString: value).trimmingCharacters(in: .whitespacesAndNewlines)
        return !injected.isEmpty
    }

    private nonisolated static func jailbreakIndicators() -> [String] {
        var signals: [String] = []
        let suspiciousPaths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt",
            "/private/var/lib/apt/"
        ]
        for path in suspiciousPaths where FileManager.default.fileExists(atPath: path) {
            signals.append("jailbreak_path:\(path)")
        }

        let probePath = "/private/scheduleme_integrity_probe.txt"
        do {
            try "probe".write(toFile: probePath, atomically: true, encoding: .utf8)
            try? FileManager.default.removeItem(atPath: probePath)
            signals.append("jailbreak_writable_private")
        } catch {
            // Expected on non-jailbroken devices.
        }

        return signals
    }

    private nonisolated static func suspiciousHookingIndicators() -> [String] {
        let needles = ["frida", "substrate", "libhooker", "cycript"]
        var signals: [String] = []
        let imageCount = _dyld_image_count()
        if imageCount == 0 { return signals }
        for index in 0..<imageCount {
            guard let cName = _dyld_get_image_name(index) else { continue }
            let name = String(cString: cName).lowercased()
            for needle in needles where name.contains(needle) {
                signals.append("hook_lib:\(needle)")
            }
        }
        return signals
    }

    private nonisolated static func isDebuggerAttached() -> Bool {
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.size
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        let result = mib.withUnsafeMutableBufferPointer { pointer in
            sysctl(pointer.baseAddress, u_int(pointer.count), &info, &size, nil, 0)
        }
        if result != 0 { return false }
        return (info.kp_proc.p_flag & P_TRACED) != 0
    }
}
