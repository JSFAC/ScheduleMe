// FILE OVERVIEW:
// Consumer app entry router (onboarding/loading/auth/main tabs).
//
// DEBUG NOTES:
// If startup view selection is wrong, this is the controlling file.

import SwiftUI

// MARK: - App Start Router

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScheduleMePage {
            Group {
                // App entry routing order:
                // 1) auth loading state, 2) main tabs if authenticated, 3) auth screens.
                if appState.isLoading {
                    ConsumerLoadingScreen()
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
    var body: some View {
        VStack(spacing: 14) {
            ProgressView()
                .tint(ScheduleMeTheme.accent)
                .scaleEffect(1.15)

            HStack(spacing: 0) {
                Text("Schedule")
                    .font(.custom(ScheduleMeTheme.fontName, size: 22).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text("Me")
                    .font(.custom(ScheduleMeTheme.fontName, size: 22).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.accent)
            }

            Text("Loading ScheduleMe")
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
