// FILE OVERVIEW:
// Main data orchestrator for businesses, bookings, messages, notifications, and payments.
//
// DEBUG NOTES:
// Most cross-screen loading/caching issues are debugged in this file first.

import CoreLocation
import Combine
import Foundation
import Auth
import Supabase
import PostgREST

@MainActor
final class ScheduleMeDataStore: ObservableObject {
    // MARK: Core app collections rendered by main consumer screens.
    @Published private(set) var businesses: [BusinessSummary] = []
    @Published private(set) var bookings: [BookingSummary] = []
    @Published private(set) var threads: [MessageThread] = []
    @Published private(set) var messages: [ConversationMessage] = []
    @Published private(set) var activeThread: MessageThread?
    @Published private(set) var notifications: [AppNotification] = []
    @Published private(set) var blockedThreadIDs: Set<String> = []

    @Published var businessError: String?
    @Published var bookingsError: String?
    @Published var messagesError: String?

    @Published private(set) var isLoadingBusinesses = false
    @Published private(set) var isLoadingBookings = false
    @Published private(set) var isLoadingThreads = false
    @Published private(set) var isLoadingMessages = false
    @Published private(set) var isSendingMessage = false
    @Published private(set) var isLoadingMoreMessages = false
    @Published private(set) var hasMoreMessages = false
    @Published private(set) var isLoadingNotifications = false
    @Published private(set) var hasLoadedBusinesses = false
    @Published private(set) var hasLoadedBookings = false
    @Published private(set) var hasLoadedThreads = false
    @Published private(set) var hasLoadedNotifications = false
    @Published private(set) var hasLoadedCampusBusinesses = false

    // MARK: Request-level cache markers to avoid unnecessary reloads while navigating tabs.
    private var messageCursor: Date?
    private var activeThreadBookingID: String?
    private var lastBusinessesFetchAt: Date?
    private var lastBusinessesCoordinate: CLLocationCoordinate2D?
    private var lastBookingsFetchAt: Date?
    private var lastThreadsFetchAt: Date?
    private let blockedThreadsDefaultsKey = "scheduleme_blocked_thread_ids"

    // MARK: - Nearby fallback row

    private struct NearbyBusinessRow: Decodable {
        let id: String
        let name: String?
        let slug: String?
        let description: String?
        let address: String?
        let lat: Double?
        let lng: Double?
        let serviceTags: [String]?
        let coverURL: String?
        let mediaURLs: [String]?
        let phone: String?
        let website: String?
        let calendlyURL: String?
        let rating: Double?
        let reviewCount: Int?
        let priceTier: Int?
        let founder50: Bool?
        let availabilityStatus: String?
        let campusProvider: Bool?
        let publicVisibility: Bool?
        let publicShowName: Bool?
        let publicShowMedia: Bool?
        let schoolDomain: String?
        let campusSchoolName: String?

        enum CodingKeys: String, CodingKey {
            case id
            case name
            case slug
            case description
            case address
            case lat
            case lng
            case serviceTags = "service_tags"
            case coverURL = "cover_url"
            case mediaURLs = "media_urls"
            case phone
            case website
            case calendlyURL = "calendly_url"
            case rating
            case reviewCount = "review_count"
            case priceTier = "price_tier"
            case founder50
            case availabilityStatus = "availability_status"
            case campusProvider = "campus_provider"
            case publicVisibility = "public_visibility"
            case publicShowName = "public_show_name"
            case publicShowMedia = "public_show_media"
            case schoolDomain = "school_domain"
            case campusSchoolName = "campus_school_name"
        }
    }

    // MARK: - Campus businesses

    @Published private(set) var campusBusinesses: [BusinessSummary] = []
    @Published private(set) var campusFeatured: [BusinessSummary] = []
    @Published private(set) var isLoadingCampusBusinesses = false

    /// Loads EDU campus businesses + featured rows.
    /// Uses school domain / campus tag filters to mirror web campus feed behavior.
    func loadCampusBusinesses(schoolDomain: String?, campusTag: String?) async {
        isLoadingCampusBusinesses = true
        defer {
            isLoadingCampusBusinesses = false
            hasLoadedCampusBusinesses = true
        }

        var items: [URLQueryItem] = [.init(name: "limit", value: "40")]
        if let domain = schoolDomain, !domain.isEmpty {
            items.append(.init(name: "school_domain", value: domain))
        }
        if let tag = campusTag, !tag.isEmpty {
            items.append(.init(name: "campus_school_name", value: tag))
        }
        if items.count == 1 {
            campusBusinesses = []
            return
        }

        do {
            let response: CampusBusinessesResponse = try await APIClient.shared.get(
                path: "/api/campus-businesses",
                queryItems: items
            )
            campusBusinesses = response.businesses
            campusFeatured = response.featured
        } catch {
            campusBusinesses = []
            campusFeatured = []
        }
    }

    func clearCampusBusinesses() {
        campusBusinesses = []
        campusFeatured = []
        hasLoadedCampusBusinesses = false
    }

    // MARK: - Favorites / pins (stored locally in UserDefaults)

    @Published private(set) var favoriteIDs: Set<String> = []

    private let favoritesDefaultsKey = "scheduleme_pinned_ids"

    init() {
        let storedBlocked = UserDefaults.standard.stringArray(forKey: blockedThreadsDefaultsKey) ?? []
        blockedThreadIDs = Set(storedBlocked)
    }

    func loadFavorites(userID: String) async {
        // Current mobile behavior stores favorites locally for snappy pin toggles.
        let stored = UserDefaults.standard.stringArray(forKey: favoritesDefaultsKey) ?? []
        favoriteIDs = Set(stored)
    }

    func toggleFavorite(businessID: String, userID: String) async {
        if favoriteIDs.contains(businessID) {
            favoriteIDs.remove(businessID)
        } else {
            favoriteIDs.insert(businessID)
        }
        UserDefaults.standard.set(Array(favoriteIDs), forKey: favoritesDefaultsKey)
    }

    /// Blocks a conversation locally so it no longer appears in the inbox.
    /// This is a user safety control required for UGC moderation.
    func blockThread(_ thread: MessageThread) {
        blockedThreadIDs.insert(thread.id)
        persistBlockedThreadIDs()
        threads.removeAll { $0.id == thread.id }
        if activeThread?.id == thread.id {
            closeActiveThread()
        }
    }

    /// Restores a previously blocked thread to the inbox list on next refresh.
    func unblockThread(threadID: String) {
        blockedThreadIDs.remove(threadID)
        persistBlockedThreadIDs()
    }

    private func persistBlockedThreadIDs() {
        UserDefaults.standard.set(Array(blockedThreadIDs), forKey: blockedThreadsDefaultsKey)
    }

