import SwiftUI

struct BookingsView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter

    private var activeCount: Int {
        dataStore.bookings.filter { $0.statusLabel.lowercased() == "confirmed" }.count
    }

    private var completedCount: Int {
        dataStore.bookings.filter { $0.statusLabel.lowercased() == "completed" }.count
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                VStack(spacing: 0) {
                    ScheduleMeHeaderBlock(
                        title: "My\nBookings",
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

                    VStack(alignment: .leading, spacing: 16) {
                        if dataStore.isLoadingBookings && dataStore.bookings.isEmpty {
                            ProgressView()
                                .tint(ScheduleMeTheme.accent)
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
                            ForEach(dataStore.bookings) { booking in
                                BookingRowCard(booking: booking)
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 18)
                    .padding(.bottom, 30)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            await dataStore.loadBookings()
        }
    }
}

private struct BookingStatCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                .foregroundColor(ScheduleMeTheme.headerGreen)
            Text(title.uppercased())
                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                .tracking(1)
                .foregroundColor(ScheduleMeTheme.mutedText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.white)
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
                    VStack(alignment: .leading, spacing: 6) {
                        Text(booking.service)
                            .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                        Text(booking.businessName ?? "ScheduleMe provider")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                    }
                    Spacer()
                    ScheduleMeTag(text: booking.statusLabel)
                }

                if let scheduledAt = booking.scheduledAt {
                    Text(scheduledAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                } else {
                    Text("Submitted \(booking.createdAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                }

                HStack {
                    if let amountLabel = booking.amountLabel {
                        Text(amountLabel)
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundStyle(ScheduleMeTheme.accent)
                    }

                    if let note = booking.note, !note.isEmpty {
                        Text(note)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                            .lineLimit(2)
                    }
                }
            }
        }
    }
}
