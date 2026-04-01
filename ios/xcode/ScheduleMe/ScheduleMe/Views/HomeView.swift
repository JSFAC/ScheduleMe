import SwiftUI
import CoreLocation

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var locationManager: LocationManager
    @EnvironmentObject private var tabRouter: TabRouter
    @State private var quickRequest = ""
    @FocusState private var isQuickRequestFocused: Bool
    @State private var showingFeedback = false
    @State private var selectedHomeCategory = "All"

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(greeting.uppercased())
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .tracking(1.2)
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        Text("What do you need\ndone today?")
                            .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }
                    .padding(.horizontal, 20)

                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 8) {
                                Image(systemName: "sparkles")
                                    .foregroundColor(ScheduleMeTheme.accent)
                                Text("AI MATCHING")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    .tracking(1.1)
                                    .foregroundColor(ScheduleMeTheme.accent)
                            }

                            TextField("", text: $quickRequest, axis: .vertical)
                                .lineLimit(3...5)
                                .scheduleMeFieldStyle()
                                .focused($isQuickRequestFocused)
                                .overlay(alignment: .topLeading) {
                                    if quickRequest.isEmpty && !isQuickRequestFocused {
                                        TypewriterPlaceholder(
                                            prefix: "Describe what you need — ",
                                            phrases: [
                                                "haircut",
                                                "tutor",
                                                "leaky pipe"
                                            ]
                                        )
                                        .padding(.leading, 16)
                                        .padding(.top, 14)
                                        .allowsHitTesting(false)
                                    }
                                }

                            HStack {
                                Text("↵ to send")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                Spacer()
                                Button("Find Pro") {
                                    tabRouter.selected = .browse
                                }
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Color(hex: "EEF2F1"))
                                .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, 20)

                    VStack(spacing: 12) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(["Leaking pipe", "Deep clean", "AC not cooling", "Haircut", "Tutoring"], id: \.self) { chip in
                                    Button {
                                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                            quickRequest = chip
                                            isQuickRequestFocused = true
                                        }
                                    } label: {
                                        Text(chip)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                            .foregroundColor(ScheduleMeTheme.accent)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 8)
                                            .background(Color.white)
                                            .clipShape(Capsule())
                                            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                                    }
                                }
                            }
                            .padding(.horizontal, 20)
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(homeCategories, id: \.self) { category in
                                    HomeCategoryPill(
                                        title: category,
                                        isSelected: category == selectedHomeCategory
                                    ) {
                                        withAnimation(.easeInOut(duration: 0.2)) {
                                            selectedHomeCategory = category
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 20)
                        }
                    }
                    .padding(.vertical, 10)
                    .background(Color.white)
                    .overlay(Rectangle().frame(height: 1).foregroundColor(ScheduleMeTheme.cardBorder), alignment: .bottom)

                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Campus Pulse")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                .tracking(1.2)
                                .foregroundColor(ScheduleMeTheme.mutedText)
                            Spacer()
                            Text("Updated daily")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                        .padding(.horizontal, 20)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                PulseCard(
                                    title: "Trending on campus",
                                    value: "Haircuts + tutoring",
                                    subtitle: "Updated today",
                                    systemImage: "flame.fill"
                                )
                                PulseCard(
                                    title: "Avg response time",
                                    value: "~18 minutes",
                                    subtitle: "Last 7 days",
                                    systemImage: "clock.fill"
                                )
                                PulseCard(
                                    title: "New pros nearby",
                                    value: "12 this week",
                                    subtitle: "Verified students",
                                    systemImage: "person.2.fill"
                                )
                            }
                            .padding(.horizontal, 20)
                        }
                    }
                    .padding(.top, 6)

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Top‑rated near you")
                            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)

                        if dataStore.isLoadingBusinesses && dataStore.businesses.isEmpty {
                            ProgressView().tint(ScheduleMeTheme.accent)
                        } else if let businessError = dataStore.businessError {
                            ScheduleMeEmptyState(
                                title: "Nearby search unavailable",
                                message: businessError,
                                systemImage: "location.slash"
                            )
                        } else if dataStore.businesses.isEmpty {
                            ScheduleMeEmptyState(
                                title: "No businesses nearby yet",
                                message: "Allow location access and we’ll pull the closest providers from the live ScheduleMe API.",
                                systemImage: "magnifyingglass"
                            )
                        } else {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 16) {
                                    ForEach(homeFilteredBusinesses.prefix(6)) { business in
                                        HomeBusinessCard(business: business)
                                    }
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                Button {
                    showingFeedback = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "message")
                        Text("Feedback")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(ScheduleMeTheme.accent)
                    .clipShape(Capsule())
                    .shadow(color: .black.opacity(0.15), radius: 6, y: 4)
                }
                .padding(.trailing, 20)
                .padding(.bottom, 24)
            }
            .sheet(isPresented: $showingFeedback) {
                FeedbackModalView(userEmail: appState.userEmail)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            locationManager.requestIfNeeded()
            await dataStore.loadBookings()
            await dataStore.loadThreads(for: appState.userID)
        }
        .task(id: locationTaskID) {
            await dataStore.loadNearbyBusinesses(coordinate: locationManager.coordinate)
        }
    }

    private var locationTaskID: String {
        guard let coordinate = locationManager.coordinate else { return "none" }
        return "\(coordinate.latitude),\(coordinate.longitude)"
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Good morning, \(displayName)"
        case 12..<17: return "Good afternoon, \(displayName)"
        default: return "Good evening, \(displayName)"
        }
    }

    private var displayName: String {
        if let email = appState.userEmail, let localPart = email.split(separator: "@").first, !localPart.isEmpty {
            return localPart.capitalized
        }
        return "there"
    }

    private var homeCategories: [String] {
        let categories = Array(Set(dataStore.businesses.map(\.primaryCategory))).sorted()
        return ["All"] + categories
    }

    private var homeFilteredBusinesses: [BusinessSummary] {
        guard selectedHomeCategory != "All" else { return dataStore.businesses }
        return dataStore.businesses.filter { $0.primaryCategory == selectedHomeCategory }
    }
}

