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
    private let supabaseURL: URL
    private let supabaseAnonKey: String
    @MainActor private var didPrewarmAuthPipeline = false

    private init() {
        let urlString = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? ""
        let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? ""
        let configuredAPIBase = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? ""
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

        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = anonKey
        self.redirectURL = redirectURL
        self.apiBaseURL = URL(string: configuredAPIBase.trimmingCharacters(in: .whitespacesAndNewlines)) ?? URL(string: "https://www.usescheduleme.com")!
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
        let session = try await client.auth.session
        let rawToken = session.accessToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawToken.isEmpty else {
            throw DataStoreError.unauthenticated
        }

        if shouldRefreshAccessToken(rawToken) {
            return try await forceRefreshAccessToken()
        }
        return rawToken
    }

    /// Forces a token refresh from Supabase refresh token storage.
    func forceRefreshAccessToken() async throws -> String {
        let refreshed = try await client.auth.refreshSession()
        let token = refreshed.accessToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            throw DataStoreError.unauthenticated
        }
        return token
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

        let payload = MobileEmailAuthRequest(
            email: email,
            password: password,
            mode: isSignup ? "signup" : "login",
            client: "ios-consumer"
        )

        let endpoints = mobileAuthEndpoints()
        var lastServerError: String?

        for endpoint in endpoints {
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder.scheduleMe.encode(payload)

            let (data, http) = try await APIClient.shared.dataResponse(
                for: request,
                requiresAuth: false,
                category: .auth
            )

            let decoded = (try? JSONDecoder.scheduleMe.decode(MobileEmailAuthResponse.self, from: data))
                ?? MobileEmailAuthResponse(accessToken: nil, refreshToken: nil, error: nil)

            if !(200..<300).contains(http.statusCode) {
                if let error = decoded.error, !error.isEmpty {
                    lastServerError = error
                } else {
                    lastServerError = "Email login failed (\(http.statusCode))."
                }
                // Try alternate host if available.
                continue
            }

            guard let accessToken = decoded.accessToken, let refreshToken = decoded.refreshToken else {
                throw DataStoreError.server(decoded.error ?? "No auth session returned.")
            }

            _ = try await client.auth.setSession(accessToken: accessToken, refreshToken: refreshToken)
            return
        }

        throw DataStoreError.server(lastServerError ?? "Email login is temporarily unavailable.")
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

    /// Sends password reset email for email/password users.
    /// Uses the hardened mobile API path first (same as provider app), then falls back to direct Supabase recover.
    func sendPasswordReset(email: String) async throws {
        do {
            try await sendPasswordResetViaMobileAPI(email: email)
            return
        } catch {
            // Fall back to direct recover if mobile API has a temporary outage.
        }

        struct PasswordResetRequest: Encodable {
            let email: String
            let redirectTo: String

            enum CodingKeys: String, CodingKey {
                case email
                case redirectTo = "redirect_to"
            }
        }

        struct PasswordResetErrorResponse: Decodable {
            let error: String?
            let msg: String?
            let message: String?
        }

        let endpoint = supabaseURL.appendingPathComponent("auth/v1/recover")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder.scheduleMe.encode(
            PasswordResetRequest(
                email: email,
                redirectTo: redirectURL.absoluteString
            )
        )

        let (data, http) = try await APIClient.shared.dataResponse(
            for: request,
            requiresAuth: false,
            category: .auth
        )
        guard (200..<300).contains(http.statusCode) else {
            let decoded = try? JSONDecoder.scheduleMe.decode(PasswordResetErrorResponse.self, from: data)
            let message = decoded?.msg ?? decoded?.message ?? decoded?.error
            throw DataStoreError.server(message ?? "Unable to send password reset email right now.")
        }
    }

    private func sendPasswordResetViaMobileAPI(email: String) async throws {
        struct MobilePasswordResetRequest: Encodable {
            let email: String
            let client: String
        }

        struct MobilePasswordResetResponse: Decodable {
            let ok: Bool?
            let error: String?
        }

        let payload = try JSONEncoder.scheduleMe.encode(
            MobilePasswordResetRequest(email: email, client: "ios-consumer")
        )
        let endpoints = mobilePasswordResetEndpoints()
        var lastError: Error?

        for endpoint in endpoints {
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("ios-consumer", forHTTPHeaderField: "X-Client-Platform")
            request.httpBody = payload

            do {
                let (data, http) = try await APIClient.shared.dataResponse(
                    for: request,
                    requiresAuth: false,
                    category: .auth
                )

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

    /// One-time background warm-up for auth-related network path to improve perceived sign-in speed.
    @MainActor
    func prewarmAuthPipelineIfNeeded(emailHint: String) {
        guard !didPrewarmAuthPipeline else { return }
        let normalized = emailHint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.contains("@"), normalized.count >= 5 else { return }
        didPrewarmAuthPipeline = true

        let apiURL = apiBaseURL.appendingPathComponent("api/mobile-email-auth")
        let supabaseHealthURL = supabaseURL.appendingPathComponent("auth/v1/health")

        Task.detached(priority: .utility) {
            var apiRequest = URLRequest(url: apiURL)
            apiRequest.httpMethod = "OPTIONS"
            apiRequest.timeoutInterval = 4
            _ = try? await APIClient.shared.dataResponse(
                for: apiRequest,
                requiresAuth: false,
                category: .auth
            )

            var supabaseRequest = URLRequest(url: supabaseHealthURL)
            supabaseRequest.httpMethod = "GET"
            supabaseRequest.timeoutInterval = 4
            _ = try? await APIClient.shared.dataResponse(
                for: supabaseRequest,
                requiresAuth: false,
                category: .auth
            )
        }
    }

    /// Returns true when JWT is near expiration (or malformed), so callers can refresh proactively.
    private func shouldRefreshAccessToken(_ jwt: String, leewaySeconds: TimeInterval = 90) -> Bool {
        guard let payload = jwtPayload(jwt),
              let exp = payload["exp"] as? TimeInterval else {
            return true
        }
        let now = Date().timeIntervalSince1970
        return exp <= (now + leewaySeconds)
    }

    private func jwtPayload(_ jwt: String) -> [String: Any]? {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var payload = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = payload.count % 4
        if remainder > 0 {
            payload += String(repeating: "=", count: 4 - remainder)
        }
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json
    }
}
