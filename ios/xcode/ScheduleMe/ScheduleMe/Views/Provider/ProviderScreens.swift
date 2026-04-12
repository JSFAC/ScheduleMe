// FILE OVERVIEW:
// Provider-specific screen implementations grouped in one file.
//
// DEBUG NOTES:
// Use this when provider dashboard or provider list/detail sections need updates.

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

// MARK: - Provider Dashboard

struct ProviderDashboardView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var providerTabRouter: ProviderTabRouter

    private var activeBookings: [BookingSummary] {
        dataStore.bookings.filter { booking in
            let status = booking.status.lowercased()
            return ["confirmed", "active", "completion_pending", "in_progress"].contains(status)
        }
        .sorted { ($0.scheduledAt ?? $0.createdAt) < ($1.scheduledAt ?? $1.createdAt) }
    }

    private var completedCount: Int {
        dataStore.bookings.filter { booking in
            let status = booking.status.lowercased()
            return status == "completed" || status == "awaiting_consumer_confirmation"
        }.count
    }

    private var disputedCount: Int {
        dataStore.bookings.filter { $0.status.lowercased().contains("dispute") }.count
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                VStack(alignment: .leading, spacing: 16) {
                    ScheduleMeHeaderBlock(
                        title: "Business Dashboard",
                        subtitle: "Track completion proof and dispute activity",
                        actionTitle: nil,
                        action: nil
                    ) {
                        EmptyView()
                    }
                    .padding(.top, -6)

                    VStack(alignment: .leading, spacing: 12) {
                        ScheduleMeCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Bookings")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)

                                HStack(spacing: 10) {
                                    ProviderMetricChip(title: "Active", value: "\(activeBookings.count)")
                                    ProviderMetricChip(title: "Completed", value: "\(completedCount)")
                                    ProviderMetricChip(title: "Disputed", value: "\(disputedCount)")
                                }

                                if let nextBooking = activeBookings.first {
                                    Text("Next up: \(nextBooking.service)")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                    Text(nextBooking.scheduledAt?.formatted(date: .abbreviated, time: .shortened) ?? "Requested \(nextBooking.createdAt.formatted(date: .abbreviated, time: .shortened))")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                } else {
                                    Text("No jobs are ready for completion right now.")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                }

                                Button("Open bookings") {
                                    providerTabRouter.selected = .bookings
                                }
                                .buttonStyle(ScheduleMePrimaryButtonStyle())
                            }
                        }
                    }
                    .padding(.horizontal, 20)
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

// MARK: - Provider Bookings