    /// Clears all in-memory state that is user/session scoped.
    /// Call on sign-out to avoid stale data flashes for the next account.
    func reset() {
        // Called on sign out. Keep this exhaustive so no stale user data leaks between sessions.
        businesses = []
        campusBusinesses = []
        campusFeatured = []
        bookings = []
        threads = []
        messages = []
        activeThread = nil
        notifications = []
        favoriteIDs = []
        businessError = nil
        bookingsError = nil
        messagesError = nil
        paymentMethods = []
        paymentDefaultID = nil
        paymentMethodsError = nil
        lastBusinessesFetchAt = nil
        lastBusinessesCoordinate = nil
        lastBookingsFetchAt = nil
        lastThreadsFetchAt = nil
        hasLoadedBusinesses = false
        hasLoadedBookings = false
        hasLoadedThreads = false
        hasLoadedNotifications = false
        hasLoadedCampusBusinesses = false
    }

    func closeActiveThread() {
        // Return from thread detail to thread list.
        activeThread = nil
        messages = []
        activeThreadBookingID = nil
    }

    /// Nearby business fetch with short cache window + distance threshold.
    func loadNearbyBusinesses(coordinate: CLLocationCoordinate2D?) async {
        let resolvedCoordinate = coordinate
            ?? lastBusinessesCoordinate
            ?? LocationManager.simulatorFallbackCoordinate
            ?? Self.defaultNearbyFallbackCoordinate
        guard let coordinate = resolvedCoordinate else {
            if businesses.isEmpty {
                businessError = DataStoreError.missingLocation.localizedDescription
            } else {
                businessError = nil
            }
            hasLoadedBusinesses = true
            return
        }
        if shouldUseNearbyBusinessesCache(for: coordinate) {
            hasLoadedBusinesses = true
            return
        }

        isLoadingBusinesses = true
        defer {
            isLoadingBusinesses = false
            hasLoadedBusinesses = true
        }

        let primaryNearbyAuth = await loadNearbyBusinessesPrimary(coordinate: coordinate, requiresAuth: true)
        let primaryNearbyPublic = await loadNearbyBusinessesPrimary(coordinate: coordinate, requiresAuth: false)
        let supabaseFallback = await loadNearbyBusinessesFallbackFromSupabase(coordinate: coordinate)
        let searchFallback = await loadNearbyBusinessesFallbackFromSearch(coordinate: coordinate)

        if let primary = primaryNearbyAuth ?? primaryNearbyPublic, !primary.isEmpty {
            businesses = mergeNearbyBusinesses(primary: primary, supplement: supabaseFallback ?? [])
            businessError = nil
            lastBusinessesFetchAt = Date()
            lastBusinessesCoordinate = coordinate
            return
        }

        if let supabaseFallback, !supabaseFallback.isEmpty {
            businesses = supabaseFallback
            businessError = nil
            lastBusinessesFetchAt = Date()
            lastBusinessesCoordinate = coordinate
            return
        }

        if let searchFallback, !searchFallback.isEmpty {
            businesses = searchFallback
            businessError = nil
            lastBusinessesFetchAt = Date()
            lastBusinessesCoordinate = coordinate
            return
        }

        if businesses.isEmpty {
            let nearbyCount = (primaryNearbyAuth ?? primaryNearbyPublic)?.count ?? 0
            let supabaseCount = supabaseFallback?.count ?? 0
            let searchCount = searchFallback?.count ?? 0
            businessError = "Nearby providers are currently unavailable. Sources returned: nearby=\(nearbyCount), supabase=\(supabaseCount), search=\(searchCount). Pull to refresh and try again."
        } else {
            businessError = nil
        }
    }

    private func loadNearbyBusinessesPrimary(
        coordinate: CLLocationCoordinate2D,
        requiresAuth: Bool
    ) async -> [BusinessSummary]? {
        do {
            let response: NearbyBusinessesResponse = try await APIClient.shared.get(
                path: "/api/nearby-businesses",
                queryItems: [
                    .init(name: "lat", value: String(coordinate.latitude)),
                    .init(name: "lng", value: String(coordinate.longitude)),
                    .init(name: "radius", value: "25"),
                    .init(name: "limit", value: "40"),
                ],
                requiresAuth: requiresAuth
            )
            let filtered = response.businesses.filter { business in
                let distance: Double?
                if let direct = business.distanceMiles {
                    distance = direct
                } else if let lat = business.lat, let lng = business.lng {
                    distance = Self.distanceMiles(
                        from: coordinate.latitude,
                        fromLng: coordinate.longitude,
                        to: lat,
                        toLng: lng
                    )
                } else {
                    distance = nil
                }
                // Nearby endpoint should only return nearby rows; enforce client-side too.
                guard let distance else { return false }
                return distance <= 35
            }
            return filtered
        } catch {
            #if DEBUG
            print("Nearby primary failed (auth=\(requiresAuth)): \(error.localizedDescription)")
            #endif
            return nil
        }
    }

