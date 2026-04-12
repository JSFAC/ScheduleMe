// FILE OVERVIEW:
// Detailed booking status page for a single booking lifecycle.
//
// DEBUG NOTES:
// Use this file when status chips, actions, or booking timeline content is incorrect.

import SwiftUI
import WebKit
import PhotosUI
import UniformTypeIdentifiers

struct BookingDetailView: View {
    let booking: BookingSummary
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @Environment(\.dismiss) private var dismiss
    @State private var showingReview = false
    @State private var showingCancelAlert = false
    @State private var showingPayment = false
    @State private var showingPaymentReview = false
    @State private var showingDisputeSheet = false
    @State private var actionError: String?
    @State private var proofGalleryStartIndex = 0
    @State private var showingProofGallery = false
    @State private var didSubmitReviewInSession = false
    @State private var remoteHasReviewedProvider: Bool? = nil

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

                ScheduleMeCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("COMPLETION & DISPUTE")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .tracking(1.1)
                            .foregroundColor(ScheduleMeTheme.mutedText)

                        Text(completionAndDisputeSummary)
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.titleText)

                        if let supplemental = completionAndDisputeSupplemental {
                            Text(supplemental)
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                    }
                }

                if showsCompletionProofCard {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("COMPLETION PROOF")
                                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                .tracking(1.1)
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            if let proofNote = booking.completionProofNote?.trimmingCharacters(in: .whitespacesAndNewlines), !proofNote.isEmpty {
                                Text(proofNote)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                            }

                            if !booking.completionProofPhotoURLs.isEmpty {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(Array(booking.completionProofPhotoURLs.enumerated()), id: \.offset) { index, url in
                                            AsyncImage(url: url) { phase in
                                                switch phase {
                                                case .success(let image):
                                                    image
                                                        .resizable()
                                                        .scaledToFill()
                                                default:
                                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                        .fill(ScheduleMeTheme.accentSoft)
                                                        .overlay(
                                                            Image(systemName: "photo")
                                                                .foregroundColor(ScheduleMeTheme.accent)
                                                        )
                                                }
                                            }
                                            .frame(width: 84, height: 84)
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                    .stroke(ScheduleMeTheme.cardBorder)
                                            )
                                            .onTapGesture {
                                                proofGalleryStartIndex = index
                                                showingProofGallery = true
                                            }
                                        }
                                    }
                                }
                            }

                            if !hasCompletionProof {
                                Text("Completion proof is still syncing or missing for this booking. You can still open a dispute while the window is active.")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }

                            if let submittedAt = booking.completionProofSubmittedAt {
                                Text("Submitted \(submittedAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }

                            if let disputeLabel = disputeWindowLabel {
                                Text(disputeLabel)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.accent)
                            }
                        }
                    }
                }

                if isDisputedLikeStatus {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("DISPUTE")
                                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                .tracking(1.1)
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            if let reason = booking.disputeReason, !reason.isEmpty {
                                Text("Reason: \(reason)")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                            }
                            if let details = booking.disputeDetails, !details.isEmpty {
                                Text(details)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }
                            Text("Funds are held while ScheduleMe reviews. Stripe chargebacks are handled separately if escalated.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                    }
                }

                // Actions
                VStack(spacing: 12) {
                    // Message button — navigate to messages tab and open thread
                    Button {
                        tabRouter.pendingMessageBusinessID = booking.businessID
                        tabRouter.pendingMessageBookingID = booking.id
                        dismiss()
                        tabRouter.selected = .messages
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "bubble.left.and.bubble.right.fill")
                            Text("Message Provider")
                        }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())

                    if canOpenDispute {
                        Button {
                            showingDisputeSheet = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                Text("Report Issue / Open Dispute")
                            }
                        }
                        .buttonStyle(ScheduleMeSecondaryButtonStyle())
                    }

                    // Review button for completed bookings
                    if isCompletedLikeStatus {
                        Button {
                            guard hasReviewedProvider == false else { return }
                            showingReview = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "star.fill")
                                Text(hasReviewedProvider ? "Review Submitted" : "Leave a Review")
                            }
                        }
                        .buttonStyle(ScheduleMeSecondaryButtonStyle())
                        .disabled(hasReviewedProvider)
                        if hasReviewedProvider {
                            Text("You have already left this provider a review.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }

                    // Cancel — allowed while not yet active/completed.
                    if ["pending", "paid", "payment_pending", "awaiting_payment", "payment_collected", "confirmed"].contains(normalizedStatus) {
                        Button("Cancel Booking") {
                            showingCancelAlert = true
                        }
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                        .foregroundColor(.red)
                        .frame(maxWidth: .infinity, alignment: .center)
                    }

                    if let actionError {
                        Text(actionError)
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
            ReviewSubmissionView(
                booking: booking,
                onSubmitted: {
                    didSubmitReviewInSession = true
                }
            )
        }
        .alert("Cancel Booking", isPresented: $showingCancelAlert) {
            Button("Keep Booking", role: .cancel) {}
            Button("Cancel Booking", role: .destructive) {
                Task { await cancelBooking() }
            }
        } message: {
            Text("Are you sure you want to cancel this booking? The provider will be notified. The $0.99 ScheduleMe Protection Fee is non-refundable.")
        }
        .sheet(isPresented: $showingPayment) {
            PaymentSetupWebView(bookingID: booking.id)
        }
        .sheet(isPresented: $showingPaymentReview) {
            BookingPaymentReviewSheet(
                booking: booking,
                primaryActionTitle: pendingPriceActionTitle ?? "Pay Booking",
                onContinue: {
                    showingPaymentReview = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                        showingPayment = true
                    }
                }
            )
        }
        .sheet(isPresented: $showingDisputeSheet) {
            BookingDisputeSheet(booking: booking)
        }
        .fullScreenCover(isPresented: $showingProofGallery) {
            BookingProofGalleryView(
                urls: booking.completionProofPhotoURLs,
                initialIndex: proofGalleryStartIndex
            )
        }
        .task(id: booking.id) {
            guard let businessID = booking.businessID else {
                remoteHasReviewedProvider = nil
                return
            }
            remoteHasReviewedProvider = await dataStore.hasSubmittedReview(for: businessID)
        }
    }

    // MARK: - Actions

    /// Cancels current booking via API and dismisses detail screen on success.
    private func cancelBooking() async {
        actionError = nil
        do {
            try await dataStore.cancelBooking(bookingID: booking.id)
            dismiss()
        } catch {
            actionError = error.localizedDescription
        }
    }

    private var pendingPriceActionTitle: String? {
        guard let amount = booking.amountCents, amount > 0, booking.paidAt == nil else { return nil }
        switch normalizedStatus {
        case "pending":
            return "Accept Price"
        case "awaiting_payment", "payment_pending", "payment_collected", "confirmed":
            return "Pay Booking"
        default:
            return nil
        }
    }

    private var hasReviewedProvider: Bool {
        if didSubmitReviewInSession { return true }
        if remoteHasReviewedProvider == true { return true }
        if booking.reviewed == true { return true }
        guard let businessID = booking.businessID else { return false }
        return dataStore.bookings.contains { item in
            item.businessID == businessID && item.reviewed == true
        }
    }

    private var showsCompletionProofCard: Bool {
        return isCompletedLikeStatus || isDisputedLikeStatus || hasCompletionProof
    }

    private var hasCompletionProof: Bool {
        let note = booking.completionProofNote?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return !note.isEmpty || !booking.completionProofPhotoURLs.isEmpty
    }

    private var canOpenDispute: Bool {
        guard !isDisputedLikeStatus else { return false }
        guard isCompletedLikeStatus || hasCompletionProof else { return false }
        guard let deadline = effectiveDisputeDeadline else { return true }
        return Date() <= deadline
    }

    private var disputeWindowLabel: String? {
        guard let deadline = effectiveDisputeDeadline else { return nil }
        let remaining = deadline.timeIntervalSinceNow
        if remaining <= 0 {
            return "Dispute window closed \(deadline.formatted(date: .abbreviated, time: .shortened))."
        }
        return "Dispute window: \(formatDisputeTimeRemaining(remaining))"
    }

    private func formatDisputeTimeRemaining(_ interval: TimeInterval) -> String {
        if interval <= 60 {
            return "<1m remaining"
        }
        let totalMinutes = Int(ceil(interval / 60))
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60
        if hours <= 0 {
            return "\(minutes)m remaining"
        }
        return "\(hours)h \(minutes)m remaining"
    }

    private var effectiveDisputeDeadline: Date? {
        if let explicitDeadline = booking.consumerConfirmationDeadlineAt {
            return explicitDeadline
        }
        if let proofSubmittedAt = booking.completionProofSubmittedAt {
            return proofSubmittedAt.addingTimeInterval(fallbackDisputeWindowInterval)
        }
        // Legacy rows may not have proof/deadline persisted yet.
        return nil
    }

    private var fallbackDisputeWindowInterval: TimeInterval {
        // Consumer app policy: always 24h dispute window.
        TimeInterval(24 * 60 * 60)
    }

    private var normalizedStatus: String {
        booking.status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var isCompletedLikeStatus: Bool {
        let status = normalizedStatus
        if status.contains("completed") || status == "complete" {
            return true
        }
        return ["awaiting_consumer_confirmation", "completion_submitted", "provider_completed", "job_completed"].contains(status)
    }

    private var isDisputedLikeStatus: Bool {
        let status = normalizedStatus
        return status.contains("disput")
    }

    private var completionAndDisputeSummary: String {
        if isDisputedLikeStatus {
            return "This booking is in dispute review. ScheduleMe will adjudicate using proof, timeline, and chat history."
        }
        if isCompletedLikeStatus || hasCompletionProof {
            if canOpenDispute {
                return "Provider marked this booking complete. Review the completion proof below and open a dispute if something is wrong."
            }
            return "Provider marked this booking complete. The dispute window is now closed."
        }
        return "Provider must submit completion proof (note and/or photos). After proof is submitted, this booking moves to Completed automatically."
    }

    private var completionAndDisputeSupplemental: String? {
        if isDisputedLikeStatus {
            if let disputedAt = booking.disputedAt {
                return "Dispute opened \(disputedAt.formatted(date: .abbreviated, time: .shortened))."
            }
            return nil
        }
        if isCompletedLikeStatus || hasCompletionProof {
            return disputeWindowLabel
        }
        let hours = Int(fallbackDisputeWindowInterval / 3600)
        return "No consumer completion confirmation is required. A dispute can be opened for up to \(hours) hours after provider completion."
    }
}

