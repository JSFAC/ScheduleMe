import SwiftUI
import EventKit
import Combine
import UIKit

struct ProviderCalendarView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @Environment(\.openURL) private var openURL
    @StateObject private var calendarSync = ProviderCalendarSyncManager()
    @State private var month: Date = Date()
    @State private var selectedDay: Date = Date()
    @State private var isHydrating = false
    @State private var dayPageIndex = 0
    @State private var expandedBookingIDs: Set<String> = []
    @State private var showingMonthYearPicker = false
    @State private var monthPickerResetToken = UUID()
    @State private var availableCalendars: [EKCalendar] = []
    @State private var showingCalendarPicker = false
    @State private var isLoadingCalendars = false
    @State private var calendarSyncMessage: String?
    @State private var calendarSyncError: String?
    private let dayPageSize = 6

    private var days: [Date] {
        let calendar = Calendar.current
        guard let monthInterval = calendar.dateInterval(of: .month, for: month),
              let monthFirstWeek = calendar.dateInterval(of: .weekOfMonth, for: monthInterval.start),
              let monthLastWeekDate = calendar.date(byAdding: .day, value: -1, to: monthInterval.end),
              let monthLastWeek = calendar.dateInterval(of: .weekOfMonth, for: monthLastWeekDate) else {
            return []
        }

        var result: [Date] = []
        var cursor = monthFirstWeek.start
        while cursor < monthLastWeek.end {
            result.append(cursor)
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return result
    }

    private var filteredBookings: [ProviderBookingSummary] {
        let calendar = Calendar.current
        let dayBookings = providerStore.bookings.filter { booking in
            let target = booking.scheduledStart ?? booking.createdAt
            return calendar.isDate(target, inSameDayAs: selectedDay)
        }
        return dayBookings.sorted { lhs, rhs in
            let lhsStatus = lhs.status.lowercased()
            let rhsStatus = rhs.status.lowercased()
            let lhsDone = lhsStatus == "cancelled" || lhsStatus == "completed" || lhsStatus == "paid"
            let rhsDone = rhsStatus == "cancelled" || rhsStatus == "completed" || rhsStatus == "paid"
            if lhsDone != rhsDone { return !lhsDone }
            let lhsTime = lhs.scheduledStart ?? lhs.createdAt
            let rhsTime = rhs.scheduledStart ?? rhs.createdAt
            return lhsTime < rhsTime
        }
    }

    private var dayPageCount: Int {
        max(1, Int(ceil(Double(filteredBookings.count) / Double(dayPageSize))))
    }

    private var pagedDayBookings: [ProviderBookingSummary] {
        guard !filteredBookings.isEmpty else { return [] }
        let start = max(0, min(dayPageIndex * dayPageSize, max(filteredBookings.count - 1, 0)))
        let end = min(start + dayPageSize, filteredBookings.count)
        return Array(filteredBookings[start..<end])
    }

    private var bookingsSyncSignature: String {
        providerStore.bookings
            .sorted { $0.id < $1.id }
            .map { booking in
                let start = (booking.scheduledStart ?? booking.createdAt).timeIntervalSince1970
                let end = (booking.scheduledEnd ?? booking.createdAt).timeIntervalSince1970
                return "\(booking.id)|\(booking.status.lowercased())|\(Int(start))|\(Int(end))|\(booking.amountCents ?? 0)"
            }
            .joined(separator: "||")
    }

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {
                    calendarSyncCard

                    if isHydrating && providerStore.bookings.isEmpty {
                        calendarSkeleton
                    } else {
                        monthGrid
                        dayAgenda
                    }
                }
                .padding(16)
            }

            if showingCalendarPicker {
                calendarPickerOverlay
            }
        }
        .navigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    month = Calendar.current.date(byAdding: .month, value: -1, to: month) ?? month
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .padding(8)
                }
                .contentShape(Rectangle())
                .buttonStyle(.plain)
            }

            ToolbarItem(placement: .principal) {
                Button {
                    // Always reset jump picker to current month/year before presenting.
                    monthPickerResetToken = UUID()
                    showingMonthYearPicker = true
                } label: {
                    HStack(spacing: 6) {
                        Text(month.formatted(.dateTime.month(.wide).year()))
                            .font(.custom(ScheduleMeTheme.fontName, size: 17).weight(.semibold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                    }
                }
                .buttonStyle(.plain)
            }

            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    month = Calendar.current.date(byAdding: .month, value: 1, to: month) ?? month
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .padding(8)
                }
                .contentShape(Rectangle())
                .buttonStyle(.plain)
            }
        }
        .refreshable {
            isHydrating = true
            await providerStore.refreshAll(force: true, prioritizeFastLoad: true)
            isHydrating = false
            if calendarSync.isConnected {
                await syncBookingsToConnectedCalendar(showMessage: false)
            }
        }
        .task {
            if providerStore.bookings.isEmpty {
                isHydrating = true
            }
            await providerStore.refreshAll(force: false)
            isHydrating = false
            if calendarSync.isConnected {
                await syncBookingsToConnectedCalendar(showMessage: false)
            }
        }
        .onChange(of: bookingsSyncSignature) { _, _ in
            guard calendarSync.isConnected else { return }
            Task {
                await syncBookingsToConnectedCalendar(showMessage: false)
            }
        }
        .onChange(of: month) { _, newMonth in
            dayPageIndex = 0
            expandedBookingIDs.removeAll()
            if !Calendar.current.isDate(selectedDay, equalTo: newMonth, toGranularity: .month) {
                selectedDay = newMonth
            }
        }
        .fullScreenCover(isPresented: $showingMonthYearPicker) {
            ProviderMonthYearPickerOverlay(
                selectedMonth: $month,
                resetToken: monthPickerResetToken,
                onClose: {
                    showingMonthYearPicker = false
                }
            )
        }
        .alert(
            "Calendar Sync",
            isPresented: Binding(
                get: { calendarSyncError != nil },
                set: { if !$0 { calendarSyncError = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(calendarSyncError ?? "")
        }
    }

    private var calendarSyncCard: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Calendar")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                Text(
                    calendarSync.isConnected
                    ? "Connected. Existing bookings are synced and new bookings are added automatically."
                    : "Connect once to sync all past bookings and automatically add future bookings in your selected calendar."
                )
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                .foregroundStyle(ScheduleMeTheme.mutedText)

                if let connectedCalendarName = calendarSync.connectedCalendarDisplayName {
                    Text("Connected to: \(connectedCalendarName)")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }

                if let calendarSyncMessage {
                    Text(calendarSyncMessage)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                }

                if calendarSync.isConnected {
                    HStack(spacing: 8) {
                        Button {
                            Task { await syncBookingsToConnectedCalendar(showMessage: true) }
                        } label: {
                            Label(calendarSync.isSyncing ? "Syncing..." : "Sync Now", systemImage: "arrow.triangle.2.circlepath")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(ScheduleMeTheme.accent)
                        .disabled(calendarSync.isSyncing)

                        Button("Change Calendar") {
                            Task { await connectCalendarTapped() }
                        }
                        .buttonStyle(.bordered)
                        .tint(ScheduleMeTheme.accent)

                        Button("Disconnect") {
                            calendarSync.disconnect()
                            calendarSyncMessage = "Calendar sync disconnected."
                        }
                        .buttonStyle(.bordered)
                        .tint(Color.red)
                    }
                } else {
                    Button {
                        Task { await connectCalendarTapped() }
                    } label: {
                        Label("Connect Calendar", systemImage: "calendar.badge.plus")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(ScheduleMeTheme.accent)
                }
            }
        }
    }

    private var calendarPickerOverlay: some View {
        ZStack {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture {
                    showingCalendarPicker = false
                }

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Choose Calendar")
                        .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.9)
                    Spacer()
                    Button {
                        showingCalendarPicker = false
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                            .frame(width: 28, height: 28)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }

                if isLoadingCalendars {
                    HStack(spacing: 10) {
                        ProgressView()
                            .tint(ScheduleMeTheme.accent)
                        Text("Loading calendars...")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 18)
                } else if availableCalendars.isEmpty {
                    VStack(spacing: 10) {
                        Text("No writable calendars available")
                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                        Text("We couldn't find an editable calendar yet. Make sure at least one calendar account has write access, then try again.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundStyle(ScheduleMeTheme.mutedText)
                            .multilineTextAlignment(.center)

                        HStack(spacing: 8) {
                            Button("Open Settings") {
                                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                                openURL(url)
                            }
                            .buttonStyle(.bordered)
                            .tint(ScheduleMeTheme.accent)

                            Button("Retry") {
                                Task { await connectCalendarTapped() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(ScheduleMeTheme.accent)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 8) {
                            ForEach(Array(availableCalendars.enumerated()), id: \.offset) { _, calendar in
                                Button {
                                    guard calendar.allowsContentModifications else {
                                        calendarSyncError = "This calendar is read-only. Choose a calendar that allows edits."
                                        return
                                    }
                                    showingCalendarPicker = false
                                    Task {
                                        calendarSync.connect(to: calendar)
                                        await syncBookingsToConnectedCalendar(showMessage: true)
                                    }
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(calendar.title.isEmpty ? "Untitled Calendar" : calendar.title)
                                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                                .foregroundStyle(ScheduleMeTheme.titleText)
                                            Text(calendar.source.title.isEmpty ? "Calendar Account" : calendar.source.title)
                                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                                .foregroundStyle(ScheduleMeTheme.mutedText)
                                        }
                                        Spacer()
                                        if !calendar.allowsContentModifications {
                                            Text("Read-only")
                                                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.bold))
                                                .foregroundStyle(.orange)
                                        } else {
                                            Image(systemName: "chevron.right")
                                                .font(.system(size: 12, weight: .semibold))
                                                .foregroundStyle(ScheduleMeTheme.mutedText)
                                        }
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 10)
                                    .background(ScheduleMeTheme.surface)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(ScheduleMeTheme.cardBorder)
                                    )
                                }
                                .buttonStyle(.plain)
                                .disabled(!calendar.allowsContentModifications)
                            }
                        }
                    }
                    .frame(maxHeight: 300)
                }
            }
            .padding(16)
            .background(ScheduleMeTheme.pageBackground)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
            .padding(.horizontal, 18)
            .shadow(color: .black.opacity(0.22), radius: 16, y: 8)
        }
        .transition(.opacity)
    }

    private var monthGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 8) {
            ForEach(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], id: \.self) { day in
                Text(day)
                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            }

            ForEach(days, id: \.self) { day in
                let isCurrentMonth = Calendar.current.isDate(day, equalTo: month, toGranularity: .month)
                let isSelected = Calendar.current.isDate(day, inSameDayAs: selectedDay)
                let hasBooking = providerStore.bookings.contains {
                    Calendar.current.isDate($0.scheduledStart ?? $0.createdAt, inSameDayAs: day)
                }

                Button {
                    selectedDay = day
                } label: {
                    VStack(spacing: 2) {
                        Text(day.formatted(.dateTime.day()))
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundStyle(isSelected ? Color.white : (isCurrentMonth ? ScheduleMeTheme.titleText : ScheduleMeTheme.mutedText))

                        Circle()
                            .fill(hasBooking ? (isSelected ? Color.white : ScheduleMeTheme.accent) : Color.clear)
                            .frame(width: 4, height: 4)
                    }
                    .frame(maxWidth: .infinity, minHeight: 36)
                    .background(isSelected ? ScheduleMeTheme.accent : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .contentShape(Rectangle())
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ScheduleMeTheme.cardBorder))
    }

    private var dayAgenda: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Schedule for \(selectedDay.formatted(date: .abbreviated, time: .omitted))")
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.titleText)
                .frame(maxWidth: .infinity, alignment: .center)

            if filteredBookings.isEmpty {
                ScheduleMeEmptyState(
                    title: "No bookings this day",
                    message: "Tap another day to check its schedule.",
                    systemImage: "calendar"
                )
            } else {
                HStack(spacing: 12) {
                    pageArrow(systemName: "chevron.left", isEnabled: dayPageIndex > 0) {
                        dayPageIndex = max(0, dayPageIndex - 1)
                    }
                    Text("Page \(min(dayPageIndex + 1, dayPageCount)) of \(dayPageCount)")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                    pageArrow(systemName: "chevron.right", isEnabled: dayPageIndex < dayPageCount - 1) {
                        dayPageIndex = min(dayPageCount - 1, dayPageIndex + 1)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 2)

                ForEach(pagedDayBookings) { booking in
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(booking.service)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                    Text(booking.scheduledStart?.formatted(date: .omitted, time: .shortened) ?? booking.createdAt.formatted(date: .omitted, time: .shortened))
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .foregroundStyle(Color(hex: "64748B"))
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
                                if expandedBookingIDs.contains(booking.id) {
                                    expandedBookingIDs.remove(booking.id)
                                } else {
                                    expandedBookingIDs.insert(booking.id)
                                }
                            } label: {
                                HStack {
                                    Text(expandedBookingIDs.contains(booking.id) ? "Hide Details" : "Show Details")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .foregroundStyle(Color(hex: "D1D5DB"))
                                    Spacer()
                                    Image(systemName: expandedBookingIDs.contains(booking.id) ? "chevron.up" : "chevron.down")
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(Color(hex: "94A3B8"))
                                }
                            }
                            .contentShape(Rectangle())
                            .buttonStyle(.plain)

                            if expandedBookingIDs.contains(booking.id) {
                                VStack(alignment: .leading, spacing: 5) {
                                    detailRow("Customer", booking.customerDisplayName)
                                    detailRow("Service", booking.service)
                                    detailRow("Scheduled", (booking.scheduledStart ?? booking.createdAt).formatted(date: .abbreviated, time: .shortened))
                                    detailRow("Notes", (booking.notes?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false) ? (booking.notes ?? "") : "No notes provided")
                                }
                                .padding(9)
                                .background(ScheduleMeTheme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
                            }
                        }
                    }
                }
            }
        }
        .onChange(of: selectedDay) { _, _ in dayPageIndex = 0 }
    }

    private func detailRow(_ title: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(title)
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                .foregroundStyle(Color(hex: "94A3B8"))
                .frame(width: 68, alignment: .leading)
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                .foregroundStyle(Color(hex: "CBD5E1"))
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func statusColor(for booking: ProviderBookingSummary) -> Color {
        if booking.isDerivedPricePending {
            return Color(hex: "EF4444")
        }
        let status = booking.status
        switch status.lowercased() {
        case "price_disputed":
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
            return ScheduleMeTheme.accent
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

    private var calendarSkeleton: some View {
        VStack(alignment: .leading, spacing: 12) {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color(hex: "2A2A2A"))
                .frame(height: 36)
                .redacted(reason: .placeholder)

            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(ScheduleMeTheme.surface)
                .frame(height: 250)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
                .redacted(reason: .placeholder)

            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color(hex: "2A2A2A"))
                .frame(width: 180, height: 14)
                .redacted(reason: .placeholder)

            ForEach(0..<3, id: \.self) { _ in
                ScheduleMeCard {
                    VStack(alignment: .leading, spacing: 8) {
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color(hex: "2A2A2A"))
                            .frame(width: 130, height: 12)
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(Color(hex: "2A2A2A"))
                            .frame(width: 180, height: 10)
                    }
                    .redacted(reason: .placeholder)
                }
            }
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
        .contentShape(Rectangle())
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }

    private func connectCalendarTapped() async {
        isLoadingCalendars = true
        defer { isLoadingCalendars = false }
        do {
            let calendars = try await calendarSync.fetchWritableCalendars()
            if calendars.isEmpty {
                availableCalendars = []
                showingCalendarPicker = true
                return
            }
            if calendars.count == 1, let first = calendars.first {
                calendarSync.connect(to: first)
                await syncBookingsToConnectedCalendar(showMessage: true)
            } else {
                availableCalendars = calendars
                showingCalendarPicker = true
            }
        } catch {
            calendarSyncError = error.localizedDescription
        }
    }

    private func syncBookingsToConnectedCalendar(showMessage: Bool) async {
        do {
            let result = try await calendarSync.sync(bookings: providerStore.bookings)
            if showMessage {
                calendarSyncMessage = "Synced \(result.syncedCount) bookings to Calendar."
            }
        } catch {
            calendarSyncError = error.localizedDescription
        }
    }
}

