// FILE OVERVIEW:
// Browse professionals experience with list/grid/map presentation modes.
//
// DEBUG NOTES:
// Map/list filter inconsistencies or search problems should be traced here.

import SwiftUI
import CoreLocation
import MapKit
import UIKit

struct BrowseView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var locationManager: LocationManager
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var tabRouter: TabRouter
    @State private var searchText = ""
    @State private var selectedCategory = "All"
    @State private var selectedSort: BrowseSortMode = .recommended
    @State private var selectedViewMode: BrowseViewMode = .grid
    @AppStorage("scheduleme_service_radius") private var selectedDistance = "25 mi"
    @State private var showingFilters = false
    @State private var selectedMapBusiness: BusinessSummary?
    @State private var selectedNavigationBusiness: BusinessSummary?
    @State private var browsePage = 0
    @State private var didRefreshProfileOnAppear = false
    @State private var mapPosition: MapCameraPosition = {
        let fallback = LocationManager.simulatorFallbackCoordinate ?? CLLocationCoordinate2D(latitude: 36.9916, longitude: -122.0583)
        return .region(
            MKCoordinateRegion(
                center: fallback,
                span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
            )
        )
    }()

    private enum BrowseViewMode: String, CaseIterable, Identifiable {
        case list = "List"
        case grid = "Grid"
        case map = "Map"
        var id: String { rawValue }
    }

    private enum BrowseSortMode: String, CaseIterable, Identifiable {
        case recommended = "Recommended"
        case pinnedFirst = "Pinned First"
        case ratingHighToLow = "Rating (High to Low)"
        case reviewsMost = "Most Reviewed"
        case distanceNearFirst = "Distance (Near First)"
        case alphabeticalAZ = "A to Z"

        var id: String { rawValue }
    }

    // MARK: - Derived Data
    private let listPageSize = 8
    private let gridPageSize = 8

    private var categories: [String] {
        let values = dataStore.businesses.map(\.primaryCategory)
        return ["All", "Pinned", "New"] + Array(Set(values)).sorted()
    }

    /// Search/category/distance filtering for list/grid/map modes.
    private var filteredBusinesses: [BusinessSummary] {
        let filtered = dataStore.businesses.filter { business in
            let matchesCategory: Bool = {
                if selectedCategory == "All" { return true }
                if selectedCategory == "Pinned" { return dataStore.favoriteIDs.contains(business.id) }
                if selectedCategory == "New" { return business.isNew }
                return business.primaryCategory == selectedCategory
            }()
            let matchesSearch = searchText.isEmpty
                || business.name.localizedCaseInsensitiveContains(searchText)
                || business.primaryCategory.localizedCaseInsensitiveContains(searchText)
            let matchesDistance = matchesDistance(for: business)
            return matchesCategory && matchesSearch && matchesDistance
        }
        switch selectedSort {
        case .recommended:
            return filtered.sorted {
                ($0.distanceMiles ?? .greatestFiniteMagnitude) < ($1.distanceMiles ?? .greatestFiniteMagnitude)
            }
        case .pinnedFirst:
            return filtered.sorted { lhs, rhs in
                let lhsPinned = dataStore.favoriteIDs.contains(lhs.id)
                let rhsPinned = dataStore.favoriteIDs.contains(rhs.id)
                if lhsPinned != rhsPinned { return lhsPinned && !rhsPinned }
                return (lhs.distanceMiles ?? .greatestFiniteMagnitude) < (rhs.distanceMiles ?? .greatestFiniteMagnitude)
            }
        case .ratingHighToLow:
            return filtered.sorted { ($0.rating ?? 0) > ($1.rating ?? 0) }
        case .reviewsMost:
            return filtered.sorted { ($0.reviewCount ?? 0) > ($1.reviewCount ?? 0) }
        case .distanceNearFirst:
            return filtered.sorted {
                ($0.distanceMiles ?? .greatestFiniteMagnitude) < ($1.distanceMiles ?? .greatestFiniteMagnitude)
            }
        case .alphabeticalAZ:
            return filtered.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        }
    }

    private var browsePageSize: Int {
        selectedViewMode == .list ? listPageSize : gridPageSize
    }

    private var totalBrowsePages: Int {
        max(Int(ceil(Double(filteredBusinesses.count) / Double(browsePageSize))), 1)
    }

    private var pagedBrowseBusinesses: [BusinessSummary] {
        guard filteredBusinesses.isEmpty == false else { return [] }
        let safePage = min(max(browsePage, 0), totalBrowsePages - 1)
        let start = safePage * browsePageSize
        let end = min(start + browsePageSize, filteredBusinesses.count)
        return Array(filteredBusinesses[start..<end])
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("Browse Pros")
                                .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                            Text("EXPLORE")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .tracking(1.2)
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                        Spacer()
                        Menu {
                            ForEach(BrowseViewMode.allCases) { option in
                                Button(option.rawValue) {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                        selectedViewMode = option
                                    }
                                }
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "rectangle.grid.1x2")
                                Text("View")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            }
                            .foregroundColor(ScheduleMeTheme.titleText)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
                        }
                    }
                    .padding(.horizontal, 20)

                    VStack(spacing: 8) {
                        HStack(spacing: 8) {
                            HStack(spacing: 8) {
                                Image(systemName: "magnifyingglass")
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                TextField("Search businesses or services", text: $searchText)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13))
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorderStrong))

                            Menu {
                                ForEach(BrowseSortMode.allCases) { option in
                                    Button(option.rawValue) {
                                        withAnimation(.easeInOut(duration: 0.2)) {
                                            selectedSort = option
                                        }
                                    }
                                }
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "arrow.up.arrow.down")
                                        .font(.system(size: 12, weight: .semibold))
                                    Text(selectedSort.rawValue)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .lineLimit(1)
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
                                ForEach(categories, id: \.self) { category in
                                    BrowsePill(title: category, isSelected: selectedCategory == category) {
                                        withAnimation(.easeInOut(duration: 0.2)) {
                                            selectedCategory = category
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

                    if appState.eduVerified == false {
                        BrowseStudentVerifyBanner {
                            tabRouter.selected = .campus
                        }
                        .padding(.horizontal, 20)
                    }

                    // Results
                    if selectedViewMode == .map {
                        browseResults
                    } else if (!dataStore.hasLoadedBusinesses || dataStore.isLoadingBusinesses) && dataStore.businesses.isEmpty {
                        BrowseSkeletonView()
                            .padding(.horizontal, 20)
                    } else if !dataStore.businesses.isEmpty {
                        if filteredBusinesses.isEmpty {
                            ScheduleMeEmptyState(
                                title: "No matches",
                                message: "Try adjusting your search or distance filter.",
                                systemImage: "magnifyingglass"
                            )
                            .padding(.horizontal, 20)
                        } else {
                            Text("\(filteredBusinesses.count) businesses")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                                .padding(.horizontal, 20)
                            browseResults
                        }
                    } else if let businessError = dataStore.businessError {
                        ScheduleMeEmptyState(
                            title: "Browse unavailable",
                            message: businessError,
                            systemImage: "location.slash"
                        )
                        .padding(.horizontal, 20)
                    } else if !hasLocation && !dataStore.isLoadingBusinesses {
                        LocationPromptCard()
                            .padding(.horizontal, 20)
                    } else if dataStore.businesses.isEmpty && hasLocation {
                        ScheduleMeEmptyState(
                            title: "No businesses found nearby",
                            message: "Try adjusting your filters or distance.",
                            systemImage: "mappin.and.ellipse"
                        )
                        .padding(.horizontal, 20)
                    } else {
                        BrowseSkeletonView()
                            .padding(.horizontal, 20)
                    }

                    Spacer(minLength: 24)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
        }
        .task {
            locationManager.requestIfNeeded()
        }
        .task(id: locationTaskID) {
            await dataStore.loadNearbyBusinesses(coordinate: locationManager.coordinate)
            updateMapRegion()
        }
        .sheet(isPresented: $showingFilters) {
            BrowseFiltersSheet(
                categories: categories,
                selectedCategory: $selectedCategory,
                selectedDistance: $selectedDistance
            )
        }
        .navigationDestination(item: $selectedNavigationBusiness) { business in
            BusinessDetailView(business: business)
                .toolbar(.visible, for: .navigationBar)
        }
        .onAppear {
            updateMapRegion()
            guard !didRefreshProfileOnAppear else { return }
            didRefreshProfileOnAppear = true
            Task {
                await appState.refreshProfile()
            }
        }
        .onChange(of: filteredBusinesses) { _, _ in
            if let selected = selectedMapBusiness,
               filteredBusinesses.contains(where: { $0.id == selected.id }) == false {
                selectedMapBusiness = nil
            }
            browsePage = min(max(browsePage, 0), totalBrowsePages - 1)
            updateMapRegion()
        }
        .onChange(of: selectedViewMode) { _, mode in
            if mode == .list || mode == .grid {
                browsePage = min(max(browsePage, 0), totalBrowsePages - 1)
            }
        }
    }

    private var hasLocation: Bool {
        locationManager.coordinate != nil || LocationManager.simulatorFallbackCoordinate != nil
    }

    /// Drives `.task(id:)` refresh when user location changes.
    private var locationTaskID: String {
        guard let coordinate = locationManager.coordinate else { return "none" }
        return "\(coordinate.latitude),\(coordinate.longitude)"
    }

    private var browseResults: some View {
        Group {
            switch selectedViewMode {
            case .list:
                VStack(spacing: 12) {
                    ForEach(pagedBrowseBusinesses) { business in
                        NavigationLink(destination: BusinessDetailView(business: business)) {
                            BusinessListRow(
                                business: business,
                                imageHeight: 122
                            )
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 20)
                    }
                    BrowsePaginationControls(
                        currentPage: $browsePage,
                        totalPages: totalBrowsePages
                    )
                    .padding(.top, 2)
                }
            case .grid:
                VStack(spacing: 12) {
                    LazyVGrid(columns: gridColumns, spacing: 14) {
                        ForEach(pagedBrowseBusinesses) { business in
                            NavigationLink(destination: BusinessDetailView(business: business)) {
                                BusinessGridCard(business: business)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)

                    BrowsePaginationControls(
                        currentPage: $browsePage,
                        totalPages: totalBrowsePages
                    )
                }
            case .map:
                BrowseMapCompositeView(
                    position: $mapPosition,
                    businesses: mapBusinesses,
                    selectedBusiness: $selectedMapBusiness,
                    navigationBusiness: $selectedNavigationBusiness
                )
                .padding(.horizontal, 12)
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: selectedViewMode)
    }

    /// Distance filter gate using user-selected radius.
    private func matchesDistance(for business: BusinessSummary) -> Bool {
        if locationManager.coordinate == nil { return true }
        let trimmed = selectedDistance.replacingOccurrences(of: " mi", with: "")
        guard let limit = Double(trimmed), let distance = business.distanceMiles else {
            return true
        }
        return distance <= limit
    }

    private var mapBusinesses: [MapBusiness] {
        let raw = filteredBusinesses.compactMap { business -> MapBusiness? in
            guard let lat = business.lat, let lng = business.lng else { return nil }
            let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            return MapBusiness(
                business: business,
                coordinate: coordinate,
                sourceCoordinate: coordinate
            )
        }
        return staggeredMapBusinesses(raw)
    }

    private func staggeredMapBusinesses(_ businesses: [MapBusiness]) -> [MapBusiness] {
        guard businesses.count > 1 else { return businesses }
        let selectedID = selectedMapBusiness?.id
        let grouped = Dictionary(grouping: businesses) { item in
            "\(item.sourceCoordinate.latitude)|\(item.sourceCoordinate.longitude)"
        }
        var output: [MapBusiness] = []
        output.reserveCapacity(businesses.count)

        for (_, group) in grouped {
            if group.count == 1 {
                output.append(group[0])
                continue
            }
            let sorted = group.sorted { $0.business.name.localizedCaseInsensitiveCompare($1.business.name) == .orderedAscending }
            let radius = 0.00024 // ~25m
            let count = max(sorted.count, 1)
            for (index, item) in sorted.enumerated() {
                if selectedID == item.business.id {
                    output.append(
                        MapBusiness(
                            business: item.business,
                            coordinate: item.sourceCoordinate,
                            sourceCoordinate: item.sourceCoordinate
                        )
                    )
                    continue
                }

                let effectiveIndex = selectedID == nil ? index : (index + 1)
                let angle = (2.0 * Double.pi * Double(effectiveIndex)) / Double(count)
                let latOffset = radius * cos(angle)
                let cosLat = max(cos(item.sourceCoordinate.latitude * Double.pi / 180.0), 0.3)
                let lngOffset = (radius * sin(angle)) / cosLat
                let staggered = CLLocationCoordinate2D(
                    latitude: item.sourceCoordinate.latitude + latOffset,
                    longitude: item.sourceCoordinate.longitude + lngOffset
                )
                output.append(
                    MapBusiness(
                        business: item.business,
                        coordinate: staggered,
                        sourceCoordinate: item.sourceCoordinate
                    )
                )
            }
        }

        return output.sorted { lhs, rhs in
            filteredBusinesses.firstIndex(where: { $0.id == lhs.business.id }) ?? .max
                < filteredBusinesses.firstIndex(where: { $0.id == rhs.business.id }) ?? .max
        }
    }

    /// Chooses initial map camera target: user location -> first result -> simulator fallback.
    private func updateMapRegion() {
        if let coordinate = locationManager.coordinate {
            mapPosition = .region(
                MKCoordinateRegion(
                    center: coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
                )
            )
            return
        }
        if let first = mapBusinesses.first {
            mapPosition = .region(
                MKCoordinateRegion(
                    center: first.coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
                )
            )
            return
        }
        if let fallback = LocationManager.simulatorFallbackCoordinate {
            mapPosition = .region(
                MKCoordinateRegion(
                    center: fallback,
                    span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
                )
            )
        }
    }

    private var gridColumns: [GridItem] {
        [
            GridItem(.flexible(), spacing: 10, alignment: .top),
            GridItem(.flexible(), spacing: 10, alignment: .top)
        ]
    }
}

private struct BrowseSkeletonView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SkeletonBlock(height: 42, cornerRadius: 12)
            SkeletonBlock(height: 110, cornerRadius: 20)
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
                        SkeletonBlock(width: 118, height: 14, cornerRadius: 8)
                        HStack(spacing: 6) {
                            SkeletonBlock(width: 82, height: 12, cornerRadius: 8)
                            SkeletonBlock(width: 44, height: 12, cornerRadius: 8)
                            SkeletonCircle(size: 14)
                        }
                        SkeletonBlock(width: 74, height: 10, cornerRadius: 6)
                    }
                }
            }
        }
    }
}

