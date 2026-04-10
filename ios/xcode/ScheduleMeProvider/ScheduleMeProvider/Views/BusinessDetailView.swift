// FILE OVERVIEW:
// Business profile detail + service selection + booking-time setup.
//
// DEBUG NOTES:
// If custom pricing, business hours, or booking-time UI behaves incorrectly, start here.

import SwiftUI

private struct SelectedPhoto: Identifiable {
    let url: URL

    var id: String { url.absoluteString }
}

struct BusinessDetailView: View {
    let business: BusinessSummary
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @State private var reviews: [BusinessReview] = []
    @State private var isLoadingReviews = false
    @State private var showingBooking = false
    @State private var selectedPhotoIndex = 0
    @State private var services: [BusinessService] = []
    @State private var isLoadingServices = false
    @State private var profile: BusinessProfile?
    @State private var isLoadingProfile = false
    @State private var selectedService: BusinessService?
    @State private var isCustomServiceSelected = false
    @State private var preferredDate = Date()
    @State private var preferredTime = Date()
    @State private var bookingNote = ""
    @State private var selectedPhoto: SelectedPhoto?
    @State private var customServiceName = ""
    @State private var customServicePriceText = ""
    @State private var customServicePriceDigits = ""
    @State private var bookingValidationMessage: String?
    @State private var requiresExactTime = true
    @State private var showingTimePicker = false
    @State private var tempTime = Date()

    private var allPhotos: [URL] {
        var urls: [URL] = []
        if let cover = business.coverURL { urls.append(cover) }
        for url in business.mediaURLs where url != business.coverURL {
            urls.append(url)
        }
        return urls
    }

    var body: some View {
        ScheduleMeScreen(showsTopBar: false) {
            VStack(alignment: .leading, spacing: 0) {
                // Photo gallery
                if !allPhotos.isEmpty {
                    ZStack {
                        TabView(selection: $selectedPhotoIndex) {
                            ForEach(allPhotos.indices, id: \.self) { index in
                                ZStack {
                                    ScheduleMeTheme.pageBackground
                                    AsyncImage(url: allPhotos[index]) { phase in
                                        switch phase {
                                        case .success(let image):
                                            image.resizable().scaledToFit()
                                        default:
                                            Rectangle().fill(ScheduleMeTheme.pageBackground)
                                        }
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                }
                                .tag(index)
                                .onTapGesture {
                                    selectedPhoto = SelectedPhoto(url: allPhotos[index])
                                }
                            }
                        }
                        .tabViewStyle(.page(indexDisplayMode: .automatic))
                        .frame(height: 260)

                        if allPhotos.count > 1 {
                            HStack {
                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        selectedPhotoIndex = max(selectedPhotoIndex - 1, 0)
                                    }
                                } label: {
                                    Image(systemName: "chevron.left")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                        .frame(width: 32, height: 32)
                                        .background(ScheduleMeTheme.surface.opacity(0.9))
                                        .clipShape(Circle())
                                        .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                                }
                                .disabled(selectedPhotoIndex == 0)
                                .opacity(selectedPhotoIndex == 0 ? 0.4 : 1)

                                Spacer()

                                Button {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        selectedPhotoIndex = min(selectedPhotoIndex + 1, allPhotos.count - 1)
                                    }
                                } label: {
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                        .frame(width: 32, height: 32)
                                        .background(ScheduleMeTheme.surface.opacity(0.9))
                                        .clipShape(Circle())
                                        .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                                }
                                .disabled(selectedPhotoIndex == allPhotos.count - 1)
                                .opacity(selectedPhotoIndex == allPhotos.count - 1 ? 0.4 : 1)
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 12)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                        }
                    }
                } else {
                    Rectangle()
                        .fill(ScheduleMeTheme.accentSoft)
                        .frame(height: 200)
                        .overlay(
                            Image(systemName: "building.2")
                                .font(.system(size: 48, weight: .light))
                                .foregroundStyle(ScheduleMeTheme.accent.opacity(0.5))
                        )
                }

                VStack(alignment: .leading, spacing: 20) {
                    // Name + Rating
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(business.name)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                if let description = business.description {
                                    Text(description)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                        .lineLimit(3)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                            Spacer()
                            if let priceLabel = business.priceLabel {
                                Text(priceLabel)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.bold))
                                    .foregroundColor(ScheduleMeTheme.accent)
                            }
                        }