    /// Last-resort fallback: use `/api/search` which exists on all web deployments.
    private func loadNearbyBusinessesFallbackFromSearch(
        coordinate: CLLocationCoordinate2D
    ) async -> [BusinessSummary]? {
        struct SearchRequest: Encodable {
            let lat: Double
            let lng: Double
            let radius: Int
            let limit: Int
        }
        struct SearchBusinessRow: Decodable {
            let id: String
            let name: String?
            let slug: String?
            let description: String?
            let address: String?
            let lat: Double?
            let lng: Double?
            let serviceTags: [String]?
            let coverURL: String?
            let mediaURLs: [String]?
            let priceTier: Int?
            let rating: Double?
            let reviewCount: Int?
            let calendlyURL: String?
            let distanceMiles: Double?

            enum CodingKeys: String, CodingKey {
                case id
                case name
                case slug
                case description
                case address
                case lat
                case lng
                case serviceTags = "service_tags"
                case coverURL = "cover_url"
                case mediaURLs = "media_urls"
                case priceTier = "price_tier"
                case rating
                case reviewCount = "review_count"
                case calendlyURL = "calendly_url"
                case distanceMiles = "distance_miles"
            }
        }
        struct SearchResponse: Decodable {
            let data: [SearchBusinessRow]

            init(from decoder: Decoder) throws {
                if let single = try? decoder.singleValueContainer(),
                   let direct = try? single.decode([SearchBusinessRow].self) {
                    data = direct
                    return
                }
                let container = try decoder.container(keyedBy: DynamicCodingKey.self)
                if let rows = try container.decodeIfPresent([SearchBusinessRow].self, forKey: DynamicCodingKey("data")) {
                    data = rows
                    return
                }
                if let rows = try container.decodeIfPresent([SearchBusinessRow].self, forKey: DynamicCodingKey("businesses")) {
                    data = rows
                    return
                }
                if let rows = try container.decodeIfPresent([SearchBusinessRow].self, forKey: DynamicCodingKey("results")) {
                    data = rows
                    return
                }
                if let nested = try container.decodeIfPresent(SearchResponse.self, forKey: DynamicCodingKey("payload")) {
                    data = nested.data
                    return
                }
                data = []
            }
        }
        struct DynamicCodingKey: CodingKey {
            var stringValue: String
            init(_ string: String) { self.stringValue = string }
            init?(stringValue: String) { self.stringValue = stringValue }
            var intValue: Int?
            init?(intValue: Int) { return nil }
        }

        let request = SearchRequest(
            lat: coordinate.latitude,
            lng: coordinate.longitude,
            radius: 50,
            limit: 80
        )
        var responseAuthed: SearchResponse?
        var responsePublic: SearchResponse?

        do {
            responseAuthed = try await APIClient.shared.send(
                path: "/api/search",
                method: "POST",
                body: request,
                requiresAuth: true
            )
        } catch {
            #if DEBUG
            print("Nearby search fallback (auth) failed: \(error.localizedDescription)")
            #endif
        }

        do {
            responsePublic = try await APIClient.shared.send(
                path: "/api/search",
                method: "POST",
                body: request,
                requiresAuth: false
            )
        } catch {
            #if DEBUG
            print("Nearby search fallback (public) failed: \(error.localizedDescription)")
            #endif
        }

        let rows = (responseAuthed?.data ?? []) + (responsePublic?.data ?? [])
        let mapped = rows.map { row in
            BusinessSummary(
                id: row.id,
                name: row.name ?? "Local provider",
                slug: row.slug,
                description: row.description,
                address: row.address,
                lat: row.lat,
                lng: row.lng,
                serviceTags: row.serviceTags ?? [],
                coverURL: BusinessSummary.resolveRemoteURL(from: row.coverURL),
                mediaURLs: (row.mediaURLs ?? []).compactMap(BusinessSummary.resolveRemoteURL(from:)),
                phone: nil,
                website: nil,
                calendlyURL: row.calendlyURL,
                rating: row.rating,
                reviewCount: row.reviewCount,
                priceTier: row.priceTier,
                distanceMiles: row.distanceMiles,
                founder50: nil,
                availabilityStatus: nil,
                campusProvider: nil,
                publicVisibility: nil,
                publicShowName: nil,
                publicShowMedia: nil,
                schoolDomain: nil,
                campusSchoolName: nil
            )
        }
        let deduped = Dictionary(uniqueKeysWithValues: mapped.map { ($0.id, $0) }).values
        if !deduped.isEmpty {
            return deduped.sorted {
                ($0.distanceMiles ?? .greatestFiniteMagnitude) < ($1.distanceMiles ?? .greatestFiniteMagnitude)
            }
        }
        return nil
    }

    /// Direct Supabase fallback for nearby inventory when `/api/nearby-businesses`
    /// is missing/unhealthy on the web deployment.
    private func loadNearbyBusinessesFallbackFromSupabase(
        coordinate: CLLocationCoordinate2D,
        radiusMiles: Double = 25
    ) async -> [BusinessSummary]? {
        do {
            let response: PostgrestResponse<[NearbyBusinessRow]>
            do {
                // Preferred query path on current schema.
                response = try await SupabaseManager.shared.client
                    .from("businesses")
                    .select("id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,public_visibility,public_show_name,school_domain,campus_school_name,is_onboarded")
                    .eq("is_onboarded", value: true)
                    .limit(300)
                    .execute()
            } catch {
                // Back-compat fallback for deployments where `is_onboarded` is absent.
                response = try await SupabaseManager.shared.client
                    .from("businesses")
                    .select("id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,public_visibility,public_show_name,school_domain,campus_school_name")
                    .limit(300)
                    .execute()
            }

            let nearby = response.value
                .compactMap { row -> BusinessSummary? in
                    let distance: Double?
                    if let lat = row.lat, let lng = row.lng {
                        let computedDistance = Self.distanceMiles(
                            from: coordinate.latitude,
                            fromLng: coordinate.longitude,
                            to: lat,
                            toLng: lng
                        )
                        guard computedDistance <= radiusMiles else { return nil }
                        distance = computedDistance
                    } else {
                        // Keep non-geocoded businesses in fallback results so Home/Browse
                        // doesn't render empty when nearby endpoint is unavailable.
                        distance = nil
                    }

                    let mediaURLs = (row.mediaURLs ?? []).compactMap(BusinessSummary.resolveRemoteURL(from:))
                    let coverURL = BusinessSummary.resolveRemoteURL(from: row.coverURL)
                    return BusinessSummary(
                        id: row.id,
                        name: row.name ?? "Student provider",
                        slug: row.slug,
                        description: row.description,
                        address: row.address,
                        lat: row.lat,
                        lng: row.lng,
                        serviceTags: row.serviceTags ?? [],
                        coverURL: coverURL,
                        mediaURLs: mediaURLs,
                        phone: row.phone,
                        website: row.website,
                        calendlyURL: row.calendlyURL,
                        rating: row.rating,
                        reviewCount: row.reviewCount,
                        priceTier: row.priceTier,
                        distanceMiles: distance,
                        founder50: row.founder50,
                        availabilityStatus: row.availabilityStatus,
                        campusProvider: row.campusProvider,
                        publicVisibility: row.publicVisibility,
                        publicShowName: row.publicShowName,
                        publicShowMedia: row.publicShowMedia,
                        schoolDomain: row.schoolDomain,
                        campusSchoolName: row.campusSchoolName
                    )
                }
                .sorted {
                    let leftDistance = $0.distanceMiles ?? .greatestFiniteMagnitude
                    let rightDistance = $1.distanceMiles ?? .greatestFiniteMagnitude
                    return leftDistance < rightDistance
                }
            if !nearby.isEmpty {
                return nearby
            }

            // If nothing falls inside radius, still return recent public/campus inventory
            // so Home/Browse never feel empty in low-density areas.
            let fallbackAnyLocation = response.value.compactMap { row -> BusinessSummary? in
                let mediaURLs = (row.mediaURLs ?? []).compactMap(BusinessSummary.resolveRemoteURL(from:))
                let coverURL = BusinessSummary.resolveRemoteURL(from: row.coverURL)
                return BusinessSummary(
                    id: row.id,
                    name: row.name ?? "Student provider",
                    slug: row.slug,
                    description: row.description,
                    address: row.address,
                    lat: row.lat,
                    lng: row.lng,
                    serviceTags: row.serviceTags ?? [],
                    coverURL: coverURL,
                    mediaURLs: mediaURLs,
                    phone: row.phone,
                    website: row.website,
                    calendlyURL: row.calendlyURL,
                    rating: row.rating,
                    reviewCount: row.reviewCount,
                    priceTier: row.priceTier,
                    distanceMiles: nil,
                    founder50: row.founder50,
                    availabilityStatus: row.availabilityStatus,
                    campusProvider: row.campusProvider,
                    publicVisibility: row.publicVisibility,
                    publicShowName: row.publicShowName,
                    publicShowMedia: row.publicShowMedia,
                    schoolDomain: row.schoolDomain,
                    campusSchoolName: row.campusSchoolName
                )
            }
            return Array(fallbackAnyLocation.prefix(60))
        } catch {
            #if DEBUG
            print("Nearby supabase fallback failed: \(error.localizedDescription)")
            #endif
            return nil
        }
    }

