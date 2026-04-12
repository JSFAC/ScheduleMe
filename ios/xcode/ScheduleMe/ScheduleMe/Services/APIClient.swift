// FILE OVERVIEW:
// Central network client used by app features to call backend APIs.
//
// DEBUG NOTES:
// If an endpoint fails, start here to inspect request build, auth headers, and response decoding.

import Foundation
import CryptoKit
import Security

// MARK: - HTTP Client

final class APIClient: NSObject, URLSessionDelegate {
    static let shared = APIClient()

    enum RequestCategory {
        case general
        case auth
        case payment
        case media
        case securityTelemetry
    }

    private let baseURL: URL
    private let alternateBaseURL: URL?
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = true
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()
    private let decoder = JSONDecoder.scheduleMe
    private let encoder = JSONEncoder.scheduleMe
    private let pinnedCertificateHashesByHost: [String: Set<String>] = [
        // SHA-256 DER certificate hashes (base64), refreshed on 2026-04-09.
        // Include leaf + intermediate hashes as backup pins for safer cert rotation.
        "www.usescheduleme.com": [
            "72CpCHtlFrQqwVm8JbmuAZ6wRsjAc0aeOwSTDSpLWlc=", // leaf (Let's Encrypt R12-issued)
            "Ex/Od4QBaJmloAIDqe/IDxjrvXVYBxftwVU1gJMINuw="  // intermediate R12
        ],
        "usescheduleme.com": [
            "DmDmsmFZEY5Pnk8huTrTewbM2B++UvOoZ3f+IZEVB3Y=", // leaf (Let's Encrypt R13-issued)
            "07EoIWqEP47xMhUB9d9Spd9Sk57iwZKXcSzT3k1Bk1Q="  // intermediate R13
        ],
        "imfrlykibvjdbijegdky.supabase.co": [
            "OYvM4tmVyyPLCSqTe1tYvZW0CKRfv4mre7EUA0eJrn0=", // leaf
            "HfwWBfutNY2LyET3bRUgP6ycpcGnn9SFf/ryhk++v5Y="  // Google Trust Services WE1 intermediate
        ]
    ]

    private override init() {
        let configuredBase = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? ""
        if let parsedURL = URL(string: configuredBase), parsedURL.host != nil {
            self.baseURL = parsedURL
        } else {
            #if DEBUG
            assertionFailure("API_BASE_URL is missing or invalid. Falling back to production base URL.")
            #endif
            self.baseURL = URL(string: "https://www.usescheduleme.com")!
        }
        if let host = self.baseURL.host?.lowercased() {
            if host == "www.usescheduleme.com" {
                self.alternateBaseURL = URL(string: "https://usescheduleme.com")
            } else if host == "usescheduleme.com" {
                self.alternateBaseURL = URL(string: "https://www.usescheduleme.com")
            } else {
                self.alternateBaseURL = nil
            }
        } else {
            self.alternateBaseURL = nil
        }
        super.init()
    }

    /// GET helper used for read-only endpoints.
    func get<T: Decodable>(
        path: String,
        queryItems: [URLQueryItem] = [],
        requiresAuth: Bool = true,
        category: RequestCategory? = nil
    ) async throws -> T {
        let resolvedCategory = category ?? requestCategory(for: path)
        let request = try await makeRequest(
            path: path,
            method: "GET",
            queryItems: queryItems,
            body: nil,
            requiresAuth: requiresAuth,
            category: resolvedCategory
        )
        return try await perform(request, category: resolvedCategory)
    }

