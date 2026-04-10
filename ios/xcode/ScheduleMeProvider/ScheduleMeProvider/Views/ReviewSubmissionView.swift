// FILE OVERVIEW:
// Post-booking review submission form and rating flow.
//
// DEBUG NOTES:
// If review submit validation or payload mapping breaks, debug this file.

import SwiftUI

struct ReviewSubmissionView: View {
    let booking: BookingSummary
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var rating = 0
    @State private var hovered = 0
    @State private var comment = ""
    @State private var isDone = false
    @State private var error: String?

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
            }
            .navigationTitle("Leave a Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") { dismiss() }
                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
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

                if let error {
                    Text(error)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundColor(.red)
                }

                Button {
                    Task { await submitReview() }
                } label: {
                    if dataStore.isSubmittingReview {
                        ProgressView().tint(.white)
                    } else {
                        Text("Submit Review")
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
                .disabled(rating == 0 || dataStore.isSubmittingReview)
            }
        }
    }

    private var doneView: some View {
        ScheduleMeCard {
            VStack(spacing: 16) {
                Text("⭐")
                    .font(.system(size: 56))

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
                comment: comment
            )
            withAnimation { isDone = true }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
