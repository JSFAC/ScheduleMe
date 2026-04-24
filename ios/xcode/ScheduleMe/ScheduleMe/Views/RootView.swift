// FILE OVERVIEW:
// Consumer app entry router (onboarding/loading/auth/main tabs).
//
// DEBUG NOTES:
// If startup view selection is wrong, this is the controlling file.

import SwiftUI

// MARK: - App Start Router

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var locationManager: LocationManager
    @EnvironmentObject private var tabRouter: TabRouter
    @AppStorage("scheduleme_guest_browsing_enabled") private var guestBrowsingEnabled = false
    @State private var didBootstrap = false
    @State private var didRunStartupPrefetch = false
    @State private var startupCoreFeedsReady = false
    @State private var loadingVisibleUntil = Date.distantPast
    @State private var loadingHoldRefresh = false
    @State private var loadingBarCompleted = false
    @State private var loadingProgress: CGFloat = 0.08
    @State private var loadingProgressTask: Task<Void, Never>?

    // Keep startup loading intentional, but still fast.
    private let minimumLoadingVisibility: TimeInterval = 0.8

    var body: some View {
        ScheduleMePage {
            Group {
                // App entry routing order:
                // 1) loading state, 2) main tabs when signed in or guest-enabled, 3) auth screens.
                if shouldShowLoadingScreen {
                    ConsumerLoadingScreen(
                        context: appState.loadingContext,
                        finishSignal: loadingFinishSignal,
                        progressValue: loadingProgress
                    ) {
                        loadingBarCompleted = true
                        loadingHoldRefresh.toggle()
                    }
                } else if appState.isAuthenticated || guestBrowsingEnabled {
                    MainTabView()
                } else {
                    AuthView(
                        onContinueAsGuest: {
                            guestBrowsingEnabled = true
                            tabRouter.selected = .home
                        }
                    )
                }
            }
        }
        .sheet(item: pendingBusinessLookupBinding) { item in
            DeepLinkBusinessLoader(lookupKey: item.key) {
                appState.pendingBusinessLookupKey = nil
            }
        }
        .task {
            guard !didBootstrap else { return }
            didBootstrap = true
            if appState.isLoading {
                loadingVisibleUntil = Date().addingTimeInterval(minimumLoadingVisibility)
                loadingBarCompleted = false
                loadingProgress = 0.08
                startupCoreFeedsReady = false
            }
            startLoadingProgressTickerIfNeeded()
            await appState.bootstrap()
            advanceLoadingProgress(to: 0.34)
            await runStartupPrefetchIfNeeded()
        }
        .onChange(of: appState.isLoading) { _, isLoadingNow in
            if isLoadingNow {
                let wasShowingLoading = shouldShowLoadingScreen
                loadingVisibleUntil = Date().addingTimeInterval(minimumLoadingVisibility)
                loadingBarCompleted = false
                startupCoreFeedsReady = false
                // Avoid auth-loader progress snap-back if a second loading pulse starts
                // while the overlay is already visible.
                if appState.loadingContext == .startup || !wasShowingLoading {
                    loadingProgress = 0.08
                }
                startLoadingProgressTickerIfNeeded()
                return
            }
            if appState.loadingContext == .startup {
                // Keep startup splash visible until core entry feeds (Home/Campus) are ready.
                advanceLoadingProgress(to: startupCoreFeedsReady ? 1.0 : 0.92)
            } else {
                // Auth transition loaders should always finish when auth bootstrap completes.
                advanceLoadingProgress(to: 1.0)
            }
            let remaining = loadingVisibleUntil.timeIntervalSinceNow
            guard remaining > 0 else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + remaining) {
                loadingHoldRefresh.toggle()
            }
        }
        .onChange(of: appState.isAuthenticated) { _, isAuthenticated in
            if !isAuthenticated {
                didRunStartupPrefetch = false
                startupCoreFeedsReady = false
                loadingBarCompleted = false
                loadingProgress = 0.08
                stopLoadingProgressTicker()
                Task {
                    await runStartupPrefetchIfNeeded()
                }
                return
            }

            guestBrowsingEnabled = false
            // Re-run startup prefetch for the newly authenticated state.
            // Without resetting this gate, signing-in can wait forever on stale prefetch state.
            didRunStartupPrefetch = false
            startupCoreFeedsReady = false
            startLoadingProgressTickerIfNeeded()
            Task {
                await runStartupPrefetchIfNeeded()
            }
        }
        .onChange(of: guestBrowsingEnabled) { _, enabled in
            guard enabled else { return }
            didRunStartupPrefetch = false
            startupCoreFeedsReady = false
            Task {
                await runStartupPrefetchIfNeeded()
            }
        }
        .onChange(of: shouldShowLoadingScreen) { _, showLoading in
            if showLoading {
                startLoadingProgressTickerIfNeeded()
            } else {
                stopLoadingProgressTicker()
            }
        }
        .onDisappear {
            stopLoadingProgressTicker()
        }
    }

    private var shouldShowLoadingScreen: Bool {
        // Sign-in/sign-out loading screens should render whenever auth bootstrap is in progress.
        if appState.loadingContext != .startup {
            return appState.isLoading || Date() < loadingVisibleUntil
        }
        // Startup loader is only for authenticated/guest app entry.
        guard appState.isAuthenticated || guestBrowsingEnabled else { return false }
        _ = loadingHoldRefresh
        if appState.isLoading { return true }
        if requiresCoreStartupFeeds && !startupCoreFeedsReady { return true }
        if !loadingBarCompleted { return true }
        return !loadingReadyForDismiss
    }

    private var loadingReadyForDismiss: Bool {
        let minimumVisibleElapsed = Date() >= loadingVisibleUntil
        let sessionReady = !appState.isLoading
        let dataReady = (!requiresCoreStartupFeeds) || startupCoreFeedsReady
        return minimumVisibleElapsed && sessionReady && dataReady
    }

    private var loadingFinishSignal: Bool {
        if appState.loadingContext != .startup {
            return !appState.isLoading
        }
        return loadingReadyForDismiss
    }

    private func runStartupPrefetchIfNeeded() async {
        guard !didRunStartupPrefetch else { return }
        didRunStartupPrefetch = true
        startupCoreFeedsReady = false

        // If we're heading to auth, don't hold splash on data prefetch.
        guard requiresCoreStartupFeeds else {
            startupCoreFeedsReady = true
            advanceLoadingProgress(to: 1.0)
            return
        }

        // Guest mode: preload nearby Home feed before entering tabs.
        if guestBrowsingEnabled && !appState.isAuthenticated {
            locationManager.requestIfNeeded()
            let coordinate = locationManager.coordinate ?? LocationManager.simulatorFallbackCoordinate
            if !dataStore.hasLoadedBusinesses {
                await dataStore.loadNearbyBusinesses(coordinate: coordinate)
            }
            startupCoreFeedsReady = true
            advanceLoadingProgress(to: 1.0)
            return
        }

        let baseline: CGFloat = 0.34
        let upperBound: CGFloat = 0.96
        advanceLoadingProgress(to: baseline)

        var plannedSteps = 1 // final completion checkpoint
        if !dataStore.hasLoadedBusinesses { plannedSteps += 1 }
        if appState.eduVerified == true && !dataStore.hasLoadedCampusBusinesses { plannedSteps += 1 }

        var completedSteps = 0
        let markStepComplete: () -> Void = {
            completedSteps += 1
            let ratio = CGFloat(completedSteps) / CGFloat(max(plannedSteps, 1))
            let nextProgress = baseline + ((upperBound - baseline) * ratio)
            advanceLoadingProgress(to: nextProgress)
        }

        locationManager.requestIfNeeded()
        let coordinate = locationManager.coordinate ?? LocationManager.simulatorFallbackCoordinate

        // Critical path before splash dismissal: Home and, when applicable, Campus feed.
        let needsBusinesses = !dataStore.hasLoadedBusinesses
        let needsCampus = appState.eduVerified == true && !dataStore.hasLoadedCampusBusinesses
        let campusDomain = appState.resolvedSchoolDomain
        let campusTag = campusDomain?.split(separator: ".").first.map { String($0).uppercased() }

        if needsBusinesses && needsCampus {
            async let nearbyTask: Void = dataStore.loadNearbyBusinesses(coordinate: coordinate)
            async let campusTask: Void = dataStore.loadCampusBusinesses(schoolDomain: campusDomain, campusTag: campusTag)
            await nearbyTask
            markStepComplete()
            await campusTask
            markStepComplete()
        } else {
            if needsBusinesses {
                await dataStore.loadNearbyBusinesses(coordinate: coordinate)
                markStepComplete()
            }
            if needsCampus {
                await dataStore.loadCampusBusinesses(schoolDomain: campusDomain, campusTag: campusTag)
                markStepComplete()
            }
        }

        startupCoreFeedsReady = true
        markStepComplete()
        advanceLoadingProgress(to: 1.0)

        // Non-critical prefetches continue in background after app entry.
        if let uid = appState.userID {
            Task {
                await dataStore.loadFavorites(userID: uid)
            }
            if !dataStore.hasLoadedThreads {
                Task {
                    await dataStore.loadThreads(for: uid)
                }
            }
        }
        if !dataStore.hasLoadedBookings {
            Task {
                await dataStore.loadBookings()
            }
        }

    }

    private var requiresCoreStartupFeeds: Bool {
        appState.isAuthenticated || guestBrowsingEnabled
    }

    private func advanceLoadingProgress(to value: CGFloat) {
        let clamped = max(0.06, min(value, 1.0))
        if clamped > loadingProgress {
            loadingProgress = clamped
        } else if clamped == 1.0 {
            loadingProgress = 1.0
        }
    }

    private func startLoadingProgressTickerIfNeeded() {
        guard loadingProgressTask == nil else { return }
        loadingProgressTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 120_000_000)
                await MainActor.run {
                    guard shouldShowLoadingScreen else { return }
                    guard loadingProgress < 1.0 else { return }
                    let ceiling: CGFloat
                    if loadingReadyForDismiss {
                        ceiling = 1.0
                    } else if appState.isLoading {
                        ceiling = 0.88
                    } else if appState.isAuthenticated {
                        ceiling = 0.97
                    } else {
                        ceiling = 0.93
                    }
                    guard loadingProgress < ceiling else { return }
                    let increment: CGFloat
                    if loadingProgress < 0.82 {
                        increment = appState.loadingContext == .signingIn ? 0.020 : 0.016
                    } else if loadingProgress < 0.92 {
                        increment = appState.loadingContext == .signingIn ? 0.015 : 0.012
                    } else if loadingProgress < 0.97 {
                        increment = appState.loadingContext == .signingIn ? 0.010 : 0.008
                    } else {
                        increment = 0.005
                    }
                    loadingProgress = min(ceiling, loadingProgress + increment)
                }
            }
        }
    }

    private func stopLoadingProgressTicker() {
        loadingProgressTask?.cancel()
        loadingProgressTask = nil
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
    let context: AppState.LoadingContext
    let finishSignal: Bool
    let progressValue: CGFloat
    let onBarCompleted: () -> Void

    private var icon: String {
        switch context {
        case .startup:
            return "graduationcap.fill"
        case .signingIn:
            return "person.badge.shield.checkmark.fill"
        case .signingOut:
            return "rectangle.portrait.and.arrow.right"
        }
    }

    private var titleText: String {
        switch context {
        case .startup:
            return "ScheduleMe"
        case .signingIn:
            return "Signing in"
        case .signingOut:
            return "Signing out"
        }
    }

    private var subtitleText: String {
        switch context {
        case .startup:
            return "Loading your marketplace…"
        case .signingIn:
            return "Retrieving account data and syncing your dashboard…"
        case .signingOut:
            return "Clearing your session securely…"
        }
    }

    private var loadingTint: Color {
        switch context {
        case .startup, .signingIn:
            return ScheduleMeTheme.accent
        case .signingOut:
            return Color(hex: "ef4444")
        }
    }

    private var iconCircleBackground: Color {
        switch context {
        case .startup, .signingIn:
            return ScheduleMeTheme.accentSoft
        case .signingOut:
            return Color(hex: "ef4444").opacity(0.18)
        }
    }

    var body: some View {
        VStack {
            Spacer()

            VStack(spacing: 16) {
                Circle()
                    .fill(iconCircleBackground)
                    .frame(width: 72, height: 72)
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundColor(loadingTint)
                    )

                if context == .startup {
                    HStack(spacing: 0) {
                        Text("Schedule")
                            .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        Text("Me")
                            .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.accent)
                    }
                } else {
                    Text(titleText)
                        .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                }

                Text(subtitleText)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 10)

                ScheduleMeLoadingBar(
                    width: 120,
                    height: 8,
                    tint: loadingTint,
                    completesOnFirstRun: true,
                    finishSignal: finishSignal,
                    progressOverride: progressValue,
                    shimmerOpacity: context == .signingOut ? 0.12 : 0.22,
                    onCompleted: onBarCompleted
                )
                    .padding(.top, 6)
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 28)
            .frame(maxWidth: 350)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
            .shadow(color: Color.black.opacity(0.14), radius: 18, y: 10)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 22)
    }
}
