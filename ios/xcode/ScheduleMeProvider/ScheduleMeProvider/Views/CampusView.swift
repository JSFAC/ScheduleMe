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
            let normalized = selectedCategory.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            list = list.filter { $0.primaryCategory.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == normalized }
        }
        if !searchText.isEmpty {
            let q = searchText.lowercased()
            list = list.filter {
                $0.name.lowercased().contains(q) ||
                $0.primaryCategory.lowercased().contains(q) ||
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
        let cats = Array(Set(allCampusBusinesses.map(\.primaryCategory))).sorted()
        return ["All", "Pinned"] + cats
    }

    private var featuredBusinesses: [BusinessSummary] {
        dataStore.campusFeatured
    }

    /// De-duplicates featured + regular campus arrays so each business appears once.
    private var allCampusBusinesses: [BusinessSummary] {
        var combined = dataStore.campusBusinesses + dataStore.campusFeatured
        var seen = Set<String>()
        combined = combined.filter { seen.insert($0.id).inserted }
        return combined
    }

    private var showFeatured: Bool {
        selectedCategory == "All" && searchText.isEmpty && !featuredBusinesses.isEmpty
    }

    private var gridBusinesses: [BusinessSummary] {
        if showFeatured {
            let featuredIDs = Set(featuredBusinesses.map(\.id))
            return dataStore.campusBusinesses.filter { !featuredIDs.contains($0.id) }
        }
        return filtered
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

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                if appState.eduVerified == true {
                    VStack(spacing: 0) {
                        // Header
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

                        // Search + Sort + pills inside one card
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

                        if showFeatured {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Featured")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.bold))
                                    .foregroundColor(ScheduleMeTheme.titleText)

                                TabView(selection: $featuredIndex) {
                                    ForEach(featuredBusinesses.indices, id: \.self) { index in
                                        let business = featuredBusinesses[index]
                                        NavigationLink(destination: BusinessDetailView(business: business)) {
                                            FeaturedCampusCard(business: business)
                                        }
                                        .contentShape(Rectangle())
        .buttonStyle(.plain)
                                        .tag(index)
                                    }
                                }
                                .tabViewStyle(.page(indexDisplayMode: .never))
                                .frame(height: 172)

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
                            .padding(.horizontal, 20)
                            .padding(.bottom, 6)
                        }

                        // Content
                        if dataStore.isLoadingCampusBusinesses && dataStore.campusBusinesses.isEmpty {
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
                            LazyVGrid(
                                columns: gridColumns,
                                spacing: 10
                            ) {
                                ForEach(gridBusinesses) { business in
                                    NavigationLink(destination: BusinessDetailView(business: business)) {
                                        BusinessGridCard(business: business)
                                    }
                                    .contentShape(Rectangle())
        .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 18)
                        }
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
        .task {
            if appState.eduVerified == true {
                await dataStore.loadCampusBusinesses(schoolDomain: campusDomain, campusTag: campusTag)
                featuredIndex = 0
            }
        }
        .onChange(of: appState.schoolDomain) { _, _ in
            Task {
                await dataStore.loadCampusBusinesses(schoolDomain: campusDomain, campusTag: campusTag)
                featuredIndex = 0
            }
        }
        .onChange(of: appState.eduVerified) { _, _ in
            if appState.eduVerified == true {
                Task {
                    await dataStore.loadCampusBusinesses(schoolDomain: campusDomain, campusTag: campusTag)
                    featuredIndex = 0
                }
            } else {
                dataStore.clearCampusBusinesses()
            }
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
        if let url = URL(string: "https://usescheduleme.com/business") {
            openURL(url)
        }
    }
}

private struct FeaturedCampusCard: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var appState: AppState
    let business: BusinessSummary

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
                                Rectangle().fill(ScheduleMeTheme.pageBackground)
                            }
                        }
                        .frame(width: 110, height: 120)
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

                    Text(business.description ?? business.primaryCategory)
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    ScheduleMeTag(text: business.primaryCategory)

                    HStack(spacing: 6) {
                        if let priceLabel = business.priceLabel { ScheduleMeTag(text: priceLabel) }
                        if business.isNew { NewBadge() }
                    }

                    HStack(spacing: 6) {
                        OpenStatusDot(isOpen: business.isOpen, label: business.openStatusLabel)
                        Text("•").foregroundColor(ScheduleMeTheme.mutedText.opacity(0.4))
                        Text("\(business.distanceLabel) • \(business.ratingLabel)★")
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
                        SkeletonBlock(height: 120, cornerRadius: 16)
                        SkeletonBlock(height: 14, cornerRadius: 8)
                        SkeletonBlock(width: 84, height: 12, cornerRadius: 8)
                        SkeletonBlock(width: 68, height: 12, cornerRadius: 8)
                    }
                }
            }
        }
    }
}
