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
    @Environment(\.openURL) private var openURL
    @State private var showingEduVerificationModal = false
    @State private var showingEduStatusModal = false
    @AppStorage("scheduleme_dismiss_student_banner") private var dismissedStudentBanner = false
    @State private var quickRequest = ""
    @FocusState private var isQuickRequestFocused: Bool
    @State private var showingFeedback = false
    @State private var showFeedbackToast: Bool = false
    @State private var feedbackToastMessage: String = ""
    @State private var selectedHomeCategory = "All"
    @State private var showingMatches = false
    @State private var matchedBusinesses: [BusinessSummary] = []
    private let homeCardWidth: CGFloat = 164
    private let homeCardImageHeight: CGFloat = 84

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(scrolls: false) {
                ScrollView {
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
                                                    AsyncImage(url: business.heroImageURL) { phase in
                                                        switch phase {
                                                        case .success(let image):
                                                            image
                                                                .resizable()
                                                                .scaledToFill()
                                                        default:
                                                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                                                .fill(ScheduleMeTheme.accentSoft)
                                                                .overlay(
                                                                    Text(String(business.name.prefix(1)))
                                                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                                                                        .foregroundColor(ScheduleMeTheme.accent)
                                                                )
                                                        }
                                                    }
                                                    .frame(width: 40, height: 28)
                                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                                    .overlay(
                                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                                            .stroke(ScheduleMeTheme.cardBorder, lineWidth: 1)
                                                    )
                                                    VStack(alignment: .leading, spacing: 2) {
                                                        Text(business.name)
                                                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                                            .foregroundColor(ScheduleMeTheme.titleText)
                                                        Text(business.preferredCategory(for: selectedHomeCategory, searchText: quickRequest))
                                                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                                            .foregroundColor(ScheduleMeTheme.mutedText)
                                                    }
                                                    Spacer()
                                                    Image(systemName: "chevron.right")
                                                        .font(.system(size: 12, weight: .semibold))
                                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                                }
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                                .padding(.vertical, 4)
                                                .contentShape(Rectangle())
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }

                                    Button("Browse all results") {
                                        let query = quickRequest.trimmingCharacters(in: .whitespacesAndNewlines)
                                        tabRouter.browsePrefillQuery = query.isEmpty ? nil : query
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
                                        Capsule()
                                            .fill(
                                                isGetMatchesDisabled
                                                    ? Color.dynamic(light: Color(hex: "DDE6E3"), dark: Color(hex: "1C2A2A"))
                                                    : ScheduleMeTheme.accent
                                            )
                                    )
                                    .overlay(
                                        Capsule()
                                            .stroke(isGetMatchesDisabled ? ScheduleMeTheme.cardBorder : Color.clear, lineWidth: 1)
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

                    if appState.eduVerified == true {
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

                            ScrollView(.horizontal, showsIndicators: false) {
                                if (!dataStore.hasLoadedBusinesses || dataStore.isLoadingBusinesses) && dataStore.businesses.isEmpty {
                                    PulseSkeletonRow()
                                } else {
                                    HStack(spacing: 8) {
                                        PulseCard(
                                            title: "Trending on campus",
                                            value: pulseTrendingValue,
                                            subtitle: pulseTrendingSubtitle,
                                            systemImage: "flame.fill"
                                        )
                                        PulseCard(
                                            title: "Open now",
                                            value: "\(pulseOpenNowCount) available",
                                            subtitle: "Live provider status",
                                            systemImage: "clock.badge.checkmark.fill"
                                        )
                                        PulseCard(
                                            title: "New pros nearby",
                                            value: "\(pulseCampusProviderCount) providers",
                                            subtitle: "Verified campus listings",
                                            systemImage: "person.2.fill"
                                        )
                                    }
                                }
                            }
                        }
                        .padding(8)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
                        .padding(.horizontal, 20)
                        .padding(.top, 4)
                    } else if dismissedStudentBanner == false {
                        StudentVerifyBanner(
                            onVerify: { openEduFlow() },
                            onDismiss: { dismissedStudentBanner = true }
                        )
                        .padding(.horizontal, 20)
                        .padding(.top, 4)
                    }

                    VStack(alignment: .leading, spacing: 20) {
                        if (!dataStore.hasLoadedBusinesses || dataStore.isLoadingBusinesses) && dataStore.businesses.isEmpty {
                            HomeBusinessCarouselSection(
                                title: "Top‑rated near you",
                                subtitle: "Available now — highly reviewed",
                                businesses: [],
                                cardWidth: homeCardWidth,
                                imageHeight: homeCardImageHeight,
                                selectedCategory: selectedHomeCategory,
                                showsSkeleton: true
                            )
                        } else if !dataStore.businesses.isEmpty {
                            HomeBusinessCarouselSection(
                                title: "Top‑rated near you",
                                subtitle: "Available now — highly reviewed",
                                businesses: homeSectionBusinesses.topRated,
                                cardWidth: homeCardWidth,
                                imageHeight: homeCardImageHeight,
                                selectedCategory: selectedHomeCategory,
                                onSeeAll: { tabRouter.selected = .browse }
                            )
                            HomeBusinessCarouselSection(
                                title: "Non-student providers",
                                subtitle: "Local businesses in your area",
                                businesses: homeSectionBusinesses.nonStudents,
                                cardWidth: homeCardWidth,
                                imageHeight: homeCardImageHeight,
                                selectedCategory: selectedHomeCategory,
                                onSeeAll: { tabRouter.selected = .browse }
                            )
                            HomeBusinessCarouselSection(
                                title: "Quick response",
                                subtitle: "Pros that pick up jobs fast",
                                businesses: homeSectionBusinesses.quickResponse,
                                cardWidth: homeCardWidth,
                                imageHeight: homeCardImageHeight,
                                selectedCategory: selectedHomeCategory,
                                onSeeAll: { tabRouter.selected = .browse }
                            )
                        } else if dataStore.businessError != nil {
                            let message = hasLocation
                                ? "No nearby providers right now. Be the first to join your area."
                                : "Location disabled. Enable location to browse nearby providers."
                            ScheduleMeEmptyState(
                                title: "Nearby search unavailable",
                                message: message,
                                systemImage: "location.slash",
                                actionTitle: "Become the first provider →",
                                action: openProviderApp
                            )
                        } else if !hasLocation && !dataStore.isLoadingBusinesses {
                            LocationPromptCard()
                        } else if dataStore.businesses.isEmpty && hasLocation {
                            ScheduleMeEmptyState(
                                title: "No nearby providers yet",
                                message: "Be the first provider in your area.",
                                systemImage: "magnifyingglass",
                                actionTitle: "Become the first provider →",
                                action: openProviderApp
                            )
                        } else {
                            HomeTopRatedSkeleton(cardWidth: homeCardWidth, imageHeight: homeCardImageHeight)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
                    }
                    .contentShape(Rectangle())
                    .simultaneousGesture(
                        TapGesture().onEnded {
                            if isQuickRequestFocused {
                                isQuickRequestFocused = false
                            }
                        }
                    )
                }
                .scrollBounceBehavior(.always)
                .refreshable {
                    await refreshHomeFeed()
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
                .padding(.bottom, 12)
            }
            .overlay {
                if showingEduVerificationModal {
                    ZStack {
                        Color.black.opacity(0.45)
                            .ignoresSafeArea()
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    showingEduVerificationModal = false
                                }
                            }

                        HomeEduVerificationModal(
                            onSendCode: { email in
                                try await appState.requestEduVerificationCode(email: email)
                            },
                            onVerifyCode: { code in
                                try await appState.confirmEduVerificationCode(code: code)
                            },
                            onClose: { showingEduVerificationModal = false }
                        )
                        .padding(.horizontal, 20)
                        .transition(.scale(scale: 0.95).combined(with: .opacity))
                    }
                    .transition(.opacity)
                }
            }
            .animation(.spring(response: 0.34, dampingFraction: 0.9), value: showingEduVerificationModal)
            .overlay {
                if showingEduStatusModal {
                    ZStack {
                        Color.black.opacity(0.45)
                            .ignoresSafeArea()
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    showingEduStatusModal = false
                                }
                            }

                        EduVerificationStatusModal(
                            isVerified: appState.eduVerified == true,
                            schoolDomain: appState.schoolDomain,
                            onClose: { showingEduStatusModal = false },
                            onRefresh: {
                                Task { await appState.refreshEduVerification() }
                            }
                        )
                        .padding(.horizontal, 20)
                        .transition(.scale(scale: 0.95).combined(with: .opacity))
                    }
                    .transition(.opacity)
                }
            }
            .animation(.spring(response: 0.34, dampingFraction: 0.9), value: showingEduStatusModal)
            .sheet(isPresented: $showingFeedback) {
                FeedbackModalView(userEmail: appState.userEmail) {
                    self.showFeedbackSubmittedToast("Thanks! Feedback submitted.")
                }
            }
            .overlay(alignment: .bottom) {
                if self.showFeedbackToast {
                    HomeToastView(message: self.feedbackToastMessage)
                        .padding(.bottom, 94)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
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
        .animation(.spring(response: 0.3, dampingFraction: 0.9), value: self.showFeedbackToast)
    }

    // MARK: - Derived State

    /// Used as `.task(id:)` dependency so nearby business fetch reruns only when coordinates change.
    private var locationTaskID: String {
        guard let coordinate = locationManager.coordinate else { return "none" }
        return "\(coordinate.latitude),\(coordinate.longitude)"
    }

    private func refreshHomeFeed() async {
        locationManager.requestIfNeeded()
        await dataStore.loadBookings()
        await dataStore.loadThreads(for: appState.userID)
        await dataStore.loadNearbyBusinesses(coordinate: locationManager.coordinate)
        if appState.eduVerified == true {
            let campusDomain = appState.resolvedSchoolDomain
            let campusTag = campusDomain?.split(separator: ".").first.map { String($0).uppercased() }
            await dataStore.loadCampusBusinesses(schoolDomain: campusDomain, campusTag: campusTag)
        }
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
        if let firstName = appState.userFirstName?.trimmingCharacters(in: .whitespacesAndNewlines),
           !firstName.isEmpty {
            return firstName
        }
        if let email = appState.userEmail, let localPart = email.split(separator: "@").first, !localPart.isEmpty {
            return localPart.capitalized
        }
        return "there"
    }

    /// Campus Pulse should reflect live marketplace inventory.
    /// Prefer campus feed when available, fallback to nearby businesses.
    private var campusPulseSourceBusinesses: [BusinessSummary] {
        if appState.eduVerified == true, !dataStore.campusBusinesses.isEmpty {
            return dataStore.campusBusinesses
        }
        if appState.eduVerified == true {
            let campusOnly = dataStore.businesses.filter { $0.campusProvider == true }
            if !campusOnly.isEmpty { return campusOnly }
        }
        return dataStore.businesses
    }

    private var pulseOpenNowCount: Int {
        campusPulseSourceBusinesses.filter(\.isOpen).count
    }

    private var pulseCampusProviderCount: Int {
        campusPulseSourceBusinesses.filter { $0.campusProvider == true }.count
    }

    private var pulseTrendingValue: String {
        let tags = campusPulseSourceBusinesses.flatMap(\.categoryTags)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !tags.isEmpty else { return "Campus demand" }

        let counts = Dictionary(grouping: tags, by: { $0 }).mapValues(\.count)
        let top = counts
            .sorted { lhs, rhs in
                if lhs.value == rhs.value {
                    return lhs.key.localizedCaseInsensitiveCompare(rhs.key) == .orderedAscending
                }
                return lhs.value > rhs.value
            }
            .first?.key

        return top ?? "Campus demand"
    }

    private var pulseTrendingSubtitle: String {
        let total = campusPulseSourceBusinesses.count
        guard total > 0 else { return "Waiting for campus activity" }
        return "\(total) active providers"
    }

    private var homeCategories: [String] {
        let categories = Array(Set(dataStore.businesses.flatMap(\.categoryTags))).sorted()
        return ["All", "Non-students", "Quick response"] + categories
    }

    private var viewerSchoolDomain: String? {
        appState.resolvedSchoolDomain?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private func shouldMask(_ business: BusinessSummary) -> Bool {
        business.shouldMaskForViewer(
            userEduVerified: appState.eduVerified == true,
            userSchoolDomain: viewerSchoolDomain
        )
    }

    private var homeFilteredBusinesses: [BusinessSummary] {
        switch selectedHomeCategory {
        case "All":
            return dataStore.businesses
        case "Non-students":
            return dataStore.businesses.filter { $0.campusProvider != true }
        case "Quick response":
            return dataStore.businesses.sorted { quickResponseRank($0) > quickResponseRank($1) }
        default:
            return dataStore.businesses.filter { $0.matchesCategory(selectedHomeCategory) }
        }
    }

    private var homeSectionBusinesses: (topRated: [BusinessSummary], nonStudents: [BusinessSummary], quickResponse: [BusinessSummary]) {
        let pool = homeFilteredBusinesses
        let sortedByRating = pool.sorted {
            (($0.rating ?? 0), ($0.reviewCount ?? 0)) > (($1.rating ?? 0), ($1.reviewCount ?? 0))
        }
        let nonStudents = pool
            .filter { $0.campusProvider != true }
            .sorted { quickResponseRank($0) > quickResponseRank($1) }
        let quickResponse = pool.sorted { quickResponseRank($0) > quickResponseRank($1) }
        let topRated = Array(sortedByRating.prefix(6))
        let nonStudentRow = Array((nonStudents.isEmpty ? sortedByRating : nonStudents).prefix(6))
        let quickRow = Array(quickResponse.prefix(6))
        return (topRated, nonStudentRow, quickRow)
    }

    private func quickResponseRank(_ business: BusinessSummary) -> (Int, Int, Double, Double) {
        (
            business.isOpen ? 1 : 0,
            business.reviewCount ?? 0,
            business.rating ?? 0,
            -(business.distanceMiles ?? 999)
        )
    }

    /// Lightweight local keyword matcher for the quick-request card.
    /// It intentionally uses local in-memory businesses for immediate UX (no extra API call).
    private func runMatches() {
        let query = quickRequest.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return }
        isQuickRequestFocused = false
        let tokens = query
            .split(separator: " ")
            .map { String($0) }
            .filter { !$0.isEmpty }
        let matches = dataStore.businesses.filter { business in
            let haystack = [business.name, business.categoryTags.joined(separator: " "), business.description ?? ""]
                .joined(separator: " ")
                .lowercased()
            return tokens.allSatisfy { haystack.contains($0) }
        }
        matchedBusinesses = matches.sorted { ($0.rating ?? 0) > ($1.rating ?? 0) }
        withAnimation(.easeInOut(duration: 0.25)) {
            showingMatches = true
        }
    }

    private func openEduFlow() {
        withAnimation(.spring(response: 0.34, dampingFraction: 0.9)) {
            if appState.eduVerified == true {
                showingEduVerificationModal = false
                showingEduStatusModal = true
            } else {
                showingEduStatusModal = false
                showingEduVerificationModal = true
            }
        }
    }

    private func showFeedbackSubmittedToast(_ message: String) {
        feedbackToastMessage = message
        withAnimation {
            showFeedbackToast = true
        }
        Task {
            try? await Task.sleep(for: .seconds(2.0))
            await MainActor.run {
                withAnimation {
                    showFeedbackToast = false
                }
            }
        }
    }

    private func openProviderApp() {
        guard let deepLink = URL(string: "schedulemeprovider://auth/callback") else { return }
        openURL(deepLink) { accepted in
            guard accepted == false else { return }
            if let fallback = URL(string: "https://usescheduleme.com/business") {
                openURL(fallback)
            }
        }
    }

}

