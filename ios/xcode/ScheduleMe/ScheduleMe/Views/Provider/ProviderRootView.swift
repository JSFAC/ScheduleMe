// FILE OVERVIEW:
// Provider root routing entry for auth/loading/tab shell.
//
// DEBUG NOTES:
// If provider app entry state is wrong, inspect this file first.

import SwiftUI

// MARK: - Provider Root Router

struct ProviderRootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScheduleMePage {
            // Mirrors consumer root routing but for provider app shell.
            Group {
                if appState.isLoading {
                    VStack(spacing: 16) {
                        ProgressView()
                            .tint(ScheduleMeTheme.accent)
                            .scaleEffect(1.2)
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
    }
}