                        HStack(spacing: 12) {
                            HStack(spacing: 4) {
                                Image(systemName: "star.fill")
                                    .font(.system(size: 13))
                                    .foregroundColor(.orange)
                                Text(business.ratingLabel)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text("(\(business.reviewCount ?? 0))")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }

                            Text("•")
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            Text(business.distanceLabel)
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(business.serviceTags, id: \.self) { tag in
                                    ScheduleMeTag(text: tag
                                        .split(separator: "_")
                                        .map { $0.capitalized }
                                        .joined(separator: " ")
                                    )
                                }
                            }
                        }
                    }

                    // Book Now button
                    Button("Book Now") {
                        attemptBooking()
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())

                    // Services
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Services")
                            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)

                        if isLoadingServices {
                            ServiceSkeletonList()
                        } else if services.isEmpty {
                            ScheduleMeCard {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text("Custom requests only")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                    Text("This provider handles custom requests instead of preset services.")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            ForEach(services) { service in
                                let isSelected = selectedService?.id == service.id
                                Button {
                                    selectedService = service
                                    isCustomServiceSelected = false
                                    customServiceName = ""
                                    customServicePriceText = ""
                                    customServicePriceDigits = ""
                                    bookingValidationMessage = nil
                                    requiresExactTime = service.requiresExactTime
                                } label: {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                                            .fill(isSelected ? ScheduleMeTheme.accentSoft : ScheduleMeTheme.surface)
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 24, style: .continuous)
                                                    .stroke(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.cardBorder, lineWidth: isSelected ? 1.5 : 1)
                                            )
                                            .shadow(color: .black.opacity(0.06), radius: 18, y: 10)

                                        HStack(alignment: .top, spacing: 12) {
                                            VStack(alignment: .leading, spacing: 6) {
                                                Text(service.name)
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                                    .foregroundColor(ScheduleMeTheme.titleText)
                                                if let description = service.description, !description.isEmpty {
                                                    Text(description)
                                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                                }
                                                if let duration = service.durationMin {
                                                    Text("\(duration) min")
                                                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                                }
                                            }
                                            Spacer()
                                            Text(service.priceLabel)
                                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.bold))
                                                .foregroundColor(ScheduleMeTheme.accent)
                                        }
                                        .padding(18)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        Button {
                            selectedService = nil
                            isCustomServiceSelected = true
                            customServicePriceText = ""
                            customServicePriceDigits = ""
                            bookingValidationMessage = nil
                            requiresExactTime = profile?.customRequiresTime ?? false
                        } label: {
                            ZStack {
                                RoundedRectangle(cornerRadius: 24, style: .continuous)
                                    .fill(isCustomServiceSelected ? ScheduleMeTheme.accentSoft : ScheduleMeTheme.surface)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                                            .stroke(isCustomServiceSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.cardBorder, lineWidth: isCustomServiceSelected ? 1.5 : 1)
                                    )
                                    .shadow(color: .black.opacity(0.06), radius: 18, y: 10)

                                HStack(spacing: 8) {
                                    Image(systemName: "plus.circle")
                                        .font(.system(size: 14, weight: .semibold))
                                    Text("Custom Service Request")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                }
                                .foregroundColor(isCustomServiceSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.titleText)
                                .padding(.vertical, 14)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)

                        if isCustomServiceSelected {
                            VStack(alignment: .leading, spacing: 6) {
                                TextField("Name the service you need (max 30 chars)", text: $customServiceName)
                                    .scheduleMeFieldStyle()
                                    .onChange(of: customServiceName) { _, newValue in
                                        if newValue.count > 30 {
                                            customServiceName = String(newValue.prefix(30))
                                        }
                                    }
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 6) {
                                    Text("$")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                    TextField("0.00", text: $customServicePriceText)
                                        .keyboardType(.decimalPad)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                        .onChange(of: customServicePriceText) { _, newValue in
                                            let digits = String(newValue.filter(\.isNumber).prefix(7))
                                            customServicePriceDigits = digits
                                            let formatted = formattedCustomPrice(from: digits)
                                            if formatted != newValue {
                                                customServicePriceText = formatted
                                            }
                                        }
                                }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(ScheduleMeTheme.cardBorder)
                            )

                            if customPriceIsBelowMinimum {
                                Text("Minimum booking price is $5.00")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    .foregroundColor(.red)
                                    .padding(.leading, 8)
                            }
                        }
                    }
                    }

                    // Book Appointment
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Set your booking time")
                                .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)

                            if let bookingValidationMessage {
                                Text(bookingValidationMessage)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(.red)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(Color.red.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Business hours")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                Text(hoursSummaryForSelectedDate() ?? "Hours not available")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                            }
                            .padding(.vertical, 4)

                            CalendarMonthPicker(
                                selectedDate: $preferredDate,
                                minimumDate: Calendar.current.startOfDay(for: Date()),
                                maximumDate: Calendar.current.date(byAdding: .month, value: 6, to: Date()) ?? Date(),
                                isDateEnabled: { date in
                                    if shouldEnforceHours {
                                        return isDateOpen(date)
                                    }
                                    return true
                                }
                            )

                            if requiresExactTime {
                                if timeIntervalForSelectedDate() != nil {
                                    Button {
                                        tempTime = preferredTime
                                        showingTimePicker = true
                                    } label: {
                                        HStack {
                                            Text("Select time")
                                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                                .foregroundColor(ScheduleMeTheme.titleText)
                                            Spacer()
                                            Text(formattedTime(preferredTime))
                                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                                .foregroundColor(ScheduleMeTheme.accent)
                                            Image(systemName: "chevron.right")
                                                .font(.system(size: 12, weight: .semibold))
                                                .foregroundColor(ScheduleMeTheme.mutedText)
                                        }
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 12)
                                        .background(ScheduleMeTheme.surface)
                                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .stroke(ScheduleMeTheme.cardBorder)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                } else {
                                    Text("No times available for that day")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .foregroundColor(.red)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(Color.red.opacity(0.08))
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                }
                            } else {
                                Text("Exact time not required")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(ScheduleMeTheme.accentSoft)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }

                            TextField("Describe what you need (max 280 chars)…", text: $bookingNote, axis: .vertical)
                                .lineLimit(3...5)
                                .scheduleMeFieldStyle()
                                .onChange(of: bookingNote) { _, newValue in
                                    if newValue.count > 280 {
                                        bookingNote = String(newValue.prefix(280))
                                    }
                                }

                            Button("Review booking →") {
                                attemptBooking()
                            }
                            .buttonStyle(ScheduleMePrimaryButtonStyle())
                        }
                    }

                    // Reviews section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Reviews")
                            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)

                        if isLoadingReviews {
                            ReviewSkeletonList()
                        } else if reviews.isEmpty {
                            ScheduleMeCard {
                                VStack(spacing: 8) {
                                    Image(systemName: "star")
                                        .font(.system(size: 24))
                                        .foregroundStyle(ScheduleMeTheme.accent)
                                    Text("No reviews yet")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                    Text("Be the first to book and leave a review.")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                        .multilineTextAlignment(.center)
                                }
                                .frame(maxWidth: .infinity)
                            }
                        } else {
                            ForEach(reviews) { review in
                                ReviewCard(review: review)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showingBooking) {
            BookingCreationView(
                business: business,
                initialService: selectedService?.name ?? customServiceName,
                initialNote: bookingNote,
                preferredDate: preferredDate,
                preferredTime: requiresExactTime ? preferredTime : nil,
                requiresExactTime: requiresExactTime,
                servicePriceCents: selectedService?.priceCents ?? customServicePriceCents,
                serviceDurationMin: selectedService?.durationMin
            )
        }
        .fullScreenCover(item: $selectedPhoto) { photo in
            FullscreenBusinessImageView(url: photo.url)
        }
        .task {
            isLoadingReviews = true
            reviews = (try? await dataStore.loadReviews(for: business.id)) ?? []
            isLoadingReviews = false
            await loadBusinessProfile()
            await loadServices()
            syncPreferredTimeToAllowedRange()
        }
        .onChange(of: preferredDate) { _, newValue in
            if shouldEnforceHours, !isDateOpen(newValue) {
                let next = nextOpenDate(from: newValue)
                preferredDate = next
                bookingValidationMessage = "That day is closed. Moved to the next available day."
            } else {
                syncPreferredTimeToAllowedRange()
            }
        }
        .onChange(of: requiresExactTime) { _, _ in
            syncPreferredTimeToAllowedRange()
        }
        .onChange(of: profile?.hours) { _, _ in
            syncPreferredTimeToAllowedRange()
        }
        .sheet(isPresented: $showingTimePicker) {
            if let interval = timeIntervalForSelectedDate() {
                TimePickerModal(
                    selectedTime: $tempTime,
                    interval: interval,
                    onCancel: { showingTimePicker = false },
                    onDone: {
                        preferredTime = tempTime
                        showingTimePicker = false
                    }
                )
                .presentationDetents([.height(360)])
                .presentationDragIndicator(.visible)
            }
        }
    }

    // MARK: - Remote Data

    /// Loads preset services for the currently viewed business.
    private func loadServices() async {
        isLoadingServices = true
        defer { isLoadingServices = false }
        do {
            let response: ServicesResponse = try await APIClient.shared.get(
                path: "/api/services",
                queryItems: [.init(name: "business_id", value: business.id)]
            )
            services = response.services
        } catch {
            services = []
        }
    }

    /// Loads business profile metadata including business hours and custom booking rules.
    private func loadBusinessProfile() async {
        isLoadingProfile = true
        defer { isLoadingProfile = false }
        do {
            let response: BusinessProfileResponse = try await APIClient.shared.get(
                path: "/api/business-profile",
                queryItems: [.init(name: "business_id", value: business.id)]
            )
            profile = response.business
            if isCustomServiceSelected {
                requiresExactTime = response.business?.customRequiresTime ?? false
            }
            if shouldEnforceHours, !isDateOpen(preferredDate) {
                preferredDate = nextOpenDate(from: preferredDate)
            }
            syncPreferredTimeToAllowedRange()
        } catch {
            profile = nil
        }
    }

    // MARK: - Hours + Availability Logic

    /// Normalizes business hours dictionary into calendar order (Mon...Sun) for display.
    private func sortedHours(_ hours: [String: String]) -> [(day: String, hours: String)] {
        let order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        return order.compactMap { day in
            let short = String(day.prefix(3))
            guard let value = hours[day]
                ?? hours[day.lowercased()]
                ?? hours[short]
                ?? hours[short.lowercased()] else { return nil }
            return (day, value)
        }
    }

    private var shouldEnforceHours: Bool {
        guard let hours = profile?.hours else { return false }
        return !hours.isEmpty
    }

    private var dateRange: ClosedRange<Date> {
        let start = Calendar.current.startOfDay(for: Date())
        let end = Calendar.current.date(byAdding: .month, value: 6, to: start) ?? start
        return start...end
    }

    /// Returns the allowed selectable time range for the currently selected day.
    private func timeIntervalForSelectedDate() -> ClosedRange<Date>? {
        if requiresExactTime == false { return nil }
        let calendar = Calendar.current
        let selectedDay = calendar.startOfDay(for: preferredDate)
        let today = calendar.startOfDay(for: Date())
        if shouldEnforceHours, !isDateOpen(selectedDay) {
            return nil
        }
        let (open, close) = businessHoursForDate(selectedDay)

        var start = open
        let end = close
        if selectedDay == today {
            let now = Date()
            if now > start {
                start = roundUpToNextQuarterHour(now)
            }
        }
        if start >= end {
            return nil
        }
        return start...end
    }

    /// Keeps `preferredTime` inside the currently valid open/close interval.
    private func syncPreferredTimeToAllowedRange() {
        guard let interval = timeIntervalForSelectedDate() else { return }
        if preferredTime < interval.lowerBound || preferredTime > interval.upperBound {
            preferredTime = interval.lowerBound
        }
    }

    /// Rounds to the nearest next 15-minute slot for same-day bookings.
    private func roundUpToNextQuarterHour(_ date: Date) -> Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        guard let minute = components.minute, let hour = components.hour else { return date }
        let remainder = minute % 15
        let addMinutes = remainder == 0 ? 0 : 15 - remainder
        guard let roundedBase = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: date) else {
            return date
        }
        return calendar.date(byAdding: .minute, value: addMinutes, to: roundedBase) ?? roundedBase
    }

    private func dayName(for date: Date) -> String? {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    private func dayKeys(for date: Date) -> [String] {
        guard let full = dayName(for: date) else { return [] }
        let short = String(full.prefix(3))
        return [full, full.lowercased(), short, short.lowercased(), short.capitalized]
    }

    private var hourEntries: [(day: String, time: String)] {
        guard let hours = profile?.hours else { return [] }
        return hours
            .map { (day: $0.key, time: $0.value) }
            .filter { !$0.day.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    /// Matches patterns like `Mon`, `Monday`, or ranges like `Mon-Fri` against a date.
    private func dayPatternMatches(_ pattern: String, for date: Date) -> Bool {
        let trimmed = pattern.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let full = dayName(for: date) else { return false }
        let lowered = trimmed.lowercased()
        if lowered.contains("closed") { return false }

        if dayKeys(for: date).contains(where: { lowered == $0.lowercased() }) {
            return true
        }

        let canonicalDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        let aliases: [String: String] = [
            "mon": "Monday", "monday": "Monday",
            "tue": "Tuesday", "tues": "Tuesday", "tuesday": "Tuesday",
            "wed": "Wednesday", "wednesday": "Wednesday",
            "thu": "Thursday", "thur": "Thursday", "thurs": "Thursday", "thursday": "Thursday",
            "fri": "Friday", "friday": "Friday",
            "sat": "Saturday", "saturday": "Saturday",
            "sun": "Sunday", "sunday": "Sunday"
        ]

        let normalized = trimmed
            .replacingOccurrences(of: "–", with: "-")
            .replacingOccurrences(of: ",", with: " ")
            .lowercased()

        if normalized.contains("-") {
            let parts = normalized.split(separator: "-", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            if parts.count == 2,
               let start = aliases[parts[0]],
               let end = aliases[parts[1]],
               let startIndex = canonicalDays.firstIndex(of: start),
               let endIndex = canonicalDays.firstIndex(of: end),
               let dayIndex = canonicalDays.firstIndex(of: full) {
                if startIndex <= endIndex {
                    return dayIndex >= startIndex && dayIndex <= endIndex
                }
                return dayIndex >= startIndex || dayIndex <= endIndex
            }
        }

        let tokens = normalized
            .components(separatedBy: CharacterSet.whitespacesAndNewlines)
            .map { $0.trimmingCharacters(in: .punctuationCharacters) }
            .filter { !$0.isEmpty }
        for token in tokens {
            if let resolved = aliases[token], resolved == full {
                return true
            }
        }
        return false
    }

    /// Parses text hours (e.g. `10:00 AM - 7:00 PM`) into concrete Date bounds for that day.
    private func parseHours(_ text: String, on date: Date) -> (Date, Date)? {
        let lowered = text.lowercased()
        if lowered.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return nil
        }
        if lowered.contains("closed") {
            return nil
        }
        if lowered.contains("24/7") || lowered.contains("24h") || lowered.contains("24 hours") {
            let calendar = Calendar.current
            let start = calendar.startOfDay(for: date)
            let end = calendar.date(bySettingHour: 23, minute: 59, second: 0, of: date) ?? start.addingTimeInterval((24 * 60 * 60) - 60)
            return (start, end)
        }
        if lowered.contains("appointment") {
            let calendar = Calendar.current
            let start = calendar.date(bySettingHour: 8, minute: 0, second: 0, of: date) ?? date
            let end = calendar.date(bySettingHour: 20, minute: 0, second: 0, of: date) ?? date.addingTimeInterval(60 * 60 * 12)
            return (start, end)
        }
        let normalized = text
            .replacingOccurrences(of: "–", with: "-")
            .replacingOccurrences(of: "to", with: "-", options: .caseInsensitive)
        let parts = normalized.split(separator: "-").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count == 2 else { return nil }
        guard let open = parseHourComponent(parts[0]),
              let close = parseHourComponent(parts[1]) else { return nil }
        let calendar = Calendar.current
        let openDate = calendar.date(bySettingHour: open.hour,
                                     minute: open.minute,
                                     second: 0,
                                     of: date)
        let closeDate = calendar.date(bySettingHour: close.hour,
                                      minute: close.minute,
                                      second: 0,
                                      of: date)
        guard let openDate, let closeDate else { return nil }
        return (openDate, closeDate)
    }

    /// True only when the selected day has explicit open hours.
    private func isDateOpen(_ date: Date) -> Bool {
        let entries = hourEntries
        if !entries.isEmpty {
            for entry in entries {
                if dayPatternMatches(entry.day, for: date) {
                    return parseHours(entry.time, on: date) != nil
                }
            }
            // When business hours are defined, days without an explicit match are closed.
            return false
        }
        return !shouldEnforceHours
    }

    /// Resolves the day's opening interval with a safe fallback when hours are absent.
    private func businessHoursForDate(_ date: Date) -> (Date, Date) {
        let entries = hourEntries
        if !entries.isEmpty {
            for entry in entries {
                if dayPatternMatches(entry.day, for: date),
                   let parsed = parseHours(entry.time, on: date) {
                    return parsed
                }
            }
        }
        let calendar = Calendar.current
        let start = calendar.date(bySettingHour: 8, minute: 0, second: 0, of: date) ?? date
        let end = calendar.date(bySettingHour: 20, minute: 0, second: 0, of: date) ?? date.addingTimeInterval(60 * 60 * 12)
        return (start, end)
    }

    /// Finds the next open day from a given date.
    private func nextOpenDate(from date: Date) -> Date {
        let calendar = Calendar.current
        for offset in 0..<30 {
            if let candidate = calendar.date(byAdding: .day, value: offset, to: date),
               isDateOpen(candidate) {
                return candidate
            }
        }
        return date
    }

    // MARK: - Booking Validation + Formatting

    /// Validates service/time/custom inputs before presenting final booking review sheet.
    private func attemptBooking() {
        if isCustomServiceSelected && customPriceIsBelowMinimum {
            bookingValidationMessage = "Custom service price must be at least $5.00."
            return
        }
        let serviceName = (selectedService?.name ?? (isCustomServiceSelected ? customServiceName : "")).trimmingCharacters(in: .whitespacesAndNewlines)
        if serviceName.isEmpty {
            bookingValidationMessage = "Please select a service or add a custom request."
            return
        }
        let noteTrimmed = bookingNote.trimmingCharacters(in: .whitespacesAndNewlines)
        if isCustomServiceSelected && noteTrimmed.isEmpty {
            bookingValidationMessage = "Please add a note for your custom request."
            return
        }
        if requiresExactTime, timeIntervalForSelectedDate() == nil {
            bookingValidationMessage = "No available times for that date."
            return
        }
        if requiresExactTime == false {
            preferredTime = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: preferredDate) ?? preferredDate
        }
        bookingValidationMessage = nil
        showingBooking = true
    }

    private var customServicePriceCents: Int? {
        let digits = customServicePriceDigits.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !digits.isEmpty, let value = Int(digits) else { return nil }
        return value
    }

    private var customPriceIsBelowMinimum: Bool {
        guard let value = customServicePriceCents else { return false }
        return value > 0 && value < 500
    }

    /// Formats digit input as cents-shifted currency (`100` -> `1.00`).
    private func formattedCustomPrice(from digits: String) -> String {
        let trimmed = digits.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let value = Int(trimmed), !trimmed.isEmpty else { return "" }
        let dollars = value / 100
        let cents = value % 100
        return "\(dollars).\(String(format: "%02d", cents))"
    }

    /// Parses multiple time formats (`h:mma`, `H:mm`, etc.) into hour/minute components.
    private func parseHourComponent(_ text: String) -> (hour: Int, minute: Int)? {
        let normalized = text
            .lowercased()
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: " ", with: "")
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let formats = ["h:mma", "ha", "H:mm", "HH:mm", "H", "HH"]
        for format in formats {
            formatter.dateFormat = format
            if let date = formatter.date(from: normalized) {
                let calendar = Calendar.current
                return (
                    hour: calendar.component(.hour, from: date),
                    minute: calendar.component(.minute, from: date)
                )
            }
        }
        return nil
    }

    private func formattedTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    /// Produces a user-facing hours subtitle for the currently selected booking date.
    private func hoursSummaryForSelectedDate() -> String? {
        guard shouldEnforceHours else { return nil }
        guard let name = dayName(for: preferredDate) else { return nil }
        let entries = hourEntries
        if !entries.isEmpty {
            for entry in entries {
                if dayPatternMatches(entry.day, for: preferredDate), !entry.time.isEmpty {
                    return "\(name): \(entry.time)"
                }
            }
        }
        return "\(name): Closed"
    }
}