private struct ProviderMonthYearPickerOverlay: View {
    @Binding var selectedMonth: Date
    let resetToken: UUID
    let onClose: () -> Void
    @State private var isPresented = false

    var body: some View {
        ZStack {
            Color.black
                .opacity(isPresented ? 0.34 : 0)
                .ignoresSafeArea()
                .onTapGesture {
                    dismissAnimated()
                }
                .animation(.easeOut(duration: 0.16), value: isPresented)

            ProviderMonthYearPickerSheet(
                selectedMonth: $selectedMonth,
                resetToken: resetToken,
                onDismiss: dismissAnimated
            )
            .frame(maxWidth: 330)
            .padding(.horizontal, 20)
            .offset(y: isPresented ? 0 : 44)
            .opacity(isPresented ? 1 : 0)
            .animation(.spring(response: 0.28, dampingFraction: 0.9), value: isPresented)
        }
        .presentationBackground(.clear)
        .onAppear {
            isPresented = true
        }
    }

    private func dismissAnimated() {
        isPresented = false
        Task {
            try? await Task.sleep(for: .milliseconds(180))
            await MainActor.run {
                onClose()
            }
        }
    }
}

private struct ProviderMonthYearPickerSheet: View {
    @Binding var selectedMonth: Date
    let resetToken: UUID
    let onDismiss: () -> Void
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedYear: Int
    @State private var selectedMonthNumber: Int