private struct HomeTopRatedSkeleton: View {
    let cardWidth: CGFloat
    let imageHeight: CGFloat

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 8) {
                        ZStack(alignment: .topTrailing) {
                            SkeletonBlock(width: cardWidth, height: imageHeight, cornerRadius: 16)
                            SkeletonCircle(size: 26)
                                .padding(8)
                        }
                        SkeletonBlock(width: cardWidth * 0.78, height: 14, cornerRadius: 8)
                        HStack(spacing: 6) {
                            SkeletonBlock(width: cardWidth * 0.49, height: 12, cornerRadius: 8)
                            SkeletonBlock(width: cardWidth * 0.29, height: 12, cornerRadius: 8)
                            SkeletonCircle(size: 16)
                        }
                        SkeletonBlock(width: cardWidth * 0.54, height: 10, cornerRadius: 6)
                    }
                    .frame(width: cardWidth, alignment: .leading)
                }
            }
            .padding(.vertical, 4)
        }
    }

}

private struct HomeBusinessCarouselSection: View {
    @EnvironmentObject private var appState: AppState
    let title: String
    let subtitle: String
    let businesses: [BusinessSummary]
    let cardWidth: CGFloat
    let imageHeight: CGFloat
    let selectedCategory: String
    var onSeeAll: (() -> Void)? = nil
    var showsSkeleton: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(subtitle)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .lineLimit(1)
            }

            if showsSkeleton {
                HomeTopRatedSkeleton(cardWidth: cardWidth, imageHeight: imageHeight)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(businesses.prefix(6)) { business in
                            let masked = shouldMask(business)
                            if masked {
                                HomeBusinessCard(
                                    business: business,
                                    cardWidth: cardWidth,
                                    imageHeight: imageHeight,
                                    shouldMask: true,
                                    preferredCategory: business.preferredCategory(for: selectedCategory)
                                )
                                .frame(width: cardWidth, alignment: .leading)
                            } else {
                                NavigationLink(destination: BusinessDetailView(business: business)) {
                                    HomeBusinessCard(
                                        business: business,
                                        cardWidth: cardWidth,
                                        imageHeight: imageHeight,
                                        preferredCategory: business.preferredCategory(for: selectedCategory)
                                    )
                                    .frame(width: cardWidth, alignment: .leading)
                                    .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                }
                                .frame(width: cardWidth, alignment: .leading)
                                .buttonStyle(.plain)
                            }
                        }
                        if let onSeeAll {
                            Button(action: onSeeAll) {
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
                                .padding(.vertical, 24)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private var viewerSchoolDomain: String? {
        appState.resolvedSchoolDomain?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private func shouldMask(_ business: BusinessSummary) -> Bool {
        business.shouldMaskForViewer(
            userEduVerified: appState.eduVerified == true,
            userSchoolDomain: viewerSchoolDomain
        )
    }

}

private struct PulseSkeletonRow: View {
    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        SkeletonCircle(size: 24)
                        SkeletonBlock(width: 86, height: 10, cornerRadius: 6)
                    }
                    SkeletonBlock(width: 126, height: 16, cornerRadius: 7)
                    SkeletonBlock(width: 90, height: 10, cornerRadius: 6)
                }
                .frame(width: 176, alignment: .leading)
                .padding(12)
                .background(ScheduleMeTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
            }
        }
    }
}

