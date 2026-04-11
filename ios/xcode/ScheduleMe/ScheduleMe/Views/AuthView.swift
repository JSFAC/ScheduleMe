// FILE OVERVIEW:
// Consumer onboarding-auth flow (landing, login, signup, social providers).
//
// DEBUG NOTES:
// If sign-in UX/state transitions break, debug tab mode + submit handlers in this file.

import SwiftUI
import AuthenticationServices
import Supabase

private enum ConsumerAuthTheme {
    static let bg = ScheduleMeTheme.pageBackground
    static let surface = ScheduleMeTheme.surface
    // Keep mode toggle container aligned with auth card surface (avoid blue tint mismatch in dark mode).
    static let surfaceSoft = ScheduleMeTheme.surface
    static let border = ScheduleMeTheme.cardBorder
    static let accent = ScheduleMeTheme.accent
    static let textPrimary = ScheduleMeTheme.titleText
    static let textSub = ScheduleMeTheme.mutedText
    static let fontName = ScheduleMeTheme.fontName
    static let surfaceShadow = Color.dynamic(light: Color.black.opacity(0.08), dark: Color.black.opacity(0.24))
}

struct AuthView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.webAuthenticationSession) var webAuthenticationSession

    @State private var step: AuthStep = .welcome
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorText: String?
    @State private var infoText: String?

    enum AuthStep: Hashable { case welcome, login, signup }

    var body: some View {
        ZStack {
            ConsumerAuthTheme.bg.ignoresSafeArea()
            DottedGrid(spacing: 20, dotSize: 1.6, color: Color(hex: "C5CCD4"))
                .opacity(0.16)
                .ignoresSafeArea()

            switch step {
            case .welcome:
                ConsumerWelcomeFlow(step: $step)
                    .transition(.opacity)
            case .login, .signup:
                ConsumerAuthForm(
                    step: $step,
                    email: $email,
                    password: $password,
                    isLoading: $isLoading,
                    errorText: $errorText,
                    infoText: $infoText,
                    onEmailAuth: { signInWithEmail(isLogin: step == .login) },
                    onForgotPassword: { sendPasswordReset() },
                    onApple: { signInWithOAuth(.apple) },
                    onGoogle: { signInWithOAuth(.google) }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.38, dampingFraction: 0.88), value: step)
        .onChange(of: step) { _, _ in
            errorText = nil
            infoText = nil
        }
    }

    // MARK: - Auth Actions

    /// Handles email/password login or signup depending on current form mode.
    private func signInWithEmail(isLogin: Bool) {
        errorText = nil
        infoText = nil
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if isLogin {
                    do {
                        // Prefer mobile auth endpoint first; it is configured to avoid
                        // CAPTCHA-dependent failures that can occur in native signIn flow.
                        try await SupabaseManager.shared.signInViaMobileEmailAuth(
                            email: normalizedEmail,
                            password: password,
                            isSignup: false
                        )
                    } catch {
                        // Fallback path for temporary mobile endpoint issues.
                        try await SupabaseManager.shared.client.auth.signIn(email: normalizedEmail, password: password)
                    }
                    try await assertSignedInEmailMatches(normalizedEmail)
                    appState.setAuthMethodHint("email")
                } else {
                    do {
                        try await SupabaseManager.shared.client.auth.signUp(email: normalizedEmail, password: password)
                    } catch {
                        if shouldUseMobileEmailFallback(for: error) {
                            try await SupabaseManager.shared.signInViaMobileEmailAuth(
                                email: normalizedEmail,
                                password: password,
                                isSignup: true
                            )
                        } else {
                            throw error
                        }
                    }
                }
                await appState.bootstrap(context: .signingIn)
            } catch {
                errorText = userFacingAuthError(error)
            }
        }
    }

    private func sendPasswordReset() {
        errorText = nil
        infoText = nil
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalizedEmail.isEmpty else {
            errorText = "Enter your email first, then tap Forgot password."
            return
        }
        guard normalizedEmail.contains("@"), normalizedEmail.contains(".") else {
            errorText = "Enter a valid email address."
            return
        }

        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                try await SupabaseManager.shared.sendPasswordReset(email: normalizedEmail)
                infoText = "Password reset email sent. Check your inbox and spam folder."
            } catch {
                errorText = userFacingAuthError(error)
            }
        }
    }

    /// Starts OAuth provider flow (Apple/Google) and reboots app session state on success.
    private func signInWithOAuth(_ provider: Provider) {
        errorText = nil
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                guard let callbackScheme = SupabaseManager.shared.redirectURL.scheme else {
                    throw DataStoreError.invalidConfiguration("SUPABASE_REDIRECT_URL is missing a URL scheme.")
                }
                let queryParams: [(name: String, value: String?)] = provider == .google
                    ? [(name: "prompt", value: "select_account")]
                    : []
                try await SupabaseManager.shared.client.auth.signInWithOAuth(
                    provider: provider,
                    redirectTo: SupabaseManager.shared.redirectURL,
                    queryParams: queryParams,
                    launchFlow: { @MainActor url in
                        let useEphemeral = provider != .google
                        return try await authenticateEphemeral(url: url, callbackScheme: callbackScheme, prefersEphemeral: useEphemeral)
                    }
                )
                appState.setAuthMethodHint(provider == .apple ? "apple" : "google")
                await appState.bootstrap(context: .signingIn)
            } catch {
                errorText = error.localizedDescription
            }
        }
    }

    /// ASWebAuthenticationSession helper used by Supabase OAuth launchFlow closure.
    @MainActor
    private func authenticateEphemeral(url: URL, callbackScheme: String, prefersEphemeral: Bool) async throws -> URL {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: DataStoreError.server("Missing callback URL."))
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session.prefersEphemeralWebBrowserSession = prefersEphemeral
            session.presentationContextProvider = WebAuthPresentationProvider.shared
            session.start()
        }
    }

    private func userFacingAuthError(_ error: Error) -> String {
        let raw = (error as NSError).localizedDescription
        if raw.localizedCaseInsensitiveContains("captcha") {
            return "Email login is blocked by a security challenge. Use Apple/Google for now or try again shortly."
        }
        return raw
    }

    private func shouldUseMobileEmailFallback(for error: Error) -> Bool {
        let raw = (error as NSError).localizedDescription.lowercased()
        return raw.contains("captcha")
    }

    private func assertSignedInEmailMatches(_ normalizedEmail: String) async throws {
        let session = try await SupabaseManager.shared.client.auth.session
        let activeEmail = (session.user.email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !activeEmail.isEmpty, activeEmail == normalizedEmail else {
            try? await SupabaseManager.shared.client.auth.signOut()
            throw DataStoreError.server("Sign-in safety check failed. Please sign in again.")
        }
    }
}