    private static func distanceMiles(from lat1: Double, fromLng lng1: Double, to lat2: Double, toLng lng2: Double) -> Double {
        let earthRadiusMiles = 3958.8
        let dLat = (lat2 - lat1) * .pi / 180
        let dLng = (lng2 - lng1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) * sin(dLng / 2) * sin(dLng / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return earthRadiusMiles * c
    }

    private static var defaultNearbyFallbackCoordinate: CLLocationCoordinate2D? {
        CLLocationCoordinate2D(latitude: 36.9916, longitude: -122.0583)
    }

    /// Combines primary nearby API results with fallback Supabase rows so we can
    /// preserve privacy metadata required for masked campus provider cards.
    private func mergeNearbyBusinesses(primary: [BusinessSummary], supplement: [BusinessSummary]) -> [BusinessSummary] {
        var byID: [String: BusinessSummary] = [:]

        for business in supplement {
            byID[business.id] = business
        }

        for business in primary {
            if let fallback = byID[business.id] {
                byID[business.id] = BusinessSummary(
                    id: business.id,
                    name: business.name,
                    slug: business.slug ?? fallback.slug,
                    description: business.description ?? fallback.description,
                    address: business.address ?? fallback.address,
                    lat: business.lat ?? fallback.lat,
                    lng: business.lng ?? fallback.lng,
                    serviceTags: business.serviceTags.isEmpty ? fallback.serviceTags : business.serviceTags,
                    coverURL: business.coverURL ?? fallback.coverURL,
                    mediaURLs: business.mediaURLs.isEmpty ? fallback.mediaURLs : business.mediaURLs,
                    phone: business.phone ?? fallback.phone,
                    website: business.website ?? fallback.website,
                    calendlyURL: business.calendlyURL ?? fallback.calendlyURL,
                    rating: business.rating ?? fallback.rating,
                    reviewCount: business.reviewCount ?? fallback.reviewCount,
                    priceTier: business.priceTier ?? fallback.priceTier,
                    distanceMiles: business.distanceMiles ?? fallback.distanceMiles,
                    founder50: business.founder50 ?? fallback.founder50,
                    availabilityStatus: business.availabilityStatus ?? fallback.availabilityStatus,
                    campusProvider: business.campusProvider ?? fallback.campusProvider,
                    publicVisibility: business.publicVisibility ?? fallback.publicVisibility,
                    publicShowName: business.publicShowName ?? fallback.publicShowName,
                    publicShowMedia: business.publicShowMedia ?? fallback.publicShowMedia,
                    schoolDomain: business.schoolDomain ?? fallback.schoolDomain,
                    campusSchoolName: business.campusSchoolName ?? fallback.campusSchoolName
                )
            } else {
                byID[business.id] = business
            }
        }

        return byID.values.sorted {
            ($0.distanceMiles ?? .greatestFiniteMagnitude) < ($1.distanceMiles ?? .greatestFiniteMagnitude)
        }
    }

    /// Loads bookings for the signed-in consumer.
    /// Uses short cache window to reduce flicker when tab switching.
    func loadBookings() async {
        // Bookings are cached briefly to reduce list flicker when switching tabs.
        if let lastBookingsFetchAt, Date().timeIntervalSince(lastBookingsFetchAt) < 45, !bookings.isEmpty {
            return
        }
        isLoadingBookings = true
        defer {
            isLoadingBookings = false
            hasLoadedBookings = true
        }

        do {
            let userID = try await currentUserID()
            let response: BookingsResponse = try await APIClient.shared.get(
                path: "/api/bookings",
                queryItems: [.init(name: "user_id", value: userID.lowercased())],
                requiresAuth: true
            )
            bookings = response.bookings
            bookingsError = nil
            lastBookingsFetchAt = Date()
        } catch {
            bookings = []
            bookingsError = error.localizedDescription
        }
    }

    /// Loads user notifications from API, with booking-derived fallback if endpoint fails.
    func loadNotifications() async {
        isLoadingNotifications = true
        defer {
            isLoadingNotifications = false
            hasLoadedNotifications = true
        }

        do {
            let response: NotificationsResponse = try await APIClient.shared.get(
                path: "/api/notifications",
                requiresAuth: true
            )
            notifications = response.notifications.sorted { $0.createdAt > $1.createdAt }
        } catch {
            // Fallback path so notifications page still has useful content
            // even if notifications API is unavailable.
            do {
                let userID = try await currentUserID()
                let response: BookingsResponse = try await APIClient.shared.get(
                    path: "/api/bookings",
                    queryItems: [.init(name: "user_id", value: userID.lowercased())],
                    requiresAuth: true
                )
                notifications = response.bookings.map { AppNotification.fromBooking($0) }
            } catch {
                notifications = []
            }
        }
    }

    /// Fallback strategy for threads when primary endpoint rejects access.
    /// Builds synthetic inbox rows from booking-linked thread fetches.
    private func fallbackThreadsFromBookings() async {
        do {
            let userID = try await currentUserID()
            let response: BookingsResponse = try await APIClient.shared.get(
                path: "/api/bookings",
                queryItems: [.init(name: "user_id", value: userID.lowercased())],
                requiresAuth: true
            )
            let bookingsByID = Dictionary(uniqueKeysWithValues: response.bookings.map { ($0.id, $0) })
            let bookingIDs = Array(Set(response.bookings.map(\.id)))
            var collected: [MessageThread] = []
            for bookingID in bookingIDs.prefix(30) {
                let booking = bookingsByID[bookingID]
                var threadForBooking: MessageThread?
                do {
                    let messagesResponse: MessagesResponse = try await APIClient.shared.get(
                        path: "/api/messages",
                        queryItems: [.init(name: "booking_id", value: bookingID)],
                        requiresAuth: true
                    )
                    if let thread = messagesResponse.thread {
                        threadForBooking = thread
                    } else if let booking {
                        threadForBooking = MessageThread(
                            id: booking.id,
                            businessID: booking.businessID,
                            bookingID: booking.id,
                            bookingIDs: [booking.id],
                            service: booking.service,
                            status: booking.status,
                            createdAt: booking.createdAt,
                            businesses: ThreadBusiness(id: booking.businessID, name: booking.businessName, phone: booking.businessPhone),
                            lastMessage: messagesResponse.messages.last,
                            unreadCount: 0
                        )
                    }
                } catch {
                    if let booking {
                        threadForBooking = MessageThread(
                            id: booking.id,
                            businessID: booking.businessID,
                            bookingID: booking.id,
                            bookingIDs: [booking.id],
                            service: booking.service,
                            status: booking.status,
                            createdAt: booking.createdAt,
                            businesses: ThreadBusiness(id: booking.businessID, name: booking.businessName, phone: booking.businessPhone),
                            lastMessage: nil,
                            unreadCount: 0
                        )
                    }
                }
                if let threadForBooking {
                    collected.append(threadForBooking)
                }
            }
            if collected.isEmpty {
                collected = response.bookings.map { booking in
                    MessageThread(
                        id: booking.id,
                        businessID: booking.businessID,
                        bookingID: booking.id,
                        bookingIDs: [booking.id],
                        service: booking.service,
                        status: booking.status,
                        createdAt: booking.createdAt,
                        businesses: ThreadBusiness(id: booking.businessID, name: booking.businessName, phone: booking.businessPhone),
                        lastMessage: nil,
                        unreadCount: 0
                    )
                }
            }
            threads = mergeThreadsByBusiness(collected)
                .filter { !blockedThreadIDs.contains($0.id) }
                .sorted { $0.createdAt > $1.createdAt }
            messagesError = nil
        } catch {
            threads = []
            messagesError = error.localizedDescription
        }
    }

    /// Loads inbox thread list for the current user.
    func loadThreads(for userID: String?) async {
        let session = try? await SupabaseManager.shared.client.auth.session
        let resolvedUserID = (try? await currentUserID()) ?? userID ?? session?.user.id.uuidString
        guard let resolvedUserID else {
            threads = []
            messagesError = DataStoreError.unauthenticated.localizedDescription
            hasLoadedThreads = true
            return
        }
        if let lastThreadsFetchAt, Date().timeIntervalSince(lastThreadsFetchAt) < 20, !threads.isEmpty {
            return
        }

        isLoadingThreads = true
        defer {
            isLoadingThreads = false
            hasLoadedThreads = true
        }

        do {
            // UUID must be lowercase — backend compares against JWT `sub` case-sensitively.
            let response: ThreadsResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: [.init(name: "user_id", value: resolvedUserID.lowercased())],
                requiresAuth: true
            )
            let normalizedThreads = response.threads
                .map { thread in
                    if thread.bookingID != nil {
                        return thread
                    }
                    if let inferred = inferredBookingIDForThread(thread) {
                        return MessageThread(
                            id: thread.id,
                            businessID: thread.businessID,
                            bookingID: inferred,
                            bookingIDs: [inferred],
                            service: thread.service,
                            status: thread.status,
                            createdAt: thread.createdAt,
                            businesses: thread.businesses,
                            lastMessage: thread.lastMessage,
                            unreadCount: thread.unreadCount
                        )
                    }
                    return thread
                }
            threads = mergeThreadsByBusiness(normalizedThreads)
                .filter { !blockedThreadIDs.contains($0.id) }
            messagesError = nil
            lastThreadsFetchAt = Date()
            if threads.isEmpty {
                await fallbackThreadsFromBookings()
            }
        } catch {
            await fallbackThreadsFromBookings()
            if threads.isEmpty {
                messagesError = error.localizedDescription
            }
        }
    }