    private let calendar = Calendar.current
    private let months = Calendar.current.monthSymbols

    init(selectedMonth: Binding<Date>, resetToken: UUID, onDismiss: @escaping () -> Void) {
        self._selectedMonth = selectedMonth
        self.resetToken = resetToken
        self.onDismiss = onDismiss
        let components = Calendar.current.dateComponents([.year, .month], from: Date())
        _selectedYear = State(initialValue: components.year ?? Calendar.current.component(.year, from: Date()))
        _selectedMonthNumber = State(initialValue: components.month ?? 1)
    }

    private var yearRange: [Int] {
        let current = calendar.component(.year, from: Date())
        return Array((current - 20)...(current + 20))
    }

    private func resetToCurrentDate() {
        let now = Date()
        let components = calendar.dateComponents([.year, .month], from: now)
        selectedYear = components.year ?? selectedYear
        selectedMonthNumber = components.month ?? selectedMonthNumber
    }

    var body: some View {
        VStack(spacing: 14) {
            ZStack {
                Button {
                    // Tapping title snaps picker to the current year/month.
                    resetToCurrentDate()
                } label: {
                    Text("Jump to Month")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                }
                .buttonStyle(.plain)

                HStack {
                    Button {
                        onDismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(ScheduleMeTheme.accent)
                            .frame(width: 26, height: 26)
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Button("Done") {
                        let nextMonth = calendar.date(
                            from: DateComponents(year: selectedYear, month: selectedMonthNumber, day: 1)
                        ) ?? selectedMonth
                        selectedMonth = nextMonth
                        onDismiss()
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 17).weight(.bold))
                    .foregroundStyle(ScheduleMeTheme.accent)
                    .frame(minWidth: 52, minHeight: 26, alignment: .trailing)
                }
            }

            Picker("Year", selection: $selectedYear) {
                ForEach(yearRange, id: \.self) { year in
                    Text("\(year)").tag(year)
                }
            }
            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
            .pickerStyle(.wheel)
            .frame(height: 110)
            .clipped()

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(Array(months.enumerated()), id: \.offset) { index, name in
                    let monthNumber = index + 1
                    Button {
                        selectedMonthNumber = monthNumber
                    } label: {
                        let isSelected = selectedMonthNumber == monthNumber
                        Text(String(name.prefix(3)))
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundStyle(isSelected ? Color.white : ScheduleMeTheme.titleText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                isSelected
                                ? ScheduleMeTheme.accent
                                : (colorScheme == .dark ? Color.clear : ScheduleMeTheme.surface)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(colorScheme == .dark ? ScheduleMeTheme.cardBorder.opacity(0.45) : ScheduleMeTheme.cardBorder)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 4)
        }
        .padding(18)
        .background(ScheduleMeTheme.pageBackground)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .stroke(ScheduleMeTheme.cardBorder)
        )
        .shadow(color: .black.opacity(0.16), radius: 22, y: 10)
        .onAppear {
            resetToCurrentDate()
        }
        .onChange(of: resetToken) { _, _ in resetToCurrentDate() }
    }
}

@MainActor
private final class ProviderCalendarSyncManager: ObservableObject {
    struct SyncResult {
        let syncedCount: Int
    }

