// FILE OVERVIEW:
// Consumer app entry router (onboarding/loading/auth/main tabs).
//
// DEBUG NOTES:
// If startup view selection is wrong, this is the controlling file.

import SwiftUI

// MARK: - App Start Router

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    // Controls whether onboarding carousel should be shown before auth flow.
    @AppStorage("scheduleme_onboarding_complete") private var onboardingComplete = false

    var body: some View {
        ScheduleMePage {
            Group {
                // App entry routing order:
                // 1) onboarding, 2) auth loading state, 3) main tabs if authenticated, 4) auth screens.
                if onboardingComplete == false {
                    OnboardingView()
                } else if appState.isLoading {
                    VStack(spacing: 16) {
                        ProgressView()
                            .tint(ScheduleMeTheme.accent)
                            .scaleEffect(1.2)
                        Text("Loading ScheduleMe")
                            .font(.custom(ScheduleMeTheme.fontName, size: 16)).fontWeight(.semibold)
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
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