private struct FeedbackModalView: View {
    let userEmail: String?

    @Environment(\.dismiss) private var dismiss
    @State private var topic = ""
    @State private var message = ""
    @State private var email = ""
    @State private var isSending = false
    @State private var sendError: String?
    @State private var didSend = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Topic (optional)") {
                    TextField("Bug report, idea, feature request", text: $topic)
                }

                Section("Your feedback") {
                    TextEditor(text: $message)
                        .frame(minHeight: 140)
                }

                Section("Reply email (optional)") {
                    TextField("name@email.com", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                }

                if let sendError {
                    Section {
                        Text(sendError)
                            .foregroundColor(.red)
                    }
                }

                if didSend {
                    Section {
                        Text("Thanks! Your feedback was sent.")
                            .foregroundColor(.green)
                    }
                }
            }
            .navigationTitle("Feedback")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSending ? "Sending..." : "Send") {
                        Task { await submit() }
                    }
                    .disabled(isSending || message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear {
                if email.isEmpty {
                    email = userEmail ?? ""
                }
            }
        }
    }

    private func submit() async {
        isSending = true
        sendError = nil
        didSend = false
        defer { isSending = false }

        do {
            let response: FeedbackResponse = try await APIClient.shared.send(
                path: "/api/feedback",
                method: "POST",
                body: FeedbackRequest(
                    topic: topic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : topic,
                    message: message,
                    email: email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : email
                )
            )
            if response.success == true || response.error == nil {
                didSend = true
            } else {
                sendError = response.error ?? "Unable to send feedback."
            }
        } catch {
            sendError = "Unable to send feedback right now."
        }
    }
}

private struct TypewriterPlaceholder: View {
    let prefix: String
    let phrases: [String]

    @State private var displayText = ""
    @State private var phraseIndex = 0
    @State private var charIndex = 0
    @State private var isDeleting = false

    var body: some View {
        Text(prefix + displayText)
            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
            .foregroundColor(ScheduleMeTheme.mutedText.opacity(0.75))
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .task {
                await runAnimation()
            }
    }

    private func runAnimation() async {
        guard !phrases.isEmpty else { return }
        while !Task.isCancelled {
            let phrase = phrases[phraseIndex]
            if isDeleting {
                if charIndex > 0 {
                    charIndex -= 1
                    displayText = String(phrase.prefix(charIndex))
                    try? await Task.sleep(for: .milliseconds(35))
                } else {
                    isDeleting = false
                    phraseIndex = (phraseIndex + 1) % phrases.count
                    try? await Task.sleep(for: .milliseconds(250))
                }
            } else {
                if charIndex < phrase.count {
                    charIndex += 1
                    displayText = String(phrase.prefix(charIndex))
                    try? await Task.sleep(for: .milliseconds(55))
                } else {
                    try? await Task.sleep(for: .milliseconds(900))
                    isDeleting = true
                }
            }
        }
    }
}

private struct PulseCard: View {
    let title: String
    let value: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Image(systemName: systemImage)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(ScheduleMeTheme.accent)
                    )

                Text(title.uppercased())
                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                    .tracking(1)
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                .foregroundColor(ScheduleMeTheme.titleText)
            Text(subtitle)
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                .foregroundColor(ScheduleMeTheme.mutedText)
        }
        .frame(width: 200, alignment: .leading)
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(ScheduleMeTheme.cardBorder))
    }
}

private struct HomeCategoryPill: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundColor(isSelected ? .white : ScheduleMeTheme.titleText)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    Capsule()
                        .fill(isSelected ? ScheduleMeTheme.accent : Color.white)
                        .opacity(isSelected ? 1 : 0.85)
                )
                .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

private struct HomeBusinessCard: View {
    let business: BusinessSummary

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 12) {
                AsyncImage(url: business.heroImageURL) { phase in
                    switch phase {
                    case .empty:
                        Rectangle().fill(Color(hex: "EEF2F1"))
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        Rectangle().fill(Color(hex: "EEF2F1"))
                    @unknown default:
                        Rectangle().fill(Color(hex: "EEF2F1"))
                    }
                }
                .frame(width: 230, height: 140)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                Text(business.name)
                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)

                HStack(spacing: 8) {
                    ScheduleMeTag(text: business.primaryCategory)
                    if let priceLabel = business.priceLabel {
                        ScheduleMeTag(text: priceLabel)
                    }
                }

                Text("\(business.distanceLabel) • \(business.ratingLabel) stars")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }
        }
        .frame(width: 266)
    }
}
