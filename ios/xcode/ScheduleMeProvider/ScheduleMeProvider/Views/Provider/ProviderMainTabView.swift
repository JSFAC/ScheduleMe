// FILE OVERVIEW:
// Provider app tab container for provider-only build target.
//
// DEBUG NOTES:
// Provider navigation and initial data loads are controlled in this file.

import SwiftUI

// MARK: - Provider Tab Shell

struct ProviderMainTabView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var providerTabRouter: ProviderTabRouter
    @EnvironmentObject private var providerStore: ProviderDataStore
    @State private var showingPageTour = false
    @State private var pageTourStepIndex = 0
    @State private var visitedTourTabs: Set<ProviderTab> = []
    private let pageTourSeenUsersKey = "scheduleme_provider_page_tour_seen_users"

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
        .onAppear {
            presentPageTourIfNeeded()
        }
        .onChange(of: appState.isAuthenticated) { _, _ in
            presentPageTourIfNeeded()
        }
        .onChange(of: providerTabRouter.selected) { _, selected in
            guard showingPageTour else { return }
            visitedTourTabs.insert(selected)
        }
        .overlay(alignment: .top) {
            if showingPageTour, let step = currentTourStep {
                ProviderInteractivePagesTourCard(
                    step: step,
                    stepIndex: pageTourStepIndex,
                    totalSteps: pageTourSteps.count,
                    hasVisitedTargetTab: visitedTourTabs.contains(step.tab),
                    onOpenTarget: {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                            providerTabRouter.selected = step.tab
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

    private func presentPageTourIfNeeded() {
        guard appState.isAuthenticated else { return }
        guard let userID = appState.userID, !userID.isEmpty else { return }
        guard hasSeenPageTour(for: userID) == false else { return }
        guard showingPageTour == false else { return }
        pageTourStepIndex = 0
        visitedTourTabs = [providerTabRouter.selected]
        showingPageTour = true
    }

    fileprivate struct PageTourStep: Identifiable {
        let id: Int
        let tab: ProviderTab
        let icon: String
        let title: String
        let message: String
    }

    private var pageTourSteps: [PageTourStep] {
        [
            .init(
                id: 0,
                tab: .overview,
                icon: "chart.bar.xaxis",
                title: "Overview at a glance",
                message: "Track your business performance, listing status, and day-to-day highlights from one place."
            ),
            .init(
                id: 1,
                tab: .bookings,
                icon: "calendar.badge.clock",
                title: "Manage every booking",
                message: "Review requests, confirm jobs, and keep your schedule moving without missing pending items."
            ),
            .init(
                id: 2,
                tab: .calendar,
                icon: "calendar",
                title: "Stay calendar synced",
                message: "See your provider schedule and keep upcoming jobs organized in one timeline."
            ),
            .init(
                id: 3,
                tab: .messages,
                icon: "bubble.left.and.bubble.right.fill",
                title: "Reply faster in messages",
                message: "Keep all customer updates and booking communication in clean conversation threads."
            ),
            .init(
                id: 4,
                tab: .more,
                icon: "ellipsis.circle.fill",
                title: "Control your provider tools",
                message: "Edit listing details, services, hours, and settings from the More tab."
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
            providerTabRouter.selected = step.tab
            return
        }
        if pageTourStepIndex >= pageTourSteps.count - 1 {
            finishPageTour()
        } else {
            let nextIndex = pageTourStepIndex + 1
            let nextStep = pageTourSteps[nextIndex]
            withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                pageTourStepIndex = nextIndex
                providerTabRouter.selected = nextStep.tab
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

private struct ProviderInteractivePagesTourCard: View {
    let step: ProviderMainTabView.PageTourStep
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
        stepIndex == totalSteps - 1 ? "Finish tour" : "Next"
    }
}
