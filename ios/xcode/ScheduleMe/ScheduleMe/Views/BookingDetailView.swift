// FILE OVERVIEW:
// Detailed booking status page for a single booking lifecycle.
//
// DEBUG NOTES:
// Use this file when status chips, actions, or booking timeline content is incorrect.

import SwiftUI
import WebKit

struct BookingDetailView: View {
    let booking: BookingSummary
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @Environment(\.dismiss) private var dismiss
    @State private var showingReview = false
    @State private var showingCancelAlert = false
    @State private var showingPayment = false
    @State private var cancelError: String?

    var body: some View {
        ScheduleMeScreen(showsTopBar: false) {
            VStack(alignment: .leading, spacing: 20) {
                // Status header
                ScheduleMeCard {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(booking.service)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text(booking.businessName ?? "ScheduleMe provider")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }
                            Spacer()
                            StatusBadge(status: booking.status)
                        }

                        Divider()

                        if let scheduledAt = booking.scheduledAt {
                            DetailRow(
                                systemImage: "calendar",
                                label: "Scheduled",
                                value: scheduledAt.formatted(date: .long, time: .shortened)
                            )
                        } else {
                            DetailRow(
                                systemImage: "calendar.badge.clock",
                                label: "Submitted",
                                value: booking.createdAt.formatted(date: .long, time: .shortened)
                            )
                        }

                        if let amountLabel = booking.amountLabel {
                            DetailRow(systemImage: "creditcard", label: "Amount", value: amountLabel)
                        }

                        if let note = booking.note, !note.isEmpty {
                            DetailRow(systemImage: "note.text", label: "Note", value: note)
                        }

                        Text("ID: \(booking.id)")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText.opacity(0.6))
                    }
                }

                // Contact the business
                if booking.businessPhone != nil || booking.businessEmail != nil {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("CONTACT BUSINESS")
                                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                .tracking(1.2)
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            if let phone = booking.businessPhone {
                                ContactActionRow(systemImage: "phone.fill", label: "Call \(phone)") {
                                    guard let url = URL(string: "tel:\(phone.filter { $0.isNumber })") else { return }
                                    UIApplication.shared.open(url)
                                }
                            }

                            if let email = booking.businessEmail {
                                ContactActionRow(systemImage: "envelope.fill", label: "Email \(email)") {
                                    guard let url = URL(string: "mailto:\(email)") else { return }
                                    UIApplication.shared.open(url)
                                }
                            }
                        }
                    }
                }

                // Payment status
                if !["cancelled", "payment_failed"].contains(booking.status) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("PAYMENT")
                                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                .tracking(1.1)
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            if booking.stripePaymentMethodID != nil {
                                Text("Payment method saved")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text("Your card is authorized. You’ll be charged after the service is completed.")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                Button("Change payment method") {
                                    showingPayment = true
                                }
                                .buttonStyle(ScheduleMeSecondaryButtonStyle())
                            } else {
                                Text("Payment method required")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text("Save a card to secure this booking.")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                Button("Add payment method") {
                                    showingPayment = true
                                }
                                .buttonStyle(ScheduleMePrimaryButtonStyle())
                            }
                        }
                    }
                }

                // Actions
                VStack(spacing: 12) {
                    // Message button — navigate to messages tab and open thread
                    Button {
                        dismiss()
                        tabRouter.selected = .messages
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "bubble.left.and.bubble.right.fill")
                            Text("Message Provider")
                        }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())

                    // Review button for completed bookings
                    if booking.status == "completed" {
                        Button {
                            showingReview = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "star.fill")
                                Text("Leave a Review")
                            }
                        }
                        .buttonStyle(ScheduleMeSecondaryButtonStyle())
                    }

                    // Cancel — only for pending bookings
                    if booking.status == "pending" {
                        Button("Cancel Booking") {
                            showingCancelAlert = true
                        }
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                        .foregroundColor(.red)
                        .frame(maxWidth: .infinity, alignment: .center)
                    }

                    if let cancelError {
                        Text(cancelError)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(.red)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 40)
        }
        .navigationTitle("Booking Details")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingReview) {
            ReviewSubmissionView(booking: booking)
        }
        .alert("Cancel Booking", isPresented: $showingCancelAlert) {
            Button("Keep Booking", role: .cancel) {}
            Button("Cancel Booking", role: .destructive) {
                Task { await cancelBooking() }
            }
        } message: {
            Text("Are you sure you want to cancel this booking? The provider will be notified.")
        }
        .sheet(isPresented: $showingPayment) {
            PaymentSetupWebView(bookingID: booking.id)
        }
    }

    // MARK: - Actions

    /// Cancels current booking via API and dismisses detail screen on success.
    private func cancelBooking() async {
        cancelError = nil
        do {
            try await dataStore.cancelBooking(bookingID: booking.id)
            dismiss()
        } catch {
            cancelError = error.localizedDescription
        }
    }
}

private struct PaymentSetupWebView: View {
    let bookingID: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            PaymentWebView(url: URL(string: "https://usescheduleme.com/pay/\(bookingID)"))
                .navigationTitle("Payment")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.accent)
                    }
                }
        }
    }
}

private struct PaymentWebView: UIViewRepresentable {
    let url: URL?

    /// Creates UIKit WKWebView used for hosted web payment page.
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.allowsBackForwardNavigationGestures = true
        webView.backgroundColor = UIColor.systemBackground
        return webView
    }

    /// Loads booking payment URL whenever representable updates.
    func updateUIView(_ webView: WKWebView, context: Context) {
        guard let url else { return }
        webView.load(URLRequest(url: url))
    }
}

private struct StatusBadge: View {
    let status: String

    private var color: Color {
        switch status {
        case "confirmed": return .green
        case "completed": return ScheduleMeTheme.accent
        case "pending": return .orange
        case "cancelled": return .red
        default: return ScheduleMeTheme.mutedText
        }
    }

    private var label: String {
        status.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    var body: some View {
        Text(label)
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
            .foregroundColor(color)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

private struct DetailRow: View {
    let systemImage: String
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(ScheduleMeTheme.accentSoft)
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: systemImage)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased())
                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .tracking(0.8)
                Text(value)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.titleText)
            }
            Spacer()
        }
    }
}

private struct ContactActionRow: View {
    let systemImage: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: systemImage)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(ScheduleMeTheme.accent)
                    )
                Text(label)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .lineLimit(1)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }
        }
        .buttonStyle(.plain)
    }
}
