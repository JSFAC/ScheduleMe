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

        let trimmedURLString = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedURLString: String
        if trimmedURLString.hasPrefix("http://") || trimmedURLString.hasPrefix("https://") {
            normalizedURLString = trimmedURLString
        } else if !trimmedURLString.isEmpty {
            // xcconfig treats '//' as comments, so host-only values are supported here.
            normalizedURLString = "https://\(trimmedURLString)"
        } else {
            normalizedURLString = ""
        }
        guard !normalizedURLString.isEmpty, let supabaseURL = URL(string: normalizedURLString) else {
            preconditionFailure("Missing or invalid SUPABASE_URL. Set it in Config.local.xcconfig (host or full URL).")
        }

        let trimmedAnonKey = anonKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedAnonKey.isEmpty else {
            preconditionFailure("Missing SUPABASE_ANON_KEY. Set it in Config.local.xcconfig.")
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
            supabaseKey: trimmedAnonKey,
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
