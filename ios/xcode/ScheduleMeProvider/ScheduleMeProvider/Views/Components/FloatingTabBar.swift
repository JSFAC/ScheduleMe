// FILE OVERVIEW:
// Native-style iOS tab bar with glass/material background and animated selection indicator.
//
// DEBUG NOTES:
// If tab pill visuals or selected-state behavior regresses, debug this component.

import SwiftUI

struct FloatingTabBar: View {
    @EnvironmentObject private var tabRouter: TabRouter
    let showsCampus: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Top separator
            Rectangle()
                .fill(ScheduleMeTheme.cardBorder)
                .frame(height: 0.5)

            HStack(spacing: 0) {
                if showsCampus {
                    tabItem("Campus", systemImage: "graduationcap", tab: .campus)
                }
                tabItem("Home", systemImage: "house", tab: .home)
                tabItem("Browse", systemImage: "magnifyingglass", tab: .browse)
                tabItem("Bookings", systemImage: "calendar", tab: .bookings)
                tabItem("Messages", systemImage: "bubble.left.and.bubble.right", tab: .messages)
            }
            .frame(height: 49)
            .padding(.bottom, 2) // slight visual breathing room before home indicator
        }
        .background(
            ScheduleMeTheme.surface
                .ignoresSafeArea(edges: .bottom)
        )
        .frame(maxWidth: .infinity)
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: tabRouter.selected)
    }

    @ViewBuilder
    private func tabItem(_ title: String, systemImage: String, tab: ScheduleMeTab) -> some View {
        let isSelected = tabRouter.selected == tab
        Button {
            tabRouter.selected = tab
        } label: {
            VStack(spacing: 4) {
                ZStack {
                    if isSelected {
                        Capsule()
                            .fill(ScheduleMeTheme.accentSoft)
                            .frame(width: 56, height: 30)
                            .transition(.scale(scale: 0.7).combined(with: .opacity))
                    }
                    Image(systemName: isSelected ? filledIcon(systemImage) : systemImage)
                        .font(.system(size: 17, weight: isSelected ? .semibold : .regular))
                        .foregroundColor(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.mutedText)
                        .scaleEffect(isSelected ? 1.05 : 1.0)
                }
                .frame(height: 30)

                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 9.5).weight(isSelected ? .semibold : .medium))
                    .foregroundColor(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.mutedText)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func filledIcon(_ name: String) -> String {
        let fillMap: [String: String] = [
            "house": "house.fill",
            "magnifyingglass": "magnifyingglass",
            "calendar": "calendar",
            "bubble.left.and.bubble.right": "bubble.left.and.bubble.right.fill",
            "graduationcap": "graduationcap.fill"
        ]
        return fillMap[name] ?? name
    }
}
