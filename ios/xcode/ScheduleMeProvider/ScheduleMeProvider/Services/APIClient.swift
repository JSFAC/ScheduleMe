// FILE OVERVIEW:
// Central network client used by app features to call backend APIs.
//
// DEBUG NOTES:
// If an endpoint fails, start here to inspect request build, auth headers, and response decoding.

import Foundation

// MARK: - HTTP Client

final class APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let decoder = JSONDecoder.scheduleMe
    private let encoder = JSONEncoder.scheduleMe

    private init() {
        let configuredBase = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? ""
        let normalizedBase = Self.normalizedHTTPSURLString(configuredBase)
        if let parsedURL = URL(string: normalizedBase), parsedURL.host != nil, parsedURL.scheme?.lowercased() == "https" {
            self.baseURL = parsedURL
        } else {
            #if DEBUG
            assertionFailure("API_BASE_URL is missing/invalid or not HTTPS. Falling back to production base URL.")
            #endif
            self.baseURL = URL(string: "https://www.usescheduleme.com")!
        }
    }

    private static func normalizedHTTPSURLString(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        if trimmed.hasPrefix("http://") { return "" }
        if trimmed.hasPrefix("https://") { return trimmed }
        return "https://\(trimmed)"
    }

    /// GET helper used for read-only endpoints.
    func get<T: Decodable>(
        path: String,
        queryItems: [URLQueryItem] = [],
        requiresAuth: Bool = true
    ) async throws -> T {
        let request = try await makeRequest(
            path: path,
            method: "GET",
            queryItems: queryItems,
            body: nil,
            requiresAuth: requiresAuth
        )
        return try await perform(request)
    }

    /// Generic JSON request helper used for POST/PATCH/DELETE flows.
    func send<T: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body,
        queryItems: [URLQueryItem] = [],
        requiresAuth: Bool = true
    ) async throws -> T {
        let requestBody = try encoder.encode(body)
        let request = try await makeRequest(
            path: path,
            method: method,
            queryItems: queryItems,
            body: requestBody,
            requiresAuth: requiresAuth
        )
        return try await perform(request)
    }

    func performRaw(
        _ request: URLRequest,
        category: NetworkRequestCategory = .standard
    ) async throws -> (Data, URLResponse) {
        try await SecureHTTPTransport.shared.data(for: request, category: category)
    }

    func reportSecurityEvent(
        _ event: String,
        metadata: [String: String] = [:]
    ) async {
        let payload = SecurityEventRequest(
            event: event,
            platform: "ios-provider",
            metadata: metadata
        )
        _ = try? await send(
            path: "/api/mobile-security-event",
            method: "POST",
            body: payload,
            requiresAuth: false
        ) as GenericSuccessResponse
    }

    /// Builds URLRequest with query params + optional bearer auth.
    private func makeRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem],
        body: Data?,
        requiresAuth: Bool
    ) async throws -> URLRequest {
        let cleanPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appendingPathComponent(cleanPath)
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw DataStoreError.invalidConfiguration("API URL is invalid.")
        }
        components.queryItems = queryItems.isEmpty ? nil : queryItems
        guard let finalURL = components.url else {
            throw DataStoreError.invalidConfiguration("API URL query is invalid.")
        }

        var bearer: String?
        if requiresAuth {
            bearer = try await SupabaseManager.shared.accessToken()
        }

        var request = URLRequest(url: finalURL)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ios-provider", forHTTPHeaderField: "X-Client-Platform")
        request.setValue(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown", forHTTPHeaderField: "X-Client-Version")
        if let bearer = bearer {
            request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body
        return request
    }

    /// Executes request and decodes typed response, surfacing backend `error` messages when available.
    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let category = NetworkRequestCategory.from(path: request.url?.path ?? "")
        let (data, response) = try await SecureHTTPTransport.shared.data(for: request, category: category)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DataStoreError.server("The server returned an invalid response.")
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let message =
                    (json["error"] as? String) ??
                    (json["message"] as? String) ??
                    (json["error_description"] as? String)
                if let message, !message.isEmpty {
                    throw DataStoreError.server(message)
                }
            }
            if let rawText = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
               !rawText.isEmpty {
                let normalized = rawText.replacingOccurrences(
                    of: "\\s+",
                    with: " ",
                    options: .regularExpression
                )
                let snippet = String(normalized.prefix(220))
                if snippet.localizedCaseInsensitiveContains("<html")
                    || snippet.localizedCaseInsensitiveContains("<!doctype") {
                    throw DataStoreError.server("Request failed with status \(httpResponse.statusCode). Server returned an HTML error page.")
                }
                throw DataStoreError.server(snippet)
            }
            throw DataStoreError.server("Request failed with status \(httpResponse.statusCode).")
        }

        return try decoder.decode(T.self, from: data)
    }
}

