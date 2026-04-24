// FILE OVERVIEW:
// Provider root routing entry for auth/loading/tab shell.
//
// DEBUG NOTES:
// If provider app entry state is wrong, inspect this file first.

import SwiftUI

// MARK: - Provider Root Router

struct ProviderRootView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var providerStore: ProviderDataStore
    @EnvironmentObject private var providerTabRouter: ProviderTabRouter
    @AppStorage("scheduleme_dark_mode") private var darkModeEnabled = true
    @AppStorage("provider_has_ever_authenticated") private var hasEverAuthenticated = false
    @State private var loadingHoldUntil: Date = .distantPast
    @State private var loadingHoldTick = false
    @State private var loadingHoldTask: Task<Void, Never>?
    @State private var lastLoadingKind: LoadingKind = .appLaunch
    private let loadingSubtitle = "Syncing bookings, messages, services, payouts, and profile..."
    private let minimumLoadingDisplaySeconds: TimeInterval = 2.75

    private enum LoadingKind {
        case appLaunch
        case signedInData
        case signOut
    }

    private var isProviderLoadingState: Bool {
        if appState.isSigningOut { return true }
        guard appState.isAuthenticated else { return false }
        if appState.isLoading { return true }
        return providerStore.isBootstrapping
            || !providerStore.hasResolvedAccessDecision
            || !providerStore.hasCompletedInitialDataLoad
    }

    private var shouldShowLoading: Bool {
        let _ = loadingHoldTick
        return isProviderLoadingState || Date() < loadingHoldUntil
    }

    private func extendLoadingVisibility() {
        let candidate = Date().addingTimeInterval(minimumLoadingDisplaySeconds)
        if candidate > loadingHoldUntil {
            loadingHoldUntil = candidate
        }

        loadingHoldTask?.cancel()
        let target = loadingHoldUntil
        loadingHoldTask = Task {
            let wait = max(0, target.timeIntervalSinceNow)
            if wait > 0 {
                try? await Task.sleep(for: .milliseconds(Int(wait * 1000)))
            }
            if Task.isCancelled { return }
            await MainActor.run {
                loadingHoldTick.toggle()
            }
        }
    }

    @ViewBuilder
    private var currentLoadingView: some View {
        switch resolvedLoadingKind {
        case .signOut:
            ProviderSignOutLoadingView()
        case .signedInData:
            ProviderPremiumLoadingView(
                title: "Loading Provider Dashboard",
                subtitle: loadingSubtitle,
                icon: "briefcase.fill"
            )
        case .appLaunch:
            ProviderAppLaunchLoadingView()
        }
    }

    private var liveLoadingKind: LoadingKind {
        if appState.isSigningOut { return .signOut }
        if appState.isAuthenticated { return .signedInData }
        if hasEverAuthenticated { return .signedInData }
        return .appLaunch
    }

    private var resolvedLoadingKind: LoadingKind {
        if isProviderLoadingState {
            return liveLoadingKind
        }
        return lastLoadingKind
    }

    var body: some View {
        ScheduleMePage {
            Group {
                if appState.isAuthenticated {
                    Group {
                        if shouldShowLoading {
                            currentLoadingView
                        } else if providerStore.profile == nil {
                            ProviderAccessDeniedView(
                                message: providerStore.errorMessage ?? "This account is not linked to an approved provider profile."
                            )
                        } else {
                            ProviderMainTabView()
                        }
                    }
                    .task(id: "\(appState.userID ?? "nil")|\(appState.userEmail ?? "nil")") {
                        // Every authenticated entry starts on Overview for consistency.
                        providerTabRouter.selected = .overview
                        await providerStore.bootstrap(userEmail: appState.userEmail, userID: appState.userID)

                        // Cold-start reliability: retry hydration a few times if backend/session
                        // races cause an initial empty payload.
                        var attempts = 0
                        while !Task.isCancelled && appState.isAuthenticated && attempts < 2 {
                            let needsHydration =
                                !providerStore.hasCompletedInitialDataLoad ||
                                (
                                    providerStore.profile != nil &&
                                    providerStore.bookings.isEmpty &&
                                    providerStore.threads.isEmpty &&
                                    providerStore.services.isEmpty
                                )

                            if !needsHydration { break }
                            if !providerStore.isBootstrapping {
                                await providerStore.refreshAll(force: true, prioritizeFastLoad: true)
                            }

                            attempts += 1
                            if attempts < 2 {
                                try? await Task.sleep(for: .milliseconds(350))
                            }
                        }
                    }
                } else if appState.isSigningOut {
                    currentLoadingView
                } else {
                    AuthView()
                }
            }
        }
        .onAppear {
            if isProviderLoadingState {
                lastLoadingKind = liveLoadingKind
                extendLoadingVisibility()
            }
        }
        .onChange(of: isProviderLoadingState) { _, loading in
            if loading {
                lastLoadingKind = liveLoadingKind
                extendLoadingVisibility()
            }
        }
        .onChange(of: appState.isSigningOut) { _, signingOut in
            if signingOut {
                lastLoadingKind = .signOut
            }
        }
        // Landing/auth flow is always dark for brand consistency and legibility.
        .preferredColorScheme(
            appState.isAuthenticated
                ? (darkModeEnabled ? .dark : .light)
                : .dark
        )
        .onChange(of: appState.isAuthenticated) { _, isAuthenticated in
            if isAuthenticated {
                hasEverAuthenticated = true
            }
            if !isAuthenticated {
                providerStore.reset()
                providerTabRouter.selected = .overview
            }
        }
        .onDisappear {
            loadingHoldTask?.cancel()
            loadingHoldTask = nil
        }
    }
}