private struct ConsumerWelcomePage: Hashable {
    let icon: String
    let eyebrow: String
    let title: String
    let body: String
}

private struct ConsumerWelcomeFlow: View {
    @Binding var step: AuthView.AuthStep
    @State private var page = 0
    @State private var hasUnlockedAuthButtons = false

    private let pages: [ConsumerWelcomePage] = [
        .init(
            icon: "graduationcap.fill",
            eyebrow: "Campus first",
            title: "Book trusted students,\nin seconds.",
            body: "Find vetted local pros and student providers on campus with transparent pricing and easy booking."
        ),
        .init(
            icon: "checkmark.shield.fill",
            eyebrow: "Safer payments",
            title: "Protected checkout,\nclear totals.",
            body: "Pay on-platform with Stripe and see your full total before confirming every booking."
        ),
        .init(
            icon: "message.fill",
            eyebrow: "Stay in sync",
            title: "Message providers\nwithout friction.",
            body: "Keep updates, confirmations, and booking details in one clean thread."
        )
    ]

    var body: some View {
        GeometryReader { proxy in
            let isCompactHeight = proxy.size.height < 760
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    Spacer(minLength: isCompactHeight ? 20 : 40)

                    HStack(spacing: 0) {
                        Text("Schedule")
                            .font(.custom(ConsumerAuthTheme.fontName, size: isCompactHeight ? 26 : 30).weight(.bold))
                            .foregroundColor(ConsumerAuthTheme.textPrimary)
                        Text("Me")
                            .font(.custom(ConsumerAuthTheme.fontName, size: isCompactHeight ? 26 : 30).weight(.bold))
                            .foregroundColor(ConsumerAuthTheme.accent)
                    }

                    TabView(selection: $page) {
                        ForEach(Array(pages.enumerated()), id: \.offset) { index, item in
                            ConsumerWelcomePageView(page: item, compact: isCompactHeight)
                                .tag(index)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .frame(height: isCompactHeight ? 268 : 300)
                    .padding(.top, isCompactHeight ? 12 : 18)

                    if hasUnlockedAuthButtons {
                        HStack(spacing: 10) {
                            AuthActionButton(label: "Log in", style: .outline) { step = .login }
                            AuthActionButton(label: "Create account", style: .filled) { step = .signup }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, isCompactHeight ? 20 : 26)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                    } else {
                        Text("Swipe to continue")
                            .font(.custom(ConsumerAuthTheme.fontName, size: 12).weight(.semibold))
                            .foregroundColor(ConsumerAuthTheme.textSub)
                            .padding(.top, isCompactHeight ? 20 : 30)
                            .transition(.opacity)
                    }

                    HStack(spacing: 8) {
                        ForEach(0..<pages.count, id: \.self) { i in
                            Circle()
                                .fill(i == page ? ConsumerAuthTheme.accent : ConsumerAuthTheme.border.opacity(0.65))
                                .frame(width: i == page ? 8 : 6, height: i == page ? 8 : 6)
                        }
                    }
                    .padding(.top, 16)

                    Button("Are you a provider? Log in here →") {
                        openProviderApp()
                    }
                    .font(.custom(ConsumerAuthTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(ConsumerAuthTheme.accent)
                    .padding(.top, 12)

                    Spacer(minLength: isCompactHeight ? 18 : 24)
                }
                .frame(minHeight: proxy.size.height)
            }
        }
        .onAppear {
            if page == pages.count - 1 {
                hasUnlockedAuthButtons = true
            }
        }
        .onChange(of: page) { _, newPage in
            if newPage == pages.count - 1 {
                hasUnlockedAuthButtons = true
            }
        }
    }

    /// Opens the provider app via deep-link and falls back to provider web signup/login.
    private func openProviderApp() {
        guard let providerDeepLink = URL(string: "schedulemeprovider://auth/callback") else { return }
        UIApplication.shared.open(providerDeepLink, options: [:]) { accepted in
            guard !accepted else { return }
            if let fallback = URL(string: "https://usescheduleme.com/business") {
                UIApplication.shared.open(fallback)
            }
        }
    }
}

private struct ConsumerWelcomePageView: View {
    let page: ConsumerWelcomePage
    let compact: Bool

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(ConsumerAuthTheme.accent.opacity(0.12))
                    .frame(width: compact ? 82 : 92, height: compact ? 82 : 92)
                Circle()
                    .stroke(ConsumerAuthTheme.accent.opacity(0.25), lineWidth: 1)
                    .frame(width: compact ? 82 : 92, height: compact ? 82 : 92)
                Image(systemName: page.icon)
                    .font(.system(size: compact ? 30 : 34, weight: .medium))
                    .foregroundColor(ConsumerAuthTheme.accent)
            }
            .padding(.bottom, compact ? 16 : 24)

            VStack(spacing: 8) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(ConsumerAuthTheme.accent)
                        .frame(width: 4, height: 4)
                    Text(page.eyebrow.uppercased())
                        .font(.custom(ConsumerAuthTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.6)
                        .foregroundColor(ConsumerAuthTheme.accent)
                }

                Text(page.title)
                    .font(.custom(ConsumerAuthTheme.fontName, size: compact ? 28 : 32).weight(.bold))
                    .foregroundColor(ConsumerAuthTheme.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .minimumScaleFactor(0.75)
                    .lineLimit(3)

                Text(page.body)
                    .font(.custom(ConsumerAuthTheme.fontName, size: compact ? 13 : 14).weight(.medium))
                    .foregroundColor(ConsumerAuthTheme.textSub)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .minimumScaleFactor(0.85)
                    .padding(.horizontal, 24)
            }
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .padding(.horizontal, 20)
    }
}