private struct BookingProofGalleryView: View {
    let urls: [URL]
    let initialIndex: Int
    @Environment(\.dismiss) private var dismiss
    @State private var selectedIndex: Int = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                TabView(selection: $selectedIndex) {
                    ForEach(Array(urls.enumerated()), id: \.offset) { index, url in
                        VStack {
                            Spacer()
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .scaledToFit()
                                default:
                                    ProgressView()
                                        .tint(.white)
                                }
                            }
                            .padding(.horizontal, 14)
                            Spacer()
                        }
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: urls.count > 1 ? .automatic : .never))
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 32, height: 32)
                            .background(Color.white.opacity(0.18))
                            .clipShape(Circle())
                    }
                }
            }
            .onAppear {
                selectedIndex = max(0, min(initialIndex, max(urls.count - 1, 0)))
            }
        }
    }
}

private struct BookingPaymentReviewSheet: View {
    let booking: BookingSummary
    let primaryActionTitle: String
    let onContinue: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false) {
                VStack(spacing: 16) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Review Booking")
                                .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                            DetailRow(systemImage: "wrench.and.screwdriver.fill", label: "Service", value: booking.service)
                            DetailRow(systemImage: "building.2.fill", label: "Provider", value: booking.businessName ?? "ScheduleMe provider")
                            if let scheduledAt = booking.scheduledAt {
                                DetailRow(systemImage: "calendar", label: "Scheduled", value: scheduledAt.formatted(date: .abbreviated, time: .shortened))
                            }
                            if let amountLabel = booking.amountLabel {
                                DetailRow(systemImage: "creditcard.fill", label: "Amount Due", value: amountLabel)
                            }
                        }
                    }

                    Text("You can confirm this price now and complete payment securely in the next step.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    Text("The $0.99 ScheduleMe Protection Fee is non-refundable, including when a booking is cancelled.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .multilineTextAlignment(.center)

                    Button(primaryActionTitle) {
                        onContinue()
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())

                    Button("Not now") {
                        dismiss()
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
            }
            .navigationTitle("Review")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct BookingDisputeSheet: View {
    let booking: BookingSummary

    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var reason = "Service incomplete"
    @State private var details = ""
    @State private var evidenceItems: [PhotosPickerItem] = []
    @State private var evidenceURLs: [String] = []
    @State private var isUploadingEvidence = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private let reasonOptions = [
        "Service incomplete",
        "Poor quality",
        "Wrong service",
        "Safety issue",
        "Billing issue",
        "Other"
    ]

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false) {
                VStack(alignment: .leading, spacing: 14) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Open Dispute")
                                .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)

                            Text("Explain what happened. ScheduleMe will review evidence while funds are held.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            Picker("Reason", selection: $reason) {
                                ForEach(reasonOptions, id: \.self) { option in
                                    Text(option).tag(option)
                                }
                            }
                            .pickerStyle(.menu)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(ScheduleMeTheme.cardBorder)
                            )

                            TextEditor(text: $details)
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.titleText)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 120)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(ScheduleMeTheme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(ScheduleMeTheme.cardBorder)
                                )

                            PhotosPicker(selection: $evidenceItems, maxSelectionCount: 6, matching: .images) {
                                HStack(spacing: 8) {
                                    Image(systemName: "paperclip")
                                    Text(isUploadingEvidence ? "Uploading photos..." : "Attach evidence photos")
                                }
                            }
                            .buttonStyle(ScheduleMeSecondaryButtonStyle())
                            .disabled(isUploadingEvidence || isSubmitting)

                            if !evidenceURLs.isEmpty {
                                Text("\(evidenceURLs.count) photo\(evidenceURLs.count == 1 ? "" : "s") attached")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.accent)
                            }

                            if let errorMessage {
                                Text(errorMessage)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(.red)
                            }
                        }
                    }

                    Button {
                        Task { await submitDispute() }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.circle.fill")
                            Text(isSubmitting ? "Submitting..." : "Submit Dispute")
                        }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                    .disabled(isUploadingEvidence || isSubmitting)

                    Button("Cancel") {
                        dismiss()
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())
                    .disabled(isSubmitting)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
            }
            .navigationTitle("Dispute")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: evidenceItems) { _, items in
                Task { await uploadEvidence(items) }
            }
        }
    }

    private func uploadEvidence(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        isUploadingEvidence = true
        defer { isUploadingEvidence = false }

        for item in items {
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    throw DataStoreError.server("Could not read selected photo.")
                }
                let type = item.supportedContentTypes.first
                let mimeType = type?.preferredMIMEType ?? "image/jpeg"
                let ext: String
                if type?.conforms(to: .png) == true {
                    ext = "png"
                } else if type?.conforms(to: .heic) == true {
                    ext = "heic"
                } else {
                    ext = "jpg"
                }
                let fileName = "dispute_\(UUID().uuidString).\(ext)"
                let uploadedURL = try await dataStore.uploadBookingEvidence(
                    bookingID: booking.id,
                    data: data,
                    mimeType: mimeType,
                    fileName: fileName
                )
                if !evidenceURLs.contains(uploadedURL) {
                    evidenceURLs.append(uploadedURL)
                }
                errorMessage = nil
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func submitDispute() async {
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            try await dataStore.openBookingDispute(
                bookingID: booking.id,
                reason: reason,
                details: details,
                photoURLs: evidenceURLs
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct PaymentSetupWebView: View {
    let bookingID: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 10) {
                PaymentWebView(url: URL(string: "https://usescheduleme.com/pay/\(bookingID)"))

                Text("The $0.99 ScheduleMe Protection Fee is non-refundable, including when a booking is cancelled.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
            }
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

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    /// Creates UIKit WKWebView used for hosted web payment page.
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.allowsBackForwardNavigationGestures = true
        webView.backgroundColor = UIColor.systemBackground
        webView.navigationDelegate = context.coordinator
        return webView
    }

    /// Loads booking payment URL whenever representable updates.
    func updateUIView(_ webView: WKWebView, context: Context) {
        guard let url else { return }
        guard Coordinator.isAllowed(url: url) else { return }
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        static func isAllowed(url: URL) -> Bool {
            guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased() else { return false }
            if host == "usescheduleme.com" || host == "www.usescheduleme.com" { return true }
            if host == "checkout.stripe.com" || host == "js.stripe.com" { return true }
            if host.hasSuffix(".stripe.com") { return true }
            return false
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url else { return .cancel }
            return Self.isAllowed(url: url) ? .allow : .cancel
        }
    }
}

private struct StatusBadge: View {
    let status: String

    private var color: Color {
        let normalized = status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.contains("disput") {
            return .orange
        }
        if normalized.contains("completed") || normalized == "complete" {
            return ScheduleMeTheme.accent
        }
        switch normalized {
        case "confirmed", "active", "completion_pending", "in_progress": return .green
        case "awaiting_consumer_confirmation": return ScheduleMeTheme.accent
        case "pending", "paid", "payment_pending", "awaiting_payment", "payment_collected": return .orange
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