    @Published private(set) var isSyncing = false

    private let eventStore = EKEventStore()
    private let selectedCalendarKey = "provider_calendar_identifier"
    private let autoSyncEnabledKey = "provider_calendar_auto_sync_enabled"
    private let bookingEventMapKey = "provider_calendar_booking_event_map"
    private let bookingMarkerPrefix = "scheduleme_provider_booking_id:"

    var selectedCalendarIdentifier: String? {
        get { UserDefaults.standard.string(forKey: selectedCalendarKey) }
        set { UserDefaults.standard.setValue(newValue, forKey: selectedCalendarKey) }
    }

    var isAutoSyncEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: autoSyncEnabledKey) }
        set { UserDefaults.standard.setValue(newValue, forKey: autoSyncEnabledKey) }
    }

    var isConnected: Bool {
        guard let identifier = selectedCalendarIdentifier, !identifier.isEmpty else { return false }
        return eventStore.calendar(withIdentifier: identifier) != nil && isAutoSyncEnabled
    }

    var connectedCalendarDisplayName: String? {
        guard let identifier = selectedCalendarIdentifier,
              let calendar = eventStore.calendar(withIdentifier: identifier) else {
            return nil
        }
        let title = calendar.title.isEmpty ? "Untitled Calendar" : calendar.title
        let source = calendar.source.title.isEmpty ? nil : calendar.source.title
        if let source {
            return "\(title) (\(source))"
        }
        return title
    }

    func ensureAccess() async throws {
        let status = EKEventStore.authorizationStatus(for: .event)
        if #available(iOS 17.0, *) {
            if status == .fullAccess || status == .writeOnly {
                return
            }
            if status == .notDetermined {
                let granted = try await eventStore.requestFullAccessToEvents()
                if granted { return }
            }
            throw CalendarSyncError.permissionDenied
        } else {
            if status == .authorized {
                return
            }
            if status == .notDetermined {
                let granted = try await eventStore.requestAccess(to: .event)
                if granted { return }
            }
            throw CalendarSyncError.permissionDenied
        }
    }

    func fetchWritableCalendars() async throws -> [EKCalendar] {
        try await ensureAccess()
        var writable = eventStore.calendars(for: .event)
            .filter { $0.allowsContentModifications }
            .sorted { lhs, rhs in
                let left = "\(lhs.source.title)|\(lhs.title)"
                let right = "\(rhs.source.title)|\(rhs.title)"
                return left.localizedCaseInsensitiveCompare(right) == .orderedAscending
            }

        if let fallback = eventStore.defaultCalendarForNewEvents,
           fallback.allowsContentModifications,
           !writable.contains(where: { $0.calendarIdentifier == fallback.calendarIdentifier }) {
            writable.insert(fallback, at: 0)
        }

        return writable
    }

    func connect(to calendar: EKCalendar) {
        selectedCalendarIdentifier = calendar.calendarIdentifier
        isAutoSyncEnabled = true
    }

    func disconnect() {
        selectedCalendarIdentifier = nil
        isAutoSyncEnabled = false
        UserDefaults.standard.removeObject(forKey: bookingEventMapKey)
    }

    func sync(bookings: [ProviderBookingSummary]) async throws -> SyncResult {
        guard isAutoSyncEnabled, let calendarID = selectedCalendarIdentifier, !calendarID.isEmpty else {
            throw CalendarSyncError.notConnected
        }
        guard let calendar = eventStore.calendar(withIdentifier: calendarID), calendar.allowsContentModifications else {
            throw CalendarSyncError.calendarNotFound
        }

        isSyncing = true
        defer { isSyncing = false }

        var updatedMap = bookingEventMap()
        var syncedCount = 0

        for booking in bookings {
            let event = findOrCreateEvent(for: booking, in: calendar, eventMap: updatedMap)
            apply(booking: booking, to: event, in: calendar)
            do {
                try eventStore.save(event, span: .thisEvent, commit: false)
                updatedMap[booking.id] = event.eventIdentifier
                syncedCount += 1
            } catch {
                continue
            }
        }

        try eventStore.commit()
        saveBookingEventMap(updatedMap)
        return SyncResult(syncedCount: syncedCount)
    }

    private func findOrCreateEvent(
        for booking: ProviderBookingSummary,
        in calendar: EKCalendar,
        eventMap: [String: String]
    ) -> EKEvent {
        if let mappedIdentifier = eventMap[booking.id],
           let mappedEvent = eventStore.event(withIdentifier: mappedIdentifier),
           mappedEvent.calendar.calendarIdentifier == calendar.calendarIdentifier {
            return mappedEvent
        }

        let marker = "\(bookingMarkerPrefix)\(booking.id)"
        let windowStart = Calendar.current.date(byAdding: .year, value: -2, to: Date()) ?? Date.distantPast
        let windowEnd = Calendar.current.date(byAdding: .year, value: 2, to: Date()) ?? Date.distantFuture
        let predicate = eventStore.predicateForEvents(withStart: windowStart, end: windowEnd, calendars: [calendar])
        if let existing = eventStore.events(matching: predicate).first(where: { event in
            (event.notes ?? "").contains(marker)
        }) {
            return existing
        }

        return EKEvent(eventStore: eventStore)
    }

    private func apply(booking: ProviderBookingSummary, to event: EKEvent, in calendar: EKCalendar) {
        let marker = "\(bookingMarkerPrefix)\(booking.id)"
        let start = booking.scheduledStart ?? booking.createdAt
        let fallbackEnd = Calendar.current.date(byAdding: .minute, value: 60, to: start) ?? start.addingTimeInterval(3600)
        let end = booking.scheduledEnd ?? fallbackEnd

        event.calendar = calendar
        event.title = "\(booking.service) • \(booking.customerDisplayName)"
        event.startDate = start
        event.endDate = max(end, start.addingTimeInterval(60))
        event.timeZone = .current

        var notes: [String] = []
        notes.append("Booking ID: \(booking.id)")
        notes.append("Status: \(booking.statusLabel)")
        notes.append("Customer: \(booking.customerDisplayName)")
        notes.append("Amount: \(booking.amountLabel)")
        if let bookingNotes = booking.notes?.trimmingCharacters(in: .whitespacesAndNewlines), !bookingNotes.isEmpty {
            notes.append("Notes: \(bookingNotes)")
        }
        notes.append(marker)
        event.notes = notes.joined(separator: "\n")
    }

    private func bookingEventMap() -> [String: String] {
        guard let raw = UserDefaults.standard.dictionary(forKey: bookingEventMapKey) as? [String: String] else {
            return [:]
        }
        return raw
    }

    private func saveBookingEventMap(_ map: [String: String]) {
        UserDefaults.standard.setValue(map, forKey: bookingEventMapKey)
    }

    enum CalendarSyncError: LocalizedError {
        case permissionDenied
        case calendarNotFound
        case notConnected

        var errorDescription: String? {
            switch self {
            case .permissionDenied:
                return "Calendar access is required to sync bookings."
            case .calendarNotFound:
                return "The selected calendar is no longer available."
            case .notConnected:
                return "Connect a calendar first."
            }
        }
    }
}