private struct TimePickerModal: View {
    @Binding var selectedTime: Date
    let interval: ClosedRange<Date>
    let onCancel: () -> Void
    let onDone: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                DatePicker("Preferred time", selection: $selectedTime, in: interval, displayedComponents: [.hourAndMinute])
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                Spacer(minLength: 0)
            }
            .background(ScheduleMeTheme.creamBackground)
            .navigationTitle("Select time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                        .foregroundColor(ScheduleMeTheme.accent)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onDone)
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                }
            }
        }
    }
}

private struct ServiceSkeletonList: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                ScheduleMeCard {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 8) {
                            SkeletonBlock(width: 130, height: 15, cornerRadius: 7)
                            SkeletonBlock(width: 180, height: 12, cornerRadius: 6)
                            SkeletonBlock(width: 60, height: 11, cornerRadius: 6)
                        }
                        Spacer()
                        SkeletonBlock(width: 54, height: 14, cornerRadius: 7)
                    }
                }
            }
        }
    }
}

private struct ReviewSkeletonList: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<2, id: \.self) { _ in
                ScheduleMeCard {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            SkeletonBlock(width: 74, height: 11, cornerRadius: 6)
                            Spacer()
                            SkeletonBlock(width: 66, height: 11, cornerRadius: 6)
                        }
                        SkeletonBlock(width: 110, height: 13, cornerRadius: 6)
                        SkeletonBlock(height: 12, cornerRadius: 6)
                        SkeletonBlock(width: 170, height: 12, cornerRadius: 6)
                    }
                }
            }
        }
    }
}

private struct FullscreenBusinessImageView: View {
    let url: URL
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFit()
                case .failure:
                    Text("Unable to load image")
                        .foregroundColor(.white)
                default:
                    ProgressView().tint(.white)
                }
            }
            .padding(20)

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.white.opacity(0.2))
                    .clipShape(Circle())
            }
            .padding(.trailing, 16)
            .padding(.top, 12)
        }
    }
}

private struct ReviewCard: View {
    let review: BusinessReview

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    HStack(spacing: 2) {
                        ForEach(1...5, id: \.self) { i in
                            Image(systemName: i <= review.rating ? "star.fill" : "star")
                                .font(.system(size: 12))
                                .foregroundColor(i <= review.rating ? .orange : ScheduleMeTheme.mutedText.opacity(0.3))
                        }
                    }
                    Spacer()
                    Text(review.createdAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }

                if let name = review.reviewerName, !name.isEmpty {
                    Text(name)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                }

                if let comment = review.comment, !comment.isEmpty {
                    Text(comment)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
            }
        }
    }
}
