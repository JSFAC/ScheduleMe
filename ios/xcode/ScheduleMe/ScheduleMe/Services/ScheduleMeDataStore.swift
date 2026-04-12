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
    private var threadMessageCache: [String: [ConversationMessage]] = [:]
    private var lastBusinessesFetchAt: Date?
    private var lastBusinessesCoordinate: CLLocationCoordinate2D?
    private var lastBookingsFetchAt: Date?
    private var lastThreadsFetchAt: Date?
    private let blockedThreadsDefaultsKey = "scheduleme_blocked_thread_ids"
    /// Consumer product requirement: dispute window is fixed at 24h.
    private let defaultDisputeWindowHours: Int = 24

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

        let hasCampusIdentity =
            ((schoolDomain?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
             || (campusTag?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false))
        guard hasCampusIdentity else {
            campusBusinesses = []
            campusFeatured = []
            return
        }

        var items: [URLQueryItem] = [.init(name: "limit", value: "40")]
        if let domain = schoolDomain, !domain.isEmpty {
            items.append(.init(name: "school_domain", value: domain))
        }
        if let tag = campusTag, !tag.isEmpty {
            items.append(.init(name: "campus_school_name", value: tag))
        }
        if items.count == 1 {
            let supabaseFallback = await fetchCampusBusinessesFromSupabase(
                schoolDomain: schoolDomain,
                campusTag: campusTag
            )
            let fallback = !supabaseFallback.isEmpty
                ? supabaseFallback
                : deriveCampusBusinessesFallback(schoolDomain: schoolDomain, campusTag: campusTag)
            let sanitized = sanitizeCampusBusinesses(fallback, schoolDomain: schoolDomain, campusTag: campusTag)
            campusBusinesses = sanitized
            campusFeatured = stabilizedCampusFeatured(from: Array(sanitized.prefix(1)), allBusinesses: sanitized)
            return
        }

        do {
            let response: CampusBusinessesResponse = try await APIClient.shared.get(
                path: "/api/campus-businesses",
                queryItems: items
            )
            var mergedBusinesses = response.businesses
            var mergedFeatured = response.featured
            if mergedBusinesses.isEmpty && mergedFeatured.isEmpty {
                let supabaseFallback = await fetchCampusBusinessesFromSupabase(
                    schoolDomain: schoolDomain,
                    campusTag: campusTag
                )
                let fallback = !supabaseFallback.isEmpty
                    ? supabaseFallback
                    : deriveCampusBusinessesFallback(schoolDomain: schoolDomain, campusTag: campusTag)
                mergedBusinesses = fallback
                mergedFeatured = Array(fallback.prefix(1))
            }
            let sanitizedBusinesses = sanitizeCampusBusinesses(mergedBusinesses, schoolDomain: schoolDomain, campusTag: campusTag)
            let sanitizedFeatured = sanitizeCampusBusinesses(mergedFeatured, schoolDomain: schoolDomain, campusTag: campusTag)
            campusBusinesses = sanitizedBusinesses
            campusFeatured = stabilizedCampusFeatured(from: Array(sanitizedFeatured.prefix(1)), allBusinesses: sanitizedBusinesses)
            prefetchBusinessImages(sanitizedBusinesses + sanitizedFeatured, limit: 60)
        } catch {
            let supabaseFallback = await fetchCampusBusinessesFromSupabase(
                schoolDomain: schoolDomain,
                campusTag: campusTag
            )
            let fallback = !supabaseFallback.isEmpty
                ? supabaseFallback
                : deriveCampusBusinessesFallback(schoolDomain: schoolDomain, campusTag: campusTag)
            let sanitized = sanitizeCampusBusinesses(fallback, schoolDomain: schoolDomain, campusTag: campusTag)
            campusBusinesses = sanitized
            campusFeatured = stabilizedCampusFeatured(from: Array(sanitized.prefix(1)), allBusinesses: sanitized)
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
        clearThreadMessageCache(for: thread)
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
        threadMessageCache = [:]
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
            let merged = mergeNearbyBusinesses(primary: primary, supplement: supabaseFallback ?? [])
            businesses = await enrichNearbyBusinessesWithProfileMedia(merged)
            prefetchBusinessImages(businesses, limit: 60)
            businessError = nil
            lastBusinessesFetchAt = Date()
            lastBusinessesCoordinate = coordinate
            return
        }

        if let supabaseFallback, !supabaseFallback.isEmpty {
            businesses = await enrichNearbyBusinessesWithProfileMedia(supabaseFallback)
            prefetchBusinessImages(businesses, limit: 60)
            businessError = nil
            lastBusinessesFetchAt = Date()
            lastBusinessesCoordinate = coordinate
            return
        }

        if let searchFallback, !searchFallback.isEmpty {
            businesses = await enrichNearbyBusinessesWithProfileMedia(searchFallback)
            prefetchBusinessImages(businesses, limit: 60)
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

    private func prefetchBusinessImages(_ list: [BusinessSummary], limit: Int) {
        guard !list.isEmpty else { return }
        var urls: [URL] = []
        urls.reserveCapacity(list.count * 3)
        for business in list {
            if let hero = business.heroImageURL {
                urls.append(hero)
            }
            if let cover = business.coverURL {
                urls.append(cover)
            }
            if let firstMedia = business.mediaURLs.first {
                urls.append(firstMedia)
            }
        }
        var seen = Set<URL>()
        let deduped = urls.filter { seen.insert($0).inserted }
        Task {
            await ImagePrefetcher.shared.prefetch(urls: deduped, limit: limit)
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
        var shouldTryPublicFallback = true

        do {
            responseAuthed = try await APIClient.shared.send(
                path: "/api/search",
                method: "POST",
                body: request,
                requiresAuth: true
            )
        } catch {
            let message = ((error as? LocalizedError)?.errorDescription ?? error.localizedDescription).lowercased()
            // Only run unauthenticated fallback when auth truly failed because of auth.
            shouldTryPublicFallback = message.contains("status 401") || message.contains("unauthorized")
        }

        if shouldTryPublicFallback {
            do {
                responsePublic = try await APIClient.shared.send(
                    path: "/api/search",
                    method: "POST",
                    body: request,
                    requiresAuth: false
                )
            } catch {
                // Intentionally swallow debug spam here; UI already handles empty-result fallback.
            }
        }

        let rows = (responseAuthed?.data ?? []) + (responsePublic?.data ?? [])
        let mapped = rows.map { row in
            let distance: Double?
            if let direct = row.distanceMiles {
                distance = direct
            } else if let lat = row.lat, let lng = row.lng {
                distance = Self.distanceMiles(
                    from: coordinate.latitude,
                    fromLng: coordinate.longitude,
                    to: lat,
                    toLng: lng
                )
            } else {
                distance = nil
            }
            return BusinessSummary(
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
                distanceMiles: distance,
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
        let nearbyOnly = mapped.filter { ($0.distanceMiles ?? .greatestFiniteMagnitude) <= 35 }
        let deduped = Dictionary(uniqueKeysWithValues: nearbyOnly.map { ($0.id, $0) }).values
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

            // Never fallback to arbitrary out-of-area inventory for Home/Browse.
            return []
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

    /// Nearby endpoint may intentionally redact media for some rows.
    /// Fill missing card images from `business-profile` so Home/Browse cards
    /// can still render the provider's selected cover when available.
    private func enrichNearbyBusinessesWithProfileMedia(_ input: [BusinessSummary]) async -> [BusinessSummary] {
        let missingImageIDs = Array(
            Set(
                input
                    .filter { $0.heroImageURL == nil }
                    .map(\.id)
            )
        )
        guard missingImageIDs.isEmpty == false else { return input }

        var profileByBusinessID: [String: BusinessProfile] = [:]
        for businessID in missingImageIDs.prefix(12) {
            do {
                let response: BusinessProfileResponse = try await APIClient.shared.get(
                    path: "/api/business-profile",
                    queryItems: [.init(name: "business_id", value: businessID)],
                    requiresAuth: true
                )
                if let business = response.business {
                    profileByBusinessID[businessID] = business
                    continue
                }
            } catch {
                // Try public fallback below.
            }

            do {
                let response: BusinessProfileResponse = try await APIClient.shared.get(
                    path: "/api/business-profile",
                    queryItems: [.init(name: "business_id", value: businessID)],
                    requiresAuth: false
                )
                if let business = response.business {
                    profileByBusinessID[businessID] = business
                }
            } catch {
                // Best-effort enrichment only.
            }
        }

        guard profileByBusinessID.isEmpty == false else { return input }

        return input.map { business in
            guard business.heroImageURL == nil, let profile = profileByBusinessID[business.id] else {
                return business
            }

            let profileMedia = profile.mediaURLs ?? []
            let resolvedCover = business.coverURL ?? profile.coverURL ?? profileMedia.first
            let resolvedMedia = business.mediaURLs.isEmpty ? profileMedia : business.mediaURLs

            return BusinessSummary(
                id: business.id,
                name: business.name,
                slug: business.slug,
                description: business.description,
                address: business.address,
                lat: business.lat,
                lng: business.lng,
                serviceTags: business.serviceTags,
                coverURL: resolvedCover,
                mediaURLs: resolvedMedia,
                phone: business.phone,
                website: business.website,
                calendlyURL: business.calendlyURL,
                rating: business.rating,
                reviewCount: business.reviewCount,
                priceTier: business.priceTier,
                distanceMiles: business.distanceMiles,
                founder50: business.founder50,
                availabilityStatus: business.availabilityStatus,
                campusProvider: business.campusProvider,
                publicVisibility: business.publicVisibility,
                publicShowName: business.publicShowName,
                publicShowMedia: business.publicShowMedia,
                schoolDomain: business.schoolDomain,
                campusSchoolName: business.campusSchoolName,
                stripeOnboarded: business.stripeOnboarded,
                stripeAccountID: business.stripeAccountID
            )
        }
    }

    /// Loads bookings for the signed-in account.
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
            do {
                let userID = try await currentUserID()
                let fallback = try await fetchBookingsFromSupabase(userID: userID)
                bookings = fallback
                bookingsError = nil
                lastBookingsFetchAt = Date()
            } catch {
                bookings = []
                bookingsError = error.localizedDescription
            }
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
            let sorted = response.notifications.sorted { $0.createdAt > $1.createdAt }
            if sorted.isEmpty {
                notifications = await bookingDerivedNotificationsFallback()
            } else {
                notifications = sorted
            }
        } catch {
            // Fallback path so notifications page still has useful content
            // even if notifications API is unavailable.
            notifications = await bookingDerivedNotificationsFallback()
        }
    }

    private func bookingDerivedNotificationsFallback() async -> [AppNotification] {
        do {
            let userID = try await currentUserID()
            do {
                let response: BookingsResponse = try await APIClient.shared.get(
                    path: "/api/bookings",
                    queryItems: [.init(name: "user_id", value: userID.lowercased())],
                    requiresAuth: true
                )
                return response.bookings
                    .map { AppNotification.fromBooking($0) }
                    .sorted { $0.createdAt > $1.createdAt }
            } catch {
                let fallback = try await fetchBookingsFromSupabase(userID: userID)
                return fallback
                    .map { AppNotification.fromBooking($0) }
                    .sorted { $0.createdAt > $1.createdAt }
            }
        } catch {
            return []
        }
    }

    /// Fallback strategy for threads when primary endpoint rejects access.
    /// Builds synthetic inbox rows from booking-linked thread fetches.
    private func fallbackThreadsFromBookings() async {
        do {
            let sourceBookings: [BookingSummary]
            do {
                let userID = try await currentUserID()
                let response: BookingsResponse = try await APIClient.shared.get(
                    path: "/api/bookings",
                    queryItems: [.init(name: "user_id", value: userID.lowercased())],
                    requiresAuth: true
                )
                sourceBookings = response.bookings
            } catch {
                let userID = try await currentUserID()
                sourceBookings = try await fetchBookingsFromSupabase(userID: userID)
            }

            let bookingsByID = Dictionary(uniqueKeysWithValues: sourceBookings.map { ($0.id, $0) })
            let bookingIDs = Array(Set(sourceBookings.map(\.id)))
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
                collected = sourceBookings.map { booking in
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

    /// Direct Supabase fallback for bookings when API routing/rate-limit layers are unavailable.
    private func fetchBookingsFromSupabase(userID: String) async throws -> [BookingSummary] {
        struct BookingRow: Decodable {
            let id: String
            let service: String?
            let status: String?
            let createdAt: Date?
            let scheduledStart: Date?
            let amountCents: Int?
            let paidAt: Date?
            let note: String?
            let notes: String?
            let businessID: String?
            let businessName: String?
            let stripePaymentMethodID: String?
            let stripeCustomerID: String?
            let stripeSetupIntentID: String?

            enum CodingKeys: String, CodingKey {
                case id
                case service
                case status
                case createdAt = "created_at"
                case scheduledStart = "scheduled_start"
                case amountCents = "amount_cents"
                case paidAt = "paid_at"
                case note
                case notes
                case businessID = "business_id"
                case businessName = "business_name"
                case stripePaymentMethodID = "stripe_payment_method_id"
                case stripeCustomerID = "stripe_customer_id"
                case stripeSetupIntentID = "stripe_setup_intent_id"
            }
        }

        let response: PostgrestResponse<[BookingRow]> = try await SupabaseManager.shared.client
            .from("bookings")
            .select("id,service,status,created_at,scheduled_start,amount_cents,paid_at,note,notes,business_id,business_name,stripe_payment_method_id,stripe_customer_id,stripe_setup_intent_id")
            .eq("user_id", value: userID)
            .order("created_at", ascending: false)
            .limit(120)
            .execute()

        return response.value.map { row in
            BookingSummary(
                id: row.id,
                service: row.service ?? "Service",
                status: row.status ?? "pending",
                createdAt: row.createdAt ?? .distantPast,
                scheduledAt: row.scheduledStart,
                amountCents: row.amountCents,
                paidAt: row.paidAt,
                note: row.note ?? row.notes,
                businessID: row.businessID,
                businessName: row.businessName,
                businessPhone: nil,
                businessEmail: nil,
                stripePaymentMethodID: row.stripePaymentMethodID,
                stripeCustomerID: row.stripeCustomerID,
                stripeSetupIntentID: row.stripeSetupIntentID
            )
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
        let threadCacheKey = cacheKey(for: thread)
        let cachedMessages = threadMessageCache[threadCacheKey]
        if let cachedMessages, !cachedMessages.isEmpty {
            messages = cachedMessages
        }
        // "Open thread" = reset pagination state + fetch latest page from API.
        activeThread = thread
        isLoadingMessages = messages.isEmpty
        hasMoreMessages = false
        messageCursor = nil
        activeThreadBookingID = nil
        defer { isLoadingMessages = false }

        do {
            guard let queryItems = messageQueryItems(for: thread, limit: 40) else {
                throw DataStoreError.server("Unable to open this conversation.")
            }
            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: queryItems,
                requiresAuth: true
            )
            let hydratedMessages = deduplicatedMessages(response.messages)
            messages = hydratedMessages
            threadMessageCache[threadCacheKey] = hydratedMessages
            prefetchMessageMedia(hydratedMessages, limit: 16)
            messageCursor = messages.first?.createdAt
            hasMoreMessages = response.hasMore ?? false

            let responseBookingIDs = Set(response.messages.compactMap(\.bookingID))
            activeThreadBookingID = response.thread?.bookingID
                ?? thread.bookingID
                ?? responseBookingIDs.first

            if let updatedThread = response.thread {
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
                clearLocalUnreadState(for: clearedThread, bookingIDs: clearedThread.bookingIDs ?? [])
                threadMessageCache[cacheKey(for: clearedThread)] = hydratedMessages
            }

            let bookingIDsToMarkRead = response.thread?.bookingIDs
                ?? thread.bookingIDs
                ?? Array(responseBookingIDs)
            if !bookingIDsToMarkRead.isEmpty {
                await markThreadRead(bookingIDs: bookingIDsToMarkRead)
                clearLocalUnreadState(for: response.thread ?? thread, bookingIDs: bookingIDsToMarkRead)
            } else if let businessID = thread.businessID, !businessID.isEmpty {
                clearLocalUnreadState(for: thread, bookingIDs: [])
            }
            messagesError = nil
        } catch {
            // Fallback for deployments that may not support `thread_business_id` yet.
            if let fallbackBookingID = inferredBookingIDForThread(thread) {
                do {
                    let fallback = try await fetchMessages(bookingID: fallbackBookingID, limit: 40)
                    let hydratedMessages = deduplicatedMessages(fallback.messages)
                    messages = hydratedMessages
                    threadMessageCache[threadCacheKey] = hydratedMessages
                    prefetchMessageMedia(hydratedMessages, limit: 16)
                    messageCursor = messages.first?.createdAt
                    hasMoreMessages = fallback.hasMore ?? false
                    activeThreadBookingID = fallbackBookingID
                    messagesError = nil
                    return
                } catch {
                    // continue to cached/error handling
                }
            }
            if let cachedMessages, !cachedMessages.isEmpty {
                messages = cachedMessages
            } else {
                messages = []
                messagesError = error.localizedDescription
            }
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
            guard let queryItems = messageQueryItems(
                for: thread,
                limit: 40,
                after: last,
                bookingOverride: activeThreadBookingID
            ) else {
                return
            }
            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: queryItems,
                requiresAuth: true
            )
            let incoming = response.messages

            if !incoming.isEmpty {
                let existing = Set(messages.map(\.id))
                let newMessages = incoming.filter { !existing.contains($0.id) }
                messages.append(contentsOf: newMessages)
                messages.sort { $0.createdAt < $1.createdAt }
                threadMessageCache[cacheKey(for: thread)] = messages
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
            guard let queryItems = messageQueryItems(
                for: thread,
                limit: 40,
                before: cursor,
                bookingOverride: activeThreadBookingID
            ) else {
                return
            }
            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: queryItems,
                requiresAuth: true
            )
            let incoming = response.messages

            if !incoming.isEmpty {
                let existing = Set(messages.map(\.id))
                let newMessages = incoming.filter { !existing.contains($0.id) }
                messages.insert(contentsOf: newMessages, at: 0)
                messages.sort { $0.createdAt < $1.createdAt }
                messageCursor = messages.first?.createdAt
                threadMessageCache[cacheKey(for: thread)] = messages
            }
            hasMoreMessages = response.hasMore ?? (response.messages.count >= 40)
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
            // Include legacy fields too so mixed backend versions never drop scheduling.
            scheduledStart: scheduledStart.map { formatter.string(from: $0) },
            scheduledEnd: scheduledEnd.map { formatter.string(from: $0) },
            timezone: tz,
            servicePriceCents: servicePriceCents
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
            let shouldTryLegacy = errorMessage.contains("unexpected fields")
                || errorMessage.contains("scheduled_start")
                || errorMessage.contains("scheduled_end")
                || errorMessage.contains("status 500")
                || errorMessage.contains("status 502")
                || errorMessage.contains("status 503")
                || errorMessage.contains("status 504")
                || errorMessage.contains("internal server error")

            guard shouldTryLegacy else { throw error }

            do {
                // Fallback for older deployments that still expect scheduled_start/end.
                response = try await APIClient.shared.send(
                    path: "/api/bookings",
                    method: "POST",
                    body: legacyRequest,
                    requiresAuth: true
                )
            } catch {
                // Final fallback mirrors the public web contract (no explicit user_id field).
                // Some deployments reject direct user UUID linkage but still accept email-linked booking creation.
                let webCompatibleRequest = BookingCreateRequest(
                    businessID: businessID,
                    userID: nil,
                    service: service,
                    userName: userName,
                    userPhone: userPhone,
                    userEmail: userEmail,
                    note: note,
                    address: nil,
                    scheduledDate: scheduledStart.map { bookingDateFormatter.string(from: $0) },
                    scheduledSlot: scheduledStart.map { bookingSlotFormatter.string(from: $0) },
                    scheduledStart: scheduledStart.map { formatter.string(from: $0) },
                    scheduledEnd: scheduledEnd.map { formatter.string(from: $0) },
                    timezone: tz,
                    servicePriceCents: servicePriceCents
                )
                do {
                    response = try await APIClient.shared.send(
                        path: "/api/bookings",
                        method: "POST",
                        body: webCompatibleRequest,
                        requiresAuth: true
                    )
                } catch {
                    // Public web fallback for deployments that don't accept auth-linked booking create payloads.
                    response = try await APIClient.shared.send(
                        path: "/api/bookings",
                        method: "POST",
                        body: webCompatibleRequest,
                        requiresAuth: false
                    )
                }
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
    func submitReview(
        bookingID: String,
        businessID: String,
        rating: Int,
        comment: String,
        reviewMediaURLs: [String] = []
    ) async throws {
        isSubmittingReview = true
        reviewError = nil
        defer { isSubmittingReview = false }

        let _: ReviewResponse = try await APIClient.shared.send(
            path: "/api/reviews",
            method: "POST",
            body: ReviewRequest(
                bookingID: bookingID,
                businessID: businessID,
                rating: rating,
                comment: comment,
                reviewMediaURLs: reviewMediaURLs
            ),
            requiresAuth: true
        )
        if let existing = bookings.first(where: { $0.id == bookingID }) {
            replaceLocalBooking(
                bookingID: bookingID,
                status: existing.status,
                reviewed: true
            )
        }
    }

    func loadReviews(for businessID: String) async throws -> [BusinessReview] {
        let response: ReviewsResponse = try await APIClient.shared.get(
            path: "/api/reviews",
            queryItems: [.init(name: "business_id", value: businessID)]
        )
        return response.reviews
    }

    func hasSubmittedReview(for businessID: String) async -> Bool {
        do {
            let response: ReviewStatusResponse = try await APIClient.shared.get(
                path: "/api/reviews",
                queryItems: [
                    .init(name: "business_id", value: businessID),
                    .init(name: "check_user", value: "1"),
                ],
                requiresAuth: true
            )
            return response.hasUserReviewed
        } catch {
            return false
        }
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

    /// Creates a payment-first native PaymentIntent for Apple Pay (no booking row created yet).
    func createNativeApplePayIntent(request: ApplePayCheckoutIntentRequest) async throws -> NativeApplePayIntentResponse {
        let response: NativeApplePayIntentResponse = try await APIClient.shared.send(
            path: "/api/mobile-native-checkout-intent",
            method: "POST",
            body: request,
            requiresAuth: true
        )
        if let error = response.error, !error.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw DataStoreError.server(error)
        }
        guard response.clientSecret != nil else {
            throw DataStoreError.server("Secure checkout is temporarily unavailable. Please try again.")
        }
        return response
    }

    /// Marks booking as cancelled and mirrors that change in the local bookings array.
    func cancelBooking(bookingID: String) async throws {
        do {
            let _: GenericSuccessResponse = try await sendCancelBookingRequest(bookingID: bookingID)
            replaceLocalBooking(
                bookingID: bookingID,
                status: "cancelled"
            )
            return
        } catch {
            let message = error.localizedDescription.lowercased()
            if message.contains("status 429") || message.contains("too many") {
                // Backoff for transient rate limits before failing the cancel action.
                try? await Task.sleep(nanoseconds: 450_000_000)
                do {
                    let _: GenericSuccessResponse = try await sendCancelBookingRequest(bookingID: bookingID)
                    replaceLocalBooking(
                        bookingID: bookingID,
                        status: "cancelled"
                    )
                    return
                } catch {
                    // Final resilience path for temporary API gateway throttling.
                    try await cancelBookingViaSupabase(bookingID: bookingID)
                    return
                }
            }
            throw error
        }
    }

    private func sendCancelBookingRequest(bookingID: String) async throws -> GenericSuccessResponse {
        try await APIClient.shared.send(
            path: "/api/bookings",
            method: "PATCH",
            body: UpdateBookingStatusRequest(bookingID: bookingID, status: "cancelled"),
            requiresAuth: true
        )
    }

    /// Temporary direct fallback path used only when booking PATCH is rate-limited upstream.
    private func cancelBookingViaSupabase(bookingID: String) async throws {
        struct CancelledBookingRow: Decodable {
            let id: String
        }
        let _: PostgrestResponse<CancelledBookingRow> = try await SupabaseManager.shared.client
            .from("bookings")
            .update(["status": "cancelled"])
            .eq("id", value: bookingID)
            .select("id")
            .single()
            .execute()
        replaceLocalBooking(
            bookingID: bookingID,
            status: "cancelled"
        )
    }

    /// Provider-side completion proof submission.
    /// Requires at least a note or one photo, then marks booking completed immediately.
    func submitProviderCompletionProof(
        bookingID: String,
        note: String?,
        photoURLs: [String],
        coordinate: CLLocationCoordinate2D? = nil
    ) async throws {
        let trimmedNote = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !(trimmedNote?.isEmpty ?? true) || !photoURLs.isEmpty else {
            throw DataStoreError.server("Add at least one photo or a completion note before marking complete.")
        }

        do {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/bookings/complete-proof",
                method: "POST",
                body: SubmitBookingCompletionProofRequest(
                    bookingID: bookingID,
                    note: trimmedNote,
                    photoURLs: photoURLs,
                    geoLat: coordinate?.latitude,
                    geoLng: coordinate?.longitude
                ),
                requiresAuth: true
            )
        } catch {
            // Fallback for deployments that only support generic booking status updates.
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/bookings",
                method: "PATCH",
                body: UpdateBookingStatusRequest(bookingID: bookingID, status: "completed"),
                requiresAuth: true
            )
        }

        replaceLocalBooking(
            bookingID: bookingID,
            status: "completed",
            completionProofNote: trimmedNote,
            completionProofPhotoURLs: photoURLs.compactMap(URL.init(string:)),
            completionProofSubmittedAt: Date(),
            completionProofLatitude: coordinate?.latitude,
            completionProofLongitude: coordinate?.longitude,
            consumerConfirmationDeadlineAt: Date().addingTimeInterval(TimeInterval(defaultDisputeWindowHours * 60 * 60)),
            fundsStatus: "released"
        )
    }

    /// Legacy consumer confirmation endpoint kept for backward compatibility.
    /// The app flow is provider-first completion and no consumer complete action.
    func confirmBookingCompletion(bookingID: String) async throws {
        do {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/bookings/confirm-completion",
                method: "POST",
                body: ConfirmBookingCompletionRequest(bookingID: bookingID),
                requiresAuth: true
            )
        } catch {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/bookings",
                method: "PATCH",
                body: UpdateBookingStatusRequest(bookingID: bookingID, status: "completed"),
                requiresAuth: true
            )
        }

        replaceLocalBooking(
            bookingID: bookingID,
            status: "completed",
            fundsStatus: "released"
        )
    }

    /// Consumer opens a dispute during the dispute window.
    /// Funds remain held while the platform resolves the case.
    func openBookingDispute(
        bookingID: String,
        reason: String,
        details: String?,
        photoURLs: [String]
    ) async throws {
        let trimmedReason = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedReason.isEmpty else {
            throw DataStoreError.server("Choose a dispute reason before submitting.")
        }
        let trimmedDetails = details?.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/bookings/dispute",
                method: "POST",
                body: OpenBookingDisputeRequest(
                    bookingID: bookingID,
                    reason: trimmedReason,
                    details: trimmedDetails,
                    photoURLs: photoURLs
                ),
                requiresAuth: true
            )
        } catch {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/bookings",
                method: "PATCH",
                body: UpdateBookingStatusRequest(bookingID: bookingID, status: "disputed"),
                requiresAuth: true
            )
        }

        replaceLocalBooking(
            bookingID: bookingID,
            status: "disputed",
            disputeReason: trimmedReason,
            disputeDetails: trimmedDetails,
            disputePhotoURLs: photoURLs.compactMap(URL.init(string:)),
            disputedAt: Date(),
            fundsStatus: "held"
        )
    }

    // MARK: - Messaging (continued)

    /// Sends a user message for the active thread's booking and updates in-memory thread preview.
    func sendMessage(_ content: String) async {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
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
                threadMessageCache[cacheKey(for: updatedThread)] = messages
                if let index = threads.firstIndex(where: { $0.id == updatedThread.id }) {
                    threads[index] = updatedThread
                }
            }
        } catch {
            messagesError = error.localizedDescription
        }
    }

    private func fetchMessages(bookingID: String, limit: Int) async throws -> MessagesResponse {
        try await fetchMessagesPage(bookingID: bookingID, limit: limit)
    }

    private func messageQueryItems(
        for thread: MessageThread,
        limit: Int,
        before: Date? = nil,
        after: Date? = nil,
        bookingOverride: String? = nil
    ) -> [URLQueryItem]? {
        let formatter = ISO8601DateFormatter()
        var items: [URLQueryItem] = [.init(name: "limit", value: String(limit))]

        if let businessID = thread.businessID?.trimmingCharacters(in: .whitespacesAndNewlines), !businessID.isEmpty {
            items.append(.init(name: "thread_business_id", value: businessID))
        } else if let bookingID = bookingOverride?.trimmingCharacters(in: .whitespacesAndNewlines), !bookingID.isEmpty {
            items.append(.init(name: "booking_id", value: bookingID))
        } else if let bookingID = thread.bookingID?.trimmingCharacters(in: .whitespacesAndNewlines), !bookingID.isEmpty {
            items.append(.init(name: "booking_id", value: bookingID))
        } else if let bookingID = thread.bookingIDs?.first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
            items.append(.init(name: "booking_id", value: bookingID))
        } else {
            return nil
        }

        if let before {
            items.append(.init(name: "before", value: formatter.string(from: before)))
        }
        if let after {
            items.append(.init(name: "after", value: formatter.string(from: after)))
        }
        return items
    }

    private func fetchMessagesPage(
        bookingID: String,
        limit: Int,
        before: Date? = nil,
        after: Date? = nil
    ) async throws -> MessagesResponse {
        let formatter = ISO8601DateFormatter()
        var queryItems: [URLQueryItem] = [
            .init(name: "booking_id", value: bookingID),
            .init(name: "limit", value: String(limit))
        ]
        if let before {
            queryItems.append(.init(name: "before", value: formatter.string(from: before)))
        }
        if let after {
            queryItems.append(.init(name: "after", value: formatter.string(from: after)))
        }

        do {
            return try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: queryItems,
                requiresAuth: true
            )
        } catch {
            let fallbackMessages = try await fetchMessagesFromSupabase(
                bookingID: bookingID,
                limit: limit,
                before: before,
                after: after
            )
            return MessagesResponse(
                messages: fallbackMessages,
                thread: nil,
                hasMore: before != nil ? fallbackMessages.count >= limit : false
            )
        }
    }

    private func fetchMessagesFromSupabase(
        bookingID: String,
        limit: Int,
        before: Date? = nil,
        after: Date? = nil
    ) async throws -> [ConversationMessage] {
        var query = SupabaseManager.shared.client
            .from("messages")
            .select("id,booking_id,sender_type,content,image_url,message_type,read,created_at")
            .eq("booking_id", value: bookingID)

        let formatter = ISO8601DateFormatter()
        if let before {
            query = query.lt("created_at", value: formatter.string(from: before))
        }
        if let after {
            query = query.gt("created_at", value: formatter.string(from: after))
        }

        let response: PostgrestResponse<[ConversationMessage]> = try await query
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
        return response.value.sorted { $0.createdAt < $1.createdAt }
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
        // Allow deeper fan-out because business-merged threads can map to older booking IDs.
        return Array(unique.prefix(25))
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

    private func cacheKey(for thread: MessageThread) -> String {
        if let businessID = thread.businessID?.trimmingCharacters(in: .whitespacesAndNewlines), !businessID.isEmpty {
            return "biz:\(businessID)"
        }
        let ids = ((thread.bookingIDs ?? []) + [thread.bookingID ?? ""])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if !ids.isEmpty {
            return "bookings:\(ids.sorted().joined(separator: ","))"
        }
        return "thread:\(thread.id)"
    }

    private func clearThreadMessageCache(for thread: MessageThread) {
        let key = cacheKey(for: thread)
        threadMessageCache.removeValue(forKey: key)
        if let businessID = thread.businessID?.trimmingCharacters(in: .whitespacesAndNewlines), !businessID.isEmpty {
            threadMessageCache.removeValue(forKey: "biz:\(businessID)")
        }
    }

    private func prefetchMessageMedia(_ source: [ConversationMessage], limit: Int) {
        let urls = source
            .compactMap { messageMediaURL(for: $0) }
        guard !urls.isEmpty else { return }
        Task {
            await ImagePrefetcher.shared.prefetch(urls: urls, limit: limit)
        }
    }

    private func messageMediaURL(for message: ConversationMessage) -> URL? {
        if let imageURL = message.imageURL,
           let resolved = URL(string: imageURL)
                ?? URL(string: imageURL.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "") {
            return resolved
        }
        guard let candidate = URL(string: message.content), candidate.scheme != nil else {
            return nil
        }
        let ext = candidate.pathExtension.lowercased()
        let knownMediaExtensions: Set<String> = ["mp4", "mov", "m4v", "webm", "jpg", "jpeg", "png", "heic", "webp", "gif"]
        return knownMediaExtensions.contains(ext) ? candidate : nil
    }

    private func deriveCampusBusinessesFallback(schoolDomain: String?, campusTag: String?) -> [BusinessSummary] {
        let normalizedDomain = normalizedSchoolDomain(schoolDomain)
        let normalizedTag = normalizedCampusTag(campusTag)

        var localCandidates = businesses.filter { business in
            business.campusProvider == true
                || normalizedSchoolDomain(business.schoolDomain) != nil
                || normalizedCampusTag(business.campusSchoolName) != nil
        }

        if let normalizedDomain {
            let matchingDomain = localCandidates.filter { business in
                if let businessDomain = normalizedSchoolDomain(business.schoolDomain) {
                    return businessDomain == normalizedDomain
                }
                return normalizedCampusTag(business.campusSchoolName) == normalizedCampusTag(normalizedDomain.components(separatedBy: ".").first)
            }
            if !matchingDomain.isEmpty {
                localCandidates = matchingDomain
            }
        }

        if let normalizedTag {
            let matchingTag = localCandidates.filter { business in
                let businessTag = normalizedCampusTag(business.campusSchoolName)
                    ?? normalizedCampusTag(normalizedSchoolDomain(business.schoolDomain)?.components(separatedBy: ".").first)
                return businessTag == normalizedTag
            }
            if !matchingTag.isEmpty {
                localCandidates = matchingTag
            }
        }

        return localCandidates.sorted { lhs, rhs in
            let lhsScore = (lhs.rating ?? 0) * 100 + Double(lhs.reviewCount ?? 0)
            let rhsScore = (rhs.rating ?? 0) * 100 + Double(rhs.reviewCount ?? 0)
            if lhsScore == rhsScore {
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
            return lhsScore > rhsScore
        }
    }

    /// Defensive client-side gate: only allow EDU-campus providers for the current campus context.
    /// This prevents API regressions from leaking non-campus providers into Campus feed/featured.
    private func sanitizeCampusBusinesses(
        _ source: [BusinessSummary],
        schoolDomain: String?,
        campusTag: String?
    ) -> [BusinessSummary] {
        let normalizedDomain = normalizedSchoolDomain(schoolDomain)
        let normalizedTag = normalizedCampusTag(campusTag)

        var seen = Set<String>()
        return source
            .filter { business in
                guard business.campusProvider == true else { return false }

                let businessDomain = normalizedSchoolDomain(business.schoolDomain)
                let businessTag = normalizedCampusTag(business.campusSchoolName)
                    ?? normalizedCampusTag(businessDomain?.components(separatedBy: ".").first)

                if let normalizedDomain {
                    // Strict campus identity: when viewer has a verified school domain,
                    // provider must match that exact .edu domain.
                    return businessDomain == normalizedDomain
                }

                if let normalizedTag {
                    return businessTag == normalizedTag
                }

                return businessDomain != nil || businessTag != nil
            }
            .filter { seen.insert($0.id).inserted }
    }

    private func stabilizedCampusFeatured(
        from incomingFeatured: [BusinessSummary],
        allBusinesses: [BusinessSummary]
    ) -> [BusinessSummary] {
        // Keep existing featured card stable across refreshes to avoid jarring swaps.
        if let existing = campusFeatured.first,
           allBusinesses.contains(where: { $0.id == existing.id }) {
            return [existing]
        }
        if let firstIncoming = incomingFeatured.first {
            return [firstIncoming]
        }
        if let firstBusiness = allBusinesses.first {
            return [firstBusiness]
        }
        return []
    }

    private func fetchCampusBusinessesFromSupabase(schoolDomain: String?, campusTag: String?) async -> [BusinessSummary] {
        let normalizedDomain = normalizedSchoolDomain(schoolDomain)
        let normalizedTag = normalizedCampusTag(campusTag)

        do {
            let response: PostgrestResponse<[NearbyBusinessRow]>
            do {
                if let normalizedDomain {
                    response = try await SupabaseManager.shared.client
                        .from("businesses")
                        .select("id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,public_visibility,public_show_name,school_domain,campus_school_name,is_onboarded")
                        .eq("campus_provider", value: true)
                        .eq("is_onboarded", value: true)
                        .eq("school_domain", value: normalizedDomain)
                        .limit(120)
                        .execute()
                } else if let normalizedTag {
                    response = try await SupabaseManager.shared.client
                        .from("businesses")
                        .select("id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,public_visibility,public_show_name,school_domain,campus_school_name,is_onboarded")
                        .eq("campus_provider", value: true)
                        .eq("is_onboarded", value: true)
                        .eq("campus_school_name", value: normalizedTag)
                        .limit(120)
                        .execute()
                } else {
                    response = try await SupabaseManager.shared.client
                        .from("businesses")
                        .select("id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,public_visibility,public_show_name,school_domain,campus_school_name,is_onboarded")
                        .eq("campus_provider", value: true)
                        .eq("is_onboarded", value: true)
                        .limit(120)
                        .execute()
                }
            } catch {
                if let normalizedDomain {
                    response = try await SupabaseManager.shared.client
                        .from("businesses")
                        .select("id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,public_visibility,public_show_name,school_domain,campus_school_name")
                        .eq("campus_provider", value: true)
                        .eq("school_domain", value: normalizedDomain)
                        .limit(120)
                        .execute()
                } else if let normalizedTag {
                    response = try await SupabaseManager.shared.client
                        .from("businesses")
                        .select("id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,public_visibility,public_show_name,school_domain,campus_school_name")
                        .eq("campus_provider", value: true)
                        .eq("campus_school_name", value: normalizedTag)
                        .limit(120)
                        .execute()
                } else {
                    response = try await SupabaseManager.shared.client
                        .from("businesses")
                        .select("id,name,slug,description,address,lat,lng,service_tags,cover_url,media_urls,phone,website,calendly_url,rating,review_count,price_tier,founder50,availability_status,campus_provider,public_visibility,public_show_name,school_domain,campus_school_name")
                        .eq("campus_provider", value: true)
                        .limit(120)
                        .execute()
                }
            }

            return response.value
                .map { campusBusinessSummary(from: $0) }
                .sorted {
                    let leftScore = ($0.rating ?? 0) * 100 + Double($0.reviewCount ?? 0)
                    let rightScore = ($1.rating ?? 0) * 100 + Double($1.reviewCount ?? 0)
                    return leftScore == rightScore
                        ? $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
                        : leftScore > rightScore
                }
        } catch {
            return []
        }
    }

    private func campusBusinessSummary(from row: NearbyBusinessRow) -> BusinessSummary {
        BusinessSummary(
            id: row.id,
            name: row.name ?? "Student provider",
            slug: row.slug,
            description: row.description,
            address: row.address,
            lat: row.lat,
            lng: row.lng,
            serviceTags: row.serviceTags ?? [],
            coverURL: BusinessSummary.resolveRemoteURL(from: row.coverURL),
            mediaURLs: (row.mediaURLs ?? []).compactMap(BusinessSummary.resolveRemoteURL(from:)),
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

    private func normalizedSchoolDomain(_ value: String?) -> String? {
        guard let raw = value?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let lowered = raw
            .replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
            .replacingOccurrences(of: "www.", with: "")
            .lowercased()
        guard !lowered.isEmpty else { return nil }
        if lowered.contains(".edu") {
            return lowered
        }
        return nil
    }

    private func normalizedCampusTag(_ value: String?) -> String? {
        guard let raw = value?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let cleaned = raw.replacingOccurrences(of: ".edu", with: "", options: .caseInsensitive)
        guard !cleaned.isEmpty else { return nil }
        return cleaned.uppercased()
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
        mediaType: String,
        appendLocally: Bool = true
    ) async throws -> ConversationMessage {
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
            if appendLocally {
                messages.append(response.message)
                if let activeThread {
                    threadMessageCache[cacheKey(for: activeThread)] = messages
                }
            }
            return response.message
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
            if appendLocally {
                messages.append(response.message)
                if let activeThread {
                    threadMessageCache[cacheKey(for: activeThread)] = messages
                }
            }
            return response.message
        }
    }

    /// Uploads booking evidence and returns a public URL without posting to chat.
    func uploadBookingEvidence(
        bookingID: String,
        data: Data,
        mimeType: String,
        fileName: String,
        mediaType: String = "image"
    ) async throws -> String {
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
            throw DataStoreError.server(upload.error ?? "Failed to upload evidence.")
        }
        return mediaURL
    }

    /// Marks all given booking thread IDs as read for the current consumer.
    func markThreadRead(bookingIDs: [String]) async {
        let normalizedIDs = Set(bookingIDs.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
        for bookingID in normalizedIDs {
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

        if !normalizedIDs.isEmpty {
            let active = activeThread
            clearLocalUnreadState(for: active ?? MessageThread(
                id: "local-read",
                businessID: nil,
                bookingID: nil,
                bookingIDs: Array(normalizedIDs),
                service: "Conversation",
                status: "pending",
                createdAt: Date(),
                businesses: nil,
                lastMessage: nil,
                unreadCount: 0
            ), bookingIDs: Array(normalizedIDs))
        }
    }

    private func clearLocalUnreadState(for sourceThread: MessageThread, bookingIDs: [String]) {
        let normalizedIDs = Set(bookingIDs.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
        let sourceBusinessID = sourceThread.businessID?.trimmingCharacters(in: .whitespacesAndNewlines)
        let sourceID = sourceThread.id.trimmingCharacters(in: .whitespacesAndNewlines)

        threads = threads.map { existing in
            let existingBusinessID = existing.businessID?.trimmingCharacters(in: .whitespacesAndNewlines)
            let existingIDs = Set(((existing.bookingIDs ?? []) + [existing.bookingID ?? ""])
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty })

            let matchesBusiness = sourceBusinessID != nil && existingBusinessID == sourceBusinessID
            let matchesThreadID = !sourceID.isEmpty && existing.id == sourceID
            let matchesBookingID = !normalizedIDs.isEmpty && !existingIDs.isDisjoint(with: normalizedIDs)

            guard matchesBusiness || matchesThreadID || matchesBookingID else { return existing }
            return MessageThread(
                id: existing.id,
                businessID: existing.businessID,
                bookingID: existing.bookingID,
                bookingIDs: existing.bookingIDs,
                service: existing.service,
                status: existing.status,
                createdAt: existing.createdAt,
                businesses: existing.businesses,
                lastMessage: existing.lastMessage,
                unreadCount: 0
            )
        }
    }

    /// Returns authenticated user UUID for endpoints that require explicit `user_id`.
    private func currentUserID() async throws -> String {
        let session = try await SupabaseManager.shared.client.auth.session
        return session.user.id.uuidString
    }

    private func replaceLocalBooking(
        bookingID: String,
        status: String,
        completionProofNote: String? = nil,
        completionProofPhotoURLs: [URL]? = nil,
        completionProofSubmittedAt: Date? = nil,
        completionProofLatitude: Double? = nil,
        completionProofLongitude: Double? = nil,
        consumerConfirmationDeadlineAt: Date? = nil,
        disputeReason: String? = nil,
        disputeDetails: String? = nil,
        disputePhotoURLs: [URL]? = nil,
        disputedAt: Date? = nil,
        fundsStatus: String? = nil,
        reviewed: Bool? = nil
    ) {
        guard let index = bookings.firstIndex(where: { $0.id == bookingID }) else { return }
        let existing = bookings[index]
        bookings[index] = BookingSummary(
            id: existing.id,
            service: existing.service,
            status: status,
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
            stripeSetupIntentID: existing.stripeSetupIntentID,
            completionProofNote: completionProofNote ?? existing.completionProofNote,
            completionProofPhotoURLs: completionProofPhotoURLs ?? existing.completionProofPhotoURLs,
            completionProofSubmittedAt: completionProofSubmittedAt ?? existing.completionProofSubmittedAt,
            completionProofUploaderID: existing.completionProofUploaderID,
            completionProofLatitude: completionProofLatitude ?? existing.completionProofLatitude,
            completionProofLongitude: completionProofLongitude ?? existing.completionProofLongitude,
            consumerConfirmationDeadlineAt: consumerConfirmationDeadlineAt ?? existing.consumerConfirmationDeadlineAt,
            disputeReason: disputeReason ?? existing.disputeReason,
            disputeDetails: disputeDetails ?? existing.disputeDetails,
            disputePhotoURLs: disputePhotoURLs ?? existing.disputePhotoURLs,
            disputedAt: disputedAt ?? existing.disputedAt,
            fundsStatus: fundsStatus ?? existing.fundsStatus,
            reviewed: reviewed ?? existing.reviewed
        )
    }
}

// MARK: - Image Prefetching

private actor ImagePrefetcher {
    static let shared = ImagePrefetcher()

    private var warmedURLs: Set<URL> = []
    private init() {}

    func prefetch(urls: [URL], limit: Int = 48) {
        guard !urls.isEmpty else { return }
        let capped = max(0, limit)
        guard capped > 0 else { return }

        for url in urls.prefix(capped) {
            guard warmedURLs.insert(url).inserted else { continue }

            var request = URLRequest(url: url)
            request.cachePolicy = .returnCacheDataElseLoad
            Task.detached(priority: .utility) {
                _ = try? await APIClient.shared.dataResponse(
                    for: request,
                    requiresAuth: false,
                    category: .media
                )
            }
        }
    }
}
