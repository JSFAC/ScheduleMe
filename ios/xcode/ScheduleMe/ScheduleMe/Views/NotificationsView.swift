// FILE OVERVIEW:
// Notifications list/detail experience with archive/delete behavior.
//
// DEBUG NOTES:
// If notification rows, tabs, or paging look wrong, debug this file.

import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab: NotificationTab = .all
    @State private var currentPage: Int = 1
    private let pageSize = 6

    @State private var archivedIDs: Set<String> = []
    @State private var deletedIDs: Set<String> = []

    private let archivedKey = "scheduleme_archived_notifications"
    private let deletedKey = "scheduleme_deleted_notifications"

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false, respectsTabBarInset: false) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 12) {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                                .frame(width: 36, height: 36)
                                .background(ScheduleMeTheme.surface)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                        }

                        Text("Notifications")
                            .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 12)

                    NotificationTabs(selected: $selectedTab)
                        .padding(.horizontal, 20)

                    if (!dataStore.hasLoadedNotifications || dataStore.isLoadingNotifications) && dataStore.notifications.isEmpty {
                        NotificationSkeletonList()
                            .padding(.horizontal, 20)
                    } else if notificationsForTab.isEmpty {
                        ScheduleMeEmptyState(
                            title: "No notifications",
                            message: "You're all caught up for now.",
                            systemImage: "bell"
                        )
                        .padding(.horizontal, 20)
                    } else {
                        VStack(spacing: 8) {
                            ForEach(pagedNotifications) { notification in
                                NavigationLink(destination: NotificationDetailView(notification: notification)) {
                                    NotificationRow(notification: notification)
                                }
                                .buttonStyle(.plain)
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        delete(notification)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }

                                    Button {
                                        toggleArchive(notification)
                                    } label: {
                                        Label(selectedTab == .archived ? "Unarchive" : "Archive", systemImage: "archivebox")
                                    }
                                    .tint(ScheduleMeTheme.accent)
                                }
                            }
                        }
                        .padding(.horizontal, 20)

                        NotificationPagination(
                            currentPage: $currentPage,
                            totalPages: totalPages
                        )
                        .padding(.horizontal, 20)
                        .padding(.top, 4)
                    }
                }
                .padding(.bottom, 12)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            loadArchiveState()
            await dataStore.loadNotifications()
        }
        .onAppear {
            Task { await dataStore.loadNotifications() }
        }
        .onChange(of: selectedTab) { _, _ in
            currentPage = 1
        }
    }

    // MARK: - Derived Lists

    private var notificationsForTab: [AppNotification] {
        let filtered = dataStore.notifications.filter { !deletedIDs.contains($0.id) }
        switch selectedTab {
        case .all:
            return filtered.filter { !archivedIDs.contains($0.id) }
        case .archived:
            return filtered.filter { archivedIDs.contains($0.id) }
        }
    }

    private var totalPages: Int {
        max(1, Int(ceil(Double(notificationsForTab.count) / Double(pageSize))))
    }

    private var pagedNotifications: [AppNotification] {
        let start = (currentPage - 1) * pageSize
        let end = min(start + pageSize, notificationsForTab.count)
        guard start < end else { return [] }
        return Array(notificationsForTab[start..<end])
    }

    // MARK: - Local Persistence

    private func loadArchiveState() {
        if let saved = UserDefaults.standard.array(forKey: archivedKey) as? [String] {
            archivedIDs = Set(saved)
        }
        if let saved = UserDefaults.standard.array(forKey: deletedKey) as? [String] {
            deletedIDs = Set(saved)
        }
    }

    private func persistArchiveState() {
        UserDefaults.standard.set(Array(archivedIDs), forKey: archivedKey)
        UserDefaults.standard.set(Array(deletedIDs), forKey: deletedKey)
    }

    // MARK: - User Actions

    private func toggleArchive(_ notification: AppNotification) {
        if archivedIDs.contains(notification.id) {
            archivedIDs.remove(notification.id)
        } else {
            archivedIDs.insert(notification.id)
        }
        persistArchiveState()
    }

    private func delete(_ notification: AppNotification) {
        deletedIDs.insert(notification.id)
        archivedIDs.remove(notification.id)
        persistArchiveState()
    }
}