// MARK: - Shared location prompt

struct LocationPromptCard: View {
    @EnvironmentObject private var locationManager: LocationManager

    private var isDenied: Bool {
        locationManager.authorizationStatus == .denied ||
        locationManager.authorizationStatus == .restricted
    }

    var body: some View {
        ScheduleMeCard {
            VStack(spacing: 12) {
                Image(systemName: isDenied ? "location.slash" : "location.circle")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(ScheduleMeTheme.accent)
                Text(isDenied ? "Location Disabled" : "Enable Location")
                    .font(.custom(ScheduleMeTheme.fontName, size: 17).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(isDenied
                     ? "Location access was denied. Open Settings to allow it."
                     : "Allow location access to see professionals near you.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .multilineTextAlignment(.center)
                Button(isDenied ? "Open Settings" : "Enable Location") {
                    if locationManager.authorizationStatus == .notDetermined {
                        locationManager.requestIfNeeded()
                        return
                    }
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
            }
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Business card components (shared across Browse, Home, Campus)

/// Full-width horizontal list row
struct BusinessListRow: View {
    let business: BusinessSummary
    var imageHeight: CGFloat = 92
    var onSelect: (() -> Void)? = nil
    var onOpen: (() -> Void)? = nil
    var openDestinationBusiness: BusinessSummary? = nil
    private var shouldMask: Bool {
        // Home/Browse should always show public provider cards.
        false
    }
    private var displayName: String {
        shouldMask ? "Student provider" : business.name
    }
    private var imageURL: URL? {
        return business.heroImageURL
    }
    private var privateBadgeBackground: Color {
        Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "262626"))
    }
    private var privateBadgeText: Color {
        Color.dynamic(light: Color(hex: "1F2937"), dark: Color(hex: "E5E7EB"))
    }
    private var placeholderBackground: Color {
        Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "2C2C2E"))
    }

    var body: some View {
        ScheduleMeCard {
            rowContent
        }
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var rowContent: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(spacing: 8) {
                imagePanel

                if let openDestinationBusiness {
                    NavigationLink(destination: BusinessDetailView(business: openDestinationBusiness)) {
                        Text("View")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.accent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .buttonStyle(.plain)
                } else if let onOpen {
                    Button("View") {
                        onOpen()
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
                    .buttonStyle(.plain)
                }
            }
            .frame(width: 96)

            detailsPanel
        }
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    @ViewBuilder
    private var imagePanel: some View {
        let image = ZStack(alignment: .topLeading) {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFill()
                        default:
                            ZStack {
                                Rectangle().fill(placeholderBackground)
                                Text(String(displayName.prefix(2)).uppercased())
                                    .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }
                        }
                    }
                    .frame(width: 96, height: imageHeight)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    if business.founder50 == true {
                        Founder50Badge()
                            .padding(6)
                    }
                }
                .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        if let onSelect {
            image.onTapGesture { onSelect() }
        } else {
            image
        }
    }

    @ViewBuilder
    private var detailsPanel: some View {
        let details = VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(displayName)
                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .lineLimit(1)
                    Spacer()
                    PinButton(businessID: business.id)
                }
                if shouldMask {
                    Text("PRIVATE UNTIL STUDENT VERIFICATION")
                        .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.bold))
                        .tracking(0.6)
                        .foregroundColor(privateBadgeText)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(privateBadgeBackground)
                        .overlay(
                            Capsule()
                                .stroke(ScheduleMeTheme.cardBorderStrong)
                        )
                        .clipShape(Capsule())
                }
                Text(business.description ?? business.primaryCategory)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .lineLimit(1)
                ScheduleMeTag(text: business.primaryCategory)
                HStack(spacing: 6) {
                    if let priceLabel = business.priceLabel {
                        ScheduleMeTag(text: priceLabel)
                    }
                    if business.isNew {
                        NewBadge()
                    }
                }
                HStack(spacing: 6) {
                    OpenStatusDot(isOpen: business.isOpen, label: business.openStatusLabel)
                    Text("•").foregroundColor(ScheduleMeTheme.mutedText.opacity(0.4))
                    Text("\(business.distanceLabel) • \(business.ratingLabel)★")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }
            }
            .contentShape(Rectangle())
        if let onSelect {
            details.onTapGesture { onSelect() }
        } else {
            details
        }
    }
}