struct ProviderBookingsView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @State private var selectedBookingForCompletion: BookingSummary?

    private var readyToCompleteBookings: [BookingSummary] {
        dataStore.bookings.filter { booking in
            let status = booking.status.lowercased()
            return ["confirmed", "active", "completion_pending", "in_progress"].contains(status)
        }
        .sorted { ($0.scheduledAt ?? $0.createdAt) < ($1.scheduledAt ?? $1.createdAt) }
    }

    private var recentlyCompletedBookings: [BookingSummary] {
        dataStore.bookings.filter { booking in
            let status = booking.status.lowercased()
            return status == "completed" || status == "awaiting_consumer_confirmation"
        }
        .sorted { ($0.completionProofSubmittedAt ?? $0.createdAt) > ($1.completionProofSubmittedAt ?? $1.createdAt) }
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                ScheduleMeHeaderBlock(
                    title: "Bookings",
                    subtitle: "Submit completion proof to complete jobs instantly",
                    actionTitle: nil,
                    action: nil
                ) {
                    EmptyView()
                }
                .padding(.top, -6)

                VStack(alignment: .leading, spacing: 14) {
                    if dataStore.isLoadingBookings && dataStore.bookings.isEmpty {
                        ScheduleMeEmptyState(
                            title: "Loading bookings",
                            message: "Pulling your latest jobs...",
                            systemImage: "calendar.badge.clock"
                        )
                    } else if let error = dataStore.bookingsError {
                        ScheduleMeEmptyState(
                            title: "Bookings unavailable",
                            message: error,
                            systemImage: "calendar.badge.exclamationmark"
                        )
                    } else if readyToCompleteBookings.isEmpty && recentlyCompletedBookings.isEmpty {
                        ScheduleMeEmptyState(
                            title: "No bookings yet",
                            message: "Active jobs will appear here so you can mark them complete with proof.",
                            systemImage: "calendar"
                        )
                    } else {
                        if !readyToCompleteBookings.isEmpty {
                            Text("READY TO COMPLETE")
                                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                .tracking(1.1)
                                .foregroundColor(ScheduleMeTheme.mutedText)
                                .padding(.horizontal, 2)

                            ForEach(readyToCompleteBookings) { booking in
                                ProviderBookingActionCard(booking: booking) {
                                    selectedBookingForCompletion = booking
                                }
                            }
                        }

                        if !recentlyCompletedBookings.isEmpty {
                            Text("RECENTLY COMPLETED")
                                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                .tracking(1.1)
                                .foregroundColor(ScheduleMeTheme.mutedText)
                                .padding(.horizontal, 2)
                                .padding(.top, readyToCompleteBookings.isEmpty ? 0 : 8)

                            ForEach(recentlyCompletedBookings.prefix(8)) { booking in
                                ScheduleMeCard {
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(booking.service)
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                                                    .foregroundColor(ScheduleMeTheme.titleText)
                                                Text(booking.businessName ?? "ScheduleMe customer")
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                            }
                                            Spacer()
                                            ProviderBookingStatusBadge(status: booking.status)
                                        }

                                        if let submittedAt = booking.completionProofSubmittedAt {
                                            Text("Proof submitted \(submittedAt.formatted(date: .abbreviated, time: .shortened))")
                                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                                .foregroundColor(ScheduleMeTheme.mutedText)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            await dataStore.loadBookings()
        }
        .sheet(item: $selectedBookingForCompletion) { booking in
            ProviderCompletionProofSheet(booking: booking)
        }
    }
}

private struct ProviderBookingActionCard: View {
    let booking: BookingSummary
    let onMarkComplete: () -> Void

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(booking.service)
                            .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        Text(booking.businessName ?? "ScheduleMe customer")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }
                    Spacer()
                    ProviderBookingStatusBadge(status: booking.status)
                }

                if let scheduledAt = booking.scheduledAt {
                    Text("Scheduled \(scheduledAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }

                Text("Add a note, photos, or both. Booking completes immediately when submitted.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)

                Button {
                    onMarkComplete()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Mark Complete")
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
            }
        }
    }
}

private struct ProviderCompletionProofSheet: View {
    let booking: BookingSummary

    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var note = ""
    @State private var proofItems: [PhotosPickerItem] = []
    @State private var proofPhotoURLs: [String] = []
    @State private var isUploadingProof = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private var hasProofInput: Bool {
        !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !proofPhotoURLs.isEmpty
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false) {
                VStack(alignment: .leading, spacing: 14) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Completion Proof")
                                .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)

                            Text("\(booking.service) • \(booking.businessName ?? "Customer")")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            Text("Add at least one completion note or photo. Submitting will mark this booking completed immediately and continue payout release.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            TextEditor(text: $note)
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.titleText)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 110)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(ScheduleMeTheme.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(ScheduleMeTheme.cardBorder)
                                )

                            PhotosPicker(selection: $proofItems, maxSelectionCount: 6, matching: .images) {
                                HStack(spacing: 8) {
                                    Image(systemName: "camera")
                                    Text(isUploadingProof ? "Uploading photos..." : "Attach completion photos")
                                }
                            }
                            .buttonStyle(ScheduleMeSecondaryButtonStyle())
                            .disabled(isUploadingProof || isSubmitting)

                            if !proofPhotoURLs.isEmpty {
                                Text("\(proofPhotoURLs.count) photo\(proofPhotoURLs.count == 1 ? "" : "s") attached")
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
                        Task { await submitCompletionProof() }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "checkmark.seal.fill")
                            Text(isSubmitting ? "Submitting..." : "Submit & Mark Complete")
                        }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                    .disabled(isUploadingProof || isSubmitting || !hasProofInput)

                    Button("Cancel") {
                        dismiss()
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())
                    .disabled(isSubmitting)
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
            }
            .navigationTitle("Mark Complete")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: proofItems) { _, items in
                Task { await uploadProofPhotos(items) }
            }
        }
    }

    private func uploadProofPhotos(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        isUploadingProof = true
        defer { isUploadingProof = false }

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

                let fileName = "completion_proof_\(UUID().uuidString).\(ext)"
                let uploadedURL = try await dataStore.uploadBookingEvidence(
                    bookingID: booking.id,
                    data: data,
                    mimeType: mimeType,
                    fileName: fileName
                )
                if !proofPhotoURLs.contains(uploadedURL) {
                    proofPhotoURLs.append(uploadedURL)
                }
                errorMessage = nil
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func submitCompletionProof() async {
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            try await dataStore.submitProviderCompletionProof(
                bookingID: booking.id,
                note: note,
                photoURLs: proofPhotoURLs,
                coordinate: nil
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ProviderMetricChip: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                .foregroundColor(ScheduleMeTheme.accent)
            Text(title.uppercased())
                .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.semibold))
                .tracking(1)
                .foregroundColor(ScheduleMeTheme.mutedText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(ScheduleMeTheme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(ScheduleMeTheme.accent.opacity(0.22))
        )
    }
}

private struct ProviderBookingStatusBadge: View {
    let status: String

    private var color: Color {
        switch status.lowercased() {
        case "confirmed", "active", "completion_pending", "in_progress": return .green
        case "awaiting_consumer_confirmation", "completed": return ScheduleMeTheme.accent
        case "disputed": return .orange
        case "pending", "payment_pending", "payment_collected", "awaiting_payment": return .orange
        case "cancelled", "payment_failed": return .red
        default: return ScheduleMeTheme.mutedText
        }
    }

    private var label: String {
        status.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    var body: some View {
        Text(label)
            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.bold))
            .foregroundColor(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

// MARK: - Provider Services

struct ProviderServicesView: View {
    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                ScheduleMeHeaderBlock(
                    title: "Services",
                    subtitle: "Edit pricing, availability, and offerings",
                    actionTitle: "Add service",
                    action: {}
                ) {
                    EmptyView()
                }
                .padding(.top, -6)

                ScheduleMeEmptyState(
                    title: "No services yet",
                    message: "Your live services will show here once added.",
                    systemImage: "briefcase"
                )
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Provider Messages

struct ProviderMessagesView: View {
    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                ScheduleMeHeaderBlock(
                    title: "Messages",
                    subtitle: "Stay in touch with customers",
                    actionTitle: nil,
                    action: nil
                ) {
                    EmptyView()
                }
                .padding(.top, -6)

                ScheduleMeEmptyState(
                    title: "No messages yet",
                    message: "Customer conversations will appear here.",
                    systemImage: "bubble.left.and.bubble.right"
                )
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Provider Account

struct ProviderAccountView: View {
    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                ScheduleMeHeaderBlock(
                    title: "Account",
                    subtitle: "Business settings and payout details",
                    actionTitle: nil,
                    action: nil
                ) {
                    EmptyView()
                }
                .padding(.top, -6)

                ScheduleMeEmptyState(
                    title: "Provider settings",
                    message: "Connect payouts, edit business info, and manage availability.",
                    systemImage: "person.crop.circle"
                )
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
