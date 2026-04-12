// FILE OVERVIEW:
// Bookings hub grouped into pending/active/completed/cancelled sections.
//
// DEBUG NOTES:
// Section paging/expansion issues and booking counts are controlled in this file.

import SwiftUI

struct BookingsView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @State private var pendingExpanded = false
    @State private var activeExpanded = false
    @State private var completedExpanded = false
    @State private var cancelledExpanded = false
    @State private var disputedExpanded = false
    @State private var pendingPage = 0
    @State private var activePage = 0
    @State private var completedPage = 0
    @State private var cancelledPage = 0
    @State private var disputedPage = 0

    private let pageSize = 4

    // MARK: - Derived Counts

    private var activeCount: Int {
        dataStore.bookings.filter { ["confirmed", "active", "completion_pending", "in_progress"].contains($0.status.lowercased()) }.count
    }

    private var completedCount: Int {
        dataStore.bookings.filter { ["completed", "awaiting_consumer_confirmation"].contains($0.status.lowercased()) }.count
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(allowsBounce: true, onRefresh: refreshBookings) {
                VStack(spacing: 0) {
                    BookingsHeaderCard(
                        title: "My Bookings",
                        subtitle: "Track and manage your service requests",
                        actionTitle: "New request",
                        action: { tabRouter.selected = .browse }
                    ) {
                        HStack(spacing: 12) {
                            BookingStatChip(title: "Total", value: "\(dataStore.bookings.count)")
                            BookingStatChip(title: "Active", value: "\(activeCount)")
                            BookingStatChip(title: "Completed", value: "\(completedCount)")
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .stroke(ScheduleMeTheme.cardBorder.opacity(0.45), lineWidth: 1)
                    )
                    .padding(.horizontal, 20)
                    .padding(.top, 8)

                    VStack(alignment: .leading, spacing: 10) {
                        if (!dataStore.hasLoadedBookings || dataStore.isLoadingBookings) && dataStore.bookings.isEmpty {
                            BookingSkeletonList()
                        } else if let bookingsError = dataStore.bookingsError {
                            ScheduleMeEmptyState(
                                title: "Bookings unavailable",
                                message: bookingsError,
                                systemImage: "calendar.badge.exclamationmark"
                            )
                        } else if dataStore.bookings.isEmpty {
                            ScheduleMeEmptyState(
                                title: "No bookings yet",
                                message: "Browse local professionals and book your first service.",
                                systemImage: "calendar",
                                actionTitle: "Browse professionals",
                                action: { tabRouter.selected = .browse }
                            )
                        } else {
                            BookingSectionView(
                                title: "Pending",
                                bookings: pendingBookings,
                                expanded: $pendingExpanded,
                                page: $pendingPage,
                                pageSize: pageSize
                            )
                            BookingSectionView(
                                title: "Disputed",
                                bookings: disputedBookings,
                                expanded: $disputedExpanded,
                                page: $disputedPage,
                                pageSize: pageSize
                            )
                            BookingSectionView(
                                title: "Active",
                                bookings: activeBookings,
                                expanded: $activeExpanded,
                                page: $activePage,
                                pageSize: pageSize
                            )
                            BookingSectionView(
                                title: "Completed",
                                bookings: completedBookings,
                                expanded: $completedExpanded,
                                page: $completedPage,
                                pageSize: pageSize
                            )
                            BookingSectionView(
                                title: "Cancelled",
                                bookings: cancelledBookings,
                                expanded: $cancelledExpanded,
                                page: $cancelledPage,
                                pageSize: pageSize
                            )
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 10)
                    .padding(.bottom, 20)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            await dataStore.loadBookings()
        }
    }

    private func refreshBookings() async {
        await dataStore.loadBookings()
    }

    // MARK: - Buckets

    private var pendingBookings: [BookingSummary] {
        dataStore.bookings.filter { bookingBucket(for: $0.status) == .pending }
    }

    private var activeBookings: [BookingSummary] {
        dataStore.bookings.filter { bookingBucket(for: $0.status) == .active }
    }

    private var completedBookings: [BookingSummary] {
        dataStore.bookings.filter { bookingBucket(for: $0.status) == .completed }
    }

    private var cancelledBookings: [BookingSummary] {
        dataStore.bookings.filter { bookingBucket(for: $0.status) == .cancelled }
    }

    private var disputedBookings: [BookingSummary] {
        dataStore.bookings.filter { bookingBucket(for: $0.status) == .disputed }
    }

    private enum BookingBucket {
        case pending
        case active
        case completed
        case cancelled
        case disputed
    }

    private func bookingBucket(for rawStatus: String) -> BookingBucket {
        let status = rawStatus.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        // Disputes first so they never get swallowed by generic failed/cancelled matching.
        if status.contains("dispute") || status.contains("chargeback") {
            return .disputed
        }
        if status.contains("cancel") || status == "payment_failed" || status.contains("failed") {
            return .cancelled
        }
        // Payment capture alone should not move the booking to completed.
        // It stays pending until provider accepts/starts/completes.
        if status == "paid" || status == "payment_collected" || status == "payment_pending" || status == "awaiting_payment" {
            return .pending
        }
        if status == "awaiting_consumer_confirmation" {
            return .completed
        }
        if status.contains("complete") {
            return .completed
        }
        if status.contains("confirm") || status == "active" || status == "in_progress" || status.contains("progress") {
            return .active
        }

        // Default unknown/new states to pending so counts reconcile and are visible to users.
        return .pending
    }
}

private struct BookingSectionView: View {
    let title: String
    let bookings: [BookingSummary]
    @Binding var expanded: Bool
    @Binding var page: Int
    let pageSize: Int

    private var totalPages: Int {
        max(1, Int(ceil(Double(bookings.count) / Double(pageSize))))
    }

    private var pageItems: [BookingSummary] {
        let start = page * pageSize
        guard start < bookings.count else { return [] }
        return Array(bookings[start..<min(start + pageSize, bookings.count)])
    }

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 10) {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        expanded.toggle()
                    }
                } label: {
                    HStack(spacing: 8) {
                        Text(title)
                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        Text("(\(bookings.count))")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        Spacer()
                        Image(systemName: expanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }
                }
                .buttonStyle(.plain)

                if expanded {
                    if bookings.isEmpty {
                        Text("No \(title.lowercased()) bookings yet.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    } else {
                        ForEach(pageItems) { booking in
                            NavigationLink(destination: BookingDetailView(booking: booking)) {
                                BookingRowCard(booking: booking)
                            }
                            .buttonStyle(.plain)
                        }

                        if totalPages > 1 {
                            HStack(spacing: 20) {
                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) { page -= 1 }
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "chevron.left")
                                        Text("Back")
                                    }
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                    .foregroundColor(page == 0 ? ScheduleMeTheme.mutedText.opacity(0.4) : ScheduleMeTheme.accent)
                                }
                                .disabled(page == 0)

                                Text("\(page + 1) / \(totalPages)")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)

                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) { page += 1 }
                                } label: {
                                    HStack(spacing: 6) {
                                        Text("Next")
                                        Image(systemName: "chevron.right")
                                    }
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                    .foregroundColor(page >= totalPages - 1 ? ScheduleMeTheme.mutedText.opacity(0.4) : ScheduleMeTheme.accent)
                                }
                                .disabled(page >= totalPages - 1)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 6)
                        }
                    }
                }
            }
        }
    }
}