/// 2-column grid card
struct BusinessGridCard: View {
    let business: BusinessSummary
    var onSelect: (() -> Void)? = nil
    private var shouldMask: Bool {
        // Home/Browse should always show public provider cards.
        false
    }
    private var displayName: String {
        shouldMask ? "Student provider" : business.name
    }
    private var imageURL: URL? {
        return business.heroImageURL
    }
    private var privateBadgeBackground: Color {
        Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "262626"))
    }
    private var privateBadgeText: Color {
        Color.dynamic(light: Color(hex: "1F2937"), dark: Color(hex: "E5E7EB"))
    }
    private var placeholderBackground: Color {
        Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "2C2C2E"))
    }

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 6) {
                ZStack(alignment: .topLeading) {
                    GeometryReader { proxy in
                        let width = proxy.size.width
                        AsyncImage(url: imageURL) { phase in
                            switch phase {
                            case .success(let image): image.resizable().scaledToFill()
                            default:
                                ZStack {
                                    Rectangle().fill(placeholderBackground)
                                    Text(String(displayName.prefix(2)).uppercased())
                                        .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                }
                            }
                        }
                        .frame(width: width, height: 72)
                        .clipped()
                    }
                    .frame(height: 72)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    if business.founder50 == true {
                        Founder50Badge()
                            .padding(6)
                    }
                }

                HStack(alignment: .center, spacing: 6) {
                    Text(displayName)
                        .font(.custom(ScheduleMeTheme.fontName, size: 10.5).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .lineLimit(1)
                    Spacer()
                    PinButton(businessID: business.id)
                }

                if shouldMask {
                    Text("PRIVATE UNTIL STUDENT VERIFICATION")
                        .font(.custom(ScheduleMeTheme.fontName, size: 8).weight(.bold))
                        .tracking(0.5)
                        .foregroundColor(privateBadgeText)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(privateBadgeBackground)
                        .overlay(
                            Capsule()
                                .stroke(ScheduleMeTheme.cardBorderStrong)
                        )
                        .clipShape(Capsule())
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 2)
                }

                ScheduleMeTag(text: business.primaryCategory)

                HStack(spacing: 4) {
                    if let priceLabel = business.priceLabel {
                        ScheduleMeTag(text: priceLabel)
                    }
                    if business.isNew { NewBadge() }
                    OpenStatusDot(isOpen: business.isOpen, label: business.openStatusLabel)
                }

                Text(business.distanceLabel)
                    .font(.custom(ScheduleMeTheme.fontName, size: 8.5).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            }
        }
        .frame(maxWidth: .infinity)
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .modifier(OptionalCardTap(onTap: onSelect))
    }
}

