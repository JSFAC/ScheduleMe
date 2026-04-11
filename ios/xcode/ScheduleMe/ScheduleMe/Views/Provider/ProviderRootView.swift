// FILE OVERVIEW:
// Provider root routing entry for auth/loading/tab shell.
//
// DEBUG NOTES:
// If provider app entry state is wrong, inspect this file first.

import SwiftUI

// MARK: - Provider Root Router

struct ProviderRootView: View {
    @EnvironmentObject private var appState: AppState
    @State private var loadingVisibleUntil = Date.distantPast
    @State private var loadingHoldRefresh = false
    @State private var loadingBarCompleted = false

    private let minimumLoadingVisibility: TimeInterval = 0.3

    var body: some View {
        ScheduleMePage {
            // Mirrors consumer root routing but for provider app shell.
            Group {
                if shouldShowLoadingScreen {
                    VStack(spacing: 16) {
                        ScheduleMeLoadingBar(
                            width: 150,
                            height: 8,
                            tint: ScheduleMeTheme.accent,
                            completesOnFirstRun: true
                        ) {
                            loadingBarCompleted = true
                            loadingHoldRefresh.toggle()
                        }
                        Text("Loading ScheduleMe Provider")
                            .font(.custom(ScheduleMeTheme.fontName, size: 16)).fontWeight(.semibold)
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if appState.isAuthenticated {
                    ProviderMainTabView()
                } else {
                    AuthView()
                }
            }
        }
        .onAppear {
            if appState.isLoading {
                loadingVisibleUntil = Date().addingTimeInterval(minimumLoadingVisibility)
                loadingBarCompleted = false
            }
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
}
