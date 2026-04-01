import Foundation
import Combine
import Supabase
import Auth
import PostgREST

@MainActor
final class AppState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var isLoading: Bool = true
    @Published var eduVerified: Bool? = nil
    @Published var userEmail: String? = nil
    @Published var userID: String? = nil

    private var authTask: Task<Void, Never>?

    init() {
        authTask = Task {
            for await state in SupabaseManager.shared.client.auth.authStateChanges {
                if [.initialSession, .signedIn, .signedOut, .tokenRefreshed].contains(state.event) {
                    apply(session: state.session)
                }
            }
        }
    }

    func bootstrap() async {
        isLoading = true
        let session = try? await SupabaseManager.shared.client.auth.session
        apply(session: session)
        await refreshEduVerification()
    }

    func signOut() async {
        do {
            try await SupabaseManager.shared.client.auth.signOut()
        } catch {
            // Ignore for now
        }
        eduVerified = nil
    }

    func handleIncomingURL(_ url: URL) {
        SupabaseManager.shared.handle(url)
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            await bootstrap()
        }
    }

    private func apply(session: Session?) {
        userEmail = session?.user.email
        userID = session?.user.id.uuidString
        isAuthenticated = session != nil
        isLoading = false

        if session != nil {
            eduVerified = nil
            Task { await refreshEduVerification() }
        } else {
            eduVerified = nil
        }
    }

    func refreshEduVerification() async {
        guard let userID else {
            eduVerified = nil
            return
        }

        struct EduStatus: Decodable {
            let eduVerified: Bool?

            enum CodingKeys: String, CodingKey {
                case eduVerified = "edu_verified"
            }
        }

        do {
            let response: PostgrestResponse<EduStatus> = try await SupabaseManager.shared.client
                .from("profiles")
                .select("edu_verified")
                .eq("id", value: userID)
                .single()
                .execute()
            eduVerified = response.value.eduVerified ?? false
        } catch {
            eduVerified = false
        }
    }

    deinit {
        authTask?.cancel()
    }
}
