import SwiftUI
import AuthenticationServices
import Supabase

struct AuthView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.webAuthenticationSession) var webAuthenticationSession
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorText: String? = nil

    var body: some View {
        ZStack {
            ScheduleMeTheme.pageBackground.ignoresSafeArea()

            // Dotted grid background
            DottedGrid()
                .opacity(0.18)
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 18) {
                    Spacer(minLength: 6)

                    // Logo
                    HStack(spacing: 0) {
                        Text("Schedule")
                            .font(.custom(ScheduleMeTheme.fontName, size: 28))
                            .fontWeight(.bold)
                            .foregroundColor(ScheduleMeTheme.titleText)
                        Text("Me")
                            .font(.custom(ScheduleMeTheme.fontName, size: 28))
                            .fontWeight(.bold)
                            .foregroundColor(ScheduleMeTheme.accent)
                    }

                    VStack(spacing: 8) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(ScheduleMeTheme.accent)
                                .frame(width: 5, height: 5)
                            Text("LOCAL SERVICES, DONE RIGHT")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11))
                                .fontWeight(.semibold)
                                .tracking(1.2)
                                .foregroundColor(ScheduleMeTheme.accent)
                        }

                        Text("Book trusted students,\nin seconds.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 28))
                            .fontWeight(.bold)
                            .foregroundColor(ScheduleMeTheme.titleText)
                            .multilineTextAlignment(.center)

                        Text("From stylists to photographers to home repair — ScheduleMe connects you with vetted local professionals and student service providers on campus. Browse, book, and pay in one place.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13))
                            .fontWeight(.medium)
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 8)
                    }

                    // Auth card
                    VStack(spacing: 14) {
                        VStack(spacing: 10) {
                            TextField("Email", text: $email)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(12)
                                .background(Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder, lineWidth: 1))

                            SecureField("Password", text: $password)
                                .textInputAutocapitalization(.never)
                                .padding(12)
                                .background(Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder, lineWidth: 1))
                        }

                        if let errorText {
                            Text(errorText)
                                .font(.caption)
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                        }

                        Button(action: signInWithEmail) {
                            Text(isLoading ? "Signing in..." : "Continue with Email")
                                .font(.custom(ScheduleMeTheme.fontName, size: 14))
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .foregroundColor(.white)
                                .background(ScheduleMeTheme.accent)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .disabled(isLoading)

                        Text("or")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12))
                            .foregroundColor(ScheduleMeTheme.mutedText)

                        VStack(spacing: 10) {
                            Button(action: { signInWithOAuth(.apple) }) {
                                HStack(spacing: 10) {
                                    Image(systemName: "apple.logo")
                                    Text("Continue with Apple")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14))
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .foregroundColor(.white)
                                .background(Color.black)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .disabled(isLoading)

                            Button(action: { signInWithOAuth(.google) }) {
                                HStack(spacing: 10) {
                                    Image(systemName: "globe")
                                    Text("Continue with Google")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14))
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .foregroundColor(ScheduleMeTheme.titleText)
                                .background(Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder, lineWidth: 1))
                            }
                            .disabled(isLoading)
                        }
                    }
                    .padding(18)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .shadow(color: Color.black.opacity(0.06), radius: 14, x: 0, y: 8)
                    .padding(.horizontal, 20)

                    Spacer(minLength: 24)
                }
                .padding(.top, 8)
            }
        }
    }

    private func signInWithEmail() {
        errorText = nil
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                try await SupabaseManager.shared.client.auth.signIn(email: email, password: password)
                await appState.bootstrap()
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    private func signInWithOAuth(_ provider: Provider) {
        errorText = nil
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                guard let callbackScheme = SupabaseManager.shared.redirectURL.scheme else {
                    throw DataStoreError.invalidConfiguration("SUPABASE_REDIRECT_URL is missing a URL scheme.")
                }
                try await SupabaseManager.shared.client.auth.signInWithOAuth(
                    provider: provider,
                    redirectTo: SupabaseManager.shared.redirectURL,
                    launchFlow: { @MainActor url in
                        try await webAuthenticationSession.authenticate(
                            using: url,
                            callbackURLScheme: callbackScheme
                        )
                    }
                )
                await appState.bootstrap()
            } catch {
                errorText = error.localizedDescription
            }
        }
    }
}
