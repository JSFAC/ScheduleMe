// FILE OVERVIEW:
// Reusable calendar month picker used by booking flows.
//
// DEBUG NOTES:
// Disabled-day logic and month navigation behavior are isolated in this component.

import SwiftUI

struct CalendarMonthPicker: View {
    @Binding var selectedDate: Date
    let minimumDate: Date
    let maximumDate: Date
    let isDateEnabled: (Date) -> Bool

    @State private var visibleMonth: Date = Date()

    private let calendar = Calendar.current
    private let daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        visibleMonth = calendar.date(byAdding: .month, value: -1, to: visibleMonth) ?? visibleMonth
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .frame(width: 30, height: 30)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                }
                .disabled(!canGoPrevious)
                .opacity(canGoPrevious ? 1 : 0.4)

                Spacer()

                Text(monthTitle)
                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)

                Spacer()

                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        visibleMonth = calendar.date(byAdding: .month, value: 1, to: visibleMonth) ?? visibleMonth
                    }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .frame(width: 30, height: 30)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                }
                .disabled(!canGoNext)
                .opacity(canGoNext ? 1 : 0.4)
            }

            HStack(spacing: 0) {
                ForEach(daysOfWeek, id: \.self) { day in
                    Text(day)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .frame(maxWidth: .infinity)
                }
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 8) {
                ForEach(gridDates, id: \.self) { date in
                    if let date {
                        let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
                        let isDisabled = isDateDisabled(date)
                        Button {
                            selectedDate = calendar.startOfDay(for: date)
                        } label: {
                            Text(dayNumber(for: date))
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                .foregroundColor(isSelected ? .white : (isDisabled ? ScheduleMeTheme.mutedText.opacity(0.4) : ScheduleMeTheme.titleText))
                                .frame(width: 34, height: 34)
                                .background(
                                    Circle()
                                        .fill(isSelected ? ScheduleMeTheme.accent : Color.clear)
                                )
                        }
                        .buttonStyle(.plain)
                        .disabled(isDisabled)
                    } else {
                        Color.clear.frame(height: 34)
                    }
                }
            }
        }
        .onAppear {
            visibleMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: selectedDate)) ?? selectedDate
        }
        .onChange(of: selectedDate) { _, newValue in
            let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: newValue)) ?? newValue
            visibleMonth = startOfMonth
        }
    }

    // MARK: - Calendar Computed Helpers

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: visibleMonth)
    }

    private var gridDates: [Date?] {
        let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: visibleMonth)) ?? visibleMonth
        let range = calendar.range(of: .day, in: .month, for: startOfMonth) ?? 1..<2
        let firstWeekday = calendar.component(.weekday, from: startOfMonth)
        let leadingBlank = (firstWeekday - calendar.firstWeekday + 7) % 7

        var dates: [Date?] = Array(repeating: nil, count: leadingBlank)
        for day in range {
            if let date = calendar.date(byAdding: .day, value: day - 1, to: startOfMonth) {
                dates.append(date)
            }
        }
        while dates.count % 7 != 0 {
            dates.append(nil)
        }
        return dates
    }

    private func dayNumber(for date: Date) -> String {
        String(calendar.component(.day, from: date))
    }

    private var canGoPrevious: Bool {
        guard let previous = calendar.date(byAdding: .month, value: -1, to: visibleMonth) else { return false }
        return previous >= calendar.date(from: calendar.dateComponents([.year, .month], from: minimumDate)) ?? minimumDate
    }

    private var canGoNext: Bool {
        guard let next = calendar.date(byAdding: .month, value: 1, to: visibleMonth) else { return false }
        return next <= calendar.date(from: calendar.dateComponents([.year, .month], from: maximumDate)) ?? maximumDate
    }

    private func isDateDisabled(_ date: Date) -> Bool {
        // Disabled if outside global bounds or if business rules mark date unavailable.
        let normalized = calendar.startOfDay(for: date)
        if normalized < calendar.startOfDay(for: minimumDate) || normalized > calendar.startOfDay(for: maximumDate) {
            return true
        }
        return !isDateEnabled(normalized)
    }
}
