// FILE OVERVIEW:
// Consumer home feed with quick matching, chips, pulse cards, and top-rated section.
//
// DEBUG NOTES:
// Get-matches input/button logic and home card rendering live here.

import SwiftUI
import CoreLocation

struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var locationManager: LocationManager
    @EnvironmentObject private var tabRouter: TabRouter
    @State private var showingAccount = false
    @AppStorage("scheduleme_dismiss_student_banner") private var dismissedStudentBanner = false
    @State private var quickRequest = ""
    @FocusState private var isQuickRequestFocused: Bool
    @State private var showingFeedback = false
    @Environment(\.floatingTabBarHeight) private var tabBarHeight
    @State private var selectedHomeCategory = "All"
    @State private var showingMatches = false
    @State private var matchedBusinesses: [BusinessSummary] = []
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
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
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 8) {
                                Image(systemName: "sparkles")
                                    .foregroundColor(ScheduleMeTheme.accent)
                                Text("GET MATCHES")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    .tracking(1.1)
                                    .foregroundColor(ScheduleMeTheme.accent)
                                Spacer()
                                if showingMatches {
                                    Button {
                                        withAnimation(.easeInOut(duration: 0.2)) {
                                            showingMatches = false
                                        }
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundColor(ScheduleMeTheme.mutedText)
                                            .frame(width: 28, height: 28)
                                            .background(ScheduleMeTheme.surface)
                                            .clipShape(Circle())
                                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                                    }
                                    .contentShape(Rectangle())
        .buttonStyle(.plain)
                                }
                            }

                            if showingMatches {
                                VStack(alignment: .leading, spacing: 10) {
                                    if matchedBusinesses.isEmpty {
                                        Text("No matches yet")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                            .foregroundColor(ScheduleMeTheme.titleText)
                                        Text("Try a different keyword or browse all professionals.")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                            .foregroundColor(ScheduleMeTheme.mutedText)
                                    } else {
                                        ForEach(matchedBusinesses.prefix(3)) { business in
                                            NavigationLink(destination: BusinessDetailView(business: business)) {
                                                HStack(spacing: 10) {
                                                    Circle()
                                                        .fill(ScheduleMeTheme.accentSoft)
                                                        .frame(width: 32, height: 32)
                                                        .overlay(
                                                            Text(String(business.name.prefix(1)))
                                                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                                                                .foregroundColor(ScheduleMeTheme.accent)
                                                        )
                                                    VStack(alignment: .leading, spacing: 2) {
                                                        Text(business.name)
                                                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                                            .foregroundColor(ScheduleMeTheme.titleText)
                                                        Text(business.primaryCategory)
                                                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                                            .foregroundColor(ScheduleMeTheme.mutedText)
                                                    }
                                                    Spacer()
                                                    Image(systemName: "chevron.right")
                                                        .font(.system(size: 12, weight: .semibold))
                                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                                }
                                                .padding(.vertical, 4)
                                            }
                                            .contentShape(Rectangle())
        .buttonStyle(.plain)
                                        }
                                    }

                                    Button("Browse all results") {
                                        tabRouter.selected = .browse
                                    }
                                    .buttonStyle(ScheduleMeSecondaryButtonStyle())
                                }
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                            } else {
                                TextField("", text: $quickRequest, axis: .vertical)
                                    .lineLimit(3...5)
                                    .scheduleMeFieldStyle()
                                    .foregroundColor(ScheduleMeTheme.titleText)
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
                                    let isGetMatchesDisabled = quickRequest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    Button("Get matches") {
                                        runMatches()
                                    }
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(isGetMatchesDisabled ? ScheduleMeTheme.mutedText : .white)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 7)
                                    .background(
                                        isGetMatchesDisabled
                                            ? (colorScheme == .dark ? Color(hex: "1F2937") : Color(hex: "EEF2F1"))
                                            : ScheduleMeTheme.accent
                                    )
                                    .clipShape(Capsule())
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 20)

                    VStack(spacing: 8) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(["Leaking pipe", "Deep clean", "AC not cooling", "Haircut", "Tutoring"], id: \.self) { chip in
                                    Button {
                                        isQuickRequestFocused = true
                                        Task {
                                            quickRequest = ""
                                            for i in 1...chip.count {
                                                quickRequest = String(chip.prefix(i))
                                                try? await Task.sleep(for: .milliseconds(40))
                                            }
                                        }
                                    } label: {
                                        Text(chip)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                            .foregroundColor(ScheduleMeTheme.accent)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 6)
                                            .background(ScheduleMeTheme.surface)
                                            .clipShape(Capsule())
                                            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                                    }
                                }
                            }
                        }

                        Divider().overlay(ScheduleMeTheme.cardBorder.opacity(0.25))

                        ViewThatFits(in: .horizontal) {
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
                            .frame(maxWidth: .infinity)
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
                            }
                        }
                    }
                    .padding(8)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
                    .padding(.horizontal, 20)

                    VStack(alignment: .leading, spacing: 6) {
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
                        .padding(.horizontal, 12)

                        if appState.eduVerified == false && dismissedStudentBanner == false {
                            StudentVerifyBanner(
                                onVerify: { showingAccount = true },
                                onDismiss: { dismissedStudentBanner = true }
                            )
                            .padding(.horizontal, 12)
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
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
                        }
                    }
                    .padding(8)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
                    .padding(.horizontal, 20)
                    .padding(.top, 4)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Top‑rated near you")
                            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)

                        if dataStore.isLoadingBusinesses && dataStore.businesses.isEmpty {
                            HomeTopRatedSkeleton()
                        } else if let businessError = dataStore.businessError {
                            ScheduleMeEmptyState(
                                title: "Nearby search unavailable",
                                message: businessError,
                                systemImage: "location.slash"
                            )
                        } else if !hasLocation && !dataStore.isLoadingBusinesses {
                            LocationPromptCard()
                        } else if dataStore.businesses.isEmpty && hasLocation {
                            ScheduleMeEmptyState(
                                title: "No businesses nearby yet",
                                message: "Be the first to bring ScheduleMe to your area.",
                                systemImage: "magnifyingglass"
                            )
                        } else {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 14) {
                                    ForEach(homeFilteredBusinesses.prefix(6)) { business in
                                        NavigationLink(destination: BusinessDetailView(business: business)) {
                                            HomeBusinessCard(business: business)
                                        }
                                        .contentShape(Rectangle())
        .buttonStyle(.plain)
                                    }
                                    // See all arrow card
                                    Button { tabRouter.selected = .browse } label: {
                                        VStack(spacing: 8) {
                                            Circle()
                                                .fill(ScheduleMeTheme.accentSoft)
                                                .frame(width: 44, height: 44)
                                                .overlay(
                                                    Image(systemName: "arrow.right")
                                                        .font(.system(size: 18, weight: .semibold))
                                                        .foregroundStyle(ScheduleMeTheme.accent)
                                                )
                                            Text("See all\npros")
                                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                                .foregroundColor(ScheduleMeTheme.mutedText)
                                                .multilineTextAlignment(.center)
                                        }
                                        .frame(width: 80)
                                        .padding(.vertical, 40)
                                    }
                                    .contentShape(Rectangle())
        .buttonStyle(.plain)
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
                .padding(.bottom, tabBarHeight + 12)
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

    // MARK: - Derived State

    /// Used as `.task(id:)` dependency so nearby business fetch reruns only when coordinates change.
    private var locationTaskID: String {
        guard let coordinate = locationManager.coordinate else { return "none" }
        return "\(coordinate.latitude),\(coordinate.longitude)"
    }

    /// True when device location (or simulator fallback) is available for nearby content.
    private var hasLocation: Bool {
        locationManager.coordinate != nil || LocationManager.simulatorFallbackCoordinate != nil
    }

    /// Time-of-day greeting shown in the home header.
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

    /// Lightweight local keyword matcher for the quick-request card.
    /// It intentionally uses local in-memory businesses for immediate UX (no extra API call).
    private func runMatches() {
        let query = quickRequest.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return }
        let tokens = query
            .split(separator: " ")
            .map { String($0) }
            .filter { !$0.isEmpty }
        let matches = dataStore.businesses.filter { business in
            let haystack = [business.name, business.primaryCategory, business.description ?? ""]
                .joined(separator: " ")
                .lowercased()
            return tokens.allSatisfy { haystack.contains($0) }
        }
        matchedBusinesses = matches.sorted { ($0.rating ?? 0) > ($1.rating ?? 0) }
        withAnimation(.easeInOut(duration: 0.25)) {
            showingMatches = true
        }
    }
}

