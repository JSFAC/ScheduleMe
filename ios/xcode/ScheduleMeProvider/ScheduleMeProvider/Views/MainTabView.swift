// FILE OVERVIEW:
// Root consumer tab container and tab-level data bootstrap tasks.
//
// DEBUG NOTES:
// If a tab is missing or wrong on startup, check this file first.

import SwiftUI

// MARK: - Consumer Main Tab Shell

struct MainTabView: View {
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var locationManager: LocationManager

    var body: some View {
        ZStack(alignment: .bottom) {
            ZStack {
                if appState.eduVerified == true {
                    CampusView()
                        .opacity(tabRouter.selected == .campus ? 1 : 0)
                        .allowsHitTesting(tabRouter.selected == .campus)
                }
                HomeView()
                    .opacity(tabRouter.selected == .home ? 1 : 0)
                    .allowsHitTesting(tabRouter.selected == .home)
                BrowseView()
                    .opacity(tabRouter.selected == .browse ? 1 : 0)
                    .allowsHitTesting(tabRouter.selected == .browse)
                BookingsView()
                    .opacity(tabRouter.selected == .bookings ? 1 : 0)
                    .allowsHitTesting(tabRouter.selected == .bookings)
                MessagesView()
                    .opacity(tabRouter.selected == .messages ? 1 : 0)
                    .allowsHitTesting(tabRouter.selected == .messages)
            }

            FloatingTabBar(showsCampus: appState.eduVerified == true)
                .environmentObject(tabRouter)
        }
        // 49pt = the visible content height of the tab bar above the home indicator.
        // Views use this to reserve bottom space so content doesn't hide under the tab bar.
        .environment(\.floatingTabBarHeight, 49)
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
            if let uid = appState.userID {
                await dataStore.loadFavorites(userID: uid)
                await dataStore.loadThreads(for: uid)
                await dataStore.loadBookings()
            }
            if appState.eduVerified == true {
                let campusDomain = appState.resolvedSchoolDomain
                let campusTag = campusDomain?.split(separator: ".").first.map { String($0).uppercased() }
                await dataStore.loadCampusBusinesses(schoolDomain: campusDomain, campusTag: campusTag)
            }
            if let coordinate = locationManager.coordinate ?? LocationManager.simulatorFallbackCoordinate {
                await dataStore.loadNearbyBusinesses(coordinate: coordinate)
            }
        }
    }
}
