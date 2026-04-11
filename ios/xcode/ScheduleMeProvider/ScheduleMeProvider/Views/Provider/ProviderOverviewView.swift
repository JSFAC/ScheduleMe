import SwiftUI
import UIKit

struct ProviderOverviewView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @State private var path: [ProviderMoreDestination] = []
    @State private var stripeActionInFlight = false
    @State private var stripeActionError: String?

    private var completedCount: Int {
        providerStore.bookings.filter {
            let status = $0.status.lowercased()
            return status == "completed" || status == "paid"
        }.count
    }

    private var uniqueClients: Int {
        let keys = providerStore.bookings.compactMap { booking -> String? in
            if let id = booking.profile?.id, !id.isEmpty { return "id:\(id.lowercased())" }
            if let email = booking.profile?.email, !email.isEmpty { return "email:\(email.lowercased())" }
            if let name = booking.profile?.name, !name.isEmpty { return "name:\(name.lowercased())" }
            if let full = booking.profile?.fullName, !full.isEmpty { return "full:\(full.lowercased())" }
            if let username = booking.profile?.username, !username.isEmpty { return "user:\(username.lowercased())" }
            return nil
        }
        return Set(keys).count
    }

    private var platformFeeSubtitle: String {
        let formatted = String(format: "%.0f", providerStore.platformFeePercent)
        return "After \(formatted)% protection fee"
    }

    private var awaitingPayoutLabel: String {
        NumberFormatter.currency.string(from: NSNumber(value: Double(providerStore.awaitingPayoutNetCents) / 100.0)) ?? "$0"
    }

    private var revenueBars: [(label: String?, cents: Int)] {
        let calendar = Calendar.current
        let now = Date()
        guard let lookbackStart = calendar.date(byAdding: .day, value: -42, to: now) else {
            return Array(repeating: (label: nil, cents: 0), count: 8)
        }
        var byDay: [Date: Int] = [:]

        for booking in providerStore.bookings {
            guard let amountCents = booking.amountCents, amountCents > 0 else { continue }
            let status = booking.status.lowercased()
            let hasCapturedPayment = (booking.paidAt != nil || status == "paid" || status == "completed")
            let isCancelled = status == "cancelled"
            guard hasCapturedPayment, !isCancelled else { continue }

            let eventDate = booking.paidAt ?? booking.scheduledStart ?? booking.createdAt
            guard eventDate >= lookbackStart && eventDate <= now else { continue }
            let dayStart = calendar.startOfDay(for: eventDate)
            let netAmount = Int(Double(amountCents) * (1 - providerStore.platformFeeRate))
            byDay[dayStart, default: 0] += max(netAmount, 0)
        }

        let nonZero = byDay
            .map { (label: $0.key.formatted(.dateTime.month(.abbreviated).day()), cents: $0.value, date: $0.key) }
            .sorted {
                if $0.cents == $1.cents { return $0.date < $1.date }
                return $0.cents < $1.cents
            }
            .suffix(8)
            .map { (label: Optional($0.label), cents: $0.cents) }

        let placeholders = max(0, 8 - nonZero.count)
        return Array(repeating: (label: nil, cents: 0), count: placeholders) + nonZero
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                ScheduleMeBackground()
                    .ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 14) {
                        header
                        kpiGrid
                        revenueCard
                        quickActions
                        recentBookings
                        paymentAccountCard
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    ScheduleMeWordmark(size: 24)
                }
            }
            .refreshable {
                await providerStore.refreshAll()
            }
            .navigationDestination(for: ProviderMoreDestination.self) { destination in
                switch destination {
                case .calendar:
                    ProviderCalendarView()
                case .businessHours:
                    ProviderBusinessHoursView()
                case .services:
                    ProviderServicesView()
                case .clients:
                    ProviderClientsView()
                case .settings:
                    ProviderSettingsView()
                case .editListing:
                    ProviderEditListingView()
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(providerStore.profile?.name ?? "Your Business")
                .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                .foregroundStyle(ScheduleMeTheme.titleText)
            Text("Run your bookings, messages, services, and payouts from one place.")
                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                .foregroundStyle(ScheduleMeTheme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var kpiGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            statItem(
                title: "Total Payout",
                value: providerStore.stripeBalance.totalPayoutLabel,
                subtitle: platformFeeSubtitle,
                accent: "dollarsign.circle"
            )
            statItem(
                title: "This Month",
                value: providerStore.stripeBalance.thisMonthPayoutLabel,
                subtitle: "Current month payout",
                accent: "chart.line.uptrend.xyaxis"
            )
            statItem(
                title: "Awaiting Payout",
                value: awaitingPayoutLabel,
                subtitle: "\(providerStore.awaitingPayoutCount) paid bookings pending release",
                accent: "clock.arrow.circlepath"
            )
            statItem(
                title: "Clients",
                value: "\(uniqueClients)",
                subtitle: "\(completedCount) jobs completed",
                accent: "person.2"
            )
        }
    }

    private func statItem(title: String, value: String, subtitle: String, accent: String) -> some View {
        premiumCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: accent)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(hex: "33C8B5"))
                    Spacer()
                }

                Text(value)
                    .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                Text(subtitle)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 118, alignment: .topLeading)
        }
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Quick Actions")
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.titleText)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                actionButton(title: "Calendar", icon: "calendar", destination: .calendar)
                actionButton(title: "Services", icon: "briefcase", destination: .services)
                actionButton(title: "Clients", icon: "person.2", destination: .clients)
                actionButton(title: "Settings", icon: "gearshape", destination: .settings)
            }
        }
    }

    private func actionButton(title: String, icon: String, destination: ProviderMoreDestination) -> some View {
        Button {
            path.append(destination)
        } label: {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                Spacer()
            }
            .foregroundStyle(ScheduleMeTheme.titleText)
            .padding(12)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
        }
        .contentShape(Rectangle())
        .buttonStyle(.plain)
    }

    private var recentBookings: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent Bookings")
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.titleText)

            if providerStore.bookings.isEmpty {
                premiumCard {
                    VStack(spacing: 8) {
                        Image(systemName: "calendar")
                            .font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(Color(hex: "33C8B5"))
                        Text("No bookings yet")
                            .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                        Text("Requests will show here once customers submit them.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 22)
                }
            } else {
                ForEach(providerStore.bookings.prefix(5)) { booking in
                    premiumCard {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(booking.customerDisplayName)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                    .foregroundStyle(ScheduleMeTheme.titleText)
                                Text(booking.service)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundStyle(ScheduleMeTheme.mutedText)
                                Text((booking.scheduledStart ?? booking.createdAt).formatted(date: .abbreviated, time: .shortened))
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                    .foregroundStyle(ScheduleMeTheme.mutedText)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(booking.amountLabel)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.bold))
                                    .foregroundColor(amountColor(for: booking))
                                Text(booking.statusLabel)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    .foregroundStyle(statusColor(for: booking))
                            }
                        }
                    }
                }
            }
        }
    }

    private var revenueCard: some View {
        premiumCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Revenue")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                HStack(alignment: .bottom, spacing: 6) {
                    let maxValue = max(revenueBars.map(\.cents).max() ?? 1, 1)
                    ForEach(Array(revenueBars.enumerated()), id: \.offset) { _, point in
                        let cents = point.cents
                        let ratio = cents > 0 ? max(Double(cents) / Double(maxValue), 0.18) : 0.02
                        VStack(spacing: 4) {
                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                .fill(cents == 0 ? ScheduleMeTheme.cardBorder : (cents == maxValue ? ScheduleMeTheme.accent : ScheduleMeTheme.accentSoft))
                                .frame(height: cents == 0 ? 5 : max(20, 76 * ratio))
                            Text(point.label ?? "")
                                .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.semibold))
                                .foregroundStyle(ScheduleMeTheme.mutedText)
                        }
                    }
                }
                .frame(height: 96, alignment: .bottom)

                if let maxPoint = revenueBars.last(where: { $0.cents > 0 }),
                   let label = maxPoint.label {
                    Text("Top day: \(label) \(NumberFormatter.currency.string(from: NSNumber(value: Double(maxPoint.cents) / 100.0)) ?? "$0")")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }

                Text("Top 8 days in the past 6 weeks")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            }
        }
    }

    private var paymentAccountCard: some View {
        premiumCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Stripe Account")
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                    Spacer()
                    Text((providerStore.profile?.stripeOnboarded ?? false) ? "Connected" : "Not Connected")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.bold))
                        .foregroundStyle((providerStore.profile?.stripeOnboarded ?? false) ? Color(hex: "22C55E") : Color(hex: "F59E0B"))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(ScheduleMeTheme.surface.opacity(0.8))
                        .clipShape(Capsule())
                }

                Text((providerStore.profile?.stripeOnboarded ?? false)
                     ? "Payouts are active. Standard payouts usually arrive in 1–2 business days."
                     : "Connect Stripe to receive payouts and track pending transfers.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)

                HStack {
                    Text("Available \(providerStore.stripeBalance.totalPayoutLabel)")
                    Spacer()
                    Text("Pending payout \(providerStore.stripeBalance.pendingPayoutLabel)")
                }
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)

                if let stripeActionError {
                    Text(stripeActionError)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundStyle(Color(hex: "FCA5A5"))
                }

                Button(stripeActionInFlight ? "Opening Stripe..." : ((providerStore.profile?.stripeOnboarded ?? false) ? "Manage Stripe Settings" : "Connect Stripe")) {
                    stripeActionError = nil
                    stripeActionInFlight = true
                    Task {
                        defer { stripeActionInFlight = false }
                        do {
                            let url = try await providerStore.openStripeConnectURL()
                            await MainActor.run { UIApplication.shared.open(url) }
                        } catch {
                            stripeActionError = error.localizedDescription
                        }
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
                .disabled(stripeActionInFlight)

                Text("New Stripe accounts may take up to 7 days for the first payout to arrive.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 2)
            }
        }
    }

    private func premiumCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            content()
        }
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ScheduleMeTheme.cardBorder))
    }

    private func statusColor(for booking: ProviderBookingSummary) -> Color {
        if booking.isDerivedPricePending {
            return Color(hex: "EF4444")
        }
        let status = booking.status
        switch status.lowercased() {
        case "price_disputed", "disputed", "price_pending":
            return Color(hex: "EF4444")
        case "pending", "payment_pending":
            return Color(hex: "F59E0B")
        case "cancelled":
            return Color(hex: "94A3B8")
        case "active", "confirmed":
            return Color(hex: "22C55E")
        case "completed", "paid":
            return Color(hex: "3B82F6")
        default:
            return Color(hex: "33C8B5")
        }
    }

    private func amountColor(for booking: ProviderBookingSummary) -> Color {
        if booking.isDerivedPricePending {
            return Color(hex: "F59E0B")
        }
        switch booking.status.lowercased() {
        case "cancelled":
            return ScheduleMeTheme.mutedText
        case "price_disputed", "disputed", "price_pending":
            return Color(hex: "F59E0B")
        default:
            return ScheduleMeTheme.accent
        }
    }
}