private struct ProviderAppLaunchLoadingView: View {
    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            VStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(ScheduleMeTheme.accentSoft)
                        .frame(width: 84, height: 84)
                    Image(systemName: "briefcase.fill")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                }
                .symbolEffect(.pulse.byLayer, options: .repeating, isActive: true)

                HStack(spacing: 0) {
                    Text("Loading Schedule")
                        .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                    Text("Me")
                        .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                }

                Text("Preparing sign-in, secure session checks, and app services...")
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                    .lineLimit(2)

                ScheduleMeLoadingBar(
                    tint: ScheduleMeTheme.accent,
                    track: ScheduleMeTheme.cardBorderStrong,
                    width: 180,
                    height: 4,
                    target: 1.0,
                    initialProgress: 0.08,
                    animate: true
                )
                .padding(.top, 6)
            }
            .padding(26)
            .frame(maxWidth: 340, minHeight: 240)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(ScheduleMeTheme.cardBorder))
            .padding(.horizontal, 24)
        }
    }
}

private struct ProviderSignOutLoadingView: View {
    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            VStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color(hex: "EF4444").opacity(0.14))
                        .frame(width: 84, height: 84)
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(Color(hex: "F87171"))
                }
                .symbolEffect(.pulse.byLayer, options: .repeating, isActive: true)

                Text("Signing Out")
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                Text("Securing your account and clearing this device session...")
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                    .lineLimit(2)

                ScheduleMeLoadingBar(
                    tint: Color(hex: "F87171"),
                    track: ScheduleMeTheme.cardBorderStrong,
                    width: 180,
                    height: 4,
                    target: 1.0,
                    initialProgress: 0.12,
                    animate: true
                )
                .padding(.top, 6)
            }
            .padding(26)
            .frame(maxWidth: 340, minHeight: 240)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(ScheduleMeTheme.cardBorder))
            .padding(.horizontal, 24)
        }
    }
}

private struct ProviderAccessDeniedView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var providerStore: ProviderDataStore
    @Environment(\.openURL) private var openURL
    @State private var showingProviderApplication = false
    let message: String

    private var consumerAppDeepLinkURL: URL {
        URL(string: "scheduleme://auth/callback")!
    }

    private var consumerAppFallbackURL: URL {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "CONSUMER_APP_STORE_URL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return URL(string: configured?.isEmpty == false ? configured! : "https://apps.apple.com")!
    }

    private func openConsumerApp() {
        openURL(consumerAppDeepLinkURL) { accepted in
            if !accepted {
                openURL(consumerAppFallbackURL)
            }
        }
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "090B10"), Color(hex: "10141B")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 14) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundStyle(Color(hex: "F59E0B"))

                Text("Provider Access Required")
                    .font(.custom(ScheduleMeTheme.fontName, size: 22).weight(.bold))
                    .foregroundStyle(Color.white)

                Text(message)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                    .foregroundStyle(Color(hex: "94A3B8"))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)

                Button("Apply as Provider") {
                    showingProviderApplication = true
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())

                HStack(spacing: 16) {
                    Button("Back") {
                        Task {
                            await appState.signOut()
                            providerStore.reset()
                        }
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(Color(hex: "94A3B8"))
                    .contentShape(Rectangle())
        .buttonStyle(.plain)

                    Text("•")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                        .foregroundStyle(Color(hex: "4B5563"))

                    Button("Open Consumer App") {
                        openConsumerApp()
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(Color(hex: "33C8B5"))
                    .contentShape(Rectangle())
        .buttonStyle(.plain)
                }
                .padding(.top, 2)
            }
            .padding(22)
            .background(Color(hex: "11161F"))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(hex: "273141")))
            .padding(.horizontal, 24)
        }
        .fullScreenCover(isPresented: $showingProviderApplication) {
            NavigationStack {
                ProviderApplicationView()
            }
        }
    }
}

private struct ProviderPremiumLoadingView: View {
    let title: String
    let subtitle: String
    let icon: String
    var animateBar: Bool = true
    var initialBarProgress: Double = 0.03

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            VStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(ScheduleMeTheme.accentSoft)
                        .frame(width: 84, height: 84)
                    Image(systemName: icon)
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                }
                .symbolEffect(.pulse.byLayer, options: .repeating, isActive: true)

                VStack(spacing: 4) {
                    ScheduleMeWordmark(size: 34)

                    Text("FOR PROVIDERS")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .tracking(1.4)
                        .foregroundStyle(ScheduleMeTheme.accent)
                }

                Text(subtitle)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                    .lineLimit(2)

                ScheduleMeLoadingBar(
                    tint: ScheduleMeTheme.accent,
                    track: ScheduleMeTheme.cardBorderStrong,
                    width: 180,
                    height: 4,
                    target: 1.0,
                    initialProgress: initialBarProgress,
                    animate: animateBar
                )
                    .padding(.top, 6)
            }
            .padding(26)
            .frame(maxWidth: 340, minHeight: 240)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(ScheduleMeTheme.cardBorder))
            .padding(.horizontal, 24)
        }
    }
}
