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
        userEmail = session?.user.email
        userID = session?.user.id.uuidString
        isAuthenticated = session != nil
        isLoading = false
        if session != nil {
            loadingContext = .startup
        }

        if session != nil {
            updateAuthMethodFromStoredHint()
        } else {
            authMethodDisplay = "Unknown"
            authMethodSymbol = "person.badge.shield.checkmark"
        }

        if session != nil {
            eduVerified = nil
            schoolDomain = nil
            avatarURL = nil
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
            let schoolEmail: String?
            let campusKey: String?

            enum CodingKeys: String, CodingKey {
                case eduVerified = "edu_verified"
                case schoolDomain = "school_domain"
                case schoolEmail = "school_email"
                case campusKey = "campus_key"
            }
        }

        struct EduStatusAPI: Decodable {
            let verified: Bool?
            let schoolDomain: String?
            let schoolEmail: String?
            let campusKey: String?

            enum CodingKeys: String, CodingKey {
                case verified
                case eduVerified = "edu_verified"
                case schoolDomain
                case schoolDomainSnake = "school_domain"
                case schoolEmail = "school_email"
                case campusKey = "campus_key"
            }

            init(from decoder: Decoder) throws {
                let container = try decoder.container(keyedBy: CodingKeys.self)
                verified = try container.decodeIfPresent(Bool.self, forKey: .verified)
                    ?? container.decodeIfPresent(Bool.self, forKey: .eduVerified)
                schoolDomain = try container.decodeIfPresent(String.self, forKey: .schoolDomain)
                    ?? container.decodeIfPresent(String.self, forKey: .schoolDomainSnake)
                schoolEmail = try container.decodeIfPresent(String.self, forKey: .schoolEmail)
                campusKey = try container.decodeIfPresent(String.self, forKey: .campusKey)
            }
        }

        var apiVerified: Bool?
        var apiDomain: String?
        var apiSchoolEmail: String?
        var apiCampusKey: String?
        var profileVerified: Bool?
        var profileDomain: String?
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
            apiSchoolEmail = response.schoolEmail?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            apiCampusKey = response.campusKey?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        } catch {
            // fall back to profile check below
        }

        do {
            let response: PostgrestResponse<EduStatus> = try await SupabaseManager.shared.client
                .from("profiles")
                .select("edu_verified,school_domain,school_email,campus_key")
                .eq("id", value: userID)
                .single()
                .execute()
            profileVerified = response.value.eduVerified
            profileDomain = response.value.schoolDomain?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            profileSchoolEmail = response.value.schoolEmail?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            profileCampusKey = response.value.campusKey?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        } catch {
            profileVerified = nil
        }

        // Profile row is the source of truth for current user state if it exists.
        // This avoids temporary backend/API regressions from forcing verified users to "unverified".
        if let profileVerified {
            eduVerified = profileVerified
        } else if let apiVerified {
            eduVerified = apiVerified
        } else {
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

        let resolvedDomain = profileDomain
            ?? apiDomain
            ?? schoolEmailDomain
            ?? campusDomainFromKey
            ?? resolvedSchoolDomain
        if let resolvedDomain, !resolvedDomain.isEmpty {
            schoolDomain = resolvedDomain
        } else if eduVerified != true {
            schoolDomain = nil
        }
    }

    func refreshProfile() async {
        // Pull avatar URL used by top bar/account photo views.
        guard let userID else {
            avatarURL = nil
            return
        }

        struct ProfileRow: Decodable {
            let avatarURL: String?

            enum CodingKeys: String, CodingKey {
                case avatarURL = "avatar_url"
            }
        }

        do {
            let response: PostgrestResponse<ProfileRow> = try await SupabaseManager.shared.client
                .from("profiles")
                .select("avatar_url")
                .eq("id", value: userID)
                .single()
                .execute()
            avatarURL = response.value.avatarURL
        } catch {
            avatarURL = nil
        }
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
