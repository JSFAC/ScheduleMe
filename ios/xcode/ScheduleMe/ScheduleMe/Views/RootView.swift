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
    @State private var didBootstrap = false
    @State private var didRunStartupPrefetch = false
    @State private var startupPrefetchCompleted = false
    @State private var loadingVisibleUntil = Date.distantPast
    @State private var loadingHoldRefresh = false
    @State private var loadingBarCompleted = false
    @State private var loadingProgress: CGFloat = 0.08
    @State private var loadingProgressTask: Task<Void, Never>?

    // Keep startup loading visible long enough for the progress animation to feel intentional.
    private let minimumLoadingVisibility: TimeInterval = 1.15

    var body: some View {
        ScheduleMePage {
            Group {
                // App entry routing order:
                // 1) auth loading state, 2) main tabs if authenticated, 3) auth screens.
                if shouldShowLoadingScreen {
                    ConsumerLoadingScreen(
                        context: appState.loadingContext,
                        finishSignal: loadingReadyForDismiss,
                        progressValue: loadingProgress
                    ) {
                        loadingBarCompleted = true
                        loadingHoldRefresh.toggle()
                    }
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
        .task {
            guard !didBootstrap else { return }
            didBootstrap = true
            if appState.isLoading {
                loadingVisibleUntil = Date().addingTimeInterval(minimumLoadingVisibility)
                loadingBarCompleted = false
                loadingProgress = 0.08
            }
            startLoadingProgressTickerIfNeeded()
            await appState.bootstrap()
            advanceLoadingProgress(to: 0.34)
            await runStartupPrefetchIfNeeded()
        }
        .onChange(of: appState.isLoading) { _, isLoadingNow in
            if isLoadingNow {
                loadingVisibleUntil = Date().addingTimeInterval(minimumLoadingVisibility)
                loadingBarCompleted = false
                loadingProgress = 0.08
                startLoadingProgressTickerIfNeeded()
                return
            }
            if !appState.isAuthenticated {
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
                startupPrefetchCompleted = false
                loadingBarCompleted = false
                loadingProgress = 0.08
                stopLoadingProgressTicker()
                return
            }

            startLoadingProgressTickerIfNeeded()
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
        _ = loadingHoldRefresh
        if appState.isLoading { return true }
        if appState.isAuthenticated && !startupPrefetchCompleted { return true }
        if !loadingBarCompleted { return true }
        return !loadingReadyForDismiss
    }

    private var loadingReadyForDismiss: Bool {
        let minimumVisibleElapsed = Date() >= loadingVisibleUntil
        let sessionReady = !appState.isLoading
        let dataReady = (!appState.isAuthenticated) || startupPrefetchCompleted
        return minimumVisibleElapsed && sessionReady && dataReady
    }

    private func runStartupPrefetchIfNeeded() async {
        guard appState.isAuthenticated else { return }
        guard !didRunStartupPrefetch else { return }
        didRunStartupPrefetch = true
        startupPrefetchCompleted = false

        let baseline: CGFloat = 0.34
        let upperBound: CGFloat = 0.96
        advanceLoadingProgress(to: baseline)

        var plannedSteps = 1 // final completion checkpoint
        if appState.userID != nil {
            plannedSteps += 1 // favorites
            if !dataStore.hasLoadedThreads { plannedSteps += 1 }
        }
        if !dataStore.hasLoadedBookings { plannedSteps += 1 }
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

        if let uid = appState.userID {
            await dataStore.loadFavorites(userID: uid)
            markStepComplete()
        } else {
            markStepComplete()
        }
        if !dataStore.hasLoadedThreads, let uid = appState.userID {
            await dataStore.loadThreads(for: uid)
            markStepComplete()
        }
        if !dataStore.hasLoadedBookings {
            await dataStore.loadBookings()
            markStepComplete()
        }
        if !dataStore.hasLoadedBusinesses {
            await dataStore.loadNearbyBusinesses(coordinate: coordinate)
            markStepComplete()
        }
        if appState.eduVerified == true && !dataStore.hasLoadedCampusBusinesses {
            let campusDomain = appState.resolvedSchoolDomain
            let campusTag = campusDomain?.split(separator: ".").first.map { String($0).uppercased() }
            await dataStore.loadCampusBusinesses(schoolDomain: campusDomain, campusTag: campusTag)
            markStepComplete()
        }

        startupPrefetchCompleted = true
        markStepComplete()
        advanceLoadingProgress(to: 1.0)
        if appState.loadingContext == .signingIn {
            appState.loadingContext = .startup
        }
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

    var body: some View {
        VStack {
            Spacer()

            VStack(spacing: 16) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 72, height: 72)
                    .overlay(
                        Image(systemName: icon)
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.accent)
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
                    tint: ScheduleMeTheme.accent,
                    completesOnFirstRun: true,
                    finishSignal: finishSignal,
                    progressOverride: progressValue,
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