// MARK: - Feedback Modal

private struct FeedbackModalView: View {
    let userEmail: String?
    let onSubmitted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var topic = ""
    @State private var message = ""
    @State private var email = ""
    @State private var isSending = false
    @State private var sendError: String?

    var body: some View {
        NavigationStack {
            ScheduleMePage {
                VStack(spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Feedback")
                                .font(.custom(ScheduleMeTheme.fontName, size: 38).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)

                            Text("Tell us what’s working and what we should improve.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            ScheduleMeCard {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("TOPIC (OPTIONAL)")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                        .tracking(1.1)
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                    TextField("Bug report, idea, feature request", text: $topic)
                                        .scheduleMeFieldStyle()
                                }

                                VStack(alignment: .leading, spacing: 10) {
                                    Text("YOUR FEEDBACK")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                        .tracking(1.1)
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                    TextEditor(text: $message)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                        .scrollContentBackground(.hidden)
                                        .frame(minHeight: 150)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 10)
                                        .background(ScheduleMeTheme.surface)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                .stroke(ScheduleMeTheme.cardBorder)
                                        )
                                }

                                VStack(alignment: .leading, spacing: 10) {
                                    Text("REPLY EMAIL (OPTIONAL)")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                                        .tracking(1.1)
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                    TextField("name@email.com", text: $email)
                                        .textInputAutocapitalization(.never)
                                        .keyboardType(.emailAddress)
                                        .scheduleMeFieldStyle()
                                }

                                if let sendError {
                                    Text(sendError)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .foregroundColor(.red)
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 14)
                        .padding(.bottom, 28)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
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
                onSubmitted()
                dismiss()
            } else {
                sendError = response.error ?? "Unable to send feedback."
            }
        } catch {
            sendError = "Unable to send feedback right now."
        }
    }
}

