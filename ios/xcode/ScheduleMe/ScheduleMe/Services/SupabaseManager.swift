import Foundation
import Supabase

final class SupabaseManager {
    static let shared = SupabaseManager()

    let client: SupabaseClient
    let redirectURL: URL

    private init() {
        let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
        // Force the app redirect scheme to avoid falling back to Site URL.
        let redirectString = "scheduleme://auth/callback"

        guard let supabaseURL = URL(string: urlString) else {
            fatalError("SUPABASE_URL is invalid.")
        }
        guard let redirectURL = URL(string: redirectString) else {
            fatalError("SUPABASE_REDIRECT_URL is invalid.")
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

    func handle(_ url: URL) {
        client.handle(url)
    }

    func accessToken() async throws -> String {
        try await client.auth.session.accessToken
    }
}
