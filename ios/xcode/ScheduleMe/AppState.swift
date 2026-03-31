import Foundation
import Combine

final class AppState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = true
    @Published var userEmail: String? = nil

    private var cancellables = Set<AnyCancellable>()

    init() {
        Task { await bootstrap() }
    }

    @MainActor
    func bootstrap() async {
        isLoading = true
        let session = try? await SupabaseManager.shared.client.auth.session
        if let session = session {
            userEmail = session.user.email
            isAuthenticated = true
        } else {
            isAuthenticated = false
        }
        isLoading = false
    }

    @MainActor
    func signOut() async {
        do {
            try await SupabaseManager.shared.client.auth.signOut()
            userEmail = nil
            isAuthenticated = false
        } catch {
            // Ignore for now
        }
    }
}
