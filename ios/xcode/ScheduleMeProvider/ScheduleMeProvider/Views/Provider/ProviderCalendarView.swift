import SwiftUI

struct ProviderCalendarView: View {
    @EnvironmentObject private var providerStore: ProviderDataStore
    @State private var month: Date = Date()
    @State private var selectedDay: Date = Date()
    @State private var isHydrating = false
    @State private var dayPageIndex = 0
    @State private var expandedBookingIDs: Set<String> = []
    @State private var showingMonthYearPicker = false
    @State private var monthPickerResetToken = UUID()
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

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {
                    if isHydrating && providerStore.bookings.isEmpty {
                        calendarSkeleton
                    } else {
                        monthGrid
                        dayAgenda
                    }
                }
                .padding(16)
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
        }
        .task {
            if providerStore.bookings.isEmpty {
                isHydrating = true
            }
            await providerStore.refreshAll(force: false)
            isHydrating = false
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
