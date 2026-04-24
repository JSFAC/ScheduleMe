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
    @State private var didApplyInitialDefaultTab = false
    @State private var showingPageTour = false
    @State private var pageTourStepIndex = 0
    @State private var visitedTourTabs: Set<ScheduleMeTab> = []
    private let pageTourSeenUsersKey = "scheduleme_consumer_page_tour_seen_users"

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

            Group {
            if appState.isAuthenticated {
                BookingsView()
            } else {
                GuestBookingsView(
                    onBrowse: {
                        tabRouter.selected = .browse
                    }
                )
            }
            }
            .tabItem {
                Label("Bookings", systemImage: "calendar")
            }
            .tag(ScheduleMeTab.bookings)

            Group {
            if appState.isAuthenticated {
                MessagesView()
            } else {
                GuestMessagesView(
                    onBrowse: {
                        tabRouter.selected = .browse
                    }
                )
            }
            }
            .tabItem {
                Label("Messages", systemImage: "bubble.left.and.bubble.right")
            }
            .badge(appState.isAuthenticated ? unreadMessagesCount : 0)
            .tag(ScheduleMeTab.messages)
        }
        .tint(ScheduleMeTheme.accent)
        .task(id: appState.userID) {
            guard let userID = appState.userID else { return }
            await dataStore.loadThreads(for: userID)
        }
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
            presentPageTourIfNeeded()
        }
        .onChange(of: appState.isAuthenticated) { _, _ in
            presentPageTourIfNeeded()
        }
        .onChange(of: tabRouter.selected) { _, selected in
            guard showingPageTour else { return }
            visitedTourTabs.insert(selected)
        }
        .overlay(alignment: .top) {
            if showingPageTour, let step = currentTourStep {
                InteractivePagesTourCard(
                    step: step,
                    stepIndex: pageTourStepIndex,
                    totalSteps: pageTourSteps.count,
                    hasVisitedTargetTab: visitedTourTabs.contains(step.tab),
                    onOpenTarget: {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                            tabRouter.selected = step.tab
                        }
                    },
                    onNext: advancePageTour,
                    onSkip: finishPageTour
                )
                .padding(.horizontal, 14)
                .padding(.top, 8)
                .id(step.id)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showingPageTour)
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

    private var unreadMessagesCount: Int {
        max(0, dataStore.threads.reduce(0) { $0 + max(0, $1.unreadCount) })
    }

    private func presentPageTourIfNeeded() {
        guard appState.isAuthenticated else { return }
        guard let userID = appState.userID, !userID.isEmpty else { return }
        guard hasSeenPageTour(for: userID) == false else { return }
        guard showingPageTour == false else { return }
        pageTourStepIndex = 0
        visitedTourTabs = [tabRouter.selected]
        showingPageTour = true
    }

    fileprivate struct PageTourStep: Identifiable {
        let id: Int
        let tab: ScheduleMeTab
        let icon: String
        let title: String
        let message: String
    }

    private var pageTourSteps: [PageTourStep] {
        [
        .init(
            id: 0,
            tab: .home,
            icon: "house.fill",
            title: "Home, your command center",
            message: "See top-rated providers, quick-response pros, and personalized suggestions in one place."
        ),
        .init(
            id: 1,
            tab: .browse,
            icon: "magnifyingglass",
            title: "Browse with confidence",
            message: "Filter by category, compare ratings, and find the right provider in seconds."
        ),
        .init(
            id: 2,
            tab: .bookings,
            icon: "calendar.badge.clock",
            title: "Track every booking",
            message: "Create requests and monitor progress from pending to completed without losing details."
        ),
        .init(
            id: 3,
            tab: .messages,
            icon: "bubble.left.and.bubble.right.fill",
            title: "Stay in sync with pros",
            message: "Keep confirmations, updates, and questions in one clean thread."
        )
    ]
    }

    private var currentTourStep: PageTourStep? {
        guard pageTourStepIndex >= 0, pageTourStepIndex < pageTourSteps.count else { return nil }
        return pageTourSteps[pageTourStepIndex]
    }

    private func advancePageTour() {
        guard let step = currentTourStep else {
            finishPageTour()
            return
        }
        guard visitedTourTabs.contains(step.tab) else {
            tabRouter.selected = step.tab
            return
        }
        if pageTourStepIndex >= pageTourSteps.count - 1 {
            finishPageTour()
        } else {
            let nextIndex = pageTourStepIndex + 1
            let nextStep = pageTourSteps[nextIndex]
            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                pageTourStepIndex = nextIndex
                tabRouter.selected = nextStep.tab
            }
            visitedTourTabs.insert(nextStep.tab)
        }
    }

    private func finishPageTour() {
        if let userID = appState.userID, !userID.isEmpty {
            markPageTourSeen(for: userID)
        }
        showingPageTour = false
    }

    private func hasSeenPageTour(for userID: String) -> Bool {
        let seenUsers = Set(UserDefaults.standard.stringArray(forKey: pageTourSeenUsersKey) ?? [])
        return seenUsers.contains(userID)
    }

    private func markPageTourSeen(for userID: String) {
        var seenUsers = Set(UserDefaults.standard.stringArray(forKey: pageTourSeenUsersKey) ?? [])
        seenUsers.insert(userID)
        UserDefaults.standard.set(Array(seenUsers), forKey: pageTourSeenUsersKey)
    }
}

