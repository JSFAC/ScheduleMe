import Foundation
import Combine
import PostgREST
import Supabase

@MainActor
final class ProviderDataStore: ObservableObject {
    private struct EmptyBody: Encodable {}

    private struct BusinessRow: Decodable {
        let id: String
        let name: String?
        let ownerName: String?
        let ownerEmail: String?
        let phone: String?
        let address: String?
        let description: String?
        let website: String?
        let instagram: String?
        let coverURL: String?
        let mediaURLs: [String]?
        let serviceTags: [String]?
        let stripeOnboarded: Bool?
        let isOnboarded: Bool?
        let schoolDomain: String?
        let eduVerified: Bool?
        let founder50: Bool?
        let platformFeePercent: Double?
        let hours: [String: String]?
        let availabilityStatus: String?
        let customRequestRequiresExactTime: Bool?
        let ownerID: String?

        enum CodingKeys: String, CodingKey {
            case id
            case name
            case ownerName = "owner_name"
            case ownerEmail = "owner_email"
            case phone
            case address
            case description
            case website
            case instagram
            case coverURL = "cover_url"
            case mediaURLs = "media_urls"
            case serviceTags = "service_tags"
            case stripeOnboarded = "stripe_onboarded"
            case isOnboarded = "is_onboarded"
            case schoolDomain = "school_domain"
            case eduVerified = "edu_verified"
            case founder50
            case platformFeePercent = "platform_fee_percent"
            case hours
            case providerHours = "provider_hours"
            case businessHours = "business_hours"
            case hoursJSON = "hours_json"
            case availabilityStatus = "availability_status"
            case customRequestRequiresExactTime = "custom_request_requires_exact_time"
            case customRequestExactTime = "custom_request_exact_time"
            case customRequestsRequireExactTime = "custom_requests_require_exact_time"
            case ownerID = "owner_id"
        }

        private struct HourWindow: Decodable {
            let open: String?
            let close: String?
        }

        private struct HourEntry: Decodable {
            let day: String?
            let time: String?
            let open: String?
            let close: String?
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)

            id = try container.decode(String.self, forKey: .id)
            name = try? container.decodeIfPresent(String.self, forKey: .name)
            ownerName = try? container.decodeIfPresent(String.self, forKey: .ownerName)
            ownerEmail = try? container.decodeIfPresent(String.self, forKey: .ownerEmail)
            phone = try? container.decodeIfPresent(String.self, forKey: .phone)
            address = try? container.decodeIfPresent(String.self, forKey: .address)
            description = try? container.decodeIfPresent(String.self, forKey: .description)
            website = try? container.decodeIfPresent(String.self, forKey: .website)
            instagram = try? container.decodeIfPresent(String.self, forKey: .instagram)
            coverURL = try? container.decodeIfPresent(String.self, forKey: .coverURL)
            ownerID = try? container.decodeIfPresent(String.self, forKey: .ownerID)
            schoolDomain = try? container.decodeIfPresent(String.self, forKey: .schoolDomain)
            availabilityStatus = try? container.decodeIfPresent(String.self, forKey: .availabilityStatus)
            if let direct = Self.decodeFlexibleBool(container, key: .customRequestRequiresExactTime) {
                customRequestRequiresExactTime = direct
            } else if let alt = Self.decodeFlexibleBool(container, key: .customRequestExactTime) {
                customRequestRequiresExactTime = alt
            } else if let alt2 = Self.decodeFlexibleBool(container, key: .customRequestsRequireExactTime) {
                customRequestRequiresExactTime = alt2
            } else {
                customRequestRequiresExactTime = nil
            }

            if let array = try? container.decode([String].self, forKey: .mediaURLs) {
                mediaURLs = array
            } else if let single = try? container.decode(String.self, forKey: .mediaURLs) {
                mediaURLs = [single]
            } else {
                mediaURLs = nil
            }

            if let tags = try? container.decode([String].self, forKey: .serviceTags) {
                serviceTags = tags
            } else if let csv = try? container.decode(String.self, forKey: .serviceTags) {
                serviceTags = csv
                    .split(separator: ",")
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            } else {
                serviceTags = nil
            }

            stripeOnboarded = Self.decodeFlexibleBool(container, key: .stripeOnboarded)
            isOnboarded = Self.decodeFlexibleBool(container, key: .isOnboarded)
            eduVerified = Self.decodeFlexibleBool(container, key: .eduVerified)
            founder50 = Self.decodeFlexibleBool(container, key: .founder50)
            platformFeePercent = Self.decodeFlexibleDouble(container, key: .platformFeePercent)

