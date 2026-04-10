import Foundation
import Supabase

final class AppState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = true
    @Published var userEmail: String? = nil

    init() {
        Task { await bootstrap() }
    }

    @MainActor
    func bootstrap() async {
        isLoading = true
        do {
            let session = try await SupabaseManager.shared.client.auth.session
            userEmail = session.user.email
            isAuthenticated = true
        } catch {
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
