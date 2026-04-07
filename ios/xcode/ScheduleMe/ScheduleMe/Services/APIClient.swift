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
    private let session: URLSession
    private let decoder = JSONDecoder.scheduleMe
    private let encoder = JSONEncoder.scheduleMe

    private init() {
        let configuredBase = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? ""
        if let parsedURL = URL(string: configuredBase), parsedURL.host != nil {
            self.baseURL = parsedURL
        } else {
            #if DEBUG
            assertionFailure("API_BASE_URL is missing or invalid. Falling back to production base URL.")
            #endif
            self.baseURL = URL(string: "https://www.usescheduleme.com")!
        }
        self.session = .shared
    }

    /// GET helper used for read-only endpoints.
    func get<T: Decodable>(
        path: String,
        queryItems: [URLQueryItem] = [],
        requiresAuth: Bool = false
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
        requiresAuth: Bool = false
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
        if let bearer = bearer {
            request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body
        return request
    }

    /// Executes request and decodes typed response, surfacing backend `error` messages when available.
    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DataStoreError.server("The server returned an invalid response.")
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            if
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                let message = json["error"] as? String
            {
                throw DataStoreError.server(message)
            }
            throw DataStoreError.server("Request failed with status \(httpResponse.statusCode).")
        }

        return try decoder.decode(T.self, from: data)
    }
}