private struct OptionalCardTap: ViewModifier {
    let onTap: (() -> Void)?

    func body(content: Content) -> some View {
        if let onTap {
            content.onTapGesture { onTap() }
        } else {
            content
        }
    }
}

// MARK: - Small reusable badge/dot views

struct Founder50Badge: View {
    var body: some View {
        Text("FOUNDER50")
            .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.bold))
            .tracking(0.8)
            .foregroundColor(.white)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color.black.opacity(0.65))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.2), lineWidth: 0.5))
    }
}

struct NewBadge: View {
    var body: some View {
        Text("New")
            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.bold))
            .foregroundColor(Color(hex: "92400e"))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Color(hex: "fef3c7"))
            .clipShape(Capsule())
    }
}

struct OpenStatusDot: View {
    let isOpen: Bool
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(isOpen ? Color.green : ScheduleMeTheme.mutedText.opacity(0.5))
                .frame(width: 6, height: 6)
            Text(label)
                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                .foregroundColor(isOpen ? .green : ScheduleMeTheme.mutedText)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(isOpen ? Color.green.opacity(0.12) : ScheduleMeTheme.surface)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(isOpen ? Color.green.opacity(0.3) : ScheduleMeTheme.cardBorder)
        )
    }
}

struct PinButton: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var appState: AppState
    let businessID: String

    private var isPinned: Bool { dataStore.favoriteIDs.contains(businessID) }

    var body: some View {
        Button {
            guard let uid = appState.userID else { return }
            Task { await dataStore.toggleFavorite(businessID: businessID, userID: uid) }
        } label: {
            Image(systemName: isPinned ? "pin.fill" : "pin")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(isPinned ? ScheduleMeTheme.accent : ScheduleMeTheme.mutedText)
                .frame(width: 28, height: 28)
                .background(isPinned ? ScheduleMeTheme.accentSoft : ScheduleMeTheme.surface.opacity(0.9))
                .clipShape(Circle())
                .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Map view

private struct MapBusiness: Identifiable, Hashable {
    let business: BusinessSummary
    let coordinate: CLLocationCoordinate2D
    let sourceCoordinate: CLLocationCoordinate2D
    var id: String { business.id }

    static func == (lhs: MapBusiness, rhs: MapBusiness) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

private struct BrowseMapView: View {
    @Binding var position: MapCameraPosition
    let businesses: [MapBusiness]
    @Binding var selectedBusiness: BusinessSummary?

    private var orderedBusinesses: [MapBusiness] {
        guard let selectedID = selectedBusiness?.id else { return businesses }
        let unselected = businesses.filter { $0.business.id != selectedID }
        let selected = businesses.filter { $0.business.id == selectedID }
        return unselected + selected
    }

    private var selectedSourceCoordinate: CLLocationCoordinate2D? {
        guard let selectedID = selectedBusiness?.id else { return nil }
        return businesses.first(where: { $0.business.id == selectedID })?.sourceCoordinate
    }

    private func sameSource(_ lhs: CLLocationCoordinate2D, _ rhs: CLLocationCoordinate2D) -> Bool {
        abs(lhs.latitude - rhs.latitude) < 0.0000001 && abs(lhs.longitude - rhs.longitude) < 0.0000001
    }

    var body: some View {
        ZStack {
            Map(position: $position) {
                ForEach(orderedBusinesses) { business in
                    Annotation(business.business.name, coordinate: business.coordinate) {
                        Button {
                            selectedBusiness = business.business
                            position = .region(
                                MKCoordinateRegion(
                                    center: business.coordinate,
                                    span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
                                )
                            )
                        } label: {
                            MapBusinessAvatar(
                                business: business.business,
                                isSelected: selectedBusiness?.id == business.business.id,
                                isDimmed: {
                                    guard let selectedSourceCoordinate else { return false }
                                    guard selectedBusiness?.id != business.business.id else { return false }
                                    return sameSource(business.sourceCoordinate, selectedSourceCoordinate)
                                }()
                            )
                        }
                        .buttonStyle(.plain)
                        .zIndex(selectedBusiness?.id == business.business.id ? 2 : 1)
                    }
                }
            }
            .applyScheduleMeMapStyle()
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))

            if businesses.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "mappin.slash")
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                    Text("No locations to show")
                        .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                    Text("Try expanding your distance or clearing filters.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }
                .padding(20)
                .background(ScheduleMeTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 6)
            }

        }
        .frame(height: 320)
    }
}

