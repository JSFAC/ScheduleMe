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
    @State private var selectedViewMode: BrowseViewMode = .grid
    @AppStorage("scheduleme_service_radius") private var selectedDistance = "25 mi"
    @State private var showingFilters = false
    @State private var selectedMapBusiness: BusinessSummary?
    @State private var mapPosition: MapCameraPosition = {
        let fallback = LocationManager.simulatorFallbackCoordinate ?? CLLocationCoordinate2D(latitude: 34.0522, longitude: -118.2437)
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

    // MARK: - Derived Data

    private var categories: [String] {
        let values = dataStore.businesses.map(\.primaryCategory)
        return ["All"] + Array(Set(values)).sorted()
    }

    /// Search/category/distance filtering for list/grid/map modes.
    private var filteredBusinesses: [BusinessSummary] {
        dataStore.businesses.filter { business in
            let matchesCategory = selectedCategory == "All" || business.primaryCategory == selectedCategory
            let matchesSearch = searchText.isEmpty
                || business.name.localizedCaseInsensitiveContains(searchText)
                || business.primaryCategory.localizedCaseInsensitiveContains(searchText)
            let matchesDistance = matchesDistance(for: business)
            return matchesCategory && matchesSearch && matchesDistance
        }
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

                            Button {
                                showingFilters = true
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "slider.horizontal.3")
                                        .font(.system(size: 12, weight: .semibold))
                                    Text("Filters")
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

                        HStack {
                            BrowsePill(title: "All", isSelected: selectedCategory == "All") {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    selectedCategory = "All"
                                }
                            }
                            Spacer()
                        }
                    }
                    .padding(10)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
                    .padding(.horizontal, 20)

                    // Results
                    if selectedViewMode == .map {
                        browseResults
                    } else if !hasLocation && !dataStore.isLoadingBusinesses {
                        LocationPromptCard()
                            .padding(.horizontal, 20)
                    } else if let businessError = dataStore.businessError {
                        ScheduleMeEmptyState(
                            title: "Browse unavailable",
                            message: businessError,
                            systemImage: "location.slash"
                        )
                        .padding(.horizontal, 20)
                    } else if dataStore.isLoadingBusinesses && dataStore.businesses.isEmpty {
                        BrowseSkeletonView()
                            .padding(.horizontal, 20)
                    } else if dataStore.businesses.isEmpty && hasLocation {
                        ScheduleMeEmptyState(
                            title: "No businesses found nearby",
                            message: "Try adjusting your filters or distance.",
                            systemImage: "mappin.and.ellipse"
                        )
                        .padding(.horizontal, 20)
                    } else if filteredBusinesses.isEmpty && !dataStore.businesses.isEmpty {
                        ScheduleMeEmptyState(
                            title: "No matches",
                            message: "Try adjusting your search or distance filter.",
                            systemImage: "magnifyingglass"
                        )
                        .padding(.horizontal, 20)
                    } else {
                        if !dataStore.businesses.isEmpty {
                            Text("\(filteredBusinesses.count) businesses")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                                .padding(.horizontal, 20)
                        }
                        browseResults
                    }

                    Spacer(minLength: 24)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
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
        .onAppear {
            updateMapRegion()
        }
        .onChange(of: filteredBusinesses) { _, _ in
            updateMapRegion()
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
                    ForEach(filteredBusinesses) { business in
                        NavigationLink(destination: BusinessDetailView(business: business)) {
                            BusinessListRow(business: business)
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 20)
                    }
                }
            case .grid:
                LazyVGrid(columns: gridColumns, spacing: 14) {
                    ForEach(filteredBusinesses) { business in
                        NavigationLink(destination: BusinessDetailView(business: business)) {
                            BusinessGridCard(business: business)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            case .map:
                BrowseMapView(
                    position: $mapPosition,
                    businesses: mapBusinesses,
                    selectedBusiness: $selectedMapBusiness
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
        filteredBusinesses.compactMap { business in
            guard let lat = business.lat, let lng = business.lng else { return nil }
            return MapBusiness(
                business: business,
                coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)
            )
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
                        SkeletonBlock(height: 120, cornerRadius: 16)
                        SkeletonBlock(height: 14, cornerRadius: 8)
                        SkeletonBlock(width: 92, height: 12, cornerRadius: 8)
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
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var appState: AppState
    let business: BusinessSummary

    var body: some View {
        ScheduleMeCard {
            HStack(alignment: .top, spacing: 14) {
                ZStack(alignment: .topLeading) {
                    AsyncImage(url: business.heroImageURL) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFill()
                        default: Rectangle().fill(ScheduleMeTheme.pageBackground)
                        }
                    }
                    .frame(width: 100, height: 100)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    if business.founder50 == true {
                        Founder50Badge()
                            .padding(6)
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(business.name)
                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                            .foregroundStyle(ScheduleMeTheme.titleText)
                            .lineLimit(1)
                        Spacer()
                        PinButton(businessID: business.id)
                    }
                    Text(business.description ?? business.primaryCategory)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                        .lineLimit(2)
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
            }
        }
    }
}

/// 2-column grid card
struct BusinessGridCard: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var appState: AppState
    let business: BusinessSummary

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 4) {
                ZStack(alignment: .topLeading) {
                    GeometryReader { proxy in
                        let width = proxy.size.width
                        AsyncImage(url: business.heroImageURL) { phase in
                            switch phase {
                            case .success(let image): image.resizable().scaledToFill()
                            default:
                                ZStack {
                                    Rectangle().fill(ScheduleMeTheme.pageBackground)
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
                    Text(business.name)
                        .font(.custom(ScheduleMeTheme.fontName, size: 10.5).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                        .lineLimit(1)
                    Spacer()
                    PinButton(businessID: business.id)
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

    var body: some View {
        ZStack {
            Map(position: $position) {
                ForEach(businesses) { business in
                    Annotation(business.business.name, coordinate: business.coordinate) {
                        Button {
                            selectedBusiness = business.business
                        } label: {
                            MapBusinessAvatar(business: business.business)
                        }
                        .buttonStyle(.plain)
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

            if let selected = selectedBusiness {
                VStack {
                    Spacer()
                    NavigationLink(destination: BusinessDetailView(business: selected)) {
                        ScheduleMeCard {
                            HStack(spacing: 12) {
                                AsyncImage(url: selected.heroImageURL) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image.resizable().scaledToFill()
                                    default:
                                        Circle()
                                            .fill(ScheduleMeTheme.accentSoft)
                                            .overlay(
                                                Text(String(selected.name.prefix(1)))
                                                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.bold))
                                                    .foregroundColor(ScheduleMeTheme.accent)
                                            )
                                    }
                                }
                                .frame(width: 46, height: 46)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(selected.name)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                    Text(selected.primaryCategory)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                }
                                Spacer()
                                Text(selected.distanceLabel)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(height: 360)
    }
}

private struct MapBusinessAvatar: View {
    let business: BusinessSummary

    var body: some View {
        ZStack {
            Circle()
                .fill(ScheduleMeTheme.surface)
                .frame(width: 40, height: 40)
                .shadow(color: .black.opacity(0.18), radius: 6, y: 3)
            AsyncImage(url: business.heroImageURL) { phase in
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
