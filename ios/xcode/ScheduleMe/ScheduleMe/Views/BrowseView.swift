import SwiftUI
import CoreLocation
import MapKit

struct BrowseView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var locationManager: LocationManager
    @EnvironmentObject private var tabRouter: TabRouter
    @State private var searchText = ""
    @State private var selectedCategory = "All"
    @State private var selectedViewMode: BrowseViewMode = .grid
    @State private var selectedDistance = "25 mi"
    @State private var showingFilters = false
    @State private var mapPosition: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 34.0522, longitude: -118.2437),
            span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
        )
    )

    private enum BrowseViewMode: String, CaseIterable, Identifiable {
        case list = "List"
        case grid = "Grid"
        case map = "Map"

        var id: String { rawValue }
    }

    private var categories: [String] {
        let values = dataStore.businesses.map(\.primaryCategory)
        return ["All"] + Array(Set(values)).sorted()
    }

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
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("EXPLORE")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .tracking(1.2)
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        Text("Browse\nPros")
                            .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }
                    .padding(.horizontal, 20)

                    HStack(spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(ScheduleMeTheme.mutedText)
                            TextField("Search businesses or services", text: $searchText)
                                .font(.custom(ScheduleMeTheme.fontName, size: 13))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))

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
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
                        }
                    }
                    .padding(.horizontal, 20)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(BrowseViewMode.allCases) { option in
                                SelectionPill(
                                    title: option.rawValue,
                                    isSelected: option == selectedViewMode
                                ) {
                                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                        selectedViewMode = option
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                    }

                    VStack(spacing: 10) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(categories, id: \.self) { category in
                                    SelectionPill(
                                        title: category,
                                        isSelected: category == selectedCategory
                                    ) {
                                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                            selectedCategory = category
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 20)
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                Text("Within")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                ForEach(["5 mi", "10 mi", "25 mi", "50 mi", "100 mi"], id: \.self) { distance in
                                    SelectionPill(
                                        title: distance,
                                        isSelected: distance == selectedDistance
                                    ) {
                                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                            selectedDistance = distance
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

                    Text("\(filteredBusinesses.count) businesses")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .padding(.horizontal, 20)

                    if let businessError = dataStore.businessError {
                        ScheduleMeEmptyState(
                            title: "Browse unavailable",
                            message: businessError,
                            systemImage: "location.slash"
                        )
                        .padding(.horizontal, 20)
                    } else if dataStore.isLoadingBusinesses && dataStore.businesses.isEmpty {
                        ProgressView()
                            .tint(ScheduleMeTheme.accent)
                            .padding(.horizontal, 20)
                    } else if filteredBusinesses.isEmpty {
                        ScheduleMeEmptyState(
                            title: "No businesses found nearby",
                            message: "Enable location access and click the button below to see local pros near you.",
                            systemImage: "mappin"
                        )
                        .padding(.horizontal, 20)
                    } else {
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
        .onChange(of: locationTaskID) { _, _ in
            updateMapRegion()
        }
        .onChange(of: filteredBusinesses) { _, _ in
            updateMapRegion()
        }
    }

    private var locationTaskID: String {
        guard let coordinate = locationManager.coordinate else { return "none" }
        return "\(coordinate.latitude),\(coordinate.longitude)"
    }

    private var browseResults: some View {
        Group {
            switch selectedViewMode {
            case .list:
                ForEach(filteredBusinesses) { business in
                    BrowseBusinessRow(business: business)
                        .padding(.horizontal, 20)
                }
            case .grid:
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    ForEach(filteredBusinesses) { business in
                        BrowseBusinessCard(business: business)
                    }
                }
                .padding(.horizontal, 20)
            case .map:
                BrowseMapView(
                    position: $mapPosition,
                    businesses: mapBusinesses
                )
                .padding(.horizontal, 12)
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: selectedViewMode)
    }

    private func matchesDistance(for business: BusinessSummary) -> Bool {
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
                id: business.id,
                name: business.name,
                category: business.primaryCategory,
                coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng)
            )
        }
    }

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
        }
    }
}

private struct MapBusiness: Identifiable, Hashable {
    let id: String
    let name: String
    let category: String
    let coordinate: CLLocationCoordinate2D

    static func == (lhs: MapBusiness, rhs: MapBusiness) -> Bool {
        lhs.id == rhs.id
            && lhs.name == rhs.name
            && lhs.category == rhs.category
            && lhs.coordinate.latitude == rhs.coordinate.latitude
            && lhs.coordinate.longitude == rhs.coordinate.longitude
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(name)
        hasher.combine(category)
        hasher.combine(coordinate.latitude)
        hasher.combine(coordinate.longitude)
    }
}

private struct SelectionPill: View {
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

private struct BrowseBusinessRow: View {
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
                .frame(width: 100, height: 100)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 8) {
                    Text(business.name)
                        .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                    Text(business.description ?? business.primaryCategory)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                        .lineLimit(2)
                    HStack {
                        ScheduleMeTag(text: business.primaryCategory)
                        if let priceLabel = business.priceLabel {
                            ScheduleMeTag(text: priceLabel)
                        }
                    }
                    Text("\(business.distanceLabel) • \(business.ratingLabel) stars")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }
            }
        }
    }
}

private struct BrowseMapView: View {
    @Binding var position: MapCameraPosition
    let businesses: [MapBusiness]

    var body: some View {
        ZStack {
            Map(position: $position) {
                ForEach(businesses) { business in
                    Marker(business.name, coordinate: business.coordinate)
                        .tint(ScheduleMeTheme.accent)
                }
            }
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
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 6)
            }
        }
        .frame(height: 360)
    }
}

private struct BrowseBusinessCard: View {
    let business: BusinessSummary

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 10) {
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
                .frame(height: 120)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                Text(business.name)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                    .lineLimit(1)

                Text(business.primaryCategory)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)

                Text("\(business.distanceLabel) • \(business.ratingLabel)★")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            }
        }
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
                        ForEach(categories, id: \.self) { category in
                            Text(category).tag(category)
                        }
                    }
                }

                Section("Distance") {
                    Picker("Distance", selection: $selectedDistance) {
                        ForEach(["5 mi", "10 mi", "25 mi", "50 mi", "100 mi"], id: \.self) { distance in
                            Text(distance).tag(distance)
                        }
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