private struct InteractivePagesTourCard: View {
    let step: MainTabView.PageTourStep
    let stepIndex: Int
    let totalSteps: Int
    let hasVisitedTargetTab: Bool
    let onOpenTarget: () -> Void
    let onNext: () -> Void
    let onSkip: () -> Void
    @State private var pulse = false
    @State private var floatCard = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 10) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 34, height: 34)
                    .overlay(
                        Circle()
                            .stroke(ScheduleMeTheme.accent.opacity(0.30), lineWidth: 1.5)
                            .scaleEffect(pulse ? 1.18 : 0.92)
                            .opacity(pulse ? 0.12 : 0.45)
                    )
                    .overlay(
                        Image(systemName: step.icon)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(ScheduleMeTheme.accent)
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text("Quick tour")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    Text(step.title)
                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .lineLimit(2)
                }
                Spacer()
                Text("\(stepIndex + 1)/\(totalSteps)")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }

            HStack(spacing: 6) {
                ForEach(0..<totalSteps, id: \.self) { idx in
                    Capsule()
                        .fill(idx <= stepIndex ? ScheduleMeTheme.accent : ScheduleMeTheme.cardBorder)
                        .frame(width: idx == stepIndex ? 22 : 8, height: 6)
                        .animation(.spring(response: 0.28, dampingFraction: 0.82), value: stepIndex)
                }
            }

            Text(step.message)
                .font(.custom(ScheduleMeTheme.fontName, size: 12.5).weight(.medium))
                .foregroundColor(ScheduleMeTheme.mutedText)

            Button(primaryButtonTitle) {
                if hasVisitedTargetTab {
                    onNext()
                } else {
                    onOpenTarget()
                }
            }
            .buttonStyle(ScheduleMePrimaryButtonStyle())

            Button("Skip tour") {
                onSkip()
            }
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
            .foregroundColor(ScheduleMeTheme.mutedText)
        }
        .padding(14)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ScheduleMeTheme.cardBorder))
        .shadow(color: .black.opacity(0.14), radius: 10, y: 4)
        .offset(y: floatCard ? 0 : -4)
        .opacity(floatCard ? 1 : 0.85)
        .onAppear {
            withAnimation(.spring(response: 0.36, dampingFraction: 0.86)) {
                floatCard = true
            }
            pulse = true
        }
    }

    private var primaryButtonTitle: String {
        return stepIndex == totalSteps - 1 ? "Finish tour" : "Next"
    }
}

private struct GuestBookingsView: View {
    let onBrowse: () -> Void

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(allowsBounce: true) {
                VStack(spacing: 10) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Bookings")
                                .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                            Text("Sign in is required to request services and track bookings.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                    }

                    ScheduleMeEmptyState(
                        title: "Guest mode",
                        message: "You can browse providers, but booking is available after sign in.",
                        systemImage: "calendar.badge.exclamationmark",
                        actionTitle: "Browse professionals",
                        action: onBrowse
                    )
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct GuestMessagesView: View {
    let onBrowse: () -> Void

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(allowsBounce: true) {
                VStack(spacing: 10) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Messages")
                                .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                            Text("Sign in is required to message providers and manage conversations.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                    }

                    ScheduleMeEmptyState(
                        title: "Guest mode",
                        message: "After sign in, you can chat with providers directly.",
                        systemImage: "bubble.left.and.exclamationmark.bubble.right",
                        actionTitle: "Browse professionals",
                        action: onBrowse
                    )
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
