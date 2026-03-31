import Foundation

final class APIClient {
    static let shared = APIClient()

    private let baseURL: URL

    private init() {
        let base = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? ""
        self.baseURL = URL(string: base)!
    }

    func makeRequest(path: String, method: String = "GET", body: Data? = nil, bearer: String? = nil) -> URLRequest {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let bearer = bearer {
            request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body
        return request
    }
}
