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
    @State private var didApplyInitialDefaultTab = false

    var body: some View {
        TabView(selection: selectedTabBinding) {
            // Campus tab is conditional and only visible for EDU-verified users.
            if appState.eduVerified == true {
                CampusView()
                    .tabItem {
                        Label("Campus", systemImage: "graduationcap")
                    }
                    .tag(ScheduleMeTab.campus)
            }

            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house")
                }
                .tag(ScheduleMeTab.home)

            BrowseView()
                .tabItem {
                    Label("Browse", systemImage: "magnifyingglass")
                }
                .tag(ScheduleMeTab.browse)

            BookingsView()
                .tabItem {
                    Label("Bookings", systemImage: "calendar")
                }
                .tag(ScheduleMeTab.bookings)

            MessagesView()
                .tabItem {
                    Label("Messages", systemImage: "bubble.left.and.bubble.right")
                }
                .tag(ScheduleMeTab.messages)
        }
        .tint(ScheduleMeTheme.accent)
        .onChange(of: appState.eduVerified) { _, verified in
            // If verification is removed while user is on Campus tab, redirect safely to Home.
            if verified != true && tabRouter.selected == .campus {
                tabRouter.selected = .home
            }
            applyInitialDefaultTabIfNeeded()
        }
        .onAppear {
            if appState.eduVerified != true && tabRouter.selected == .campus {
                tabRouter.selected = .home
            }
            applyInitialDefaultTabIfNeeded()
        }
        .task {
            // Prime core user data after the tab shell is mounted.
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

    /// Sets first-launch default tab: EDU verified users start on Campus, otherwise Home.
    private func applyInitialDefaultTabIfNeeded() {
        guard !didApplyInitialDefaultTab else { return }
        guard let verified = appState.eduVerified else { return }
        didApplyInitialDefaultTab = true
        tabRouter.selected = verified ? .campus : .home
    }

    private var selectedTabBinding: Binding<ScheduleMeTab> {
        Binding(
            get: {
                // Defensive guard so stale tab state can never keep user on hidden Campus tab.
                if appState.eduVerified != true && tabRouter.selected == .campus {
                    return .home
                }
                return tabRouter.selected
            },
            set: { newValue in
                if appState.eduVerified != true && newValue == .campus {
                    tabRouter.selected = .home
                } else {
                    tabRouter.selected = newValue
                }
            }
        )
    }
}
