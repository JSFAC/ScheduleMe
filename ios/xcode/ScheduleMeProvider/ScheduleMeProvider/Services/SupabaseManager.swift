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
    private let apiBaseURL: URL
    private let authSettingsURL: URL
    private let anonKey: String

    private init() {
        let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
        let configuredRedirect = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_REDIRECT_URL") as? String
        let configuredAPIBase = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? ""
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
        self.anonKey = trimmedAnonKey

        let redirectURL = URL(string: redirectString) ?? URL(string: defaultRedirect)!
        if URL(string: redirectString) == nil {
            #if DEBUG
            assertionFailure("SUPABASE_REDIRECT_URL is invalid. Falling back to \(defaultRedirect).")
            #endif
        }
        self.authSettingsURL = supabaseURL.appendingPathComponent("auth/v1/settings")
        self.apiBaseURL = URL(string: configuredAPIBase.trimmingCharacters(in: .whitespacesAndNewlines)) ?? URL(string: "https://www.usescheduleme.com")!

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

    func signInViaMobileEmailAuth(email: String, password: String, isSignup: Bool = false) async throws {
        struct MobileEmailAuthRequest: Encodable {
            let email: String
            let password: String
            let mode: String
            let client: String
        }

        struct MobileEmailAuthResponse: Decodable {
            let accessToken: String?
            let refreshToken: String?
            let error: String?

            enum CodingKeys: String, CodingKey {
                case accessToken = "access_token"
                case refreshToken = "refresh_token"
                case error
            }
        }

        let endpoint = apiBaseURL.appendingPathComponent("api/mobile-email-auth")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder.scheduleMe.encode(
            MobileEmailAuthRequest(
                email: email,
                password: password,
                mode: isSignup ? "signup" : "login",
                client: "ios-provider"
            )
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw DataStoreError.server("Invalid mobile auth response.")
        }

        let decoded = (try? JSONDecoder.scheduleMe.decode(MobileEmailAuthResponse.self, from: data))
            ?? MobileEmailAuthResponse(accessToken: nil, refreshToken: nil, error: nil)

        guard (200..<300).contains(http.statusCode) else {
            if let error = decoded.error, !error.isEmpty {
                throw DataStoreError.server(error)
            }
            throw DataStoreError.server("Email login failed (\(http.statusCode)).")
        }

        guard let accessToken = decoded.accessToken, let refreshToken = decoded.refreshToken else {
            throw DataStoreError.server(decoded.error ?? "No auth session returned.")
        }

        _ = try await client.auth.setSession(accessToken: accessToken, refreshToken: refreshToken)
    }

    /// Lightweight preflight so OAuth buttons can fail gracefully when a provider is disabled upstream.
    /// If this check cannot run (offline/server issue), we fail open and allow sign-in to proceed.
    func isOAuthProviderEnabled(_ provider: Provider) async -> Bool {
        struct SettingsResponse: Decodable {
            let external: [String: Bool]
        }

        guard let providerKey = providerKey(provider) else { return true }
        var request = URLRequest(url: authSettingsURL)
        request.httpMethod = "GET"
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return true
            }
            let settings = try JSONDecoder().decode(SettingsResponse.self, from: data)
            return settings.external[providerKey] ?? true
        } catch {
            return true
        }
    }

    private func providerKey(_ provider: Provider) -> String? {
        switch provider {
        // Supabase settings currently report Twitter provider under `twitter`.
        case .x:
            return "twitter"
        default:
            return provider.rawValue
        }
    }
}