private struct MapBusinessAvatar: View {
    let business: BusinessSummary
    let isSelected: Bool
    let isDimmed: Bool
    private var pinImageURL: URL? {
        business.coverURL ?? business.heroImageURL
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(isSelected ? ScheduleMeTheme.accentSoft : ScheduleMeTheme.surface)
                .frame(width: isSelected ? 48 : 40, height: isSelected ? 48 : 40)
                .shadow(color: .black.opacity(0.18), radius: 6, y: 3)
                .overlay(
                    Circle()
                        .stroke(isSelected ? ScheduleMeTheme.accent : Color.clear, lineWidth: 2)
                )
            AsyncImage(url: pinImageURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Circle()
                        .fill(ScheduleMeTheme.accentSoft)
                        .overlay(
                            Text(String(business.name.prefix(1)))
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.bold))
                                .foregroundColor(ScheduleMeTheme.accent)
                        )
                }
            }
            .frame(width: 32, height: 32)
            .clipShape(Circle())
        }
        .opacity(isDimmed ? 0.45 : 1)
        .scaleEffect(isDimmed ? 0.92 : 1)
    }
}

private struct BrowseMapCompositeView: View {
    @Binding var position: MapCameraPosition
    let businesses: [MapBusiness]
    @Binding var selectedBusiness: BusinessSummary?
    @Binding var navigationBusiness: BusinessSummary?
    @State private var currentPage = 0
    private let pageSize = 8