private struct HomeTopRatedSkeleton: View {
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 8) {
                        SkeletonBlock(width: 160, height: 110, cornerRadius: 16)
                        SkeletonBlock(width: 120, height: 14, cornerRadius: 8)
                        SkeletonBlock(width: 80, height: 12, cornerRadius: 8)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }
}

// MARK: - Feedback Modal

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

private struct StudentVerifyBanner: View {
    let onVerify: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "graduationcap.fill")
                .foregroundStyle(ScheduleMeTheme.accent)
            VStack(alignment: .leading, spacing: 4) {
                Text("Are you a student?")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text("Verify your .edu email to unlock your campus marketplace")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }
            Spacer()
            Button("Verify Now →", action: onVerify)
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .foregroundColor(.white)
                .background(ScheduleMeTheme.accent)
                .clipShape(Capsule())

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .frame(width: 26, height: 26)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
            }
            .contentShape(Rectangle())
        .buttonStyle(.plain)
        }
        .padding(12)
        .background(Color(hex: "E8F6F3"))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
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

    /// Cycles through canned prompts to make the empty quick-request field feel alive.
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
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 24, height: 24)
                    .overlay(
                        Image(systemName: systemImage)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(ScheduleMeTheme.accent)
                    )

                Text(title.uppercased())
                    .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.semibold))
                    .tracking(1)
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                .foregroundColor(ScheduleMeTheme.titleText)
            Text(subtitle)
                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.medium))
                .foregroundColor(ScheduleMeTheme.mutedText)
        }
        .frame(width: 176, alignment: .leading)
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
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
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                        .opacity(isSelected ? 1 : 0.85)
                )
                .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
        }
        .contentShape(Rectangle())
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

