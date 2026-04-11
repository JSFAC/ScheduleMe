// FILE OVERVIEW:
// Consumer app entry router (onboarding/loading/auth/main tabs).
//
// DEBUG NOTES:
// If startup view selection is wrong, this is the controlling file.

import SwiftUI

// MARK: - App Start Router

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @State private var didBootstrap = false
    @State private var loadingVisibleUntil = Date.distantPast
    @State private var loadingHoldRefresh = false
    @State private var loadingBarCompleted = false

    // Keep startup loading visible long enough for the progress animation to feel intentional.
    private let minimumLoadingVisibility: TimeInterval = 1.15

    var body: some View {
        ScheduleMePage {
            Group {
                // App entry routing order:
                // 1) auth loading state, 2) main tabs if authenticated, 3) auth screens.
                if shouldShowLoadingScreen {
                    ConsumerLoadingScreen(context: appState.loadingContext) {
                        loadingBarCompleted = true
                        loadingHoldRefresh.toggle()
                    }
                } else if appState.isAuthenticated {
                    MainTabView()
                } else {
                    AuthView()
                }
            }
        }
        .sheet(item: pendingBusinessLookupBinding) { item in
            DeepLinkBusinessLoader(lookupKey: item.key) {
                appState.pendingBusinessLookupKey = nil
            }
        }
        .task {
            guard !didBootstrap else { return }
            didBootstrap = true
            if appState.isLoading {
                loadingVisibleUntil = Date().addingTimeInterval(minimumLoadingVisibility)
                loadingBarCompleted = false
            }
            await appState.bootstrap()
        }
        .onChange(of: appState.isLoading) { _, isLoadingNow in
            if isLoadingNow {
                loadingVisibleUntil = Date().addingTimeInterval(minimumLoadingVisibility)
                loadingBarCompleted = false
                return
            }
            let remaining = loadingVisibleUntil.timeIntervalSinceNow
            guard remaining > 0 else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + remaining) {
                loadingHoldRefresh.toggle()
            }
        }
    }

    private var shouldShowLoadingScreen: Bool {
        _ = loadingHoldRefresh
        if appState.isLoading { return true }
        if !loadingBarCompleted { return true }
        return Date() < loadingVisibleUntil
    }

    private var pendingBusinessLookupBinding: Binding<PendingBusinessLookupItem?> {
        Binding(
            get: {
                guard let key = appState.pendingBusinessLookupKey else { return nil }
                return PendingBusinessLookupItem(key: key)
            },
            set: { newValue in
                appState.pendingBusinessLookupKey = newValue?.key
            }
        )
    }
}

private struct PendingBusinessLookupItem: Identifiable {
    let key: String
    var id: String { key }
}

private struct ConsumerLoadingScreen: View {
    let context: AppState.LoadingContext
    let onBarCompleted: () -> Void

    private var icon: String {
        switch context {
        case .startup:
            return "graduationcap.fill"
        case .signingIn:
            return "person.badge.shield.checkmark.fill"
        case .signingOut:
            return "rectangle.portrait.and.arrow.right"
        }
    }

    private var titleText: String {
        switch context {
        case .startup:
            return "ScheduleMe"
        case .signingIn:
            return "Signing in"
        case .signingOut:
            return "Signing out"
        }
    }

    private var subtitleText: String {
        switch context {
        case .startup:
            return "Loading your marketplace…"
        case .signingIn:
            return "Retrieving account data and syncing your dashboard…"
        case .signingOut:
            return "Clearing your session securely…"
        }
    }

    var body: some View {
        VStack {
            Spacer()

            VStack(spacing: 16) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 72, height: 72)
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.accent)
                    )

                if context == .startup {
                    HStack(spacing: 0) {
                        Text("Schedule")
                            .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        Text("Me")
                            .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.accent)
                    }
                } else {
                    Text(titleText)
                        .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                }

                Text(subtitleText)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 10)

                ScheduleMeLoadingBar(
                    width: 120,
                    height: 8,
                    tint: ScheduleMeTheme.accent,
                    completesOnFirstRun: true,
                    onCompleted: onBarCompleted
                )
                    .padding(.top, 6)
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 28)
            .frame(maxWidth: 350)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
            .shadow(color: Color.black.opacity(0.14), radius: 18, y: 10)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 22)
    }
}
