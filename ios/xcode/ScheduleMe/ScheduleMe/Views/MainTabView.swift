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
    @State private var didRunInitialPrefetch = false
    @State private var isShowingInitialWarmupOverlay = true
    @State private var warmupOverlayStartedAt = Date()

    // Keeps the warmup overlay visible long enough to avoid "half-painted" first-frame content.
    private let minimumWarmupOverlayVisibility: TimeInterval = 1.2
    // Safety guard: never block the user behind warmup forever if a network call stalls.
    private let maximumWarmupOverlayVisibility: TimeInterval = 2.8

    var body: some View {
        ZStack {
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
                guard !didRunInitialPrefetch else { return }
                didRunInitialPrefetch = true
                warmupOverlayStartedAt = Date()
                isShowingInitialWarmupOverlay = true

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
                await dismissWarmupOverlayWhenReady()
            }

            if isShowingInitialWarmupOverlay {
                ConsumerTabWarmupOverlay()
                    .transition(.opacity)
                    .zIndex(2)
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

    private func dismissWarmupOverlayWhenReady() async {
        while true {
            let elapsed = Date().timeIntervalSince(warmupOverlayStartedAt)
            let hasReachedMinimumVisibility = elapsed >= minimumWarmupOverlayVisibility
            let hasReachedMaximumVisibility = elapsed >= maximumWarmupOverlayVisibility
            let hasPrimaryFeedLoaded = await MainActor.run { hasLoadedInitialFeedForVisibleTab() }

            if (hasReachedMinimumVisibility && hasPrimaryFeedLoaded) || hasReachedMaximumVisibility {
                break
            }

            try? await Task.sleep(for: .milliseconds(120))
        }

        await MainActor.run {
            guard isShowingInitialWarmupOverlay else { return }
            withAnimation(.easeOut(duration: 0.22)) {
                isShowingInitialWarmupOverlay = false
            }
        }
    }

    private func hasLoadedInitialFeedForVisibleTab() -> Bool {
        if appState.eduVerified == true && tabRouter.selected == .campus {
            return dataStore.hasLoadedCampusBusinesses || !dataStore.isLoadingCampusBusinesses
        }
        return dataStore.hasLoadedBusinesses || !dataStore.isLoadingBusinesses
    }
}

private struct ConsumerTabWarmupOverlay: View {
    var body: some View {
        ZStack {
            ScheduleMeTheme.pageBackground
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(ScheduleMeTheme.accent)

                HStack(spacing: 0) {
                    Text("Schedule")
                        .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                    Text("Me")
                        .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                }

                Text("Preparing your feed…")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.mutedText)

                ScheduleMeLoadingBar(
                    width: 118,
                    height: 8,
                    tint: ScheduleMeTheme.accent,
                    track: ScheduleMeTheme.accentSoft
                )
                .padding(.top, 6)
            }
            .padding(.horizontal, 26)
            .padding(.vertical, 26)
            .frame(maxWidth: 340)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
            .shadow(color: Color.black.opacity(0.12), radius: 16, y: 8)
        }
    }
}
