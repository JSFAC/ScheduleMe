// FILE OVERVIEW:
// Campus-specific marketplace feed for EDU-verified users.
//
// DEBUG NOTES:
// Campus search/filter/featured card bugs and tag readability are handled here.

import SwiftUI

struct CampusView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var tabRouter: TabRouter
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @Environment(\.openURL) private var openURL

    @State private var searchText = ""
    @State private var selectedCategory = "All"
    @State private var sortMode = "recommended"
    @State private var featuredIndex = 0

    // MARK: - Derived Data

    /// Applies category/search/sort transforms over campus inventory.
    private var filtered: [BusinessSummary] {
        var list = allCampusBusinesses
        if selectedCategory == "Pinned" {
            list = list.filter { dataStore.favoriteIDs.contains($0.id) }
        } else if selectedCategory != "All" {
            list = list.filter { $0.matchesCategory(selectedCategory) }
        }
        if !searchText.isEmpty {
            let q = searchText.lowercased()
            list = list.filter {
                $0.name.lowercased().contains(q) ||
                $0.categoryTags.contains(where: { $0.lowercased().contains(q) }) ||
                ($0.description ?? "").lowercased().contains(q)
            }
        }
        switch sortMode {
        case "rating": return list.sorted { ($0.rating ?? 0) > ($1.rating ?? 0) }
        case "reviews": return list.sorted { ($0.reviewCount ?? 0) > ($1.reviewCount ?? 0) }
        case "az": return list.sorted { $0.name < $1.name }
        default: return list
        }
    }

    private var campusCategories: [String] {
        let cats = Array(Set(allCampusBusinesses.flatMap(\.categoryTags))).sorted()
        return ["All", "Pinned"] + cats
    }

    private var featuredBusinesses: [BusinessSummary] {
        dataStore.campusFeatured
            .filter(isValidCampusProvider(_:))
            .sorted {
            let leftScore = (($0.rating ?? 0) * 1000) + Double($0.reviewCount ?? 0)
            let rightScore = (($1.rating ?? 0) * 1000) + Double($1.reviewCount ?? 0)
            if leftScore == rightScore {
                return $0.id < $1.id
            }
            return leftScore > rightScore
        }
    }

    /// De-duplicates featured + regular campus arrays so each business appears once.
    private var allCampusBusinesses: [BusinessSummary] {
        var combined = (dataStore.campusBusinesses + dataStore.campusFeatured)
            .filter(isValidCampusProvider(_:))
        var seen = Set<String>()
        combined = combined.filter { seen.insert($0.id).inserted }
        return combined
    }

    private var showFeatured: Bool {
        selectedCategory == "All" && searchText.isEmpty && !featuredBusinesses.isEmpty
    }

    private var gridBusinesses: [BusinessSummary] {
        let base = filtered
        if showFeatured {
            let featuredIDs = Set(featuredBusinesses.map(\.id))
            return base.filter { !featuredIDs.contains($0.id) }
        }
        return base
    }

    private var gridColumns: [GridItem] {
        [
            GridItem(.flexible(), spacing: 10, alignment: .top),
            GridItem(.flexible(), spacing: 10, alignment: .top)
        ]
    }

    private var campusName: String {
        if let domain = campusDomain, !domain.isEmpty {
            return domain.replacingOccurrences(of: ".edu", with: "").uppercased()
        }
        return "Campus"
    }

    private var campusDomain: String? {
        appState.resolvedSchoolDomain
    }

    private var campusTag: String? {
        campusDomain?.split(separator: ".").first.map { String($0).uppercased() }
    }

    private func isValidCampusProvider(_ business: BusinessSummary) -> Bool {
        guard business.campusProvider == true else { return false }
        let normalizedDomain = campusDomain?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedTag = campusTag?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let businessDomain = business.schoolDomain?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let businessTag = business.campusSchoolName?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

        if let normalizedDomain, !normalizedDomain.isEmpty {
            return businessDomain == normalizedDomain
        }
        if let normalizedTag, !normalizedTag.isEmpty {
            if businessTag == normalizedTag { return true }
            let derivedTag = businessDomain?.split(separator: ".").first.map { String($0).uppercased() }
            return derivedTag == normalizedTag
        }
        return businessDomain?.hasSuffix(".edu") == true
    }

    private func refreshCampusFeed() async {
        guard appState.eduVerified == true else { return }
        guard let domain = campusDomain?.trimmingCharacters(in: .whitespacesAndNewlines), !domain.isEmpty else {
            return
        }
        await dataStore.loadCampusBusinesses(schoolDomain: domain, campusTag: campusTag)
    }

    private func loadCampusIfReady() async {
        guard appState.eduVerified == true else { return }
        guard let domain = campusDomain?.trimmingCharacters(in: .whitespacesAndNewlines), !domain.isEmpty else {
            dataStore.clearCampusBusinesses()
            return
        }
        await dataStore.loadCampusBusinesses(schoolDomain: domain, campusTag: campusTag)
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(scrolls: false) {
                ScrollView {
                    campusContent
                }
                .scrollBounceBehavior(.always)
                .refreshable {
                    await refreshCampusFeed()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            await loadCampusIfReady()
            featuredIndex = 0
        }
        .onChange(of: appState.schoolDomain) { _, _ in
            Task {
                await loadCampusIfReady()
                featuredIndex = 0
            }
        }
        .onChange(of: appState.eduVerified) { _, _ in
            if appState.eduVerified == true {
                Task {
                    await loadCampusIfReady()
                    featuredIndex = 0
                }
            } else {
                dataStore.clearCampusBusinesses()
            }
        }
        .onChange(of: featuredBusinesses.count) { _, count in
            guard count > 0 else {
                featuredIndex = 0
                return
            }
            featuredIndex = min(max(featuredIndex, 0), count - 1)
        }
    }

    @ViewBuilder
    private var campusContent: some View {
        if appState.eduVerified == true {
            VStack(spacing: 0) {
                campusHeader
                campusSearchAndFilters
                featuredSection
                campusBodySection
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

    private var campusHeader: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("🎓 \(campusName)")
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text("\(campusName) Verified")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .foregroundColor(.white)
                    .background(ScheduleMeTheme.accent)
                    .clipShape(Capsule())
            }
            Text("Showing campus providers for \(campusName)")
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                .foregroundColor(ScheduleMeTheme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .padding(.bottom, 10)
        .zIndex(2)
    }

    private var campusSearchAndFilters: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .font(.system(size: 13))
                    TextField("Search by name, service, category", text: $searchText)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(ScheduleMeTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorderStrong))

                Menu {
                    Button("Recommended") { sortMode = "recommended" }
                    Button("Highest rated") { sortMode = "rating" }
                    Button("Most reviewed") { sortMode = "reviews" }
                    Button("A to Z") { sortMode = "az" }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.up.arrow.down")
                            .font(.system(size: 12, weight: .semibold))
                        Text(sortLabel)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    }
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorderStrong))
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(campusCategories, id: \.self) { cat in
                        BrowsePill(title: cat, isSelected: cat == selectedCategory) {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                selectedCategory = cat
                            }
                        }
                    }
                }
            }
        }
        .padding(10)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .zIndex(2)
    }

    @ViewBuilder
    private var featuredSection: some View {
        if showFeatured {
            CampusFeaturedSection(
                featuredBusinesses: featuredBusinesses,
                selectedCategory: selectedCategory,
                searchText: searchText,
                featuredIndex: $featuredIndex
            )
            .padding(.horizontal, 20)
            .padding(.bottom, 6)
        }
    }

    @ViewBuilder
    private var campusBodySection: some View {
        if (!dataStore.hasLoadedCampusBusinesses || dataStore.isLoadingCampusBusinesses) && allCampusBusinesses.isEmpty {
            CampusSkeletonView()
                .padding(.horizontal, 20)
                .padding(.top, 10)
        } else if filtered.isEmpty {
            ScheduleMeEmptyState(
                title: "No campus providers yet",
                message: "Be the first verified campus service provider here.",
                systemImage: "graduationcap",
                actionTitle: "Apply as a campus provider →",
                action: openBusinessSignup
            )
            .padding(.horizontal, 20)
            .padding(.top, 30)
        } else {
            CampusGridSection(
                businesses: gridBusinesses,
                selectedCategory: selectedCategory,
                searchText: searchText,
                columns: gridColumns
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 18)
        }
    }

    // MARK: - UI Helpers

    private var sortLabel: String {
        switch sortMode {
        case "rating": return "Top rated"
        case "reviews": return "Most reviewed"
        case "az": return "A to Z"
        default: return "Sort"
        }
    }

    /// Deep-links user to provider signup page when campus feed is empty.
    private func openBusinessSignup() {
        guard let providerDeepLink = URL(string: "schedulemeprovider://auth/callback") else { return }
        UIApplication.shared.open(providerDeepLink, options: [:]) { accepted in
            guard !accepted else { return }
            if let fallback = URL(string: "https://usescheduleme.com/business") {
                openURL(fallback)
            }
        }
    }
}

