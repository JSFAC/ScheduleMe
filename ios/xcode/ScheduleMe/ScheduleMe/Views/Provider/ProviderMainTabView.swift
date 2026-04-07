// FILE OVERVIEW:
// Provider app tab container for provider-only build target.
//
// DEBUG NOTES:
// Provider navigation and initial data loads are controlled in this file.

import SwiftUI

// MARK: - Provider Tab Shell

struct ProviderMainTabView: View {
    @EnvironmentObject private var providerTabRouter: ProviderTabRouter

    var body: some View {
        // Provider tab shell for provider-target build.
        TabView(selection: $providerTabRouter.selected) {
            ProviderDashboardView()
                .tabItem { Label("Dashboard", systemImage: "chart.bar.xaxis") }
                .tag(ProviderTab.dashboard)
            ProviderBookingsView()
                .tabItem { Label("Bookings", systemImage: "calendar") }
                .tag(ProviderTab.bookings)
            ProviderServicesView()
                .tabItem { Label("Services", systemImage: "briefcase") }
                .tag(ProviderTab.services)
            ProviderMessagesView()
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right") }
                .tag(ProviderTab.messages)
            ProviderAccountView()
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
                .tag(ProviderTab.account)
        }
        .tint(ScheduleMeTheme.accent)
    }
}
