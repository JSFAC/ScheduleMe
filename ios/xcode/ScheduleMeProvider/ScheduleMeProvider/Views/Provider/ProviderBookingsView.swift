import SwiftUI

struct ProviderBookingsView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @State private var filter: BookingFilter = .all
    @State private var didSetInitialFilter = false
    @State private var expandedIDs: Set<String> = []
    @State private var pageIndex = 0
    @State private var pricingBooking: ProviderBookingSummary?
    @State private var priceDigits = ""
    @State private var actionError: String?
    @State private var successToast: String?
    @State private var pendingConfirmation: BookingConfirmation?
    private let pageSize = 8

    private enum BookingFilter: String, CaseIterable, Identifiable {
        case all, pending, disputed, active, completed, cancelled

        var id: String { rawValue }
        var label: String { rawValue.capitalized }
    }

    private enum ConfirmActionType {
        case complete
        case cancel
    }

    private struct BookingConfirmation: Identifiable {
        let id = UUID()
        let bookingID: String
        let title: String
        let message: String
        let confirmLabel: String
        let action: ConfirmActionType
    }

    private var filtered: [ProviderBookingSummary] {
        switch filter {
        case .pending:
            return providerStore.bookings.filter { isPending($0) }
        case .active:
            return providerStore.bookings.filter {
                let status = $0.status.lowercased()
                return status == "active" || status == "confirmed"
            }
        case .disputed:
            return providerStore.bookings.filter { isDisputed($0) }
        case .completed:
            return providerStore.bookings.filter {
                let status = $0.status.lowercased()
                return status == "completed" || status == "paid"
            }
        case .cancelled:
            return providerStore.bookings.filter { $0.status.lowercased() == "cancelled" }
        case .all:
            return providerStore.bookings
        }
    }

    private var pagedFiltered: [ProviderBookingSummary] {
        guard !filtered.isEmpty else { return [] }
        let start = max(0, min(pageIndex * pageSize, max(filtered.count - 1, 0)))
        let end = min(start + pageSize, filtered.count)
        return Array(filtered[start..<end])
    }

    private var pageCount: Int {
        guard !filtered.isEmpty else { return 1 }
        return Int(ceil(Double(filtered.count) / Double(pageSize)))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ScheduleMeBackground()
                    .ignoresSafeArea()

                GeometryReader { proxy in
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 10) {
                            HStack {
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 2)

                            filterRow

                            if let actionError {
                                Text(actionError)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundStyle(.red)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            if filtered.isEmpty {
                                VStack {
                                    Spacer(minLength: 0)
                                    ScheduleMeEmptyState(
                                        title: "No bookings",
                                        message: "Bookings in this category will appear here.",
                                        systemImage: "calendar.badge.clock"
                                    )
                                    .frame(maxWidth: .infinity)
                                    Spacer(minLength: 0)
                                }
                                .frame(minHeight: max(proxy.size.height - 120, 360))
                            } else {
                                pageControls

                                ForEach(pagedFiltered) { booking in
                                    bookingCard(booking)
                                }
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .navigationTitle("Bookings")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable {
                await providerStore.loadBookings()
            }
            .onAppear {
                setInitialFilterIfNeeded()
            }
            .onChange(of: providerStore.bookings.count) { _, _ in
                guard !didSetInitialFilter else { return }
                setInitialFilterIfNeeded()
            }
            .onChange(of: filter) { _, _ in
                pageIndex = 0
            }
            .sheet(item: $pricingBooking) { booking in
                priceSheet(for: booking)
            }
            .overlay(alignment: .top) {
                if let successToast {
                    Text(successToast)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                        .padding(.top, 10)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .overlay {
                if let confirmation = pendingConfirmation {
                    confirmationOverlay(confirmation)
                }
            }
        }
    }

    private var filterRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(BookingFilter.allCases) { item in
                    Button {
                        filter = item
                    } label: {
                        Text("\(item.label) (\(count(for: item)))")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(filter == item ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                            .foregroundStyle(filter == item ? Color.white : ScheduleMeTheme.titleText)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .contentShape(Rectangle())
        .buttonStyle(.plain)
                }
            }
        }
    }

    private var pageControls: some View {
        HStack(spacing: 12) {
            Button {
                pageIndex = max(0, pageIndex - 1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(pageIndex == 0 ? ScheduleMeTheme.mutedText : ScheduleMeTheme.titleText)
                    .frame(width: 30, height: 30)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(Circle())
            }
            .contentShape(Rectangle())
        .buttonStyle(.plain)
            .disabled(pageIndex == 0)

            Text("Page \(min(pageIndex + 1, pageCount)) of \(pageCount)")
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)

            Button {
                pageIndex = min(pageCount - 1, pageIndex + 1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(pageIndex >= pageCount - 1 ? ScheduleMeTheme.mutedText : ScheduleMeTheme.titleText)
                    .frame(width: 30, height: 30)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(Circle())
            }
            .contentShape(Rectangle())
        .buttonStyle(.plain)
            .disabled(pageIndex >= pageCount - 1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }

    private func bookingCard(_ booking: ProviderBookingSummary) -> some View {
        let isExpanded = expandedIDs.contains(booking.id)

        return VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(booking.service)
                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.bold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                        Text(booking.customerDisplayName)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                        Text((booking.scheduledStart ?? booking.createdAt).formatted(date: .abbreviated, time: .shortened))
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                        if let notes = booking.notes, !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text(notes)
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                .foregroundStyle(ScheduleMeTheme.mutedText)
                                .lineLimit(2)
                        }
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(booking.amountLabel)
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.bold))
                            .foregroundColor(amountColor(for: booking))
                        Text(booking.statusLabel)
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .foregroundStyle(statusColor(for: booking))
                    }
                }

                Button {
                    if isExpanded {
                        expandedIDs.remove(booking.id)
                    } else {
                        expandedIDs.insert(booking.id)
                    }
                } label: {
                    let showDetailsOnly = ["completed", "paid", "cancelled"].contains(booking.status.lowercased())
                    HStack {
                        Text(isExpanded ? "Hide Actions" : (showDetailsOnly ? "Show Booking Details" : "Manage Booking"))
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(ScheduleMeTheme.titleText)
                    .padding(.vertical, 6)
                }
                .contentShape(Rectangle())
        .buttonStyle(.plain)

                if isExpanded {
                    VStack(spacing: 8) {
                        if isPending(booking) {
                            HStack(spacing: 8) {
                                Button("Accept Booking") {
                                    Task {
                                        await runAction(successMessage: "Booking accepted.") {
                                            try await providerStore.confirmBooking(bookingID: booking.id)
                                        }
                                    }
                                }
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                .foregroundStyle(Color.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 9)
                                .background(Color(hex: "16A34A"))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .contentShape(Rectangle())
        .buttonStyle(.plain)

                                if shouldAllowPendingSetPrice(booking) {
                                    Button("Set Price") {
                                        pricingBooking = booking
                                        if let amount = booking.amountCents, amount > 0 {
                                            priceDigits = String(amount)
                                        } else {
                                            priceDigits = ""
                                        }
                                    }
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundStyle(ScheduleMeTheme.titleText)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 9)
                                    .background(ScheduleMeTheme.surface)
                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .contentShape(Rectangle())
        .buttonStyle(.plain)
                                }
                            }
                        }

                        if isDisputed(booking) {
                            HStack(spacing: 8) {
                                if booking.status.lowercased() == "price_disputed" || booking.status.lowercased() == "disputed" {
                                    Button("Set New Price") {
                                        pricingBooking = booking
                                        if let amount = booking.amountCents {
                                            priceDigits = String(amount)
                                        } else {
                                            priceDigits = ""
                                        }
                                    }
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundStyle(ScheduleMeTheme.titleText)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 9)
                                    .background(ScheduleMeTheme.surface)
                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .contentShape(Rectangle())
        .buttonStyle(.plain)
                                }

                                Button("Accept Customer Price (\(booking.customerCounterAmountLabel))") {
                                    Task {
                                        await runAction(successMessage: "Customer price accepted.") {
                                            try await providerStore.confirmBooking(bookingID: booking.id)
                                        }
                                    }
                                }
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                .foregroundStyle(Color.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 9)
                                .background(ScheduleMeTheme.accent)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .contentShape(Rectangle())
        .buttonStyle(.plain)
                            }
                            if booking.isDerivedPricePending {
                                Text("Waiting for customer to accept your proposed price.")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                    .foregroundStyle(ScheduleMeTheme.mutedText)
                            }
                        }

                        if ["active", "confirmed"].contains(booking.status.lowercased()) {
                            Button("Mark Complete") {
                                pendingConfirmation = BookingConfirmation(
                                    bookingID: booking.id,
                                    title: "Mark booking complete?",
                                    message: "This action is irreversible and cannot be undone.",
                                    confirmLabel: "Mark Complete",
                                    action: .complete
                                )
                            }
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundStyle(Color.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 9)
                            .background(ScheduleMeTheme.accent)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .contentShape(Rectangle())
        .buttonStyle(.plain)
                        }

                        if !["cancelled", "completed", "paid"].contains(booking.status.lowercased()) {
                            Button("Cancel Booking") {
                                pendingConfirmation = BookingConfirmation(
                                    bookingID: booking.id,
                                    title: "Cancel this booking?",
                                    message: "This action is irreversible and cannot be undone.",
                                    confirmLabel: "Cancel Booking",
                                    action: .cancel
                                )
                            }
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(ScheduleMeTheme.surface)
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .contentShape(Rectangle())
        .buttonStyle(.plain)
                        }

                        if ["completed", "paid", "cancelled"].contains(booking.status.lowercased()) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Booking Details")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundStyle(ScheduleMeTheme.titleText)
                                detailRow("Customer", booking.customerDisplayName)
                                detailRow("Service", booking.service)
                                detailRow("Requested", booking.createdAt.formatted(date: .abbreviated, time: .shortened))
                                if booking.status.lowercased() == "cancelled" {
                                    detailRow("Time Cancelled", booking.statusChangedAt.formatted(date: .abbreviated, time: .shortened))
                                } else {
                                    detailRow("Time Completed", booking.statusChangedAt.formatted(date: .abbreviated, time: .shortened))
                                }
                                detailRow("Notes", (booking.notes?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ? (booking.notes ?? "") : "No notes provided")
                            }
                            .padding(10)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
    }

    private func priceSheet(for booking: ProviderBookingSummary) -> some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("Set price for \(booking.customerDisplayName)")
                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                HStack(spacing: 8) {
                    Text("$")
                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                    TextField("0.00", text: priceTextBinding)
                        .keyboardType(.numberPad)
                        .modifier(ScheduleMeFieldModifier())
                        .scheduleMePasteMenu(priceTextBinding)
                }

                Button("Save Price") {
                    let amount = priceCentsFromDigits
                    guard amount > 0 else {
                        actionError = "Enter a valid amount."
                        return
                    }
                    Task {
                        await runAction {
                            try await providerStore.setBookingPrice(bookingID: booking.id, amountCents: amount)
                        }
                        pricingBooking = nil
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())

                Spacer()
            }
            .padding(16)
            .navigationTitle("Set Price")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { pricingBooking = nil }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func runAction(successMessage: String? = nil, _ operation: () async throws -> Void) async {
        do {
            try await operation()
            actionError = nil
            if let successMessage {
                await showSuccessToast(successMessage)
            }
        } catch {
            actionError = error.localizedDescription
        }
    }

    private func setInitialFilterIfNeeded() {
        guard !providerStore.bookings.isEmpty else {
            filter = .all
            return
        }

        if providerStore.bookings.contains(where: isPending(_:)) {
            filter = .pending
        } else if providerStore.bookings.contains(where: isDisputed(_:)) {
            filter = .disputed
        } else if providerStore.bookings.contains(where: { ["active", "confirmed"].contains($0.status.lowercased()) }) {
            filter = .active
        } else {
            filter = .all
        }
        didSetInitialFilter = true
    }

    private func count(for filter: BookingFilter) -> Int {
        switch filter {
        case .all:
            return providerStore.bookings.count
        case .pending:
            return providerStore.bookings.filter { isPending($0) }.count
        case .active:
            return providerStore.bookings.filter { ["active", "confirmed"].contains($0.status.lowercased()) }.count
        case .disputed:
            return providerStore.bookings.filter { isDisputed($0) }.count
        case .completed:
            return providerStore.bookings.filter { ["completed", "paid"].contains($0.status.lowercased()) }.count
        case .cancelled:
            return providerStore.bookings.filter { $0.status.lowercased() == "cancelled" }.count
        }
    }

    private func isDisputed(_ booking: ProviderBookingSummary) -> Bool {
        let status = booking.status.lowercased()
        if status == "price_disputed" || status == "disputed" || status == "price_pending" {
            return true
        }
        // Website flow can still surface "pending" for price negotiation records.
        return booking.isDerivedPricePending
    }

    private func isPending(_ booking: ProviderBookingSummary) -> Bool {
        let status = booking.status.lowercased()
        if status == "payment_pending" { return true }
        if status == "pending" && !isDisputed(booking) { return true }
        return false
    }

    private func shouldAllowPendingSetPrice(_ booking: ProviderBookingSummary) -> Bool {
        if let amount = booking.amountCents, amount > 0 {
            return false
        }
        return true
    }

    private var priceTextBinding: Binding<String> {
        Binding(
            get: { formatCentsDigits(priceDigits) },
            set: { newValue in
                priceDigits = newValue.filter(\.isNumber)
            }
        )
    }

    private var priceCentsFromDigits: Int {
        Int(priceDigits) ?? 0
    }

    private func formatCentsDigits(_ digits: String) -> String {
        let value = Double(Int(digits) ?? 0) / 100.0
        return String(format: "%.2f", value)
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

    private func detailRow(_ title: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(title)
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)
                .frame(width: 70, alignment: .leading)
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                .foregroundStyle(ScheduleMeTheme.titleText)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func confirmationOverlay(_ confirmation: BookingConfirmation) -> some View {
        ZStack {
            Color.black.opacity(0.6)
                .ignoresSafeArea()
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.18)) {
                        pendingConfirmation = nil
                    }
                }

            VStack(spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: confirmation.action == .cancel ? "exclamationmark.triangle.fill" : "checkmark.seal.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(confirmation.action == .cancel ? Color(hex: "FCA5A5") : ScheduleMeTheme.accent)
                    Text(confirmation.title)
                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                    Spacer()
                }

                Text(confirmation.message)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 8) {
                    Button("Keep Booking") {
                        withAnimation(.easeInOut(duration: 0.18)) {
                            pendingConfirmation = nil
                        }
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))

                    Button(confirmation.confirmLabel) {
                        let bookingID = confirmation.bookingID
                        let action = confirmation.action
                        withAnimation(.easeInOut(duration: 0.18)) {
                            pendingConfirmation = nil
                        }
                        Task {
                            switch action {
                            case .complete:
                                await runAction(successMessage: "Booking marked complete.") {
                                    try await providerStore.completeBooking(bookingID: bookingID)
                                }
                            case .cancel:
                                await runAction(successMessage: "Booking cancelled.") {
                                    try await providerStore.cancelBooking(bookingID: bookingID)
                                }
                            }
                        }
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                    .foregroundStyle(Color.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(confirmation.action == .cancel ? Color(hex: "B91C1C") : ScheduleMeTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
            .padding(14)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
            .padding(.horizontal, 22)
        }
        .transition(.opacity.combined(with: .scale(scale: 0.98)))
        .animation(.easeInOut(duration: 0.18), value: pendingConfirmation != nil)
    }

    @MainActor
    private func showSuccessToast(_ message: String) async {
        withAnimation(.easeInOut(duration: 0.2)) {
            successToast = message
        }
        try? await Task.sleep(for: .seconds(1.4))
        withAnimation(.easeInOut(duration: 0.2)) {
            successToast = nil
        }
    }
}
