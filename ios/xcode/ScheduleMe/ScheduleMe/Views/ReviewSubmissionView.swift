// FILE OVERVIEW:
// Post-booking review submission form and rating flow.
//
// DEBUG NOTES:
// If review submit validation or payload mapping breaks, debug this file.

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import UIKit

struct ReviewSubmissionView: View {
    let booking: BookingSummary
    var onSubmitted: (() -> Void)? = nil
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var rating = 0
    @State private var hovered = 0
    @State private var comment = ""
    @State private var isDone = false
    @State private var error: String?
    @State private var reviewMediaItems: [PhotosPickerItem] = []
    @State private var pendingReviewMedia: [PendingReviewMedia] = []
    @State private var isPreparingReviewMedia = false
    @FocusState private var isCommentFocused: Bool

    private let ratingLabels = ["", "Poor", "Fair", "Good", "Great", "Excellent"]
    private var activeRating: Int { hovered > 0 ? hovered : rating }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false) {
                VStack(spacing: 0) {
                    if isDone {
                        doneView
                    } else {
                        formView
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 40)
                .contentShape(Rectangle())
                .simultaneousGesture(
                    TapGesture().onEnded {
                        if isCommentFocused {
                            isCommentFocused = false
                        }
                    }
                )
            }
            .navigationTitle("Leave a Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .frame(width: 32, height: 32)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }
                }
            }
            .onChange(of: reviewMediaItems) { _, items in
                Task { await prepareReviewMedia(items) }
            }
        }
    }

    private var formView: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 20) {
                // Business info
                VStack(alignment: .leading, spacing: 4) {
                    Text("RATE YOUR EXPERIENCE")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.accent)
                    Text(booking.businessName ?? "Your provider")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Text(booking.service)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }

                // Stars
                VStack(spacing: 8) {
                    HStack(spacing: 12) {
                        ForEach(1...5, id: \.self) { i in
                            Image(systemName: i <= activeRating ? "star.fill" : "star")
                                .font(.system(size: 40))
                                .foregroundColor(i <= activeRating ? .orange : ScheduleMeTheme.mutedText.opacity(0.3))
                                .scaleEffect(i <= activeRating ? 1.05 : 1.0)
                                .animation(.spring(response: 0.25), value: activeRating)
                                .onTapGesture {
                                    withAnimation(.spring(response: 0.2)) {
                                        rating = i
                                    }
                                }
                        }
                    }
                    .frame(maxWidth: .infinity)

                    if activeRating > 0 {
                        Text(ratingLabels[activeRating])
                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                            .foregroundColor(.orange)
                            .transition(.opacity.combined(with: .scale))
                    }
                }

                // Comment
                VStack(alignment: .leading, spacing: 8) {
                    Text("TELL OTHERS ABOUT YOUR EXPERIENCE")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.0)
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    TextField("Optional – what went well? Any tips?", text: $comment, axis: .vertical)
                        .lineLimit(3...6)
                        .scheduleMeFieldStyle()
                        .focused($isCommentFocused)
                        .onChange(of: comment) { _, newValue in
                            if newValue.count > 500 {
                                comment = String(newValue.prefix(500))
                            }
                        }

                    Text("\(comment.count)/500")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("ADD PHOTOS / VIDEO")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.0)
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    PhotosPicker(selection: $reviewMediaItems, maxSelectionCount: 3, matching: .any(of: [.images, .videos])) {
                        HStack(spacing: 8) {
                            Image(systemName: "paperclip")
                            Text(isPreparingReviewMedia ? "Preparing media..." : "Attach up to 3 items (max 1 video)")
                        }
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())
                    .disabled(dataStore.isSubmittingReview || isPreparingReviewMedia)

                    if !pendingReviewMedia.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(pendingReviewMedia) { media in
                                    HStack(spacing: 6) {
                                        if let image = media.previewImage {
                                            Image(uiImage: image)
                                                .resizable()
                                                .scaledToFill()
                                                .frame(width: 28, height: 28)
                                                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                                        } else {
                                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                                .fill(ScheduleMeTheme.accentSoft)
                                                .frame(width: 28, height: 28)
                                                .overlay(
                                                    Image(systemName: "video.fill")
                                                        .foregroundStyle(ScheduleMeTheme.accent)
                                                )
                                        }

                                        Text(media.mediaType == "video" ? "Video" : "Image")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                            .foregroundColor(ScheduleMeTheme.titleText)

                                        Button {
                                            pendingReviewMedia.removeAll { $0.id == media.id }
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.system(size: 14))
                                                .foregroundColor(ScheduleMeTheme.mutedText)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 6)
                                    .background(ScheduleMeTheme.surface)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .stroke(ScheduleMeTheme.cardBorder)
                                    )
                                }
                            }
                        }
                    }
                }

                if let error {
                    Text(error)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundColor(.red)
                }

                Button {
                    Task { await submitReview() }
                } label: {
                    if dataStore.isSubmittingReview {
                        ScheduleMeLoadingBar(
                            width: 72,
                            height: 6,
                            tint: .white,
                            track: Color.white.opacity(0.28)
                        )
                    } else {
                        Text("Submit Review")
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
                .disabled(rating == 0 || dataStore.isSubmittingReview || isPreparingReviewMedia)
            }
        }
    }

    private var doneView: some View {
        ScheduleMeCard {
            VStack(spacing: 16) {
                Image(systemName: "star.fill")
                    .font(.system(size: 46, weight: .semibold))
                    .foregroundColor(.orange)

                VStack(spacing: 6) {
                    Text("Thanks for the review!")
                        .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Text("Your feedback helps other customers find great pros.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .multilineTextAlignment(.center)
                }

                Button("Done") { dismiss() }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Actions

    /// Validates required IDs and submits the review payload through data store.
    private func submitReview() async {
        error = nil
        guard let businessID = booking.businessID else {
            error = "Missing business information."
            return
        }
        do {
            try await dataStore.submitReview(
                bookingID: booking.id,
                businessID: businessID,
                rating: rating,
                comment: comment,
                reviewMediaURLs: try await uploadReviewMediaIfNeeded()
            )
            onSubmitted?()
            withAnimation { isDone = true }
        } catch let submitError {
            self.error = submitError.localizedDescription
        }
    }

    private func prepareReviewMedia(_ items: [PhotosPickerItem]) async {
        isPreparingReviewMedia = true
        defer { isPreparingReviewMedia = false }
        error = nil

        var prepared: [PendingReviewMedia] = []
        var videoCount = 0

        for item in items.prefix(3) {
            do {
                guard let data = try await item.loadTransferable(type: Data.self) else {
                    throw DataStoreError.server("Could not read selected media.")
                }
                let type = item.supportedContentTypes.first
                let mediaType = (type?.conforms(to: .movie) == true) ? "video" : "image"
                if mediaType == "video" {
                    videoCount += 1
                    if videoCount > 1 {
                        throw DataStoreError.server("Only 1 video is allowed per review.")
                    }
                }
                let maxSize = mediaType == "video" ? 50 * 1024 * 1024 : 8 * 1024 * 1024
                if data.count > maxSize {
                    let sizeMB = Double(data.count) / 1_048_576.0
                    let limitMB = mediaType == "video" ? 50 : 8
                    throw DataStoreError.server(
                        "\(mediaType.capitalized) is \(String(format: "%.1f", sizeMB))MB. Max allowed is \(limitMB)MB."
                    )
                }

                let mimeType = type?.preferredMIMEType ?? (mediaType == "video" ? "video/mp4" : "image/jpeg")
                let ext = type?.preferredFilenameExtension ?? (mediaType == "video" ? "mp4" : "jpg")
                let preview = mediaType == "image" ? UIImage(data: data) : nil
                prepared.append(
                    PendingReviewMedia(
                        data: data,
                        mimeType: mimeType,
                        mediaType: mediaType,
                        fileName: "review_\(UUID().uuidString).\(ext)",
                        previewImage: preview
                    )
                )
            } catch let mediaError {
                self.error = mediaError.localizedDescription
                break
            }
        }

        pendingReviewMedia = prepared
    }

    private func uploadReviewMediaIfNeeded() async throws -> [String] {
        guard !pendingReviewMedia.isEmpty else { return [] }
        var urls: [String] = []
        for media in pendingReviewMedia {
            let uploadedURL = try await dataStore.uploadBookingEvidence(
                bookingID: booking.id,
                data: media.data,
                mimeType: media.mimeType,
                fileName: media.fileName,
                mediaType: media.mediaType
            )
            urls.append(uploadedURL)
        }
        return urls
    }
}

private struct PendingReviewMedia: Identifiable {
    let id = UUID()
    let data: Data
    let mimeType: String
    let mediaType: String
    let fileName: String
    let previewImage: UIImage?
}