private struct HomeToastView: View {
    let message: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)
            Text(message)
                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                .foregroundColor(.white)
                .lineLimit(2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(ScheduleMeTheme.accent)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.16), radius: 8, y: 4)
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
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(
            Color.dynamic(
                light: Color(hex: "E8F6F3"),
                dark: Color(hex: "132522")
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
    }
}

private struct HomeEduVerificationModal: View {
    let onSendCode: (String) async throws -> Void
    let onVerifyCode: (String) async throws -> Void
    let onClose: () -> Void
    private enum Step { case email, code }
    @State private var eduEmail = ""
    @State private var verificationCode = ""
    @State private var step: Step = .email
    @State private var isSending = false
    @State private var isVerifying = false
    @State private var statusMessage: String?
    @State private var errorMessage: String?

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("EDU Verification")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .frame(width: 28, height: 28)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .buttonStyle(.plain)
                }

                Text("Use your .edu email to unlock campus-only providers.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)

                if step == .email {
                    Text("School email")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    TextField("", text: $eduEmail)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .keyboardType(.emailAddress)
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .scheduleMeFieldStyle()
                        .overlay(alignment: .leading) {
                            if eduEmail.isEmpty {
                                Text("name@school.edu")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                    .foregroundColor(Color.secondary.opacity(0.9))
                                    .padding(.leading, 16)
                                    .allowsHitTesting(false)
                            }
                        }

                    Button(isSending ? "Sending..." : "Send verification code") {
                        Task { await sendCode() }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                    .disabled(isSending)
                } else {
                    Text("Verification code")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    TextField("", text: $verificationCode)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .keyboardType(.numberPad)
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .scheduleMeFieldStyle()
                        .overlay(alignment: .leading) {
                            if verificationCode.isEmpty {
                                Text("6-digit code")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                    .foregroundColor(Color.secondary.opacity(0.9))
                                    .padding(.leading, 16)
                                    .allowsHitTesting(false)
                            }
                        }

                    HStack(spacing: 10) {
                        Button(isVerifying ? "Verifying..." : "Verify code") {
                            Task { await verifyCode() }
                        }
                        .buttonStyle(ScheduleMePrimaryButtonStyle())
                        .disabled(isVerifying || verificationCode.trimmingCharacters(in: .whitespacesAndNewlines).count < 6)

                        Button(isSending ? "Sending..." : "Resend") {
                            Task { await resendCode() }
                        }
                        .buttonStyle(ScheduleMeSecondaryButtonStyle())
                        .disabled(isSending)
                    }

                    Text("Code expires in 15 minutes.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }

                if let statusMessage {
                    Text(statusMessage)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundColor(.red)
                }
            }
            .padding(16)
        }
        .frame(maxWidth: 420)
        .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
        .padding(.vertical, 28)
    }

    private func sendCode() async {
        guard !isSending else { return }
        errorMessage = nil
        statusMessage = nil
        isSending = true
        defer { isSending = false }

        do {
            try await onSendCode(eduEmail)
            step = .code
            statusMessage = "Verification code sent to your .edu email."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func resendCode() async {
        await sendCode()
    }

    private func verifyCode() async {
        guard !isVerifying else { return }
        errorMessage = nil
        statusMessage = nil
        isVerifying = true
        defer { isVerifying = false }

        do {
            try await onVerifyCode(verificationCode)
            statusMessage = "Email verified successfully."
            onClose()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct EduVerificationStatusModal: View {
    let isVerified: Bool
    let schoolDomain: String?
    let onClose: () -> Void
    let onRefresh: () -> Void

    private var campusName: String {
        if let domain = schoolDomain, !domain.isEmpty {
            return domain.replacingOccurrences(of: ".edu", with: "").uppercased()
        }
        return "Campus"
    }

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("EDU Verification")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .frame(width: 28, height: 28)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .buttonStyle(.plain)
                }

                Text(isVerified ? "Verified Student" : "Verification Needed")
                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(isVerified ? "Campus access unlocked." : "Use your .edu email to unlock campus-only providers.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                Text("Campus: \(campusName)")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.accent)

                Button("Refresh status") {
                    onRefresh()
                }
                .buttonStyle(ScheduleMeSecondaryButtonStyle())
            }
            .padding(16)
        }
        .frame(maxWidth: 420)
        .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
        .padding(.vertical, 28)
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
                .lineLimit(1)
                .minimumScaleFactor(0.8)
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
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

private struct HomeBusinessCard: View {
    let business: BusinessSummary
    let cardWidth: CGFloat
    let imageHeight: CGFloat
    var shouldMask: Bool = false
    var preferredCategory: String? = nil
    private var displayName: String { shouldMask ? "Student provider" : business.name }
    private var imageURL: URL? {
        shouldMask ? nil : business.heroImageURL
    }
    private var placeholderBackground: Color {
        Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "2C2C2E"))
    }
    private var contentWidth: CGFloat {
        max(cardWidth - 24, 0)
    }
    private var privateBadgeBackground: Color {
        Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "262626"))
    }
    private var privateBadgeText: Color {
        Color.dynamic(light: Color(hex: "1F2937"), dark: Color(hex: "E5E7EB"))
    }
    private var displayCategory: String {
        preferredCategory ?? business.primaryCategory
    }

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 8) {
                ZStack(alignment: .topLeading) {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            ZStack {
                                Rectangle().fill(placeholderBackground)
                                Text(String(displayName.prefix(2)).uppercased())
                                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                    .frame(maxHeight: .infinity, alignment: shouldMask ? .top : .center)
                                    .padding(.top, shouldMask ? 16 : 0)
                            }
                        }
                    }
                    .frame(width: contentWidth, height: imageHeight)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    if business.founder50 == true {
                        Founder50Badge().padding(6)
                    }

                    if shouldMask {
                        Text("PRIVATE UNTIL STUDENT VERIFICATION")
                            .font(.custom(ScheduleMeTheme.fontName, size: 8).weight(.bold))
                            .tracking(0.45)
                            .foregroundColor(privateBadgeText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 6)
                            .background(privateBadgeBackground)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(ScheduleMeTheme.cardBorderStrong)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .padding(.horizontal, 6)
                            .padding(.bottom, 6)
                            .frame(maxHeight: .infinity, alignment: .bottom)
                    }

                    PinButton(businessID: business.id)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                        .padding(6)
                }

                Text(displayName)
                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(height: 18, alignment: .leading)
                    .frame(maxWidth: .infinity, alignment: .leading)

                ScheduleMeTag(text: displayCategory)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 6) {
                    if let priceLabel = business.priceLabel { ScheduleMeTag(text: priceLabel) }
                    if business.isNew { NewBadge() }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 6) {
                    OpenStatusDot(
                        isOpen: business.isOpen,
                        label: business.openStatusLabel,
                        status: business.normalizedAvailabilityStatus
                    )
                    Spacer(minLength: 6)
                    Text(business.distanceLabel)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
        }
        .frame(width: cardWidth)
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct HomeWelcomeWalkthrough: View {
    @State private var page = 0
    @State private var hasUnlockedContinue = false
    let onDone: () -> Void

    private let pages: [(title: String, body: String, icon: String)] = [
        (
            "Welcome to ScheduleMe",
            "Browse trusted local businesses and student providers in one marketplace with cleaner cards, faster loading, and better filtering.",
            "sparkles"
        ),
        (
            "Campus Mode Is Better",
            "Link your .edu email to unlock campus-only providers, verified student listings, and the campus marketplace feed.",
            "graduationcap.fill"
        ),
        (
            "Clearer Checkout + Messaging",
            "See transparent totals before confirming, keep booking updates in one thread, and manage requests end-to-end in-app.",
            "message.fill"
        )
    ]

    var body: some View {
        ZStack {
            ScheduleMeTheme.pageBackground.ignoresSafeArea()
            VStack(spacing: 20) {
                HStack(spacing: 0) {
                    Text("Schedule")
                        .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Text("Me")
                        .font(.custom(ScheduleMeTheme.fontName, size: 30).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.accent)
                }
                .padding(.top, 56)

                TabView(selection: $page) {
                    ForEach(Array(pages.enumerated()), id: \.offset) { index, item in
                        VStack(spacing: 14) {
                            Circle()
                                .fill(ScheduleMeTheme.accentSoft)
                                .frame(width: 88, height: 88)
                                .overlay(
                                    Image(systemName: item.icon)
                                        .font(.system(size: 30, weight: .semibold))
                                        .foregroundStyle(ScheduleMeTheme.accent)
                                )
                            Text(item.title)
                                .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                                .multilineTextAlignment(.center)
                            Text(item.body)
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 20)
                        }
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
                .frame(height: 360)

                Button(hasUnlockedContinue ? "Get Started" : "Next") {
                    if hasUnlockedContinue {
                        onDone()
                    } else {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            page += 1
                        }
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
                .padding(.horizontal, 24)

                Button("Skip") { onDone() }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .padding(.top, 6)

                Spacer()
            }
        }
        .onChange(of: page) { _, newPage in
            if newPage == pages.count - 1 {
                hasUnlockedContinue = true
            }
        }
    }
}
