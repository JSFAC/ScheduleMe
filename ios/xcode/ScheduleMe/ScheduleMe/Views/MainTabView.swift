import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var locationManager: LocationManager

    var body: some View {
        TabView(selection: $tabRouter.selected) {
            if appState.eduVerified == true {
                CampusView()
                    .tabItem { Label("Campus", systemImage: "graduationcap") }
                    .tag(ScheduleMeTab.campus)
            }
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
                .tag(ScheduleMeTab.home)
            BrowseView()
                .tabItem { Label("Browse", systemImage: "magnifyingglass") }
                .tag(ScheduleMeTab.browse)
            BookingsView()
                .tabItem { Label("Bookings", systemImage: "calendar") }
                .tag(ScheduleMeTab.bookings)
            MessagesView()
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right") }
                .tag(ScheduleMeTab.messages)
        }
        .tint(ScheduleMeTheme.accent)
        .onChange(of: appState.eduVerified) { _, verified in
            if verified != true && tabRouter.selected == .campus {
                tabRouter.selected = .home
            }
        }
        .onAppear {
            if appState.eduVerified != true && tabRouter.selected == .campus {
                tabRouter.selected = .home
            }
        }
        .task {
            locationManager.requestIfNeeded()
            await dataStore.loadNearbyBusinesses(coordinate: locationManager.coordinate)
        }
    }
}