private struct ConsumerAuthForm: View {
    @Binding var step: AuthView.AuthStep
    @Binding var email: String
    @Binding var password: String
    @Binding var isLoading: Bool
    @Binding var errorText: String?
    @Binding var infoText: String?

    let onEmailAuth: () -> Void
    let onForgotPassword: () -> Void
    let onApple: () -> Void
    let onGoogle: () -> Void

    @Namespace private var toggleNS

    private var isLogin: Bool { step == .login }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    step = .welcome
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(ConsumerAuthTheme.textSub)
                        .frame(width: 36, height: 36)
                        .background(ConsumerAuthTheme.surface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(ConsumerAuthTheme.border))
                }
                .buttonStyle(.plain)
                Spacer()
                HStack(spacing: 0) {
                    Text("Schedule")
                        .font(.custom(ConsumerAuthTheme.fontName, size: 22).weight(.bold))
                        .foregroundColor(ConsumerAuthTheme.textPrimary)
                    Text("Me")
                        .font(.custom(ConsumerAuthTheme.fontName, size: 22).weight(.bold))
                        .foregroundColor(ConsumerAuthTheme.accent)
                }
                Spacer()
                Color.clear.frame(width: 36, height: 36)
            }
            .padding(.horizontal, 24)
            .padding(.top, 58)
            .padding(.bottom, 22)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {
                    VStack(spacing: 6) {
                        Text(isLogin ? "Welcome Back" : "Create Your Account")
                            .font(.custom(ConsumerAuthTheme.fontName, size: 28).weight(.bold))
                            .foregroundColor(ConsumerAuthTheme.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .multilineTextAlignment(.center)
                        Text("Sign in to book trusted student providers near you.")
                            .font(.custom(ConsumerAuthTheme.fontName, size: 13).weight(.medium))
                            .foregroundColor(ConsumerAuthTheme.textSub)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .multilineTextAlignment(.center)
                    }

                    VStack(spacing: 14) {
                        modeToggle

                        VStack(spacing: 10) {
                            AuthField(placeholder: "Email", text: $email)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .onChange(of: email) { _, newValue in
                                    SupabaseManager.shared.prewarmAuthPipelineIfNeeded(emailHint: newValue)
                                }
                            AuthField(placeholder: "Password", text: $password, isSecure: true)

                            if isLogin {
                                HStack {
                                    Spacer()
                                    Button("Forgot password?") {
                                        onForgotPassword()
                                    }
                                    .font(.custom(ConsumerAuthTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(ConsumerAuthTheme.accent)
                                    .buttonStyle(.plain)
                                    .disabled(isLoading)
                                }
                            }
                        }

                        if let infoText {
                            Text(infoText)
                                .font(.custom(ConsumerAuthTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ConsumerAuthTheme.accent)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        if let errorText {
                            Text(errorText)
                                .font(.custom(ConsumerAuthTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        AuthActionButton(
                            label: isLoading ? "Please wait…" : (isLogin ? "Continue with Email" : "Sign up with Email"),
                            style: .filled
                        ) {
                            onEmailAuth()
                        }
                        .disabled(isLoading || email.isEmpty || password.isEmpty)
                        .opacity(isLoading || email.isEmpty || password.isEmpty ? 0.55 : 1)

                        HStack(spacing: 10) {
                            Rectangle().fill(ConsumerAuthTheme.border).frame(height: 1)
                            Text("or")
                                .font(.custom(ConsumerAuthTheme.fontName, size: 11).weight(.medium))
                                .foregroundColor(ConsumerAuthTheme.textSub)
                            Rectangle().fill(ConsumerAuthTheme.border).frame(height: 1)
                        }

                        VStack(spacing: 8) {
                            SocialAuthButton(label: "Continue with Apple", icon: "apple.logo", style: .appleBlack) {
                                onApple()
                            }
                            .disabled(isLoading)

                            SocialAuthButton(label: "Continue with Google", icon: nil, style: .googleWhite) {
                                onGoogle()
                            }
                            .disabled(isLoading)
                        }
                    }
                    .padding(16)
                    .background(ConsumerAuthTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(ConsumerAuthTheme.border))
                    .shadow(color: ConsumerAuthTheme.surfaceShadow, radius: 14, y: 8)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
        }
    }

    private var modeToggle: some View {
        HStack(spacing: 0) {
            ForEach([AuthView.AuthStep.login, .signup], id: \.self) { target in
                let active = step == target
                Button {
                    withAnimation(.easeInOut(duration: 0.22)) {
                        step = target
                    }
                } label: {
                    Text(target == .login ? "Log in" : "Sign up")
                        .font(.custom(ConsumerAuthTheme.fontName, size: 13).weight(active ? .bold : .semibold))
                        .foregroundColor(active ? ConsumerAuthTheme.accent : ConsumerAuthTheme.textSub)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(
                            ZStack {
                                if active {
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(ScheduleMeTheme.accentSoft)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                .stroke(ConsumerAuthTheme.accent.opacity(0.55), lineWidth: 1)
                                        )
                                        .matchedGeometryEffect(id: "consumer-auth-toggle", in: toggleNS)
                                }
                            }
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(ConsumerAuthTheme.surfaceSoft)
        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).stroke(ConsumerAuthTheme.border))
    }
}

private struct AuthField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure: Bool = false
    @State private var isRevealed = false

    var body: some View {
        HStack(spacing: 10) {
            Group {
                if isSecure && !isRevealed {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if isSecure {
                Button {
                    isRevealed.toggle()
                } label: {
                    Image(systemName: isRevealed ? "eye.slash" : "eye")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(ConsumerAuthTheme.textSub)
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isRevealed ? "Hide password" : "Show password")
            }
        }
        .font(.custom(ConsumerAuthTheme.fontName, size: 15).weight(.medium))
        .foregroundColor(ConsumerAuthTheme.textPrimary)
        .tint(ConsumerAuthTheme.accent)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(ConsumerAuthTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ConsumerAuthTheme.border))
    }
}

private enum AuthActionButtonStyle { case filled, outline }

private struct AuthActionButton: View {
    let label: String
    let style: AuthActionButtonStyle
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.custom(ConsumerAuthTheme.fontName, size: 14).weight(.semibold))
                .foregroundColor(style == .filled ? .white : ConsumerAuthTheme.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    Group {
                        if style == .filled {
                            LinearGradient(
                                colors: [ConsumerAuthTheme.accent, Color(hex: "0B615A")],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        } else {
                            Color.clear
                        }
                    }
                )
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(style == .outline ? ConsumerAuthTheme.border : Color.clear)
                )
        }
        .buttonStyle(.plain)
    }
}

private enum SocialAuthButtonStyle { case appleBlack, googleWhite }

private struct SocialAuthButton: View {
    let label: String
    let icon: String?
    let style: SocialAuthButtonStyle
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                } else {
                    GoogleLogoMark()
                }
                Text(label)
                    .font(.custom(ConsumerAuthTheme.fontName, size: 14).weight(.semibold))
            }
            .foregroundColor(style == .appleBlack ? .white : ConsumerAuthTheme.textPrimary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(style == .appleBlack ? Color.black : ConsumerAuthTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(style == .appleBlack ? Color.clear : ConsumerAuthTheme.border)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct GoogleLogoMark: View {
    var body: some View {
        Image("GoogleIcon")
            .resizable()
            .scaledToFit()
            .frame(width: 18, height: 18)
    }
}

private final class WebAuthPresentationProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuthPresentationProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let windowScenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
        if let keyWindow = windowScenes.flatMap(\.windows).first(where: \.isKeyWindow) {
            return keyWindow
        }
        if let windowScene = windowScenes.first {
            return ASPresentationAnchor(windowScene: windowScene)
        }
        preconditionFailure("No active UIWindowScene available for web authentication presentation.")
    }
}
