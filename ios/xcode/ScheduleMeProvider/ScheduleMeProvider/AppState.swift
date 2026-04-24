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

@MainActor
final class AppState: ObservableObject {
    // MARK: - Session/UI State

    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = true
    @Published var eduVerified: Bool? = nil
    @Published var userEmail: String? = nil
    @Published var userID: String? = nil
    @Published var schoolDomain: String? = nil
    @Published var schoolEmail: String? = nil
    @Published var avatarURL: String? = nil
    @Published var pendingBusinessLookupKey: String? = nil
    @Published var isSigningOut: Bool = false
    @Published private(set) var deviceSecurityFlagged: Bool = false

    /// Resolved absolute URL for rendering the signed-in user's avatar.
    var resolvedAvatarURL: URL? {
        guard let normalized = normalizeRemoteImageURLString(avatarURL) else { return nil }
        return URL(string: normalized)
    }

    /// Prefer the verified school domain from the API, fallback to .edu email.
    var resolvedSchoolDomain: String? {
        if let schoolDomain, !schoolDomain.isEmpty { return schoolDomain }
        guard let email = userEmail,
              let domain = email.split(separator: "@").last.map(String.init),
              domain.hasSuffix(".edu") else { return nil }
        return domain
    }

    private var authTask: Task<Void, Never>?
    private var previousSessionFingerprint: String?

    init() {
        // Subscribe once to Supabase auth events so app shell stays in sync with session changes.
        authTask = Task {
            for await state in SupabaseManager.shared.client.auth.authStateChanges {
                if [.initialSession, .signedIn, .signedOut, .tokenRefreshed].contains(state.event) {
                    apply(session: state.session)
                }
            }
        }
        // Eager bootstrap removes the long blank-launch gap before authStateChanges emits.
        Task {
            await bootstrap()
        }
    }

    func bootstrap() async {
        // Cold-start hydration path used after launch and OAuth callback completion.
        isLoading = true
        await runDeviceSecurityChecks()
        let session: Session?
        do {
            session = try await SupabaseManager.shared.client.auth.session
        } catch {
            session = nil
        }
        apply(session: session)
        await refreshEduVerification()
        await refreshProfile()
    }

    func signOut() async {
        let startedAt = Date()
        isSigningOut = true
        await PushNotificationManager.shared.unregisterCurrentTokenIfPossible()
        do {
            try await SupabaseManager.shared.client.auth.signOut()
        } catch {
            // Ignore for now
        }
        eduVerified = nil
        schoolDomain = nil
        schoolEmail = nil
        userEmail = nil
        userID = nil
        avatarURL = nil
        pendingBusinessLookupKey = nil
        clearLocalAppData()

        // Keep the sign-out transition visible long enough to avoid a flash/flicker.
        let minimumVisible: TimeInterval = 2.1
        let elapsed = Date().timeIntervalSince(startedAt)
        if elapsed < minimumVisible {
            let remaining = minimumVisible - elapsed
            try? await Task.sleep(for: .milliseconds(Int(remaining * 1000)))
        }
        isSigningOut = false
    }