private struct BookingSkeletonList: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        SkeletonBlock(width: 120, height: 14, cornerRadius: 6)
                        Spacer()
                        SkeletonBlock(width: 68, height: 12, cornerRadius: 8)
                    }
                    HStack(spacing: 10) {
                        SkeletonCircle(size: 34)
                        VStack(alignment: .leading, spacing: 6) {
                            SkeletonBlock(width: 140, height: 13, cornerRadius: 7)
                            SkeletonBlock(width: 102, height: 11, cornerRadius: 6)
                        }
                        Spacer()
                        SkeletonCircle(size: 18)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
                }
            }
        }
    }
}

private struct BookingsHeaderCard<Content: View>: View {
    let title: String
    let subtitle: String
    let actionTitle: String
    let action: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Text(subtitle)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
                Spacer()
                Button(action: action) {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                        Text(actionTitle)
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(ScheduleMeTheme.accent)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            content
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .background(ScheduleMeTheme.surface)
    }
}

private struct BookingStatChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: String

    private var chipBackground: Color {
        colorScheme == .dark ? ScheduleMeTheme.surface : ScheduleMeTheme.accentSoft
    }

    private var chipBorder: Color {
        colorScheme == .dark ? ScheduleMeTheme.cardBorderStrong : ScheduleMeTheme.accent.opacity(0.22)
    }

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                .foregroundColor(colorScheme == .dark ? ScheduleMeTheme.titleText : ScheduleMeTheme.accent)
            Text(title.uppercased())
                .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.semibold))
                .tracking(1)
                .foregroundColor(colorScheme == .dark ? ScheduleMeTheme.mutedText : ScheduleMeTheme.accent.opacity(0.78))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(chipBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(chipBorder)
        )
    }
}

struct BookingRowCard: View {
    let booking: BookingSummary

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(booking.service)
                            .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                        Text(booking.businessName ?? "ScheduleMe provider")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                    }
                    Spacer()
                    BookingStatusBadge(status: booking.status)
                }

                if let scheduledAt = booking.scheduledAt {
                    HStack(spacing: 6) {
                        Image(systemName: "calendar")
                            .font(.system(size: 11))
                            .foregroundColor(ScheduleMeTheme.accent)
                        Text(scheduledAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                    }
                } else {
                    Text("Submitted \(booking.createdAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }

                if let amountLabel = booking.amountLabel {
                    Text(amountLabel)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                }
            }
        }
    }
}

private struct BookingStatusBadge: View {
    let status: String

    private var color: Color {
        switch status {
        case "confirmed", "active", "completion_pending", "in_progress": return .green
        case "awaiting_consumer_confirmation": return ScheduleMeTheme.accent
        case "completed": return ScheduleMeTheme.accent
        case "disputed": return .orange
        case "pending", "paid", "payment_pending", "payment_collected", "awaiting_payment": return .orange
        case "cancelled", "payment_failed": return .red
        default: return ScheduleMeTheme.mutedText
        }
    }

    private var label: String {
        status.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    var body: some View {
        Text(label)
            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.bold))
            .foregroundColor(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}
