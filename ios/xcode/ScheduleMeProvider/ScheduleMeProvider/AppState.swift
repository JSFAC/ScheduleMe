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
    // MARK: - Session/UI State

    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = true
    @Published var eduVerified: Bool? = nil
    @Published var userEmail: String? = nil
    @Published var userID: String? = nil
    @Published var schoolDomain: String? = nil
    @Published var avatarURL: String? = nil
    @Published var pendingBusinessLookupKey: String? = nil
    @Published var isSigningOut: Bool = false

    /// Prefer the verified school domain from the API, fallback to .edu email.
    var resolvedSchoolDomain: String? {
        if let schoolDomain, !schoolDomain.isEmpty { return schoolDomain }
        guard let email = userEmail,
              let domain = email.split(separator: "@").last.map(String.init),
              domain.hasSuffix(".edu") else { return nil }
        return domain
    }

    private var authTask: Task<Void, Never>?

    init() {
        // Subscribe once to Supabase auth events so app shell stays in sync with session changes.
        authTask = Task {
            for await state in SupabaseManager.shared.client.auth.authStateChanges {
                if [.initialSession, .signedIn, .signedOut, .tokenRefreshed].contains(state.event) {
                    apply(session: state.session)
                }
            }
        }
    }

    func bootstrap() async {
        // Cold-start hydration path used after launch and OAuth callback completion.
        isLoading = true
        let session = try? await SupabaseManager.shared.client.auth.session
        apply(session: session)
        await refreshEduVerification()
        await refreshProfile()
    }

    func signOut() async {
        isSigningOut = true
        defer { isSigningOut = false }
        await PushNotificationManager.shared.unregisterCurrentTokenIfPossible()
        do {
            try await SupabaseManager.shared.client.auth.signOut()
        } catch {
            // Ignore for now
        }
        eduVerified = nil
        schoolDomain = nil
        userEmail = nil
        userID = nil
        avatarURL = nil
        pendingBusinessLookupKey = nil
        clearLocalAppData()
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
        userEmail = session?.user.email
        userID = session?.user.id.uuidString
        isAuthenticated = session != nil
        isLoading = false

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

            enum CodingKeys: String, CodingKey {
                case eduVerified = "edu_verified"
                case schoolDomain = "schoolDomain"
            }
        }

        struct EduStatusAPI: Decodable {
            let verified: Bool?
            let schoolDomain: String?
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
        } catch {
            // fall back to profile check below
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