    private var totalPages: Int {
        max(Int(ceil(Double(businesses.count) / Double(pageSize))), 1)
    }

    private var pagedBusinesses: [MapBusiness] {
        guard businesses.isEmpty == false else { return [] }
        let safePage = min(max(currentPage, 0), totalPages - 1)
        let start = safePage * pageSize
        let end = min(start + pageSize, businesses.count)
        return Array(businesses[start..<end])
    }

    /// Force a fresh navigation state so repeated taps on the same provider still open detail.
    private func openBusiness(_ business: BusinessSummary) {
        navigationBusiness = nil
        DispatchQueue.main.async {
            navigationBusiness = business
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            BrowseMapView(
                position: $position,
                businesses: businesses,
                selectedBusiness: $selectedBusiness
            )

            if businesses.isEmpty == false {
                Text("Nearby providers")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .padding(.horizontal, 4)

                HStack(spacing: 14) {
                    Button {
                        currentPage = max(currentPage - 1, 0)
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                            .frame(width: 28, height: 28)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .buttonStyle(.plain)
                    .disabled(currentPage == 0)
                    .opacity(currentPage == 0 ? 0.4 : 1)

                    Text("\(currentPage + 1) of \(totalPages)")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)

                    Button {
                        currentPage = min(currentPage + 1, totalPages - 1)
                    } label: {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                            .frame(width: 28, height: 28)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .buttonStyle(.plain)
                    .disabled(currentPage >= totalPages - 1)
                    .opacity(currentPage >= totalPages - 1 ? 0.4 : 1)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.horizontal, 4)

                ScrollViewReader { proxy in
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 10) {
                            ForEach(pagedBusinesses) { item in
                                VStack(alignment: .leading, spacing: 8) {
                                    BusinessListRow(
                                        business: item.business,
                                        onSelect: {
                                            if selectedBusiness?.id == item.business.id {
                                                openBusiness(item.business)
                                            } else {
                                                selectedBusiness = item.business
                                                position = .region(
                                                    MKCoordinateRegion(
                                                        center: item.coordinate,
                                                        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
                                                    )
                                                )
                                            }
                                        },
                                        openDestinationBusiness: item.business
                                    )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                .stroke(
                                                    selectedBusiness?.id == item.business.id
                                                        ? ScheduleMeTheme.accent.opacity(0.7)
                                                        : Color.clear,
                                                    lineWidth: 1.5
                                                )
                                        )
                                }
                                .id(item.id)
                            }
                        }
                        .padding(.horizontal, 4)
                        .padding(.bottom, 12)
                    }
                    .frame(maxHeight: 270)
                    .onChange(of: selectedBusiness?.id) { _, id in
                        guard let id else { return }
                        if let selectedIndex = businesses.firstIndex(where: { $0.business.id == id }) {
                            let targetPage = selectedIndex / pageSize
                            if currentPage != targetPage {
                                currentPage = targetPage
                            }
                        }
                        withAnimation(.easeInOut(duration: 0.22)) {
                            proxy.scrollTo(id, anchor: .center)
                        }
                    }
                    .onChange(of: businesses.count) { _, _ in
                        currentPage = min(currentPage, totalPages - 1)
                    }
                }
            }
        }
    }
}

