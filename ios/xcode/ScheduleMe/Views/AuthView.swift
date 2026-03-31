import SwiftUI

struct AuthView: View {
    @EnvironmentObject var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var errorMsg: String? = nil
    @State private var loading = false

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("ScheduleMe")
                .font(.largeTitle).bold()
            Text("Sign in to continue")
                .foregroundColor(.secondary)

            VStack(spacing: 12) {
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textFieldStyle(.roundedBorder)
                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
            }
            .padding(.horizontal, 24)

            if let errorMsg = errorMsg {
                Text(errorMsg)
                    .foregroundColor(.red)
                    .font(.footnote)
            }

            Button {
                Task { await signIn() }
            } label: {
                HStack {
                    if loading { ProgressView() }
                    Text("Continue")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color(red: 0/255, green: 126/255, blue: 109/255))
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .padding(.horizontal, 24)
            .disabled(loading || email.isEmpty || password.isEmpty)

            Divider().padding(.horizontal, 24)

            VStack(spacing: 10) {
                Button("Continue with Apple") {
                    // TODO: Sign in with Apple
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.black)
                .foregroundColor(.white)
                .cornerRadius(10)

                Button("Continue with Google") {
                    // TODO: Google OAuth
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(Color.white)
                .foregroundColor(.black)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.gray.opacity(0.3)))
            }
            .padding(.horizontal, 24)

            Spacer()
        }
    }

    @MainActor
    private func signIn() async {
        errorMsg = nil
        loading = true
        do {
            let _ = try await SupabaseManager.shared.client.auth.signIn(email: email, password: password)
            await appState.bootstrap()
        } catch {
            errorMsg = "Login failed. Check your credentials."
        }
        loading = false
    }
}
