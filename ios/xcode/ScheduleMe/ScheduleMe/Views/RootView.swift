import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScheduleMePage {
            Group {
                if appState.isLoading {
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
    }
}
