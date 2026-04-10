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

    var body: some View {
        ScheduleMePage {
            Group {
                if appState.isSigningOut {
                    ProviderPremiumLoadingView(
                        title: "Signing Out",
                        subtitle: "Clearing local data and ending your secure session...",
                        icon: "rectangle.portrait.and.arrow.right"
                    )
                } else if appState.isLoading {
                    ProviderPremiumLoadingView(
                        title: "Loading Provider Dashboard",
                        subtitle: "Syncing bookings, messages, services, and payout data...",
                        icon: "briefcase.fill"
                    )
                } else if appState.isAuthenticated {
                    Group {
                        if providerStore.lastLoadedAt == nil {
                            ProviderPremiumLoadingView(
                                title: "Loading Provider Dashboard",
                                subtitle: "Syncing bookings, messages, services, payouts, and profile...",
                                icon: "briefcase.fill"
                            )
                        } else {
                            ProviderMainTabView()
                        }
                    }
                    .task(id: "\(appState.userID ?? "nil")|\(appState.userEmail ?? "nil")") {
                        await providerStore.bootstrap(userEmail: appState.userEmail, userID: appState.userID)
                    }
                } else {
                    AuthView()
                }
            }
        }
        .onChange(of: appState.isAuthenticated) { _, isAuthenticated in
            if !isAuthenticated {
                providerStore.reset()
            }
        }
    }
}

private struct ProviderPremiumLoadingView: View {
    let title: String
    let subtitle: String
    let icon: String

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "090B10"), Color(hex: "10141B")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 14) {
                ZStack {
                    Circle()
                        .fill(Color(hex: "0C9182").opacity(0.18))
                        .frame(width: 84, height: 84)
                    Image(systemName: icon)
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(Color(hex: "33C8B5"))
                }
                .symbolEffect(.pulse.byLayer, options: .repeating, isActive: true)

                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundStyle(Color.white)

                Text(subtitle)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                    .foregroundStyle(Color(hex: "94A3B8"))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)

                ProgressView()
                    .tint(Color(hex: "33C8B5"))
                    .scaleEffect(1.15)
                    .padding(.top, 4)
            }
            .padding(26)
            .background(Color(hex: "11161F"))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color(hex: "273141")))
            .padding(.horizontal, 24)
        }
    }
}