            if let direct = try? container.decode([String: String].self, forKey: .hours) {
                hours = direct
            } else if let directProviderHours = try? container.decode([String: String].self, forKey: .providerHours) {
                hours = directProviderHours
            } else if let directBusinessHours = try? container.decode([String: String].self, forKey: .businessHours) {
                hours = directBusinessHours
            } else if let directHoursJSON = try? container.decode([String: String].self, forKey: .hoursJSON) {
                hours = directHoursJSON
            } else if let windows = try? container.decode([String: HourWindow].self, forKey: .hours) {
                var mapped: [String: String] = [:]
                for (day, window) in windows {
                    let open = (window.open ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    let close = (window.close ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !open.isEmpty || !close.isEmpty {
                        mapped[day] = close.isEmpty ? open : "\(open) - \(close)"
                    }
                }
                hours = mapped
            } else if let providerWindows = try? container.decode([String: HourWindow].self, forKey: .providerHours) {
                var mapped: [String: String] = [:]
                for (day, window) in providerWindows {
                    let open = (window.open ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    let close = (window.close ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !open.isEmpty || !close.isEmpty {
                        mapped[day] = close.isEmpty ? open : "\(open) - \(close)"
                    }
                }
                hours = mapped
            } else if let businessWindows = try? container.decode([String: HourWindow].self, forKey: .businessHours) {
                var mapped: [String: String] = [:]
                for (day, window) in businessWindows {
                    let open = (window.open ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    let close = (window.close ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !open.isEmpty || !close.isEmpty {
                        mapped[day] = close.isEmpty ? open : "\(open) - \(close)"
                    }
                }
                hours = mapped
            } else if let hoursJSONWindows = try? container.decode([String: HourWindow].self, forKey: .hoursJSON) {
                var mapped: [String: String] = [:]
                for (day, window) in hoursJSONWindows {
                    let open = (window.open ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    let close = (window.close ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !open.isEmpty || !close.isEmpty {
                        mapped[day] = close.isEmpty ? open : "\(open) - \(close)"
                    }
                }
                hours = mapped
            } else if let entries = try? container.decode([HourEntry].self, forKey: .hours) {
                var mapped: [String: String] = [:]
                for entry in entries {
                    guard let day = entry.day?.trimmingCharacters(in: .whitespacesAndNewlines), !day.isEmpty else { continue }
                    if let formatted = Self.formattedHoursText(from: entry) {
                        mapped[day] = formatted
                    }
                }
                hours = mapped
            } else if let providerEntries = try? container.decode([HourEntry].self, forKey: .providerHours) {
                var mapped: [String: String] = [:]
                for entry in providerEntries {
                    guard let day = entry.day?.trimmingCharacters(in: .whitespacesAndNewlines), !day.isEmpty else { continue }
                    if let formatted = Self.formattedHoursText(from: entry) {
                        mapped[day] = formatted
                    }
                }
                hours = mapped
            } else if let businessEntries = try? container.decode([HourEntry].self, forKey: .businessHours) {
                var mapped: [String: String] = [:]
                for entry in businessEntries {
                    guard let day = entry.day?.trimmingCharacters(in: .whitespacesAndNewlines), !day.isEmpty else { continue }
                    if let formatted = Self.formattedHoursText(from: entry) {
                        mapped[day] = formatted
                    }
                }
                hours = mapped
            } else if let hoursJSONEntries = try? container.decode([HourEntry].self, forKey: .hoursJSON) {
                var mapped: [String: String] = [:]
                for entry in hoursJSONEntries {
                    guard let day = entry.day?.trimmingCharacters(in: .whitespacesAndNewlines), !day.isEmpty else { continue }
                    if let formatted = Self.formattedHoursText(from: entry) {
                        mapped[day] = formatted
                    }
                }
                hours = mapped
            } else if let hoursJSONString = try? container.decode(String.self, forKey: .hoursJSON) {
                if let data = hoursJSONString.data(using: .utf8),
                   let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
                    hours = decoded
                } else if let data = hoursJSONString.data(using: .utf8),
                          let decodedEntries = try? JSONDecoder().decode([HourEntry].self, from: data) {
                    var mapped: [String: String] = [:]
                    for entry in decodedEntries {
                        guard let day = entry.day?.trimmingCharacters(in: .whitespacesAndNewlines), !day.isEmpty else { continue }
                        if let formatted = Self.formattedHoursText(from: entry) {
                            mapped[day] = formatted
                        }
                    }
                    hours = mapped
                } else if let data = hoursJSONString.data(using: .utf8),
                          let decodedWindows = try? JSONDecoder().decode([String: HourWindow].self, from: data) {
                    var mapped: [String: String] = [:]
                    for (day, window) in decodedWindows {
                        let open = (window.open ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        let close = (window.close ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        if !open.isEmpty || !close.isEmpty {
                            mapped[day] = close.isEmpty ? open : "\(open) - \(close)"
                        }
                    }
                    hours = mapped
                } else {
                    hours = nil
                }
            } else {
                hours = nil
            }
        }

        private static func decodeFlexibleBool(
            _ container: KeyedDecodingContainer<CodingKeys>,
            key: CodingKeys
        ) -> Bool? {
            if let value = try? container.decode(Bool.self, forKey: key) {
                return value
            }
            if let intValue = try? container.decode(Int.self, forKey: key) {
                return intValue != 0
            }
            if let stringValue = try? container.decode(String.self, forKey: key) {
                switch stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
                case "true", "1", "yes", "y":
                    return true
                case "false", "0", "no", "n":
                    return false
                default:
                    return nil
                }
            }
            return nil
        }

        private static func decodeFlexibleDouble(
            _ container: KeyedDecodingContainer<CodingKeys>,
            key: CodingKeys
        ) -> Double? {
            if let value = try? container.decode(Double.self, forKey: key) {
                return value
            }
            if let intValue = try? container.decode(Int.self, forKey: key) {
                return Double(intValue)
            }
            if let stringValue = try? container.decode(String.self, forKey: key) {
                return Double(stringValue.trimmingCharacters(in: .whitespacesAndNewlines))
            }
            return nil
        }

        private static func formattedHoursText(from entry: HourEntry) -> String? {
            let time = (entry.time ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !time.isEmpty {
                return time
            }
            let open = (entry.open ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let close = (entry.close ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !open.isEmpty || !close.isEmpty else { return nil }
            return close.isEmpty ? open : "\(open) - \(close)"
        }
    }

    private struct BusinessMediaRow: Decodable {
        let coverURL: String?
        let mediaURLs: [String]?

        enum CodingKeys: String, CodingKey {
            case coverURL = "cover_url"
            case mediaURLs = "media_urls"
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            coverURL = try? container.decodeIfPresent(String.self, forKey: .coverURL)

            if let array = try? container.decode([String].self, forKey: .mediaURLs) {
                mediaURLs = array
            } else if let single = try? container.decode(String.self, forKey: .mediaURLs) {
                let trimmed = single.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmed.hasPrefix("["),
                   let data = trimmed.data(using: .utf8),
                   let decoded = try? JSONDecoder().decode([String].self, from: data) {
                    mediaURLs = decoded
                } else if trimmed.hasPrefix("{"), trimmed.hasSuffix("}") {
                    let values = trimmed
                        .dropFirst()
                        .dropLast()
                        .split(separator: ",")
                        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .map { $0.replacingOccurrences(of: "\"", with: "") }
                        .filter { !$0.isEmpty }
                    mediaURLs = values.isEmpty ? nil : values
                } else if trimmed.isEmpty {
                    mediaURLs = nil
                } else {
                    mediaURLs = [trimmed]
                }
            } else {
                mediaURLs = nil
            }
        }
    }

    private struct ProviderProfileUpdatePayload: Encodable {
        let name: String
        let ownerName: String
        let phone: String
        let address: String
        let description: String
        let website: String
        let instagram: String
        let coverURL: String?
        let mediaURLs: [String]
        let serviceTags: [String]

        enum CodingKeys: String, CodingKey {
            case name
            case ownerName = "owner_name"
            case phone
            case address
            case description
            case website
            case instagram
            case coverURL = "cover_url"
            case mediaURLs = "media_urls"
            case serviceTags = "service_tags"
        }
    }

    private struct ProviderLegacyProfileUpdatePayload: Encodable {
        let name: String
        let ownerName: String
        let phone: String
        let address: String
        let description: String
        let website: String
        let serviceTags: [String]

        enum CodingKeys: String, CodingKey {
            case name
            case ownerName = "owner_name"
            case phone
            case address
            case description
            case website
            case serviceTags = "service_tags"
        }
    }

    private struct HoursEntryPayload: Encodable {
        let day: String
        let time: String
    }

    private struct HoursArrayUpdatePayload: Encodable {
        let hours: [HoursEntryPayload]
    }

    private struct BusinessHoursArrayUpdatePayload: Encodable {
        let businessHours: [HoursEntryPayload]

        enum CodingKeys: String, CodingKey {
            case businessHours = "business_hours"
        }
    }

    private struct ProviderHoursArrayUpdatePayload: Encodable {
        let providerHours: [HoursEntryPayload]

        enum CodingKeys: String, CodingKey {
            case providerHours = "provider_hours"
        }
    }

    @Published private(set) var businessID: String?
    @Published private(set) var profile: ProviderProfile?
    @Published private(set) var bookings: [ProviderBookingSummary] = []
    @Published private(set) var threads: [ProviderMessageThread] = []
    @Published private(set) var services: [ProviderService] = []
    @Published private(set) var messagesByThreadID: [String: [ProviderConversationMessage]] = [:]

    @Published var errorMessage: String?
    @Published private(set) var isBootstrapping = false
    @Published private(set) var isLoadingBookings = false
    @Published private(set) var isLoadingThreads = false
    @Published private(set) var isLoadingServices = false

    @Published private(set) var hasResolvedAccessDecision = false
    @Published private(set) var hasCompletedInitialDataLoad = false
    @Published private(set) var lastLoadedAt: Date?
    private var ownerEmailForFallback: String?
    private var ownerIDForFallback: String?
    private var activeAuthFingerprint: String?
    private let refreshThrottleSeconds: TimeInterval = 20

    var pendingBookingsCount: Int {
        bookings.filter {
            let status = $0.status.lowercased()
            return status == "pending" || status == "payment_pending"
        }.count
    }

    var unreadMessagesCount: Int {
        threads.reduce(0) { $0 + $1.unreadCount }
    }

    var stripeBalance: ProviderStripeBalance {
        let platformFee = platformFeeRate
        let completedGross = bookings
            .filter {
                let status = $0.status.lowercased()
                return status == "completed"
            }
            .reduce(0) { $0 + ($1.amountCents ?? 0) }

        let month = Calendar.current.component(.month, from: Date())
        let year = Calendar.current.component(.year, from: Date())

        let thisMonthCompletedGross = bookings
            .filter {
                let status = $0.status.lowercased()
                return status == "completed" &&
                Calendar.current.component(.month, from: $0.createdAt) == month &&
                Calendar.current.component(.year, from: $0.createdAt) == year
            }
            .reduce(0) { $0 + ($1.amountCents ?? 0) }

        // Escrow-style flow: paid bookings remain pending/active until completion.
        // Pending payout = customer has paid, provider has not completed.
        let pendingPayoutGross = bookings
            .filter {
                let status = $0.status.lowercased()
                return ($0.amountCents ?? 0) > 0 &&
                    ($0.paidAt != nil || status == "paid") &&
                    status != "completed" &&
                    status != "cancelled"
            }
            .reduce(0) { $0 + ($1.amountCents ?? 0) }

        return ProviderStripeBalance(
            totalPayoutCents: Int(Double(completedGross) * (1 - platformFee)),
            thisMonthPayoutCents: Int(Double(thisMonthCompletedGross) * (1 - platformFee)),
            pendingPayoutCents: Int(Double(pendingPayoutGross) * (1 - platformFee))
        )
    }

    var platformFeePercent: Double {
        if let explicit = profile?.platformFeePercent, explicit > 0, explicit < 100 {
            return explicit
        }
        return (profile?.founder50 ?? false) ? 6 : 12
    }

    var platformFeeRate: Double {
        max(0, min(platformFeePercent / 100.0, 0.99))
    }

    var awaitingPayoutCount: Int {
        bookings.filter {
            let status = $0.status.lowercased()
            return ($0.amountCents ?? 0) > 0 &&
                ($0.paidAt != nil || status == "paid") &&
                status != "completed" &&
                status != "cancelled"
        }.count
    }

    var awaitingPayoutGrossCents: Int {
        bookings
            .filter {
                let status = $0.status.lowercased()
                return ($0.amountCents ?? 0) > 0 &&
                    ($0.paidAt != nil || status == "paid") &&
                    status != "completed" &&
                    status != "cancelled"
            }
            .reduce(0) { $0 + ($1.amountCents ?? 0) }
    }

    var awaitingPayoutNetCents: Int {
        Int(Double(awaitingPayoutGrossCents) * (1 - platformFeeRate))
    }

    func bootstrap(userEmail: String?, userID: String?) async {
        guard !isBootstrapping else { return }
        let trimmedEmail = userEmail?.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedUserID = userID?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (trimmedEmail?.isEmpty == false) || (trimmedUserID?.isEmpty == false) else {
            reset()
            return
        }
        let currentFingerprint = "\(trimmedUserID ?? "")|\(trimmedEmail?.lowercased() ?? "")"
        if let activeAuthFingerprint, activeAuthFingerprint != currentFingerprint {
            // Security boundary: never allow stale provider data to survive account switches.
            reset()
        }
        activeAuthFingerprint = currentFingerprint
        ownerEmailForFallback = trimmedEmail
        ownerIDForFallback = trimmedUserID

        isBootstrapping = true
        hasResolvedAccessDecision = false
        hasCompletedInitialDataLoad = false
        defer { isBootstrapping = false }

        do {
            try await loadBusinessProfile(ownerEmail: trimmedEmail, userID: trimmedUserID)
            errorMessage = nil
            hasResolvedAccessDecision = true
        } catch {
            let message = error.localizedDescription
            reset()
            activeAuthFingerprint = currentFingerprint
            ownerEmailForFallback = trimmedEmail
            ownerIDForFallback = trimmedUserID
            errorMessage = message
            // Never leave root routing in an unresolved loading state.
            // If verification fails, surface a blocker/error view instead of spinning forever.
            hasResolvedAccessDecision = true
        }
        if profile == nil {
            lastLoadedAt = Date()
            hasCompletedInitialDataLoad = true
            return
        }
        await refreshAll(force: true, prioritizeFastLoad: true)
    }

    func refreshAll(force: Bool = false, prioritizeFastLoad: Bool = false) async {
        if !force, isDataFresh(maxAge: refreshThrottleSeconds) {
            return
        }
        if businessID == nil {
            var fallbackEmail = ownerEmailForFallback?.isEmpty == false ? ownerEmailForFallback : nil
            var fallbackUserID = ownerIDForFallback?.isEmpty == false ? ownerIDForFallback : nil
            if fallbackUserID == nil {
                do {
                    let session = try await SupabaseManager.shared.client.auth.session
                    fallbackUserID = session.user.id.uuidString
                    if let sessionEmail = session.user.email?.trimmingCharacters(in: .whitespacesAndNewlines),
                       !sessionEmail.isEmpty {
                        fallbackEmail = sessionEmail
                    }
                    ownerIDForFallback = fallbackUserID
                    ownerEmailForFallback = fallbackEmail
                } catch {
                    // Keep existing fallbacks; next refresh will retry.
                }
            }
            try? await loadBusinessProfile(ownerEmail: fallbackEmail, userID: fallbackUserID)
        }
        guard businessID != nil else {
            // Keep refresh hot if startup identity/business resolution races.
            // This avoids blank dashboards that only recover after relogin.
            lastLoadedAt = nil
            hasCompletedInitialDataLoad = true
            return
        }
        if prioritizeFastLoad {
            async let profileTask: Void = safeRefreshBusinessProfileByID()
            async let bookingsTask: Void = loadBookings()
            _ = await (profileTask, bookingsTask)
            async let threadsTask: Void = loadThreads()
            async let servicesTask: Void = loadServices()
            _ = await (threadsTask, servicesTask)
            lastLoadedAt = Date()
        } else {
            async let profileTask: Void = safeRefreshBusinessProfileByID()
            async let bookingsTask: Void = loadBookings()
            async let threadsTask: Void = loadThreads()
            async let servicesTask: Void = loadServices()
            _ = await (profileTask, bookingsTask, threadsTask, servicesTask)
            lastLoadedAt = Date()
        }
        hasCompletedInitialDataLoad = true
    }

    func reset() {
        businessID = nil
        profile = nil
        bookings = []
        threads = []
        services = []
        messagesByThreadID = [:]
        hasResolvedAccessDecision = false
        hasCompletedInitialDataLoad = false
        lastLoadedAt = nil
        errorMessage = nil
        ownerEmailForFallback = nil
        ownerIDForFallback = nil
        activeAuthFingerprint = nil
    }

    func loadBookings() async {
        guard let businessID, !businessID.isEmpty else {
            if bookings.isEmpty {
                bookings = []
            }
            return
        }
        isLoadingBookings = true
        defer { isLoadingBookings = false }

        do {
            let response: ProviderBookingsResponse = try await APIClient.shared.get(
                path: "/api/bookings",
                queryItems: [URLQueryItem(name: "business_id", value: businessID)],
                requiresAuth: true
            )
            bookings = response.bookings
            if !threads.isEmpty {
                threads = normalizeThreads(threads)
            }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadThreads() async {
        guard let businessID, !businessID.isEmpty else {
            if threads.isEmpty {
                threads = []
            }
            return
        }
        isLoadingThreads = true
        defer { isLoadingThreads = false }

        do {
            let response: ProviderMessageThreadsResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: [URLQueryItem(name: "business_id", value: businessID)],
                requiresAuth: true
            )
            threads = normalizeThreads(response.threads)
            errorMessage = nil
        } catch {
            do {
                let fallbackThreads: [ProviderMessageThread] = try await APIClient.shared.get(
                    path: "/api/messages",
                    queryItems: [URLQueryItem(name: "business_id", value: businessID)],
                    requiresAuth: true
                )
                threads = normalizeThreads(fallbackThreads)
                errorMessage = nil
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func loadMessages(threadID: String) async {
        let threadMatch = threads.first { $0.id == threadID || $0.bookingID == threadID }
        let threadKey = conversationIdentityKey(for: threadMatch)
        let relatedThreadIDs = threads
            .filter { conversationIdentityKey(for: $0) == threadKey }
            .flatMap { [$0.id, $0.bookingID, $0.lastMessage?.bookingID] }
        let relatedBookingIDsFromBookings: [String] = {
            guard let matchedProfile = threadMatch?.profile else { return [] }
            let matchedID = matchedProfile.id?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let matchedEmail = matchedProfile.email?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let matchedName = matchedProfile.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return bookings
                .filter { booking in
                    let profile = booking.profile
                    let id = profile?.id?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    let email = profile?.email?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    let name = profile?.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
                    if let matchedIDValue = matchedID, !matchedIDValue.isEmpty,
                       let idValue = id, !idValue.isEmpty {
                        return idValue == matchedIDValue
                    }
                    if let matchedEmailValue = matchedEmail, !matchedEmailValue.isEmpty,
                       let emailValue = email, !emailValue.isEmpty {
                        return emailValue == matchedEmailValue
                    }
                    return !matchedName.isEmpty && matchedName != "customer" && name == matchedName
                }
                .map(\.id)
        }()
        let candidateBookingIDs = ([threadID, threadMatch?.id, threadMatch?.bookingID] + relatedThreadIDs + relatedBookingIDsFromBookings)
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .removingDuplicates()
        let businessIDValue = businessID
        var collectedFromAPI: [ProviderConversationMessage] = []
        let apiResults = await withTaskGroup(of: [ProviderConversationMessage].self) { group in
            for bookingID in candidateBookingIDs {
                group.addTask { @MainActor in
                    let query: [URLQueryItem] = [
                        URLQueryItem(name: "booking_id", value: bookingID),
                        URLQueryItem(name: "business_id", value: businessIDValue),
                        URLQueryItem(name: "limit", value: "250")
                    ].filter { ($0.value ?? "").isEmpty == false }
                    do {
                        let response: ProviderMessagesResponse = try await APIClient.shared.get(
                            path: "/api/messages",
                            queryItems: query,
                            requiresAuth: true
                        )
                        return response.messages
                    } catch {
                        do {
                            let fallbackMessages: [ProviderConversationMessage] = try await APIClient.shared.get(
                                path: "/api/messages",
                                queryItems: query,
                                requiresAuth: true
                            )
                            return fallbackMessages
                        } catch {
                            return []
                        }
                    }
                }
            }

            var merged: [ProviderConversationMessage] = []
            for await result in group {
                merged.append(contentsOf: result)
            }
            return merged
        }
        collectedFromAPI = apiResults

        if !collectedFromAPI.isEmpty {
            let deduped = Dictionary(grouping: collectedFromAPI, by: \.id).compactMap { $0.value.first }
            let sorted = deduped.sorted { $0.createdAt < $1.createdAt }
            for id in candidateBookingIDs {
                messagesByThreadID[id] = sorted
            }
            if let resolvedBookingID = sorted.first(where: { ($0.bookingID ?? "").isEmpty == false })?.bookingID,
               !resolvedBookingID.isEmpty {
                messagesByThreadID[resolvedBookingID] = sorted
            }
            errorMessage = nil
            return
        }
        do {
            var collected: [ProviderConversationMessage] = []
            for bookingID in candidateBookingIDs {
                let supaMessages: [ProviderConversationMessage] = try await SupabaseManager.shared.client
                    .from("messages")
                    .select("id, booking_id, sender_type, content, read, created_at, image_url, message_type")
                    .eq("booking_id", value: bookingID)
                    .order("created_at", ascending: true)
                    .execute()
                    .value
                collected.append(contentsOf: supaMessages)
            }
            let deduped = Dictionary(grouping: collected, by: \.id).compactMap { $0.value.first }
            let sorted = deduped.sorted { $0.createdAt < $1.createdAt }
            for id in candidateBookingIDs {
                messagesByThreadID[id] = sorted
            }
            errorMessage = nil
            return
        } catch {
            errorMessage = "Unable to load messages right now."
        }
    }

    private func conversationIdentityKey(for thread: ProviderMessageThread?) -> String {
        guard let thread else { return "unknown" }
        return threadIdentityKey(for: thread)
    }

    private func normalizeThreads(_ rawThreads: [ProviderMessageThread]) -> [ProviderMessageThread] {
        guard !rawThreads.isEmpty else { return [] }

        var grouped: [String: [ProviderMessageThread]] = [:]
        for thread in rawThreads {
            grouped[threadIdentityKey(for: thread), default: []].append(thread)
        }

        let merged = grouped.values.compactMap { group -> ProviderMessageThread? in
            guard let newest = group.max(by: { ($0.lastMessage?.createdAt ?? $0.createdAt) < ($1.lastMessage?.createdAt ?? $1.createdAt) }) else {
                return nil
            }

            let unreadTotal = group.reduce(0) { $0 + max(0, $1.unreadCount) }

            let selectedLastMessage = group
                .compactMap(\.lastMessage)
                .max(by: { $0.createdAt < $1.createdAt })

            let selectedProfile = newest.profile ?? profileForThread(newest)
            let selectedBookingID =
                newest.bookingID ??
                newest.lastMessage?.bookingID ??
                group.compactMap(\.bookingID).first

            return ProviderMessageThread(
                id: newest.id,
                bookingID: selectedBookingID,
                service: newest.service,
                status: newest.status,
                createdAt: newest.createdAt,
                profile: selectedProfile,
                lastMessage: selectedLastMessage ?? newest.lastMessage,
                unreadCount: unreadTotal
            )
        }

        return merged.sorted { ($0.lastMessage?.createdAt ?? $0.createdAt) > ($1.lastMessage?.createdAt ?? $1.createdAt) }
    }

    private func threadIdentityKey(for thread: ProviderMessageThread) -> String {
        if let id = thread.profile?.id?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !id.isEmpty {
            return "id:\(id)"
        }
        if let email = thread.profile?.email?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !email.isEmpty {
            return "email:\(email)"
        }
        if let bookingProfile = profileForThread(thread) {
            if let id = bookingProfile.id?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !id.isEmpty {
                return "booking-id:\(id)"
            }
            if let email = bookingProfile.email?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !email.isEmpty {
                return "booking-email:\(email)"
            }
            let name = bookingProfile.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if !name.isEmpty, name != "customer" {
                return "booking-name:\(name)"
            }
        }
        let display = thread.profile?.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if !display.isEmpty, display != "customer" {
            return "name:\(display)"
        }
        if let bookingID = thread.bookingID?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), !bookingID.isEmpty {
            return "booking:\(bookingID)"
        }
        return "thread:\(thread.id.lowercased())"
    }

    private func profileForThread(_ thread: ProviderMessageThread) -> ProviderCustomerProfile? {
        guard let bookingID = thread.bookingID?.trimmingCharacters(in: .whitespacesAndNewlines), !bookingID.isEmpty else {
            return nil
        }
        return bookings.first(where: { $0.id == bookingID })?.profile
    }

    @discardableResult
    func sendMessage(threadID: String, content: String) async throws -> ProviderConversationMessage {
        let body = ProviderSendMessageRequest(
            bookingID: threadID,
            senderType: "business",
            content: content,
            imageURL: nil
        )
        let response: ProviderSendMessageResponse = try await APIClient.shared.send(
            path: "/api/messages",
            method: "POST",
            body: body,
            requiresAuth: true
        )
        messagesByThreadID[threadID, default: []].append(response.message)
        messagesByThreadID[threadID] = (messagesByThreadID[threadID] ?? []).sorted { $0.createdAt < $1.createdAt }
        await loadThreads()
        return response.message
    }

    @discardableResult
    func markMessagesRead(threadID: String) async throws -> Bool {
        let body = ProviderMarkReadRequest(bookingID: threadID, readerType: "business")
        let _: ProviderSimpleSuccessResponse = try await APIClient.shared.send(
            path: "/api/messages",
            method: "PATCH",
            body: body,
            requiresAuth: true
        )
        await loadThreads()
        return true
    }

    @discardableResult
    func sendMessageAttachment(
        threadID: String,
        data: Data,
        mimeType: String,
        fileName: String,
        mediaType: String
    ) async throws -> ProviderConversationMessage {
        let mediaURL: String
        do {
            // Prefer the listing uploader because it is stable across environments.
            mediaURL = try await uploadListingMedia(
                data: data,
                mimeType: mimeType,
                fileName: fileName,
                mediaType: mediaType
            )
        } catch {
            let message = error.localizedDescription.lowercased()
            if message.contains("missing business id") || message.contains("invalid business id") {
                // Fallback to booking-based uploader if listing upload cannot resolve business context.
                let upload: ProviderUploadMessageMediaResponse = try await APIClient.shared.send(
                    path: "/api/upload-message-media",
                    method: "POST",
                    body: ProviderUploadMessageMediaRequest(
                        bookingID: threadID,
                        mediaType: mediaType,
                        fileData: data.base64EncodedString(),
                        fileType: mimeType,
                        fileName: fileName
                    ),
                    requiresAuth: true
                )
                guard let url = upload.url, !url.isEmpty else {
                    throw DataStoreError.server(upload.error ?? "Failed to upload media.")
                }
                mediaURL = url
            } else if message.contains("invalid media bucket") {
                // Last fallback for older servers with partially configured storage.
                mediaURL = try await uploadListingMedia(
                    data: data,
                    mimeType: mimeType,
                    fileName: fileName,
                    mediaType: mediaType
                )
            } else {
                throw error
            }
        }

        let body = ProviderSendMessageRequest(
            bookingID: threadID,
            senderType: "business",
            content: mediaType == "image" ? "Image attachment" : "Video attachment",
            imageURL: mediaURL
        )
        let response: ProviderSendMessageResponse = try await APIClient.shared.send(
            path: "/api/messages",
            method: "POST",
            body: body,
            requiresAuth: true
        )
        messagesByThreadID[threadID, default: []].append(response.message)
        messagesByThreadID[threadID] = (messagesByThreadID[threadID] ?? []).sorted { $0.createdAt < $1.createdAt }
        return response.message
    }

    @discardableResult
    func uploadListingMedia(
        data: Data,
        mimeType: String,
        fileName: String,
        mediaType: String
    ) async throws -> String {
        guard let businessID, !businessID.isEmpty else {
            throw DataStoreError.server("Missing business ID.")
        }

        let dataURL = "data:\(mimeType);base64,\(data.base64EncodedString())"
        let upload: ProviderUploadBusinessMediaResponse = try await APIClient.shared.send(
            path: "/api/upload-media",
            method: "POST",
            body: ProviderUploadBusinessMediaRequest(
                businessID: businessID,
                mediaType: mediaType,
                fileData: dataURL,
                fileType: mimeType,
                fileName: fileName
            ),
            requiresAuth: true
        )

        guard let url = upload.url, !url.isEmpty else {
            throw DataStoreError.server(upload.error ?? "Failed to upload media.")
        }
        return url
    }

    @discardableResult
    func uploadCompletionProofMedia(
        bookingID: String,
        data: Data,
        mimeType: String,
        fileName: String
    ) async throws -> String {
        do {
            let upload: ProviderUploadMessageMediaResponse = try await APIClient.shared.send(
                path: "/api/upload-message-media",
                method: "POST",
                body: ProviderUploadMessageMediaRequest(
                    bookingID: bookingID,
                    mediaType: "image",
                    fileData: data.base64EncodedString(),
                    fileType: mimeType,
                    fileName: fileName
                ),
                requiresAuth: true
            )
            if let mediaURL = upload.url, !mediaURL.isEmpty {
                return mediaURL
            }
            let message = (upload.error ?? "").lowercased()
            if message.contains("invalid media bucket") {
                return try await uploadListingMedia(
                    data: data,
                    mimeType: mimeType,
                    fileName: fileName,
                    mediaType: "image"
                )
            }
            throw DataStoreError.server(upload.error ?? "Failed to upload proof image.")
        } catch {
            let message = error.localizedDescription.lowercased()
            if message.contains("invalid media bucket") {
                return try await uploadListingMedia(
                    data: data,
                    mimeType: mimeType,
                    fileName: fileName,
                    mediaType: "image"
                )
            }
            throw error
        }
    }

    func loadServices() async {
        guard let businessID, !businessID.isEmpty else {
            if services.isEmpty {
                services = []
            }
            return
        }
        isLoadingServices = true
        defer { isLoadingServices = false }

        do {
            let response: ProviderServicesResponse = try await APIClient.shared.get(
                path: "/api/services",
                queryItems: [URLQueryItem(name: "business_id", value: businessID)]
            )
            services = response.services.sorted { ($0.sortOrder ?? 0) < ($1.sortOrder ?? 0) }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createService(
        name: String,
        description: String,
        priceCents: Int,
        durationMin: Int,
        requiresExactTime: Bool?
    ) async throws {
        guard let businessID else { throw DataStoreError.server("Missing business ID.") }
        let body = ProviderServiceCreateRequest(
            businessID: businessID,
            name: name,
            description: description.isEmpty ? nil : description,
            priceCents: priceCents,
            durationMin: durationMin,
            requiresExactTime: requiresExactTime
        )
        do {
            let _: ProviderServiceMutationResponse = try await APIClient.shared.send(
                path: "/api/services",
                method: "POST",
                body: body,
                requiresAuth: true
            )
        } catch {
            // Backward-compatible fallback for deployments that do not yet support requires_exact_time.
            let legacy = ProviderServiceCreateRequest(
                businessID: businessID,
                name: name,
                description: description.isEmpty ? nil : description,
                priceCents: priceCents,
                durationMin: durationMin,
                requiresExactTime: nil
            )
            do {
                let _: ProviderServiceMutationResponse = try await APIClient.shared.send(
                    path: "/api/services",
                    method: "POST",
                    body: legacy,
                    requiresAuth: true
                )
            } catch {
                // Additional compatibility fallback for deployments using exact_time_required naming.
                let compatibility = ProviderServiceCreateCompatibilityRequest(
                    businessID: businessID,
                    name: name,
                    description: description.isEmpty ? nil : description,
                    priceCents: priceCents,
                    durationMin: durationMin,
                    requiresExactTime: requiresExactTime
                )
                do {
                    let _: ProviderServiceMutationResponse = try await APIClient.shared.send(
                        path: "/api/services",
                        method: "POST",
                        body: compatibility,
                        requiresAuth: true
                    )
                } catch {
                    throw error
                }
            }
        }
        await loadServices()
    }

    func updateService(
        id: String,
        name: String,
        description: String,
        priceCents: Int,
        durationMin: Int,
        requiresExactTime: Bool?
    ) async throws {
        guard let businessID else { throw DataStoreError.server("Missing business ID.") }
        let body = ProviderServiceUpdateRequest(
            id: id,
            businessID: businessID,
            name: name,
            description: description.isEmpty ? nil : description,
            priceCents: priceCents,
            durationMin: durationMin,
            requiresExactTime: requiresExactTime
        )
        do {
            let _: ProviderServiceMutationResponse = try await APIClient.shared.send(
                path: "/api/services",
                method: "PATCH",
                body: body,
                requiresAuth: true
            )
        } catch {
            let legacy = ProviderServiceUpdateRequest(
                id: id,
                businessID: businessID,
                name: name,
                description: description.isEmpty ? nil : description,
                priceCents: priceCents,
                durationMin: durationMin,
                requiresExactTime: nil
            )
            do {
                let _: ProviderServiceMutationResponse = try await APIClient.shared.send(
                    path: "/api/services",
                    method: "PATCH",
                    body: legacy,
                    requiresAuth: true
                )
            } catch {
                // Additional compatibility fallback for deployments using service_id / exact_time_required naming.
                let compatibility = ProviderServiceUpdateCompatibilityRequest(
                    id: id,
                    businessID: businessID,
                    name: name,
                    description: description.isEmpty ? nil : description,
                    priceCents: priceCents,
                    durationMin: durationMin,
                    requiresExactTime: requiresExactTime
                )
                do {
                    let _: ProviderServiceMutationResponse = try await APIClient.shared.send(
                        path: "/api/services",
                        method: "PATCH",
                        body: compatibility,
                        requiresAuth: true
                    )
                } catch {
                    throw error
                }
            }
        }
        await loadServices()
    }

    func updateCustomRequestScheduling(requiresExactTime: Bool) async throws {
        guard let businessID else { throw DataStoreError.server("Missing business ID.") }

        let candidateColumns = [
            "custom_request_requires_exact_time",
            "custom_requests_require_exact_time",
            "custom_request_exact_time"
        ]

        var lastError: Error?
        for column in candidateColumns {
            do {
                try await SupabaseManager.shared.client
                    .from("businesses")
                    .update([column: requiresExactTime])
                    .eq("id", value: businessID)
                    .execute()

                if let profile {
                    self.profile = ProviderProfile(
                        id: profile.id,
                        name: profile.name,
                        ownerName: profile.ownerName,
                        ownerEmail: profile.ownerEmail,
                        phone: profile.phone,
                        address: profile.address,
                        description: profile.description,
                        website: profile.website,
                        instagram: profile.instagram,
                        coverURL: profile.coverURL,
                        mediaURLs: profile.mediaURLs,
                        serviceTags: profile.serviceTags,
                        stripeOnboarded: profile.stripeOnboarded,
                        isOnboarded: profile.isOnboarded,
                        schoolDomain: profile.schoolDomain,
                        eduVerified: profile.eduVerified,
                        founder50: profile.founder50,
                        platformFeePercent: profile.platformFeePercent,
                        hours: profile.hours,
                        availabilityStatus: profile.availabilityStatus,
                        customRequestRequiresExactTime: requiresExactTime
                    )
                }
                return
            } catch {
                lastError = error
            }
        }

        if let lastError {
            throw lastError
        }
    }

    func deleteService(id: String) async throws {
        guard let businessID else { throw DataStoreError.server("Missing business ID.") }
        let body = ProviderServiceDeleteRequest(id: id, businessID: businessID)
        let _: ProviderServiceMutationResponse = try await APIClient.shared.send(
            path: "/api/services",
            method: "DELETE",
            body: body,
            requiresAuth: true
        )
        await loadServices()
    }

    func confirmBooking(bookingID: String) async throws {
        try await updateBooking(bookingID: bookingID, status: "active")
    }

    func completeBooking(
        bookingID: String,
        proofNote: String,
        proofPhotoURLs: [String] = [],
        geoMetadata: [String: String]? = nil
    ) async throws {
        let trimmedNote = proofNote.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedPhotos = proofPhotoURLs.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        guard !trimmedNote.isEmpty || !cleanedPhotos.isEmpty else {
            throw DataStoreError.server("Add at least one completion proof item (note or photo).")
        }

        let body = ProviderUpdateBookingStatusRequest(
            bookingID: bookingID,
            action: "provider_submit_completion_proof",
            proofNote: trimmedNote.isEmpty ? nil : trimmedNote,
            proofPhotoURLs: cleanedPhotos.isEmpty ? nil : cleanedPhotos,
            geoMetadata: geoMetadata
        )
        do {
            let _: ProviderSimpleSuccessResponse = try await APIClient.shared.send(
                path: "/api/bookings",
                method: "PATCH",
                body: body,
                requiresAuth: true
            )
        } catch {
            // Compatibility path for older booking PATCH handlers that reject `action`.
            let message = error.localizedDescription.lowercased()
            if message.contains("unexpected fields: action") || message.contains("unexpected field") {
                struct LegacyCompleteBookingRequest: Encodable {
                    let bookingID: String
                    let status: String
                    let proofNote: String?
                    let proofPhotoURLs: [String]?
                    let geoMetadata: [String: String]?

                    enum CodingKeys: String, CodingKey {
                        case bookingID = "booking_id"
                        case status
                        case proofNote = "proof_note"
                        case proofPhotoURLs = "proof_photo_urls"
                        case geoMetadata = "geo_metadata"
                    }
                }

                let legacyBody = LegacyCompleteBookingRequest(
                    bookingID: bookingID,
                    status: "completed",
                    proofNote: trimmedNote.isEmpty ? nil : trimmedNote,
                    proofPhotoURLs: cleanedPhotos.isEmpty ? nil : cleanedPhotos,
                    geoMetadata: geoMetadata
                )
                let _: ProviderSimpleSuccessResponse = try await APIClient.shared.send(
                    path: "/api/bookings",
                    method: "PATCH",
                    body: legacyBody,
                    requiresAuth: true
                )
            } else {
                throw error
            }
        }
        await loadBookings()
    }

    func cancelBooking(bookingID: String) async throws {
        try await updateBooking(bookingID: bookingID, status: "cancelled")
    }

    func setBookingPrice(bookingID: String, amountCents: Int) async throws {
        let body = ProviderSetBookingAmountRequest(bookingID: bookingID, amountCents: amountCents)
        let response: ProviderSetBookingAmountResponse = try await APIClient.shared.send(
            path: "/api/set-booking-amount",
            method: "POST",
            body: body,
            requiresAuth: true
        )
        if response.ok != true {
            throw DataStoreError.server(response.error ?? "Unable to set booking price.")
        }
        await loadBookings()
    }

    func openStripeConnectURL() async throws -> URL {
        guard let businessID else { throw DataStoreError.server("Missing business ID.") }
        let body = ProviderStripeConnectRequest(businessId: businessID)
        let response: ProviderStripeConnectResponse = try await APIClient.shared.send(
            path: "/api/stripe-connect",
            method: "POST",
            body: body,
            requiresAuth: true
        )
        if let raw = response.url, let url = URL(string: raw) {
            return url
        }
        throw DataStoreError.server(response.error ?? "Unable to start Stripe setup.")
    }

    func deleteAccount() async throws {
        let _: ProviderSimpleSuccessResponse = try await APIClient.shared.send(
            path: "/api/delete-account",
            method: "POST",
            body: EmptyBody(),
            requiresAuth: true
        )
    }

    func updateAvailabilityStatus(_ status: String) async throws {
        guard let businessID else { throw DataStoreError.server("Missing business ID.") }
        try await SupabaseManager.shared.client
            .from("businesses")
            .update(["availability_status": status])
            .eq("id", value: businessID)
            .execute()

        if let profile {
            self.profile = ProviderProfile(
                id: profile.id,
                name: profile.name,
                ownerName: profile.ownerName,
                ownerEmail: profile.ownerEmail,
                phone: profile.phone,
                address: profile.address,
                description: profile.description,
                website: profile.website,
                instagram: profile.instagram,
                coverURL: profile.coverURL,
                mediaURLs: profile.mediaURLs,
                serviceTags: profile.serviceTags,
                stripeOnboarded: profile.stripeOnboarded,
                isOnboarded: profile.isOnboarded,
                schoolDomain: profile.schoolDomain,
                eduVerified: profile.eduVerified,
                founder50: profile.founder50,
                platformFeePercent: profile.platformFeePercent,
                hours: profile.hours,
                availabilityStatus: status,
                customRequestRequiresExactTime: profile.customRequestRequiresExactTime
            )
        }
    }

    func updateBusinessHours(_ hours: [String: String]) async throws {
        guard let businessID else { throw DataStoreError.server("Missing business ID.") }
        let normalizedInput = Dictionary(uniqueKeysWithValues: hours.map {
            ($0.key.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), $0.value)
        })
        let entries = normalizedInput
            .map { HoursEntryPayload(day: $0.key, time: $0.value) }
            .sorted { $0.day < $1.day }
        do {
            try await SupabaseManager.shared.client
                .from("businesses")
                .update(["hours": normalizedInput])
                .eq("id", value: businessID)
                .execute()
        } catch {
            do {
                try await SupabaseManager.shared.client
                    .from("businesses")
                    .update(["business_hours": normalizedInput])
                    .eq("id", value: businessID)
                    .execute()
            } catch {
                do {
                    try await SupabaseManager.shared.client
                        .from("businesses")
                        .update(HoursArrayUpdatePayload(hours: entries))
                        .eq("id", value: businessID)
                        .execute()
                } catch {
                    do {
                        try await SupabaseManager.shared.client
                            .from("businesses")
                            .update(BusinessHoursArrayUpdatePayload(businessHours: entries))
                            .eq("id", value: businessID)
                            .execute()
                    } catch {
                        do {
                            try await SupabaseManager.shared.client
                                .from("businesses")
                                .update(["provider_hours": normalizedInput])
                                .eq("id", value: businessID)
                                .execute()
                        } catch {
                            do {
                                try await SupabaseManager.shared.client
                                    .from("businesses")
                                    .update(ProviderHoursArrayUpdatePayload(providerHours: entries))
                                    .eq("id", value: businessID)
                                    .execute()
                            } catch {
                                do {
                                    try await SupabaseManager.shared.client
                                        .from("businesses")
                                        .update(["hours_json": normalizedInput])
                                        .eq("id", value: businessID)
                                        .execute()
                                } catch {
                                    if let hoursJSONString = try? String(data: JSONEncoder().encode(normalizedInput), encoding: .utf8) {
                                        try await SupabaseManager.shared.client
                                            .from("businesses")
                                            .update(["hours_json": hoursJSONString])
                                            .eq("id", value: businessID)
                                            .execute()
                                    } else {
                                        throw error
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if let profile {
            self.profile = ProviderProfile(
                id: profile.id,
                name: profile.name,
                ownerName: profile.ownerName,
                ownerEmail: profile.ownerEmail,
                phone: profile.phone,
                address: profile.address,
                description: profile.description,
                website: profile.website,
                instagram: profile.instagram,
                coverURL: profile.coverURL,
                mediaURLs: profile.mediaURLs,
                serviceTags: profile.serviceTags,
                stripeOnboarded: profile.stripeOnboarded,
                isOnboarded: profile.isOnboarded,
                schoolDomain: profile.schoolDomain,
                eduVerified: profile.eduVerified,
                founder50: profile.founder50,
                platformFeePercent: profile.platformFeePercent,
                hours: normalizedBusinessHours(normalizedInput),
                availabilityStatus: profile.availabilityStatus,
                customRequestRequiresExactTime: profile.customRequestRequiresExactTime
            )
        }
    }

    func updateProviderProfile(
        name: String,
        ownerName: String,
        phone: String,
        address: String,
        description: String? = nil,
        website: String,
        instagram: String? = nil,
        coverURL: String? = nil,
        mediaURLs: [String]? = nil,
        serviceTags: [String]
    ) async throws {
        guard let businessID else { throw DataStoreError.server("Missing business ID.") }
        let payload = ProviderProfileUpdatePayload(
            name: name,
            ownerName: ownerName,
            phone: phone,
            address: address,
            description: description ?? profile?.description ?? "",
            website: website,
            instagram: instagram ?? profile?.instagram ?? "",
            coverURL: (coverURL ?? profile?.coverURL)?.nilIfEmptyTrimmed,
            mediaURLs: mediaURLs ?? profile?.mediaURLs ?? [],
            serviceTags: serviceTags
        )
        do {
            try await SupabaseManager.shared.client
                .from("businesses")
                .update(payload)
                .eq("id", value: businessID)
                .execute()
        } catch {
            // Fallback for deployments where optional listing columns (instagram/cover/media) are absent.
            let legacy = ProviderLegacyProfileUpdatePayload(
                name: name,
                ownerName: ownerName,
                phone: phone,
                address: address,
                description: description ?? profile?.description ?? "",
                website: website,
                serviceTags: serviceTags
            )
            try await SupabaseManager.shared.client
                .from("businesses")
                .update(legacy)
                .eq("id", value: businessID)
                .execute()
        }

        if let profile {
            self.profile = ProviderProfile(
                id: profile.id,
                name: name,
                ownerName: ownerName,
                ownerEmail: profile.ownerEmail,
                phone: phone,
                address: address,
                description: description ?? profile.description,
                website: website,
                instagram: instagram ?? profile.instagram,
                coverURL: coverURL ?? profile.coverURL,
                mediaURLs: mediaURLs ?? profile.mediaURLs,
                serviceTags: serviceTags,
                stripeOnboarded: profile.stripeOnboarded,
                isOnboarded: profile.isOnboarded,
                schoolDomain: profile.schoolDomain,
                eduVerified: profile.eduVerified,
                founder50: profile.founder50,
                platformFeePercent: profile.platformFeePercent,
                hours: profile.hours,
                availabilityStatus: profile.availabilityStatus,
                customRequestRequiresExactTime: profile.customRequestRequiresExactTime
            )
        }
    }

    private func updateBooking(bookingID: String, status: String) async throws {
        let body = ProviderUpdateBookingStatusRequest(bookingID: bookingID, status: status)
        let _: ProviderSimpleSuccessResponse = try await APIClient.shared.send(
            path: "/api/bookings",
            method: "PATCH",
            body: body,
            requiresAuth: true
        )
        await loadBookings()
    }

    private func loadBusinessProfile(ownerEmail: String?, userID: String?) async throws {
        let selectFields = try await resolveBusinessSelectFields()

        var resolvedUserID = userID?.trimmingCharacters(in: .whitespacesAndNewlines)
        if resolvedUserID?.isEmpty == true {
            resolvedUserID = nil
        }

        var sessionEmail: String?
        if resolvedUserID == nil {
            do {
                let session = try await SupabaseManager.shared.client.auth.session
                resolvedUserID = session.user.id.uuidString
                sessionEmail = session.user.email
            } catch {
                resolvedUserID = nil
                sessionEmail = nil
            }
        } else {
            do {
                let session = try await SupabaseManager.shared.client.auth.session
                sessionEmail = session.user.email
            } catch {
                sessionEmail = nil
            }
        }

        guard let resolvedUserID, !resolvedUserID.isEmpty else {
            throw DataStoreError.server("No authenticated provider session found.")
        }
        if let ownerRow = try? await fetchBusinessRow(
            selectFields: selectFields,
            column: "owner_id",
            value: resolvedUserID
        ) {
            let supplementalMedia = try? await fetchBusinessMediaRow(businessID: ownerRow.id)
            applyBusinessRow(
                ownerRow,
                ownerEmailFallback: ownerEmail ?? sessionEmail ?? "",
                supplementalCoverURL: supplementalMedia?.coverURL,
                supplementalMediaURLs: supplementalMedia?.mediaURLs
            )
            return
        }

        // Legacy fallback: older rows may not have owner_id populated yet. We only allow this
        // path when owner_id on the matched row is empty and email matches authenticated user.
        var emailCandidates: [String] = []
        for raw in [ownerEmail, sessionEmail] {
            let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !trimmed.isEmpty else { continue }
            if !emailCandidates.contains(trimmed) { emailCandidates.append(trimmed) }
            let lowered = trimmed.lowercased()
            if !emailCandidates.contains(lowered) { emailCandidates.append(lowered) }
        }

        for email in emailCandidates {
            if let row = try? await fetchBusinessRow(selectFields: selectFields, column: "owner_email", value: email) {
                let rowOwnerID = row.ownerID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if rowOwnerID.isEmpty || rowOwnerID.lowercased() == resolvedUserID.lowercased() {
                    let supplementalMedia = try? await fetchBusinessMediaRow(businessID: row.id)
                    applyBusinessRow(
                        row,
                        ownerEmailFallback: ownerEmail ?? sessionEmail ?? "",
                        supplementalCoverURL: supplementalMedia?.coverURL,
                        supplementalMediaURLs: supplementalMedia?.mediaURLs
                    )
                    return
                }
            }
        }

        throw DataStoreError.server("Provider business profile not found for this account.")
    }

    private func fetchBusinessRow(selectFields: String, column: String, value: String) async throws -> BusinessRow {
        let response: PostgrestResponse<[BusinessRow]> = try await SupabaseManager.shared.client
            .from("businesses")
            .select(selectFields)
            .eq(column, value: value)
            .limit(1)
            .execute()
        if let first = response.value.first {
            return first
        }
        throw DataStoreError.server("Provider business profile not found for this account.")
    }

    private func refreshBusinessProfileByID() async throws {
        guard let businessID, !businessID.isEmpty else { return }
        let selectFields = try await resolveBusinessSelectFields()
        let row = try await fetchBusinessRow(selectFields: selectFields, column: "id", value: businessID)
        let supplementalMedia = try? await fetchBusinessMediaRow(businessID: businessID)
        applyBusinessRow(
            row,
            ownerEmailFallback: profile?.ownerEmail ?? ownerEmailForFallback ?? "",
            supplementalCoverURL: supplementalMedia?.coverURL,
            supplementalMediaURLs: supplementalMedia?.mediaURLs
        )
    }

    private func fetchBusinessMediaRow(businessID: String) async throws -> BusinessMediaRow {
        let candidates = [
            "id,cover_url,media_urls",
            "id,cover_url",
            "id,media_urls"
        ]

        var lastError: Error?
        for select in candidates {
            do {
                let response: PostgrestResponse<[BusinessMediaRow]> = try await SupabaseManager.shared.client
                    .from("businesses")
                    .select(select)
                    .eq("id", value: businessID)
                    .limit(1)
                    .execute()
                if let row = response.value.first {
                    return row
                }
            } catch {
                lastError = error
            }
        }
        if let lastError {
            throw lastError
        }
        throw DataStoreError.server("Unable to load listing media.")
    }

    private func resolveBusinessSelectFields() async throws -> String {
        // Try richest shape first, then gracefully fall back for older/mismatched schemas.
        let candidates = [
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,availability_status,owner_id",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,availability_status",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,founder50,platform_fee_percent,hours,provider_hours,business_hours,hours_json,availability_status,custom_request_requires_exact_time,custom_requests_require_exact_time,custom_request_exact_time,owner_id",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,founder50,platform_fee_percent,hours,business_hours,hours_json,availability_status,custom_request_requires_exact_time,custom_requests_require_exact_time,custom_request_exact_time,owner_id",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,founder50,platform_fee_percent,hours,business_hours,hours_json,availability_status,owner_id",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,provider_hours,business_hours,hours_json,availability_status,custom_request_requires_exact_time,custom_requests_require_exact_time,custom_request_exact_time,owner_id",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,provider_hours,business_hours,hours_json,availability_status,custom_request_requires_exact_time,custom_requests_require_exact_time,custom_request_exact_time",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,provider_hours,business_hours,hours_json",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,provider_hours,business_hours",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,business_hours,hours_json",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,business_hours,availability_status,owner_id",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,business_hours,availability_status",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,business_hours",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,provider_hours,business_hours,hours_json,availability_status,owner_id",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,provider_hours,business_hours,hours_json",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,business_hours,hours_json",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,business_hours,availability_status,owner_id",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours,business_hours",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified,hours",
            "id,name,owner_name,owner_email,phone,address,description,website,instagram,cover_url,media_urls,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified",
            "id,name,owner_name,owner_email,phone,address,description,website,service_tags,stripe_onboarded,is_onboarded,school_domain,edu_verified"
        ]

        for select in candidates {
            do {
                let _: PostgrestResponse<[BusinessRow]> = try await SupabaseManager.shared.client
                    .from("businesses")
                    .select(select)
                    .limit(1)
                    .execute()
                return select
            } catch {
                continue
            }
        }

        throw DataStoreError.server("Unable to read provider business schema.")
    }

    private func applyBusinessRow(
        _ row: BusinessRow,
        ownerEmailFallback: String,
        supplementalCoverURL: String? = nil,
        supplementalMediaURLs: [String]? = nil
    ) {
        businessID = row.id
        let normalizedHours = normalizedBusinessHours(row.hours ?? [:])
        let mergedMedia = {
            let rowMedia = row.mediaURLs ?? []
            if !rowMedia.isEmpty { return rowMedia }
            return supplementalMediaURLs ?? []
        }()
        let mergedCoverURL = row.coverURL ?? supplementalCoverURL
        let normalizedAvailabilityRaw = row.availabilityStatus?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let normalizedAvailability = (normalizedAvailabilityRaw?.isEmpty == false) ? normalizedAvailabilityRaw : nil
        let availability =
            normalizedAvailability ??
            profile?.availabilityStatus.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ??
            "open"
        hasResolvedAccessDecision = true
        profile = ProviderProfile(
            id: row.id,
            name: row.name ?? "Business",
            ownerName: row.ownerName ?? "",
            ownerEmail: row.ownerEmail ?? ownerEmailFallback,
            phone: row.phone ?? "",
            address: row.address ?? "",
            description: row.description ?? "",
            website: row.website ?? "",
            instagram: row.instagram ?? "",
            coverURL: mergedCoverURL,
            mediaURLs: mergedMedia,
            serviceTags: row.serviceTags ?? [],
            stripeOnboarded: row.stripeOnboarded ?? false,
            isOnboarded: row.isOnboarded ?? false,
            schoolDomain: row.schoolDomain,
            eduVerified: row.eduVerified ?? false,
            founder50: row.founder50 ?? false,
            platformFeePercent: row.platformFeePercent,
            hours: normalizedHours,
            availabilityStatus: availability,
            customRequestRequiresExactTime: row.customRequestRequiresExactTime ?? true
        )
    }

    private func normalizedBusinessHours(_ raw: [String: String]) -> [String: String] {
        let canonicalDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        let lowerLookup = Dictionary(uniqueKeysWithValues: raw.map { ($0.key.lowercased(), $0.value) })
        var normalized: [String: String] = [:]

        for day in canonicalDays {
            let key = day.lowercased()
            if let value = lowerLookup[key], !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                normalized[day] = value
            } else if let value = lowerLookup[String(key.prefix(3))], !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                normalized[day] = value
            }
        }

        return normalized
    }

    private func safeRefreshBusinessProfileByID() async {
        try? await refreshBusinessProfileByID()
    }

    private func isDataFresh(maxAge: TimeInterval) -> Bool {
        guard let lastLoadedAt else { return false }
        return Date().timeIntervalSince(lastLoadedAt) < maxAge
    }

    private func isProviderAccessDenied(message: String) -> Bool {
        let normalized = message.lowercased()
        return normalized.contains("provider business profile not found") ||
            normalized.contains("provider account ownership mismatch")
    }

}

private extension String {
    var nilIfEmptyTrimmed: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

private extension Array where Element: Hashable {
    func removingDuplicates() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
