import SwiftUI

struct CampusView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                if appState.eduVerified == true {
                    VStack(spacing: 0) {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 8) {
                                Text("🎓 Campus")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text("✓ Verified")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .foregroundColor(.white)
                                    .background(ScheduleMeTheme.accent)
                                    .clipShape(Capsule())
                            }
                            Text("Showing campus providers for your school")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 12)
                        .padding(.bottom, 18)

                        VStack {
                            if dataStore.businesses.isEmpty {
                                ScheduleMeEmptyState(
                                    title: "No campus providers yet",
                                    message: "Be the first verified campus service provider here.",
                                    systemImage: "graduationcap",
                                    actionTitle: "Apply as a campus provider →",
                                    action: openBusinessSignup
                                )
                                .padding(.horizontal, 20)
                                .padding(.top, 40)
                                .padding(.bottom, 60)
                            } else {
                                VStack(spacing: 16) {
                                    ForEach(dataStore.businesses.prefix(10)) { business in
                                        CampusBusinessRow(business: business)
                                    }
                                }
                                .padding(.horizontal, 20)
                                .padding(.top, 12)
                                .padding(.bottom, 30)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                } else {
                    VStack {
                        ScheduleMeEmptyState(
                            title: "Campus locked",
                            message: "Verify your .edu email to unlock your campus marketplace.",
                            systemImage: "lock"
                        )
                        .padding(.horizontal, 20)
                        .padding(.top, 40)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func openBusinessSignup() {
        if let url = URL(string: "https://usescheduleme.com/business") {
            openURL(url)
        }
    }
}

private struct CampusBusinessRow: View {
    let business: BusinessSummary

    var body: some View {
        ScheduleMeCard {
            HStack(alignment: .top, spacing: 14) {
                AsyncImage(url: business.heroImageURL) { phase in
                    switch phase {
                    case .empty:
                        Rectangle().fill(ScheduleMeTheme.pageBackground)
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure:
                        Rectangle().fill(ScheduleMeTheme.pageBackground)
                    @unknown default:
                        Rectangle().fill(ScheduleMeTheme.pageBackground)
                    }
                }
                .frame(width: 90, height: 90)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 6) {
                    Text(business.name)
                        .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                    Text(business.description ?? business.primaryCategory)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                        .lineLimit(2)
                    HStack(spacing: 6) {
                        ScheduleMeTag(text: business.primaryCategory)
                        if let priceLabel = business.priceLabel {
                            ScheduleMeTag(text: priceLabel)
                        }
                    }
                    Text("\(business.distanceLabel) • \(business.ratingLabel)★")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }
            }
        }
    }
}