private struct CampusFeaturedSection: View {
    let featuredBusinesses: [BusinessSummary]
    let selectedCategory: String
    let searchText: String
    @Binding var featuredIndex: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Featured")
                .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.bold))
                .foregroundColor(ScheduleMeTheme.titleText)

            TabView(selection: $featuredIndex) {
                ForEach(featuredBusinesses.indices, id: \.self) { index in
                    let business = featuredBusinesses[index]
                    NavigationLink(destination: BusinessDetailView(business: business)) {
                        FeaturedCampusCard(
                            business: business,
                            preferredCategory: business.preferredCategory(for: selectedCategory, searchText: searchText)
                        )
                    }
                    .buttonStyle(.plain)
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 172)

            featuredPagination
        }
    }

    @ViewBuilder
    private var featuredPagination: some View {
        if featuredBusinesses.count > 1 {
            HStack {
                Button {
                    withAnimation(.easeInOut) {
                        featuredIndex = max(featuredIndex - 1, 0)
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .frame(width: 32, height: 32)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                }
                .disabled(featuredIndex == 0)

                Spacer()

                HStack(spacing: 6) {
                    ForEach(featuredBusinesses.indices, id: \.self) { idx in
                        Circle()
                            .fill(idx == featuredIndex ? ScheduleMeTheme.accent : ScheduleMeTheme.cardBorder)
                            .frame(width: 6, height: 6)
                    }
                }

                Spacer()

                Button {
                    withAnimation(.easeInOut) {
                        featuredIndex = min(featuredIndex + 1, featuredBusinesses.count - 1)
                    }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .frame(width: 32, height: 32)
                        .background(ScheduleMeTheme.surface)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                }
                .disabled(featuredIndex == featuredBusinesses.count - 1)
            }
        } else {
            Rectangle()
                .fill(ScheduleMeTheme.cardBorder.opacity(0.3))
                .frame(height: 1)
                .padding(.horizontal, 30)
        }
    }
}

