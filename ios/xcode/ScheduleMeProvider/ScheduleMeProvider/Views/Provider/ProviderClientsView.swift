import SwiftUI

struct ProviderClientsView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @State private var search = ""
    @State private var pageIndex = 0
    private let pageSize = 12

    private struct ProviderClient: Identifiable {
        let id: String
        let name: String
        let email: String
        let phone: String
        let bookingCount: Int
        let activeCount: Int
        let completedCount: Int
        let completedAmountCents: Int
        let activeAmountCents: Int
        let payoutNetCents: Int
    }

    private var clients: [ProviderClient] {
        var map: [String: ProviderClient] = [:]

        for booking in providerStore.bookings {
            let key: String? = {
                if let id = booking.profile?.id, !id.isEmpty { return "id:\(id.lowercased())" }
                if let email = booking.profile?.email?.lowercased(), !email.isEmpty { return "email:\(email)" }
                if let phone = booking.profile?.phone?.trimmingCharacters(in: .whitespacesAndNewlines), !phone.isEmpty { return "phone:\(phone)" }
                if let name = booking.profile?.displayName.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty { return "name:\(name.lowercased())" }
                return nil
            }()
            guard let key else { continue }

            let existing = map[key]
            let email = booking.profile?.email?.lowercased() ?? existing?.email ?? "No email on file"
            let status = booking.status.lowercased()
            let isCompleted = status == "completed" || status == "paid"
            let isActive = status == "active" || status == "confirmed"
            let feeRate = providerStore.platformFeeRate
            let netCents = Int(Double(booking.amountCents ?? 0) * (1 - feeRate))
            map[key] = ProviderClient(
                id: key,
                name: booking.profile?.displayName ?? existing?.name ?? "Client",
                email: email,
                phone: booking.profile?.phone ?? existing?.phone ?? "",
                bookingCount: (existing?.bookingCount ?? 0) + 1,
                activeCount: (existing?.activeCount ?? 0) + (isActive ? 1 : 0),
                completedCount: (existing?.completedCount ?? 0) + (isCompleted ? 1 : 0),
                completedAmountCents: (existing?.completedAmountCents ?? 0) + (isCompleted ? (booking.amountCents ?? 0) : 0),
                activeAmountCents: (existing?.activeAmountCents ?? 0) + (isActive ? (booking.amountCents ?? 0) : 0),
                payoutNetCents: (existing?.payoutNetCents ?? 0) + (isCompleted ? max(netCents, 0) : 0)
            )
        }

        return map.values
            .sorted { $0.payoutNetCents > $1.payoutNetCents }
            .filter {
                search.isEmpty ||
                $0.name.localizedCaseInsensitiveContains(search) ||
                $0.email.localizedCaseInsensitiveContains(search)
            }
    }

    private var pageCount: Int {
        max(1, Int(ceil(Double(clients.count) / Double(pageSize))))
    }

    private var pagedClients: [ProviderClient] {
        guard !clients.isEmpty else { return [] }
        let start = max(0, min(pageIndex * pageSize, max(clients.count - 1, 0)))
        let end = min(start + pageSize, clients.count)
        return Array(clients[start..<end])
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "090B10"), Color(hex: "10141B")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 10) {
                    if clients.isEmpty {
                        ScheduleMeEmptyState(
                            title: "No clients yet",
                            message: "Clients will populate here as bookings come in.",
                            systemImage: "person.2"
                        )
                    } else {
                        HStack(spacing: 12) {
                            pageArrow(systemName: "chevron.left", isEnabled: pageIndex > 0) {
                                pageIndex = max(0, pageIndex - 1)
                            }
                            Text("Page \(min(pageIndex + 1, pageCount)) of \(pageCount)")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                .foregroundStyle(ScheduleMeTheme.mutedText)
                            pageArrow(systemName: "chevron.right", isEnabled: pageIndex < pageCount - 1) {
                                pageIndex = min(pageCount - 1, pageIndex + 1)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.bottom, 2)

                        ForEach(pagedClients) { client in
                            ScheduleMeCard {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(client.name)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                        .foregroundStyle(Color.white)
                                    Text(client.email)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundStyle(ScheduleMeTheme.mutedText)

                                    HStack {
                                        Text("\(client.completedCount) completed (\(client.activeCount) active)")
                                        Spacer()
                                        Text(NumberFormatter.currency.string(from: NSNumber(value: Double(client.payoutNetCents) / 100.0)) ?? "$0")
                                    }
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    .foregroundStyle(ScheduleMeTheme.accent)

                                    if !client.phone.isEmpty {
                                        Link("Message/Call", destination: URL(string: "tel:\(client.phone)") ?? URL(string: "https://www.usescheduleme.com")!)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
        }
        .searchable(text: $search, prompt: "Search clients")
        .navigationTitle("Clients")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: search) { _, _ in pageIndex = 0 }
        .task {
            await providerStore.loadBookings()
        }
    }

    private func pageArrow(systemName: String, isEnabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(isEnabled ? Color.white : Color(hex: "64748B"))
                .frame(width: 28, height: 28)
                .background(ScheduleMeTheme.surface)
                .clipShape(Circle())
                .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}
