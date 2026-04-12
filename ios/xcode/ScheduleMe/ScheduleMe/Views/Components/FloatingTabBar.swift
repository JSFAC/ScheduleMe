// FILE OVERVIEW:
// Custom floating tab bar component used in specific layouts.
//
// DEBUG NOTES:
// If tab pill visuals or selected-state behavior regresses, debug this component.

import SwiftUI

// MARK: - Floating Tab Bar

struct FloatingTabBar: View {
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    let showsCampus: Bool

    private let height: CGFloat = 68

    var body: some View {
        HStack(spacing: 14) {
            if showsCampus {
                FloatingTabBarItem(
                    title: "Campus",
                    systemImage: "graduationcap",
                    isSelected: tabRouter.selected == .campus
                ) {
                    tabRouter.selected = .campus
                }
            }
            FloatingTabBarItem(
                title: "Home",
                systemImage: "house",
                isSelected: tabRouter.selected == .home
            ) {
                tabRouter.selected = .home
            }
            FloatingTabBarItem(
                title: "Browse",
                systemImage: "magnifyingglass",
                isSelected: tabRouter.selected == .browse
            ) {
                tabRouter.selected = .browse
            }
            FloatingTabBarItem(
                title: "Bookings",
                systemImage: "calendar",
                isSelected: tabRouter.selected == .bookings
            ) {
                tabRouter.selected = .bookings
            }
            FloatingTabBarItem(
                title: "Messages",
                systemImage: "bubble.left.and.bubble.right",
                isSelected: tabRouter.selected == .messages,
                badgeCount: unreadMessagesCount
            ) {
                tabRouter.selected = .messages
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(ScheduleMeTheme.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 30, style: .continuous)
                        .stroke(ScheduleMeTheme.cardBorder)
                )
        )
        .shadow(color: .black.opacity(0.08), radius: 10, y: 6)
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 8)
        .frame(height: height)
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: tabRouter.selected)
    }

    var barHeight: CGFloat { height }

    private var unreadMessagesCount: Int {
        max(0, dataStore.threads.reduce(0) { $0 + max(0, $1.unreadCount) })
    }
}

private struct FloatingTabBarItem: View {
    let title: String
    let systemImage: String
    let isSelected: Bool
    var badgeCount: Int = 0
    let action: () -> Void

    var body: some View {
        // Stateless tab item; parent owns selected state and navigation action.
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack {
                    if isSelected {
                        Circle()
                            .fill(ScheduleMeTheme.accentSoft)
                            .frame(width: 30, height: 30)
                    }
                    Image(systemName: systemImage)
                        .font(.system(size: 17, weight: .regular))
                        .foregroundColor(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.titleText)
                    if badgeCount > 0 {
                        Text("\(min(badgeCount, 99))")
                            .font(.custom(ScheduleMeTheme.fontName, size: 8).weight(.bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(ScheduleMeTheme.accent)
                            .clipShape(Capsule())
                            .offset(x: 14, y: -12)
                    }
                }
                .scaleEffect(isSelected ? 1.03 : 1)
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(isSelected ? .semibold : .medium))
                    .foregroundColor(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.titleText)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }
}