private struct CampusGridSection: View {
    let businesses: [BusinessSummary]
    let selectedCategory: String
    let searchText: String
    let columns: [GridItem]

    var body: some View {
        LazyVGrid(
            columns: columns,
            spacing: 10
        ) {
            ForEach(businesses) { business in
                NavigationLink(destination: BusinessDetailView(business: business)) {
                    BusinessGridCard(
                        business: business,
                        preferredCategory: business.preferredCategory(for: selectedCategory, searchText: searchText),
                        imageHeight: 84,
                        contentSpacing: 4
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct FeaturedCampusCard: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var appState: AppState
    let business: BusinessSummary
    let preferredCategory: String?
    private let featuredImageWidth: CGFloat = 110
    private let featuredImageHeight: CGFloat = 132
    private var placeholderBackground: Color {
        Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "2C2C2E"))
    }
    private var displayCategory: String {
        preferredCategory ?? business.primaryCategory
    }

    var body: some View {
        ScheduleMeCard {
            ZStack(alignment: .topTrailing) {
                HStack(alignment: .top, spacing: 12) {
                    ZStack(alignment: .topLeading) {
                        AsyncImage(url: business.heroImageURL) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().scaledToFill()
                            default:
                                ZStack {
                                    Rectangle().fill(placeholderBackground)
                                    Text(String(business.name.prefix(2)).uppercased())
                                        .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                }
                            }
                        }
                        .frame(width: featuredImageWidth, height: featuredImageHeight)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                        if business.founder50 == true {
                            Founder50Badge().padding(6)
                        }
                    }

                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(business.name)
                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                            .lineLimit(1)
                        Spacer()
                        PinButton(businessID: business.id)
                            .offset(y: -6)
                    }

                    Text(business.description ?? displayCategory)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    ScheduleMeTag(text: displayCategory)

                    HStack(spacing: 6) {
                        if let priceLabel = business.priceLabel { ScheduleMeTag(text: priceLabel) }
                        if business.isNew { NewBadge() }
                    }

                    HStack(spacing: 6) {
                        OpenStatusDot(
                            isOpen: business.isOpen,
                            label: business.openStatusLabel,
                            status: business.normalizedAvailabilityStatus
                        )
                        Text("•").foregroundColor(ScheduleMeTheme.mutedText.opacity(0.4))
                        Text(reviewSummary)
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }
                }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var reviewSummary: String {
        let hasReviews = (business.reviewCount ?? 0) > 0
        if hasReviews {
            return "\(business.distanceLabel) • \(business.ratingLabel)★"
        }
        return "\(business.distanceLabel) • No reviews"
    }
}

private struct CampusSkeletonView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SkeletonBlock(height: 44, cornerRadius: 14)
            HStack(spacing: 8) {
                SkeletonBlock(width: 68, height: 28, cornerRadius: 14)
                SkeletonBlock(width: 68, height: 28, cornerRadius: 14)
                SkeletonBlock(width: 80, height: 28, cornerRadius: 14)
                SkeletonBlock(width: 110, height: 28, cornerRadius: 14)
            }
            SkeletonBlock(height: 170, cornerRadius: 24)
            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 14, alignment: .top),
                    GridItem(.flexible(), spacing: 14, alignment: .top)
                ],
                spacing: 14
            ) {
                ForEach(0..<4, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 8) {
                        ZStack(alignment: .topTrailing) {
                            SkeletonBlock(height: 120, cornerRadius: 16)
                            SkeletonCircle(size: 24)
                                .padding(8)
                        }
                        SkeletonBlock(width: 106, height: 14, cornerRadius: 8)
                        HStack(spacing: 6) {
                            SkeletonBlock(width: 78, height: 12, cornerRadius: 8)
                            SkeletonBlock(width: 42, height: 12, cornerRadius: 8)
                            SkeletonCircle(size: 14)
                        }
                        SkeletonBlock(width: 72, height: 10, cornerRadius: 6)
                    }
                }
            }
        }
    }
}
