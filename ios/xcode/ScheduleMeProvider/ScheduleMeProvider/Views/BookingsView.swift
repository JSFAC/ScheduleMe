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
    @State private var pendingPage = 0
    @State private var activePage = 0
    @State private var completedPage = 0
    @State private var cancelledPage = 0

    private let pageSize = 4

    // MARK: - Derived Counts

    private var activeCount: Int {
        dataStore.bookings.filter { $0.status.lowercased() == "confirmed" || $0.status.lowercased() == "active" }.count
    }

    private var completedCount: Int {
        dataStore.bookings.filter { $0.status.lowercased() == "completed" || $0.status.lowercased() == "paid" }.count
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                VStack(spacing: 0) {
                    ScheduleMeHeaderBlock(
                        title: "My Bookings",
                        subtitle: "Track and manage your service requests",
                        actionTitle: "New request",
                        action: { tabRouter.selected = .browse }
                    ) {
                        HStack(spacing: 12) {
                            BookingStatCard(title: "Total", value: "\(dataStore.bookings.count)")
                            BookingStatCard(title: "Active", value: "\(activeCount)")
                            BookingStatCard(title: "Completed", value: "\(completedCount)")
                        }
                    }
                    .padding(.top, 6)

                    VStack(alignment: .leading, spacing: 10) {
                        if dataStore.isLoadingBookings && dataStore.bookings.isEmpty {
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

    // MARK: - Buckets

    private var pendingBookings: [BookingSummary] {
        dataStore.bookings.filter { ["pending", "payment_pending"].contains($0.status.lowercased()) }
    }

    private var activeBookings: [BookingSummary] {
        dataStore.bookings.filter {
            ["confirmed", "active", "awaiting_consumer_confirmation", "disputed"].contains($0.status.lowercased())
        }
    }

    private var completedBookings: [BookingSummary] {
        dataStore.bookings.filter { ["completed", "paid"].contains($0.status.lowercased()) }
    }

    private var cancelledBookings: [BookingSummary] {
        dataStore.bookings.filter { ["cancelled", "payment_failed"].contains($0.status.lowercased()) }
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
                .contentShape(Rectangle())
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
                            .contentShape(Rectangle())
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
        .contentShape(Rectangle())
    }
}

private struct BookingSkeletonList: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    SkeletonBlock(width: 120, height: 16, cornerRadius: 6)
                    SkeletonBlock(height: 70, cornerRadius: 16)
                }
            }
        }
    }
}

private struct BookingStatCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                .foregroundColor(colorScheme == .dark ? Color(hex: "9AE6D7") : ScheduleMeTheme.headerGreen)
            Text(title.uppercased())
                .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.semibold))
                .tracking(1)
                .foregroundColor(ScheduleMeTheme.mutedText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
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
        case "confirmed", "active": return .green
        case "awaiting_consumer_confirmation": return .orange
        case "disputed": return .red
        case "completed", "paid": return ScheduleMeTheme.accent
        case "pending", "payment_pending": return .orange
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
