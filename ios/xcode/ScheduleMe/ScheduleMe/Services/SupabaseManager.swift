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
        // NOTE: SUPABASE_REDIRECT_URL cannot be read from xcconfig/Info.plist because
        // xcconfig treats `//` as a comment, which silently truncates `scheduleme://auth/callback`
        // to `scheduleme:`. The redirect URL is therefore hardcoded here using the app URL scheme.
        let appScheme = (Bundle.main.object(forInfoDictionaryKey: "APP_URL_SCHEME") as? String)
            ?? "scheduleme"
        let redirectURL = URL(string: "\(appScheme)://auth/callback")!

        let supabaseURL = URL(string: urlString) ?? URL(string: "https://imfrlykibvjdbijegdky.supabase.co")!
        if URL(string: urlString) == nil {
            #if DEBUG
            assertionFailure("SUPABASE_URL is invalid. Falling back to default project URL.")
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