    func handleIncomingURL(_ url: URL) {
        if consumeBusinessDeepLink(url) {
            return
        }
        // OAuth deep-link callback entry.
        SupabaseManager.shared.handle(url)
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            await bootstrap()
        }
    }

    private func apply(session: Session?) {
        // Single fan-out point from auth session into UI-facing published fields.
        let newFingerprint = sessionFingerprint(session)
        if let previousSessionFingerprint, previousSessionFingerprint != newFingerprint {
            Task {
                await APIClient.shared.reportSecurityEvent(
                    "session_fingerprint_changed",
                    metadata: [
                        "has_session": String(session != nil)
                    ]
                )
            }
        }
        previousSessionFingerprint = newFingerprint

        userEmail = session?.user.email
        userID = session?.user.id.uuidString
        isAuthenticated = session != nil
        isLoading = false

        if session != nil {
            eduVerified = nil
            schoolDomain = nil
            schoolEmail = nil
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
            schoolEmail = nil
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

    private func sessionFingerprint(_ session: Session?) -> String {
        guard let session else { return "none" }
        let uid = session.user.id.uuidString
        let email = (session.user.email ?? "").lowercased()
        return "\(uid)|\(email)"
    }

    private func runDeviceSecurityChecks() async {
        let checks = DeviceSecurityChecks.evaluate()
        deviceSecurityFlagged = checks.isSuspicious
        guard checks.isSuspicious else { return }
        await APIClient.shared.reportSecurityEvent(
            "device_tamper_signal",
            metadata: checks.flags
        )
    }

    func refreshEduVerification() async {
        guard let userID else {
            eduVerified = nil
            schoolDomain = nil
            schoolEmail = nil
            return
        }

        struct EduStatus: Decodable {
            let eduVerified: Bool?
            let schoolDomain: String?

            enum CodingKeys: String, CodingKey {
                case eduVerified = "edu_verified"
                case schoolDomain = "schoolDomain"
            }
        }

        struct BusinessEduStatus: Decodable {
            let eduVerified: Bool?
            let schoolDomain: String?
            let schoolEmail: String?

            enum CodingKeys: String, CodingKey {
                case eduVerified = "edu_verified"
                case schoolDomain = "school_domain"
                case schoolEmail = "school_email"
            }
        }

        struct EduStatusAPI: Decodable {
            let verified: Bool?
            let schoolDomain: String?
            let schoolEmail: String?

            enum CodingKeys: String, CodingKey {
                case verified
                case schoolDomain = "school_domain"
                case schoolEmail = "school_email"
            }
        }

        // Prefer API-backed verification first (authoritative), then fallback below.
        do {
            let response: EduStatusAPI = try await APIClient.shared.get(
                path: "/api/edu-status",
                requiresAuth: true
            )
            if let verified = response.verified {
                eduVerified = verified
            }
            if let domain = response.schoolDomain, !domain.isEmpty {
                schoolDomain = domain
            }
            if let email = response.schoolEmail?.trimmingCharacters(in: .whitespacesAndNewlines), !email.isEmpty {
                schoolEmail = email.lowercased()
            }
        } catch {
            // fall back to profile check below
        }

        // Provider fallback: check business row directly if API sync lags/fails.
        do {
            let businessResponse: PostgrestResponse<BusinessEduStatus> = try await SupabaseManager.shared.client
                .from("businesses")
                .select("edu_verified, school_domain, school_email")
                .eq("owner_id", value: userID)
                .limit(1)
                .single()
                .execute()
            if let businessVerified = businessResponse.value.eduVerified {
                eduVerified = businessVerified
            }
            if let businessDomain = businessResponse.value.schoolDomain, !businessDomain.isEmpty {
                schoolDomain = businessDomain
            }
            if let businessEmail = businessResponse.value.schoolEmail, !businessEmail.isEmpty {
                schoolEmail = businessEmail.lowercased()
            }
        } catch {
            // no-op; profile fallback remains below
        }

        do {
            let response: PostgrestResponse<EduStatus> = try await SupabaseManager.shared.client
                .from("profiles")
                .select("edu_verified")
                .eq("id", value: userID)
                .single()
                .execute()
            if eduVerified == nil {
                eduVerified = response.value.eduVerified ?? false
            }
        } catch {
            if eduVerified == nil { eduVerified = false }
        }

        if schoolDomain == nil {
            schoolDomain = resolvedSchoolDomain
        }
        if schoolEmail == nil {
            schoolEmail = userEmail
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
            avatarURL = normalizeRemoteImageURLString(response.value.avatarURL)
        } catch {
            avatarURL = nil
        }
    }

    /// Normalizes host-only/relative image paths into absolute https URLs.
    func normalizeRemoteImageURLString(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") { return trimmed }
        if trimmed.hasPrefix("//") { return "https:\(trimmed)" }
        if trimmed.hasPrefix("/") {
            let apiBase = (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !apiBase.isEmpty, let baseURL = URL(string: apiBase) {
                return URL(string: trimmed, relativeTo: baseURL)?.absoluteURL.absoluteString
            }
            return nil
        }
        return "https://\(trimmed)"
    }

    deinit {
        authTask?.cancel()
    }

    private func clearLocalAppData() {
        if let bundleID = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: bundleID)
        }
        URLCache.shared.removeAllCachedResponses()
        HTTPCookieStorage.shared.removeCookies(since: .distantPast)
    }
}

private enum DeviceSecurityChecks {
    static func evaluate() -> (isSuspicious: Bool, flags: [String: String]) {
        var flags: [String: String] = [:]

        let debugger = isDebuggerAttached()
        if debugger { flags["debugger_attached"] = "true" }

        #if !targetEnvironment(simulator)
        let jailbreak = isJailbroken()
        if jailbreak { flags["jailbreak_signal"] = "true" }
        #endif

        if let dyld = ProcessInfo.processInfo.environment["DYLD_INSERT_LIBRARIES"], !dyld.isEmpty {
            flags["dyld_injected"] = "true"
        }

        return (!flags.isEmpty, flags)
    }

    private static func isDebuggerAttached() -> Bool {
        var info = kinfo_proc()
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        var size = MemoryLayout<kinfo_proc>.stride
        let result = sysctl(&mib, 4, &info, &size, nil, 0)
        if result != 0 { return false }
        return (info.kp_proc.p_flag & P_TRACED) != 0
    }

    private static func isJailbroken() -> Bool {
        let suspiciousPaths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt"
        ]
        if suspiciousPaths.contains(where: { FileManager.default.fileExists(atPath: $0) }) {
            return true
        }

        let testPath = "/private/scheduleme_security_test"
        do {
            try "x".write(toFile: testPath, atomically: true, encoding: .utf8)
            try? FileManager.default.removeItem(atPath: testPath)
            return true
        } catch {
            return false
        }
    }
}
