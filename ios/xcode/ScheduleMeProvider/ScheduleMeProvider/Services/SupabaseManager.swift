// FILE OVERVIEW:
// Singleton bootstrap for Supabase client configuration and shared auth access.
//
// DEBUG NOTES:
// If auth/session refresh breaks, confirm keys and singleton initialization path.

import Foundation
import Supabase

// MARK: - Supabase Bootstrap

final class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient
    let redirectURL: URL

    private init() {
        let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
        let configuredRedirect = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_REDIRECT_URL") as? String
        let appScheme = (Bundle.main.object(forInfoDictionaryKey: "APP_URL_SCHEME") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let defaultRedirect = ((appScheme?.isEmpty == false ? appScheme : nil) ?? "schedulemeprovider") + "://auth/callback"
        let redirectString = configuredRedirect?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
            ? (configuredRedirect ?? defaultRedirect)
            : defaultRedirect

        let supabaseURL = URL(string: urlString) ?? URL(string: "https://imfrlykibvjdbijegdky.supabase.co")!
        if URL(string: urlString) == nil {
            #if DEBUG
            assertionFailure("SUPABASE_URL is invalid. Falling back to default project URL.")
            #endif
        }

        let redirectURL = URL(string: redirectString) ?? URL(string: defaultRedirect)!
        if URL(string: redirectString) == nil {
            #if DEBUG
            assertionFailure("SUPABASE_REDIRECT_URL is invalid. Falling back to \(defaultRedirect).")
            #endif
        }

        self.redirectURL = redirectURL
        client = SupabaseClient(
            supabaseURL: supabaseURL,
            supabaseKey: anonKey,
            options: .init(
                auth: .init(
                    redirectToURL: redirectURL,
                    flowType: .pkce,
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }

    /// Passes OAuth callback URL back into Supabase auth handler.
    func handle(_ url: URL) {
        client.handle(url)
    }

    /// Returns current JWT access token for authenticated API requests.
    func accessToken() async throws -> String {
        try await client.auth.session.accessToken
    }
}