private struct HomeBusinessCard: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var appState: AppState
    let business: BusinessSummary

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 10) {
                ZStack(alignment: .topLeading) {
                    AsyncImage(url: business.heroImageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            ZStack {
                                Rectangle().fill(Color(hex: "EEF2F1"))
                                VStack(spacing: 4) {
                                    Text(String(business.name.prefix(2)).uppercased())
                                        .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                    Text("No photos yet")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                }
                            }
                        }
                    }
                    .frame(width: 220, height: 130)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    if business.founder50 == true {
                        Founder50Badge().padding(6)
                    }

                    PinButton(businessID: business.id)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                        .padding(6)
                }

                Text(business.name)
                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .lineLimit(1)
                    .frame(width: 220, alignment: .leading)

                ScheduleMeTag(text: business.primaryCategory)

                HStack(spacing: 6) {
                    if let priceLabel = business.priceLabel { ScheduleMeTag(text: priceLabel) }
                    if business.isNew { NewBadge() }
                }

                HStack(spacing: 6) {
                    OpenStatusDot(isOpen: business.isOpen, label: business.openStatusLabel)
                    Text("•").foregroundColor(ScheduleMeTheme.mutedText.opacity(0.4))
                    Text(business.distanceLabel)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
            }
        }
        .frame(width: 250)
    }
}