private struct BrowsePaginationControls: View {
    @Binding var currentPage: Int
    let totalPages: Int

    var body: some View {
        HStack(spacing: 14) {
            Button {
                currentPage = max(currentPage - 1, 0)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .frame(width: 28, height: 28)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
            }
            .buttonStyle(.plain)
            .disabled(currentPage == 0)
            .opacity(currentPage == 0 ? 0.4 : 1)

            Text("\(currentPage + 1) of \(totalPages)")
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundColor(ScheduleMeTheme.titleText)

            Button {
                currentPage = min(currentPage + 1, totalPages - 1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .frame(width: 28, height: 28)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
            }
            .buttonStyle(.plain)
            .disabled(currentPage >= totalPages - 1)
            .opacity(currentPage >= totalPages - 1 ? 0.4 : 1)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.horizontal, 16)
    }
}

// MARK: - Pill + filters

struct BrowsePill: View {
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
                .frame(minHeight: 28)
                .background(Capsule().fill(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.surface))
                .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

private struct BrowseFiltersSheet: View {
    let categories: [String]
    @Binding var selectedCategory: String
    @Binding var selectedDistance: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Category") {
                    Picker("Category", selection: $selectedCategory) {
                        ForEach(categories, id: \.self) { Text($0).tag($0) }
                    }
                }
                Section("Distance") {
                    Picker("Distance", selection: $selectedDistance) {
                        ForEach(["5 mi", "10 mi", "25 mi", "50 mi", "100 mi"], id: \.self) { Text($0).tag($0) }
                    }
                }
            }
            .navigationTitle("Filters")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct BrowseStudentVerifyBanner: View {
    let onVerify: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "graduationcap.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(ScheduleMeTheme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("Are you a student?")
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text("Verify your .edu email to unlock campus-only providers.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .lineLimit(2)
            }
            Spacer(minLength: 8)
            Button("Verify") {
                onVerify()
            }
            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(ScheduleMeTheme.accent)
            .clipShape(Capsule())
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(ScheduleMeTheme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ScheduleMeTheme.cardBorder))
    }
}