private enum NotificationTab: String, CaseIterable {
    case all = "All"
    case archived = "Archived"
}

private struct NotificationTabs: View {
    @Binding var selected: NotificationTab

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width / 2
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(ScheduleMeTheme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(ScheduleMeTheme.cardBorder)
                    )

                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(ScheduleMeTheme.accent)
                    .frame(width: width - 6, height: 30)
                    .offset(x: selected == .all ? 4 : width + 2)
                    .animation(.easeInOut(duration: 0.2), value: selected)

                HStack(spacing: 0) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selected = .all
                        }
                    } label: {
                        Text("All")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundColor(selected == .all ? .white : ScheduleMeTheme.titleText)
                            .frame(width: width, height: 34)
                    }
                    .buttonStyle(.plain)

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selected = .archived
                        }
                    } label: {
                        Text("Archived")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundColor(selected == .archived ? .white : ScheduleMeTheme.titleText)
                            .frame(width: width, height: 34)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(height: 34)
    }
}

private struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(ScheduleMeTheme.accent)
                .frame(width: 3)

            Circle()
                .fill(ScheduleMeTheme.accentSoft)
                .frame(width: 34, height: 34)
                .overlay(
                    Image(systemName: iconName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(notification.title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                if let subtitle = notification.subtitle {
                    Text(subtitle)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
                Text(notification.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }
            Spacer()
            if let chip = statusChip {
                Text(chip)
                    .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.accent)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(ScheduleMeTheme.accentSoft)
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 10)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
    }

    private var iconName: String {
        let lower = notification.title.lowercased()
        if lower.contains("cancel") { return "xmark.circle" }
        if lower.contains("confirm") { return "checkmark.circle" }
        if lower.contains("request") { return "paperplane" }
        if lower.contains("message") { return "bubble.left.and.bubble.right" }
        return "calendar"
    }

    private var statusChip: String? {
        let lower = notification.title.lowercased()
        if lower.contains("cancel") { return "Cancelled" }
        if lower.contains("confirm") { return "Confirmed" }
        if lower.contains("request") { return "Requested" }
        return nil
    }
}

private struct NotificationDetailView: View {
    @EnvironmentObject private var tabRouter: TabRouter
    @Environment(\.dismiss) private var dismiss
    let notification: AppNotification

    var body: some View {
        ScheduleMeScreen(showsTopBar: false, respectsTabBarInset: false) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                            .frame(width: 36, height: 36)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }

                    Text("Notification")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)

                ScheduleMeCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(notification.title)
                            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        if let subtitle = notification.subtitle {
                            Text(subtitle)
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                        Text(notification.createdAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }
                }
                .padding(.horizontal, 20)

                if notification.bookingID != nil {
                    Button("Open Booking") {
                        tabRouter.selected = .bookings
                        dismiss()
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                    .padding(.horizontal, 20)
                }

                Spacer()
            }
        }
    }
}

private struct NotificationPagination: View {
    @Binding var currentPage: Int
    let totalPages: Int

    var body: some View {
        HStack {
            Button("< Back") {
                currentPage = max(1, currentPage - 1)
            }
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
            .foregroundColor(currentPage == 1 ? ScheduleMeTheme.mutedText : ScheduleMeTheme.accent)
            .disabled(currentPage == 1)

            Spacer()
            Text("\(currentPage) / \(totalPages)")
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                .foregroundColor(ScheduleMeTheme.mutedText)
            Spacer()

            Button("Next >") {
                currentPage = min(totalPages, currentPage + 1)
            }
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
            .foregroundColor(currentPage == totalPages ? ScheduleMeTheme.mutedText : ScheduleMeTheme.accent)
            .disabled(currentPage == totalPages)
        }
    }
}

private struct NotificationSkeletonList: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<5, id: \.self) { _ in
                HStack(spacing: 12) {
                    SkeletonCircle(size: 38)
                    VStack(alignment: .leading, spacing: 6) {
                        SkeletonBlock(width: 180, height: 14, cornerRadius: 6)
                        SkeletonBlock(width: 120, height: 12, cornerRadius: 6)
                    }
                    Spacer()
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 14)
                .background(ScheduleMeTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18).stroke(ScheduleMeTheme.cardBorder))
            }
        }
    }
}