    private func shouldUseNearbyBusinessesCache(for coordinate: CLLocationCoordinate2D) -> Bool {
        guard let lastBusinessesFetchAt, let lastBusinessesCoordinate, !businesses.isEmpty else {
            return false
        }
        let age = Date().timeIntervalSince(lastBusinessesFetchAt)
        guard age < 120 else { return false }
        let lastLocation = CLLocation(latitude: lastBusinessesCoordinate.latitude, longitude: lastBusinessesCoordinate.longitude)
        let newLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        return lastLocation.distance(from: newLocation) < 200
    }

    /// Opens a thread and loads the newest page of messages.
    /// Also clears unread state for both UI and backend.
    func openThread(_ thread: MessageThread) async {
        guard !blockedThreadIDs.contains(thread.id) else {
            messagesError = "This conversation is blocked."
            return
        }
        // "Open thread" = reset pagination state + fetch latest page from API.
        activeThread = thread
        isLoadingMessages = true
        hasMoreMessages = false
        messageCursor = nil
        activeThreadBookingID = nil
        defer { isLoadingMessages = false }

        do {
            let candidateBookingIDs = await bookingCandidateIDs(for: thread)
            guard !candidateBookingIDs.isEmpty else {
                throw DataStoreError.server("Unable to open this conversation.")
            }
            var collectedMessages: [ConversationMessage] = []
            var selectedThreadPayload: MessageThread?
            var resolvedBookingID: String?
            var lastError: Error?
            for bookingID in candidateBookingIDs {
                do {
                    let response = try await fetchMessages(bookingID: bookingID, limit: 40)
                    if let serverThread = response.thread, selectedThreadPayload == nil {
                        selectedThreadPayload = serverThread
                    }
                    if resolvedBookingID == nil {
                        resolvedBookingID = bookingID
                    }
                    if !response.messages.isEmpty {
                        collectedMessages.append(contentsOf: response.messages)
                        // Prefer quick first paint over aggregating every possible booking thread.
                        break
                    }
                } catch {
                    lastError = error
                }
            }
            guard !collectedMessages.isEmpty else {
                throw lastError ?? DataStoreError.server("Unable to load messages for this conversation.")
            }
            activeThreadBookingID = resolvedBookingID
            messages = deduplicatedMessages(collectedMessages)
            messageCursor = messages.first?.createdAt
            hasMoreMessages = false
            if let updatedThread = selectedThreadPayload {
                // Mark thread unread badge as cleared locally as soon as user opens it.
                let clearedThread = MessageThread(
                    id: updatedThread.id,
                    businessID: updatedThread.businessID,
                    bookingID: updatedThread.bookingID,
                    bookingIDs: updatedThread.bookingIDs,
                    service: updatedThread.service,
                    status: updatedThread.status,
                    createdAt: updatedThread.createdAt,
                    businesses: updatedThread.businesses,
                    lastMessage: updatedThread.lastMessage,
                    unreadCount: 0
                )
                activeThread = clearedThread
                if let index = threads.firstIndex(where: { $0.id == thread.id }) {
                    threads[index] = clearedThread
                }
            }
            await markThreadRead(bookingIDs: candidateBookingIDs)
            messagesError = nil
        } catch {
            messages = []
            messagesError = error.localizedDescription
        }
    }