    /// Generic JSON request helper used for POST/PATCH/DELETE flows.
    func send<T: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body,
        queryItems: [URLQueryItem] = [],
        requiresAuth: Bool = true,
        category: RequestCategory? = nil
    ) async throws -> T {
        let resolvedCategory = category ?? requestCategory(for: path)
        let requestBody = try encoder.encode(body)
        let request = try await makeRequest(
            path: path,
            method: method,
            queryItems: queryItems,
            body: requestBody,
            requiresAuth: requiresAuth,
            category: resolvedCategory
        )
        return try await perform(request, category: resolvedCategory)
    }

    /// Executes a prebuilt URLRequest over the pinned networking stack.
    func dataResponse(
        for request: URLRequest,
        requiresAuth: Bool = false,
        category: RequestCategory = .general
    ) async throws -> (Data, HTTPURLResponse) {
        var currentRequest = request
        if requiresAuth, currentRequest.value(forHTTPHeaderField: "Authorization") == nil {
            let bearer = try await SupabaseManager.shared.accessToken()
            currentRequest.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }

        let policy = retryPolicy(for: category)
        if currentRequest.timeoutInterval <= 0 {
            currentRequest.timeoutInterval = policy.timeout
        }

        var attempt = 0
        while true {
            do {
                let (data, response) = try await session.data(for: currentRequest)
                guard let http = response as? HTTPURLResponse else {
                    throw DataStoreError.server("The server returned an invalid response.")
                }

                if http.statusCode == 401,
                   currentRequest.value(forHTTPHeaderField: "Authorization")?.hasPrefix("Bearer ") == true,
                   let refreshed = try? await SupabaseManager.shared.forceRefreshAccessToken() {
                    currentRequest.setValue("Bearer \(refreshed)", forHTTPHeaderField: "Authorization")
                    let (retryData, retryResponse) = try await session.data(for: currentRequest)
                    guard let retryHTTP = retryResponse as? HTTPURLResponse else {
                        throw DataStoreError.server("The server returned an invalid response.")
                    }
                    return (retryData, retryHTTP)
                }

                if shouldRetryTransient(statusCode: http.statusCode),
                   attempt < (policy.maxAttempts - 1) {
                    attempt += 1
                    try? await Task.sleep(for: .milliseconds(backoffMillis(for: attempt, baseMillis: policy.backoffBaseMillis)))
                    continue
                }

                return (data, http)
            } catch {
                if isRetriableTransportError(error), attempt < (policy.maxAttempts - 1) {
                    attempt += 1
                    try? await Task.sleep(for: .milliseconds(backoffMillis(for: attempt, baseMillis: policy.backoffBaseMillis)))
                    continue
                }
                throw error
            }
        }
    }

    /// Builds URLRequest with query params + optional bearer auth.
    private func makeRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem],
        body: Data?,
        requiresAuth: Bool,
        category: RequestCategory
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
        request.timeoutInterval = retryPolicy(for: category).timeout
        if let bearer = bearer {
            request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body
        return request
    }

    /// Executes request and decodes typed response, surfacing backend `error` messages when available.
    private func perform<T: Decodable>(_ request: URLRequest, category: RequestCategory) async throws -> T {
        var currentRequest = request
        var (data, httpResponse) = try await dataResponse(for: currentRequest, category: category)

        if httpResponse.statusCode == 401,
           request.value(forHTTPHeaderField: "Authorization")?.hasPrefix("Bearer ") == true,
           let refreshedToken = try? await SupabaseManager.shared.forceRefreshAccessToken() {
            var retry = currentRequest
            retry.setValue("Bearer \(refreshedToken)", forHTTPHeaderField: "Authorization")
            (data, httpResponse) = try await dataResponse(for: retry, category: category)
            currentRequest = retry
        }

        if !(200..<300).contains(httpResponse.statusCode),
           shouldRetryOnAlternateHost(data: data, statusCode: httpResponse.statusCode),
           let failoverRequest = requestBySwitchingToAlternateHost(currentRequest) {
            (data, httpResponse) = try await dataResponse(for: failoverRequest, category: category)
            currentRequest = failoverRequest
        }

        if !(200..<300).contains(httpResponse.statusCode),
           httpResponse.statusCode == 401,
           currentRequest.value(forHTTPHeaderField: "Authorization")?.hasPrefix("Bearer ") == true,
           let refreshedToken = try? await SupabaseManager.shared.forceRefreshAccessToken() {
            var retry = currentRequest
            retry.setValue("Bearer \(refreshedToken)", forHTTPHeaderField: "Authorization")
            (data, httpResponse) = try await dataResponse(for: retry, category: category)
            currentRequest = retry
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw makeServerError(data: data, statusCode: httpResponse.statusCode)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            // Some backend edges return HTTP 200 with an `{ error: ... }` payload.
            // Treat that as a retriable server issue instead of a decode failure.
            let serverMessage = extractServerMessage(from: data)
            if !serverMessage.isEmpty,
               shouldRetryOnAlternateHost(data: data, statusCode: httpResponse.statusCode),
               let failoverRequest = requestBySwitchingToAlternateHost(currentRequest) {
                let (fallbackData, fallbackHTTP) = try await dataResponse(for: failoverRequest, category: category)
                guard (200..<300).contains(fallbackHTTP.statusCode) else {
                    throw makeServerError(data: fallbackData, statusCode: fallbackHTTP.statusCode)
                }
                do {
                    return try decoder.decode(T.self, from: fallbackData)
                } catch {
                    let fallbackMessage = extractServerMessage(from: fallbackData)
                    if !fallbackMessage.isEmpty {
                        throw DataStoreError.server(fallbackMessage)
                    }
                    throw error
                }
            }
            if !serverMessage.isEmpty {
                throw DataStoreError.server(serverMessage)
            }
            throw error
        }
    }

    private func requestBySwitchingToAlternateHost(_ request: URLRequest) -> URLRequest? {
        guard let alternateBaseURL,
              let sourceURL = request.url,
              let sourceComponents = URLComponents(url: sourceURL, resolvingAgainstBaseURL: false),
              let sourceHost = sourceComponents.host?.lowercased(),
              let primaryHost = baseURL.host?.lowercased(),
              sourceHost == primaryHost else {
            return nil
        }

        guard var alternateComponents = URLComponents(url: alternateBaseURL, resolvingAgainstBaseURL: false) else {
            return nil
        }
        alternateComponents.path = sourceComponents.path
        alternateComponents.queryItems = sourceComponents.queryItems
        alternateComponents.percentEncodedQuery = sourceComponents.percentEncodedQuery
        alternateComponents.fragment = sourceComponents.fragment
        guard let alternateURL = alternateComponents.url else { return nil }

        var fallback = request
        fallback.url = alternateURL
        return fallback
    }

    private func shouldRetryOnAlternateHost(data: Data, statusCode: Int) -> Bool {
        guard alternateBaseURL != nil else { return false }
        if [500, 502, 503, 504].contains(statusCode) { return true }
        let message = extractServerMessage(from: data).lowercased()
        if message.contains("rate limiting service unavailable") { return true }
        if message.contains("rate limiter unavailable") { return true }
        return false
    }

    private func extractServerMessage(from data: Data) -> String {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return "" }
        return (json["error"] as? String) ?? (json["message"] as? String) ?? ""
    }

    private func validatedHTTPResponse(_ response: URLResponse) throws -> HTTPURLResponse {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DataStoreError.server("The server returned an invalid response.")
        }
        return httpResponse
    }

    private func makeServerError(data: Data, statusCode: Int) -> DataStoreError {
        let message = extractServerMessage(from: data)
        if !message.isEmpty {
            return .server(message)
        }
        return .server("Request failed with status \(statusCode).")
    }

    private func requestCategory(for path: String) -> RequestCategory {
        let normalized = path.lowercased()
        if normalized.contains("auth") || normalized.contains("password-reset") || normalized.contains("password_reset") {
            return .auth
        }
        if normalized.contains("stripe") || normalized.contains("payment") || normalized.contains("checkout") || normalized.contains("apple-pay") {
            return .payment
        }
        if normalized.contains("media") || normalized.contains("upload") || normalized.contains("image") {
            return .media
        }
        if normalized.contains("security-event") {
            return .securityTelemetry
        }
        return .general
    }

    private func retryPolicy(for category: RequestCategory) -> (maxAttempts: Int, backoffBaseMillis: Int, timeout: TimeInterval) {
        switch category {
        case .auth:
            return (maxAttempts: 4, backoffBaseMillis: 250, timeout: 15)
        case .payment:
            return (maxAttempts: 4, backoffBaseMillis: 300, timeout: 20)
        case .media:
            return (maxAttempts: 3, backoffBaseMillis: 220, timeout: 18)
        case .securityTelemetry:
            return (maxAttempts: 2, backoffBaseMillis: 200, timeout: 8)
        case .general:
            return (maxAttempts: 3, backoffBaseMillis: 200, timeout: 12)
        }
    }

    private func backoffMillis(for attempt: Int, baseMillis: Int) -> Int {
        let exponent = max(0, min(4, attempt - 1))
        let factor = 1 << exponent
        return baseMillis * factor
    }

    private func shouldRetryTransient(statusCode: Int) -> Bool {
        if statusCode == 408 || statusCode == 425 || statusCode == 429 { return true }
        if (500...599).contains(statusCode) { return true }
        return false
    }

    private func isRetriableTransportError(_ error: Error) -> Bool {
        guard let urlError = error as? URLError else { return false }
        switch urlError.code {
        case .timedOut, .cannotFindHost, .cannotConnectToHost, .networkConnectionLost, .notConnectedToInternet, .dnsLookupFailed:
            return true
        default:
            return false
        }
    }

    // MARK: - TLS Certificate Pinning

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        let host = challenge.protectionSpace.host.lowercased()
        guard let pinnedHashes = pinnedCertificateHashesByHost[host], !pinnedHashes.isEmpty else {
            completionHandler(.performDefaultHandling, nil)
            return
        }

        guard SecTrustEvaluateWithError(trust, nil) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        guard let certificateChain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
              !certificateChain.isEmpty else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        var chainHashes = Set<String>()
        for cert in certificateChain {
            let certData = SecCertificateCopyData(cert) as Data
            let hash = Data(SHA256.hash(data: certData)).base64EncodedString()
            chainHashes.insert(hash)
        }

        if !pinnedHashes.isDisjoint(with: chainHashes) {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}
