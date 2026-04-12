// FILE OVERVIEW:
// Provider app tab container for provider-only build target.
//
// DEBUG NOTES:
// Provider navigation and initial data loads are controlled in this file.

import SwiftUI

// MARK: - Provider Tab Shell

struct ProviderMainTabView: View {
    @EnvironmentObject private var providerTabRouter: ProviderTabRouter
    @EnvironmentObject private var providerStore: ProviderDataStore

    var body: some View {
        TabView(selection: $providerTabRouter.selected) {
            ProviderOverviewView()
                .tabItem { Label("Overview", systemImage: "chart.bar.xaxis") }
                .tag(ProviderTab.overview)
            ProviderBookingsView()
                .tabItem { Label("Bookings", systemImage: "calendar") }
                .badge(providerStore.pendingBookingsCount == 0 ? nil : "\(providerStore.pendingBookingsCount)")
                .tag(ProviderTab.bookings)
            NavigationStack {
                ProviderCalendarView()
            }
                .tabItem { Label("Calendar", systemImage: "calendar.badge.clock") }
                .tag(ProviderTab.calendar)
            ProviderMessagesView()
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right") }
                .badge(providerStore.unreadMessagesCount == 0 ? nil : "\(providerStore.unreadMessagesCount)")
                .tag(ProviderTab.messages)
            ProviderMoreView()
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
                .tag(ProviderTab.more)
        }
        .tint(ScheduleMeTheme.accent)
        .toolbarBackground(ScheduleMeTheme.pageBackground, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(45))
                await providerStore.refreshAll(force: false)
            }
        }
    }
}