private struct SecurityEventRequest: Encodable {
    let event: String
    let platform: String
    let metadata: [String: String]
}

enum NetworkRequestCategory {
    case standard
    case auth
    case payment
    case media

    fileprivate static func from(path: String) -> NetworkRequestCategory {
        let lower = path.lowercased()
        if lower.contains("auth") || lower.contains("password-reset") || lower.contains("signup") {
            return .auth
        }
        if lower.contains("stripe") || lower.contains("payment") {
            return .payment
        }
        if lower.contains("media") || lower.contains("upload") {
            return .media
        }
        return .standard
    }
}

private struct NetworkRetryPolicy {
    let maxAttempts: Int
    let timeout: TimeInterval
    let baseDelayMs: UInt64
}

private final class SecureHTTPTransport: NSObject, URLSessionDelegate {
    static let shared = SecureHTTPTransport()

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.requestCachePolicy = .useProtocolCachePolicy
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 40
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private var pinnedCertificateData: [Data] {
        // Pinning-capable layer: when certs are bundled, they are enforced.
        // Keep empty by default to avoid runtime breakage until cert assets are added.
        guard let urls = Bundle.main.urls(forResourcesWithExtension: "cer", subdirectory: "PinnedCertificates") else {
            return []
        }
        return urls.compactMap { try? Data(contentsOf: $0) }
    }

    func data(
        for request: URLRequest,
        category: NetworkRequestCategory
    ) async throws -> (Data, URLResponse) {
        guard let url = request.url, url.scheme?.lowercased() == "https" else {
            throw DataStoreError.invalidConfiguration("Insecure request blocked. HTTPS is required.")
        }

        let policy = retryPolicy(for: category)
        var lastError: Error?

        for attempt in 1...policy.maxAttempts {
            var working = request
            working.timeoutInterval = policy.timeout
            do {
                let (data, response) = try await session.data(for: working)
                if let http = response as? HTTPURLResponse, shouldRetryStatus(http.statusCode), attempt < policy.maxAttempts {
                    let delay = policy.baseDelayMs * UInt64(attempt)
                    try? await Task.sleep(for: .milliseconds(Int(delay)))
                    continue
                }
                return (data, response)
            } catch {
                lastError = error
                if attempt < policy.maxAttempts, shouldRetry(error) {
                    let delay = policy.baseDelayMs * UInt64(attempt)
                    try? await Task.sleep(for: .milliseconds(Int(delay)))
                    continue
                }
                throw error
            }
        }

        throw lastError ?? DataStoreError.server("Network request failed.")
    }

    private func retryPolicy(for category: NetworkRequestCategory) -> NetworkRetryPolicy {
        switch category {
        case .auth:
            return .init(maxAttempts: 3, timeout: 12, baseDelayMs: 350)
        case .payment:
            return .init(maxAttempts: 3, timeout: 18, baseDelayMs: 450)
        case .media:
            return .init(maxAttempts: 2, timeout: 20, baseDelayMs: 300)
        case .standard:
            return .init(maxAttempts: 2, timeout: 15, baseDelayMs: 280)
        }
    }

    private func shouldRetry(_ error: Error) -> Bool {
        guard let urlError = error as? URLError else { return false }
        switch urlError.code {
        case .timedOut, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed, .notConnectedToInternet, .resourceUnavailable:
            return true
        default:
            return false
        }
    }

    private func shouldRetryStatus(_ statusCode: Int) -> Bool {
        statusCode == 429 || (500...599).contains(statusCode)
    }

    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else {
            return (.performDefaultHandling, nil)
        }

        // If no pinned certs are provided in bundle, use default trust behavior.
        let pinned = pinnedCertificateData
        guard !pinned.isEmpty else {
            return (.performDefaultHandling, nil)
        }

        let certificates: [SecCertificate]
        if #available(iOS 15.0, *) {
            certificates = (SecTrustCopyCertificateChain(trust) as? [SecCertificate]) ?? []
        } else {
            let count = SecTrustGetCertificateCount(trust)
            certificates = (0..<count).compactMap { SecTrustGetCertificateAtIndex(trust, $0) }
        }

        for cert in certificates {
            let certData = SecCertificateCopyData(cert) as Data
            if pinned.contains(certData) {
                return (.useCredential, URLCredential(trust: trust))
            }
        }
        return (.cancelAuthenticationChallenge, nil)
    }
}