    /// Pulls only messages newer than the last local message.
    func refreshActiveThreadMessages(thread: MessageThread) async {
        // Poll incremental messages after the newest local message timestamp.
        guard let last = messages.last?.createdAt else {
            await openThread(thread)
            return
        }

        do {
            let bookingID: String?
            if let activeThreadBookingID {
                bookingID = activeThreadBookingID
            } else {
                bookingID = (await bookingCandidateIDs(for: thread)).first
            }
            guard let bookingID else {
                return
            }
            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: [
                    .init(name: "booking_id", value: bookingID),
                    .init(name: "after", value: ISO8601DateFormatter().string(from: last)),
                    .init(name: "limit", value: "40")
                ],
                requiresAuth: true
            )
            if !response.messages.isEmpty {
                let existing = Set(messages.map(\.id))
                let newMessages = response.messages.filter { !existing.contains($0.id) }
                messages.append(contentsOf: newMessages)
                messages.sort { $0.createdAt < $1.createdAt }
            }
        } catch {
            // ignore refresh errors
        }
    }

    /// Backward pagination for older messages using cursor-based `before` queries.
    func loadMoreMessages() async {
        // Infinite scroll backward pagination using `before=<cursor>`.
        guard !isLoadingMoreMessages, hasMoreMessages, let cursor = messageCursor else { return }
        guard let thread = activeThread else { return }
        isLoadingMoreMessages = true
        defer { isLoadingMoreMessages = false }

        do {
            let before = ISO8601DateFormatter().string(from: cursor)
            let bookingID: String?
            if let activeThreadBookingID {
                bookingID = activeThreadBookingID
            } else {
                bookingID = (await bookingCandidateIDs(for: thread)).first
            }
            guard let bookingID else {
                return
            }
            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: [
                    .init(name: "booking_id", value: bookingID),
                    .init(name: "before", value: before),
                    .init(name: "limit", value: "40")
                ],
                requiresAuth: true
            )
            if !response.messages.isEmpty {
                let existing = Set(messages.map(\.id))
                let newMessages = response.messages.filter { !existing.contains($0.id) }
                messages.insert(contentsOf: newMessages, at: 0)
                messages.sort { $0.createdAt < $1.createdAt }
                messageCursor = messages.first?.createdAt
            }
            hasMoreMessages = response.hasMore ?? (response.messages.count >= 20)
        } catch {
            // ignore load more errors
        }
    }

    // MARK: - Booking Creation

    @Published private(set) var isCreatingBooking = false
    @Published var bookingCreateError: String?

    /// Creates booking on API and returns created booking payload for downstream payment/review flow.
    func createBooking(
        businessID: String,
        service: String,
        userName: String,
        userPhone: String,
        userEmail: String,
        note: String? = nil,
        scheduledStart: Date? = nil,
        scheduledEnd: Date? = nil,
        servicePriceCents: Int? = nil
    ) async throws -> BookingCreatePayload {
        isCreatingBooking = true
        bookingCreateError = nil
        defer { isCreatingBooking = false }

        let formatter = ISO8601DateFormatter()
        let tz = TimeZone.current.identifier
        let bookingDateFormatter = DateFormatter()
        bookingDateFormatter.locale = Locale(identifier: "en_US_POSIX")
        bookingDateFormatter.timeZone = .current
        bookingDateFormatter.dateFormat = "yyyy-MM-dd"
        let bookingSlotFormatter = DateFormatter()
        bookingSlotFormatter.locale = Locale(identifier: "en_US_POSIX")
        bookingSlotFormatter.timeZone = .current
        bookingSlotFormatter.dateFormat = "h:mm a"
        let userID = try? await currentUserID()

        let modernRequest = BookingCreateRequest(
            businessID: businessID,
            userID: userID,
            service: service,
            userName: userName,
            userPhone: userPhone,
            userEmail: userEmail,
            note: note,
            address: nil,
            scheduledDate: scheduledStart.map { bookingDateFormatter.string(from: $0) },
            scheduledSlot: scheduledStart.map { bookingSlotFormatter.string(from: $0) },
            scheduledStart: nil,
            scheduledEnd: nil,
            timezone: nil,
            servicePriceCents: nil
        )

        let legacyRequest = BookingCreateRequest(
            businessID: businessID,
            userID: userID,
            service: service,
            userName: userName,
            userPhone: userPhone,
            userEmail: userEmail,
            note: note,
            address: nil,
            scheduledDate: nil,
            scheduledSlot: nil,
            scheduledStart: scheduledStart.map { formatter.string(from: $0) },
            scheduledEnd: scheduledEnd.map { formatter.string(from: $0) },
            timezone: tz,
            servicePriceCents: servicePriceCents
        )

        let response: BookingCreateResponse
        do {
            // Primary contract matches the web booking flow currently in production.
            response = try await APIClient.shared.send(
                path: "/api/bookings",
                method: "POST",
                body: modernRequest,
                requiresAuth: true
            )
        } catch {
            let errorMessage = error.localizedDescription.lowercased()
            // Fallback for older deployments that still expect scheduled_start/end.
            if errorMessage.contains("unexpected fields") || errorMessage.contains("scheduled_start") || errorMessage.contains("scheduled_end") {
                response = try await APIClient.shared.send(
                    path: "/api/bookings",
                    method: "POST",
                    body: legacyRequest,
                    requiresAuth: true
                )
            } else {
                throw error
            }
        }
        guard let booking = response.booking else {
            throw DataStoreError.server("Booking was not returned by the server.")
        }
        return booking
    }

    // MARK: - Reviews

    @Published private(set) var isSubmittingReview = false
    @Published var reviewError: String?

    /// Submits post-service review tied to a booking + business.
    func submitReview(bookingID: String, businessID: String, rating: Int, comment: String) async throws {
        isSubmittingReview = true
        reviewError = nil
        defer { isSubmittingReview = false }

        let _: ReviewResponse = try await APIClient.shared.send(
            path: "/api/reviews",
            method: "POST",
            body: ReviewRequest(bookingID: bookingID, businessID: businessID, rating: rating, comment: comment),
            requiresAuth: true
        )
    }

    func loadReviews(for businessID: String) async throws -> [BusinessReview] {
        let response: ReviewsResponse = try await APIClient.shared.get(
            path: "/api/reviews",
            queryItems: [.init(name: "business_id", value: businessID)]
        )
        return response.reviews
    }

    /// Permanently deletes the authenticated account from backend records.
    func deleteAccount() async throws {
        let _: GenericSuccessResponse = try await APIClient.shared.send(
            path: "/api/delete-account",
            method: "POST",
            body: EmptyRequest(),
            requiresAuth: true
        )
    }

    // MARK: - Payment Methods

    @Published private(set) var paymentMethods: [PaymentMethod] = []
    @Published private(set) var isLoadingPaymentMethods = false
    @Published var paymentMethodsError: String?
    @Published private(set) var paymentDefaultID: String?
    /// Loads saved cards/payment methods for the current customer.
    func loadPaymentMethods() async {
        // Pulls Stripe-linked cards from backend customer profile.
        isLoadingPaymentMethods = true
        paymentMethodsError = nil
        defer { isLoadingPaymentMethods = false }

        do {
            let response: PaymentMethodsResponse = try await APIClient.shared.get(
                path: "/api/payment-methods",
                requiresAuth: true
            )
            paymentMethods = response.paymentMethods
            paymentDefaultID = response.defaultID
        } catch {
            paymentMethodsError = error.localizedDescription
        }
    }

    /// Persists the chosen default payment method.
    func setDefaultPaymentMethod(id: String) async {
        do {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/set-default-payment-method",
                method: "POST",
                body: SetDefaultPaymentMethodRequest(paymentMethodID: id),
                requiresAuth: true
            )
            paymentDefaultID = id
        } catch {
            paymentMethodsError = error.localizedDescription
        }
    }

    /// Removes a saved payment method from backend and local list.
    func deletePaymentMethod(id: String) async {
        do {
            let _: DeletePaymentMethodResponse = try await APIClient.shared.send(
                path: "/api/payment-methods",
                method: "DELETE",
                body: DeletePaymentMethodRequest(paymentMethodID: id),
                requiresAuth: true
            )
            paymentMethods.removeAll { $0.id == id }
        } catch {
            paymentMethodsError = error.localizedDescription
        }
    }

    /// Attaches a newly created Stripe payment method to the customer.
    func attachPaymentMethod(id: String) async throws {
        let _: GenericSuccessResponse = try await APIClient.shared.send(
            path: "/api/attach-payment-method",
            method: "POST",
            body: AttachPaymentMethodRequest(paymentMethodID: id),
            requiresAuth: true
        )
    }

    /// Creates booking-scoped setup intent (used before booking payment confirmation).
    func createSetupIntentForBooking(bookingID: String, forceNew: Bool = false) async throws -> SetupIntentResponse {
        return try await APIClient.shared.send(
            path: "/api/create-setup-intent",
            method: "POST",
            body: CreateSetupIntentRequest(bookingID: bookingID, forceNew: forceNew, apiVersion: nil),
            requiresAuth: true
        )
    }

    /// Creates account-scoped setup intent for card management screen.
    func createSetupIntentForAccount(apiVersion: String? = nil) async throws -> SetupIntentResponse {
        return try await APIClient.shared.send(
            path: "/api/create-setup-intent-account",
            method: "POST",
            body: CreateSetupIntentRequest(bookingID: nil, forceNew: nil, apiVersion: apiVersion),
            requiresAuth: true
        )
    }

    /// Best-effort bootstrap to ensure Stripe customer exists before card flows.
    func ensureStripeCustomer() async {
        do {
            _ = try await createSetupIntentForAccount()
        } catch {
            // Ignore; this is a best-effort bootstrap for payment methods.
        }
    }

    /// Explicit backend sync to repair missing customer/payment linkage.
    func syncStripeCustomer() async -> StripeSyncResponse? {
        do {
            let response: StripeSyncResponse = try await APIClient.shared.send(
                path: "/api/stripe-customer-sync",
                method: "POST",
                body: EmptyRequest(),
                queryItems: [.init(name: "force", value: "1")],
                requiresAuth: true
            )
            return response
        } catch {
            // Ignore; best-effort sync.
            return nil
        }
    }

    /// Notifies backend that user completed card save during booking flow.
    func notifyPaymentMethodSaved(bookingID: String) async {
        do {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/payment-method-saved",
                method: "POST",
                body: PaymentMethodSavedRequest(bookingID: bookingID),
                requiresAuth: true
            )
        } catch {
            // Ignore for now
        }
    }

    /// Charges booking immediately via backend payment endpoint.
    func payBookingNow(bookingID: String) async throws -> PayBookingNowResponse {
        try await APIClient.shared.send(
            path: "/api/pay-booking-now",
            method: "POST",
            body: PayBookingNowRequest(bookingID: bookingID),
            requiresAuth: true
        )
    }

    /// Creates hosted Stripe Checkout session URL for a booking.
    func createCheckoutSessionURL(bookingID: String) async throws -> URL {
        let response: CheckoutSessionResponse = try await APIClient.shared.send(
            path: "/api/checkout",
            method: "POST",
            body: PayBookingNowRequest(bookingID: bookingID),
            requiresAuth: true
        )
        guard let urlString = response.url, let url = URL(string: urlString) else {
            throw DataStoreError.server(response.error ?? "Could not create checkout session.")
        }
        return url
    }

    /// Marks booking as cancelled and mirrors that change in the local bookings array.
    func cancelBooking(bookingID: String) async throws {
        let _: GenericSuccessResponse = try await APIClient.shared.send(
            path: "/api/bookings",
            method: "PATCH",
            body: UpdateBookingStatusRequest(bookingID: bookingID, status: "cancelled"),
            requiresAuth: true
        )
        if let index = bookings.firstIndex(where: { $0.id == bookingID }) {
            let existing = bookings[index]
            let updated = BookingSummary(
                id: existing.id,
                service: existing.service,
                status: "cancelled",
                createdAt: existing.createdAt,
                scheduledAt: existing.scheduledAt,
                amountCents: existing.amountCents,
                paidAt: existing.paidAt,
                note: existing.note,
                businessID: existing.businessID,
                businessName: existing.businessName,
                businessPhone: existing.businessPhone,
                businessEmail: existing.businessEmail,
                stripePaymentMethodID: existing.stripePaymentMethodID,
                stripeCustomerID: existing.stripeCustomerID,
                stripeSetupIntentID: existing.stripeSetupIntentID
            )
            bookings[index] = updated
        }
    }

    // MARK: - Messaging (continued)

    /// Sends a user message for the active thread's booking and updates in-memory thread preview.
    func sendMessage(_ content: String) async {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if containsFilteredContent(trimmed) {
            messagesError = "Your message includes language that is not allowed. Please edit and try again."
            return
        }
        if let activeThread, blockedThreadIDs.contains(activeThread.id) {
            messagesError = "This conversation is blocked."
            return
        }
        var resolvedBookingID = activeThreadBookingID
        if resolvedBookingID == nil, let thread = activeThread {
            resolvedBookingID = await bookingCandidateIDs(for: thread).first
        }
        guard let bookingID = resolvedBookingID else {
            messagesError = "This thread is missing a booking ID."
            return
        }

        isSendingMessage = true
        defer { isSendingMessage = false }

        do {
            let response: SendMessageResponse = try await APIClient.shared.send(
                path: "/api/messages",
                method: "POST",
                body: SendMessageRequest(
                    bookingID: bookingID,
                    senderType: "user",
                    content: trimmed,
                    imageURL: nil,
                    messageType: nil
                ),
                requiresAuth: true
            )
            messages.append(response.message)
            messagesError = nil

            if let activeThread {
                let updatedThread = MessageThread(
                    id: activeThread.id,
                    businessID: activeThread.businessID,
                    bookingID: activeThread.bookingID,
                    bookingIDs: activeThread.bookingIDs,
                    service: activeThread.service,
                    status: activeThread.status,
                    createdAt: activeThread.createdAt,
                    businesses: activeThread.businesses,
                    lastMessage: response.message,
                    unreadCount: 0
                )
                self.activeThread = updatedThread
                self.activeThreadBookingID = bookingID
                if let index = threads.firstIndex(where: { $0.id == updatedThread.id }) {
                    threads[index] = updatedThread
                }
            }
        } catch {
            messagesError = error.localizedDescription
        }
    }

    private func fetchMessages(bookingID: String, limit: Int) async throws -> MessagesResponse {
        try await APIClient.shared.get(
            path: "/api/messages",
            queryItems: [
                .init(name: "booking_id", value: bookingID),
                .init(name: "limit", value: String(limit))
            ],
            requiresAuth: true
        )
    }

    private func bookingCandidateIDs(for thread: MessageThread) async -> [String] {
        var ids: [String] = []
        if let id = thread.bookingID?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty {
            ids.append(id)
        }
        if let list = thread.bookingIDs {
            ids.append(contentsOf: list.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
        }
        let threadID = thread.id.trimmingCharacters(in: .whitespacesAndNewlines)
        if !threadID.isEmpty {
            ids.append(threadID)
        }
        if let inferred = inferredBookingIDForThread(thread) {
            ids.append(inferred)
        }
        let sameBusinessBookings = bookings.filter { booking in
            if let threadBusinessID = thread.businessID, let bookingBusinessID = booking.businessID {
                return threadBusinessID == bookingBusinessID
            }
            return false
        }
        if !sameBusinessBookings.isEmpty {
            ids.append(contentsOf: sameBusinessBookings.sorted { $0.createdAt > $1.createdAt }.map(\.id))
        }
        var seen: Set<String> = []
        let unique = ids.filter { seen.insert($0).inserted }
        // Keep this tight to avoid long fan-out fetch times in conversations with many bookings.
        return Array(unique.prefix(3))
    }

    private func inferredBookingIDForThread(_ thread: MessageThread) -> String? {
        if let bookingID = thread.bookingID, !bookingID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return bookingID
        }
        if let bookingID = thread.bookingIDs?.first, !bookingID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return bookingID
        }
        if thread.businessID == nil, UUID(uuidString: thread.id) != nil {
            return thread.id
        }
        return bookings.first(where: { booking in
            if let threadBusinessID = thread.businessID, let bookingBusinessID = booking.businessID {
                return threadBusinessID == bookingBusinessID
            }
            return false
        })?.id
    }

    private func mergeThreadsByBusiness(_ source: [MessageThread]) -> [MessageThread] {
        var grouped: [String: MessageThread] = [:]

        for thread in source {
            let key = thread.businessID?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                ? "biz:\(thread.businessID!)"
                : "thread:\(thread.id)"
            if let existing = grouped[key] {
                let bookingIDs = Array(Set(
                    (existing.bookingIDs ?? (existing.bookingID.map { [$0] } ?? []))
                    + (thread.bookingIDs ?? (thread.bookingID.map { [$0] } ?? []))
                ))
                let latest = (existing.createdAt >= thread.createdAt) ? existing : thread
                grouped[key] = MessageThread(
                    id: latest.id,
                    businessID: latest.businessID ?? existing.businessID,
                    bookingID: latest.bookingID ?? existing.bookingID,
                    bookingIDs: bookingIDs.isEmpty ? nil : bookingIDs,
                    service: latest.service,
                    status: latest.status,
                    createdAt: max(existing.createdAt, thread.createdAt),
                    businesses: latest.businesses ?? existing.businesses,
                    lastMessage: latest.lastMessage ?? existing.lastMessage,
                    unreadCount: existing.unreadCount + thread.unreadCount
                )
            } else {
                grouped[key] = thread
            }
        }

        return grouped.values.sorted { left, right in
            let leftDate = left.lastMessage?.createdAt ?? left.createdAt
            let rightDate = right.lastMessage?.createdAt ?? right.createdAt
            return leftDate > rightDate
        }
    }

    private func deduplicatedMessages(_ source: [ConversationMessage]) -> [ConversationMessage] {
        var seen: Set<String> = []
        return source
            .filter { seen.insert($0.id).inserted }
            .sorted { $0.createdAt < $1.createdAt }
    }

    /// Resolves the best booking id for sending into an active provider thread.
    func resolvedBookingIDForActiveThread(_ thread: MessageThread) async -> String? {
        if let activeThreadBookingID, !activeThreadBookingID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return activeThreadBookingID
        }
        return (await bookingCandidateIDs(for: thread)).first
    }

    /// Uploads a media attachment and posts it into the booking thread.
    func sendMessageAttachment(
        bookingID: String,
        data: Data,
        mimeType: String,
        fileName: String,
        mediaType: String
    ) async throws {
        let base64 = data.base64EncodedString()
        let upload: UploadMessageMediaResponse = try await APIClient.shared.send(
            path: "/api/upload-message-media",
            method: "POST",
            body: UploadMessageMediaRequest(
                bookingID: bookingID,
                mediaType: mediaType,
                fileData: base64,
                fileType: mimeType,
                fileName: fileName
            ),
            requiresAuth: true
        )
        guard let mediaURL = upload.url, !mediaURL.isEmpty else {
            throw DataStoreError.server(upload.error ?? "Failed to upload media.")
        }

        // Try rich payload first; fallback to URL-only content if backend is older.
        do {
            let response: SendMessageResponse = try await APIClient.shared.send(
                path: "/api/messages",
                method: "POST",
                body: SendMessageRequest(
                    bookingID: bookingID,
                    senderType: "user",
                    content: mediaType == "image" ? "Image attachment" : "Video attachment",
                    imageURL: mediaURL,
                    messageType: mediaType
                ),
                requiresAuth: true
            )
            messages.append(response.message)
        } catch {
            let response: SendMessageResponse = try await APIClient.shared.send(
                path: "/api/messages",
                method: "POST",
                body: SendMessageRequest(
                    bookingID: bookingID,
                    senderType: "user",
                    content: mediaURL,
                    imageURL: nil,
                    messageType: nil
                ),
                requiresAuth: true
            )
            messages.append(response.message)
        }
    }

    /// Marks all given booking thread IDs as read for the current consumer.
    func markThreadRead(bookingIDs: [String]) async {
        for bookingID in bookingIDs {
            do {
                let _: GenericSuccessResponse = try await APIClient.shared.send(
                    path: "/api/messages",
                    method: "PATCH",
                    body: ["booking_id": bookingID, "reader_type": "user"],
                    requiresAuth: true
                )
            } catch {
                continue
            }
        }
    }

    /// Basic local objectionable-content filter for UGC messaging.
    private func containsFilteredContent(_ text: String) -> Bool {
        let normalized = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return false }
        let blockedPhrases = [
            "kill yourself",
            "kys",
            "i will kill you",
            "i am going to kill you",
            "rape you",
            "go die",
            "you should die",
            "nazi"
        ]
        return blockedPhrases.contains { normalized.contains($0) }
    }

    /// Returns authenticated user UUID for endpoints that require explicit `user_id`.
    private func currentUserID() async throws -> String {
        let session = try await SupabaseManager.shared.client.auth.session
        return session.user.id.uuidString
    }
}
