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
        let normalizedURLString = Self.normalizedHTTPSURLString(trimmedURLString)
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
        let normalizedAPIBase = Self.normalizedHTTPSURLString(configuredAPIBase.trimmingCharacters(in: .whitespacesAndNewlines))
        self.apiBaseURL = URL(string: normalizedAPIBase.isEmpty ? "https://www.usescheduleme.com" : normalizedAPIBase) ?? URL(string: "https://www.usescheduleme.com")!

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

    private static func normalizedHTTPSURLString(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        if trimmed.hasPrefix("http://") {
            #if DEBUG
            assertionFailure("Insecure HTTP URL is not allowed. Use HTTPS.")
            #endif
            return ""
        }
        if trimmed.hasPrefix("https://") { return trimmed }
        // xcconfig may provide host-only values; normalize to HTTPS.
        return "https://\(trimmed)"
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

        let payload = try JSONEncoder.scheduleMe.encode(
            MobileEmailAuthRequest(
                email: email,
                password: password,
                mode: isSignup ? "signup" : "login",
                client: "ios-provider"
            )
        )

        let endpoints = mobileAuthEndpoints()
        var lastError: Error?

        for endpoint in endpoints {
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("ios-provider", forHTTPHeaderField: "X-Client-Platform")
            request.setValue(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown", forHTTPHeaderField: "X-Client-Version")
            request.httpBody = payload

            do {
                let (data, response) = try await APIClient.shared.performRaw(request, category: .auth)
                guard let http = response as? HTTPURLResponse else {
                    throw DataStoreError.server("Invalid mobile auth response.")
                }

                let decoded = (try? JSONDecoder.scheduleMe.decode(MobileEmailAuthResponse.self, from: data))
                    ?? MobileEmailAuthResponse(accessToken: nil, refreshToken: nil, error: nil)

                guard (200..<300).contains(http.statusCode) else {
                    if let error = decoded.error, !error.isEmpty {
                        throw DataStoreError.server(error)
                    }
                    if
                        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                        let message = (json["message"] as? String) ?? (json["error_description"] as? String),
                        !message.isEmpty
                    {
                        throw DataStoreError.server(message)
                    }
                    throw DataStoreError.server("Email login failed (\(http.statusCode)).")
                }

                guard let accessToken = decoded.accessToken, let refreshToken = decoded.refreshToken else {
                    throw DataStoreError.server(decoded.error ?? "No auth session returned.")
                }

                _ = try await client.auth.setSession(accessToken: accessToken, refreshToken: refreshToken)
                return
            } catch {
                lastError = error
            }
        }

        throw lastError ?? DataStoreError.server("Email login is temporarily unavailable.")
    }

    func sendPasswordResetViaMobileAPI(email: String) async throws {
        struct MobilePasswordResetRequest: Encodable {
            let email: String
            let client: String
        }

        struct MobilePasswordResetResponse: Decodable {
            let ok: Bool?
            let error: String?
        }

        let payload = try JSONEncoder.scheduleMe.encode(
            MobilePasswordResetRequest(email: email, client: "ios-provider")
        )

        let endpoints = mobilePasswordResetEndpoints()
        var lastError: Error?

        for endpoint in endpoints {
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("ios-provider", forHTTPHeaderField: "X-Client-Platform")
            request.httpBody = payload

            do {
                let (data, response) = try await APIClient.shared.performRaw(request, category: .auth)
                guard let http = response as? HTTPURLResponse else {
                    throw DataStoreError.server("Invalid password reset response.")
                }

                let decoded = (try? JSONDecoder.scheduleMe.decode(MobilePasswordResetResponse.self, from: data))
                    ?? MobilePasswordResetResponse(ok: nil, error: nil)

                guard (200..<300).contains(http.statusCode) else {
                    if let error = decoded.error, !error.isEmpty {
                        throw DataStoreError.server(error)
                    }
                    if
                        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                        let message = (json["message"] as? String) ?? (json["error_description"] as? String) ?? (json["error"] as? String),
                        !message.isEmpty
                    {
                        throw DataStoreError.server(message)
                    }
                    throw DataStoreError.server("Password reset failed (\(http.statusCode)).")
                }

                return
            } catch {
                lastError = error
            }
        }

        throw lastError ?? DataStoreError.server("Unable to send password reset email right now.")
    }

    private func mobileAuthEndpoints() -> [URL] {
        let primary = apiBaseURL.appendingPathComponent("api/mobile-email-auth")
        guard let host = apiBaseURL.host?.lowercased() else { return [primary] }
        if host == "www.usescheduleme.com" {
            return [primary, URL(string: "https://usescheduleme.com/api/mobile-email-auth")!]
        }
        if host == "usescheduleme.com" {
            return [primary, URL(string: "https://www.usescheduleme.com/api/mobile-email-auth")!]
        }
        return [primary]
    }

    private func mobilePasswordResetEndpoints() -> [URL] {
        let primary = apiBaseURL.appendingPathComponent("api/mobile-password-reset")
        guard let host = apiBaseURL.host?.lowercased() else { return [primary] }
        if host == "www.usescheduleme.com" {
            return [primary, URL(string: "https://usescheduleme.com/api/mobile-password-reset")!]
        }
        if host == "usescheduleme.com" {
            return [primary, URL(string: "https://www.usescheduleme.com/api/mobile-password-reset")!]
        }
        return [primary]
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
            let (data, response) = try await APIClient.shared.performRaw(request, category: .auth)
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
