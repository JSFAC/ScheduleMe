// FILE OVERVIEW:
// API request/response and domain model definitions used across the app.
//
// DEBUG NOTES:
// Decoding mismatches and field-name regressions are usually fixed here.

import Foundation

// MARK: - Business Feed + Profile Responses

struct NearbyBusinessesResponse: Decodable {
    let businesses: [BusinessSummary]
}

struct CampusBusinessesResponse: Decodable {
    let featured: [BusinessSummary]
    let businesses: [BusinessSummary]
}

struct BusinessProfileResponse: Decodable {
    let business: BusinessProfile?
}

struct BusinessProfile: Decodable {
    let id: String
    let name: String?
    let description: String?
    let hours: [String: String]?
    let calendlyURL: String?
    let availabilityStatus: String?
    let serviceTags: [String]?
    let coverURL: URL?
    let mediaURLs: [URL]?
    let customRequiresTime: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case hours
        case calendlyURL = "calendly_url"
        case availabilityStatus = "availability_status"
        case serviceTags = "service_tags"
        case coverURL = "cover_url"
        case mediaURLs = "media_urls"
        case customRequiresTime = "custom_requires_time"
    }

    private enum AlternateKeys: String, CodingKey {
        case providerHours = "provider_hours"
        case businessHours = "business_hours"
        case hoursJSON = "hours_json"
    }

    private struct BusinessHourEntry: Decodable {
        let day: String
        let time: String
    }

    private struct BusinessHourWindow: Decodable {
        let open: String?
        let close: String?
        let from: String?
        let to: String?

        var label: String? {
            let start = (open ?? from)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let end = (close ?? to)?.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let start, !start.isEmpty, let end, !end.isEmpty else { return nil }
            return "\(start) - \(end)"
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        calendlyURL = try container.decodeIfPresent(String.self, forKey: .calendlyURL)
        availabilityStatus = try container.decodeIfPresent(String.self, forKey: .availabilityStatus)
        if let tags = ((try? container.decodeIfPresent([String].self, forKey: .serviceTags)) ?? nil) {
            serviceTags = tags
        } else if let tagString = ((try? container.decodeIfPresent(String.self, forKey: .serviceTags)) ?? nil) {
            serviceTags = tagString
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        } else {
            serviceTags = nil
        }

        if let decodedURL = ((try? container.decodeIfPresent(URL.self, forKey: .coverURL)) ?? nil) {
            coverURL = decodedURL
        } else if let coverString = ((try? container.decodeIfPresent(String.self, forKey: .coverURL)) ?? nil),
                  let parsed = URL(string: coverString),
                  !coverString.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            coverURL = parsed
        } else {
            coverURL = nil
        }

        if let decodedURLs = ((try? container.decodeIfPresent([URL].self, forKey: .mediaURLs)) ?? nil) {
            mediaURLs = decodedURLs
        } else if let mediaStrings = ((try? container.decodeIfPresent([String].self, forKey: .mediaURLs)) ?? nil) {
            mediaURLs = mediaStrings.compactMap { value in
                let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return nil }
                return URL(string: trimmed)
            }
        } else {
            mediaURLs = nil
        }

        if let boolValue = ((try? container.decodeIfPresent(Bool.self, forKey: .customRequiresTime)) ?? nil) {
            customRequiresTime = boolValue
        } else if let intValue = ((try? container.decodeIfPresent(Int.self, forKey: .customRequiresTime)) ?? nil) {
            customRequiresTime = (intValue != 0)
        } else if let stringValue = ((try? container.decodeIfPresent(String.self, forKey: .customRequiresTime)) ?? nil) {
            let normalized = stringValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if ["true", "1", "yes", "y"].contains(normalized) {
                customRequiresTime = true
            } else if ["false", "0", "no", "n"].contains(normalized) {
                customRequiresTime = false
            } else {
                customRequiresTime = nil
            }
        } else {
            customRequiresTime = nil
        }

        var resolvedHours = (try? container.decodeIfPresent([String: String].self, forKey: .hours)) ?? nil
        if resolvedHours == nil,
           let arrayHours = ((try? container.decodeIfPresent([BusinessHourEntry].self, forKey: .hours)) ?? nil) {
            resolvedHours = Dictionary(uniqueKeysWithValues: arrayHours.map { ($0.day, $0.time) })
        }
        if resolvedHours == nil,
           let windowMap = ((try? container.decodeIfPresent([String: BusinessHourWindow].self, forKey: .hours)) ?? nil) {
            resolvedHours = windowMap.reduce(into: [String: String]()) { partial, item in
                if let label = item.value.label { partial[item.key] = label }
            }
        }
        if resolvedHours == nil {
            let alt = try decoder.container(keyedBy: AlternateKeys.self)
            resolvedHours = (try? alt.decodeIfPresent([String: String].self, forKey: .providerHours)) ?? nil
            if resolvedHours == nil {
                resolvedHours = (try? alt.decodeIfPresent([String: String].self, forKey: .businessHours)) ?? nil
            }
            if resolvedHours == nil {
                resolvedHours = (try? alt.decodeIfPresent([String: String].self, forKey: .hoursJSON)) ?? nil
            }

            if resolvedHours == nil,
               let windowMap = ((try? alt.decodeIfPresent([String: BusinessHourWindow].self, forKey: .providerHours)) ?? nil) {
                resolvedHours = windowMap.reduce(into: [String: String]()) { partial, item in
                    if let label = item.value.label { partial[item.key] = label }
                }
            }
            if resolvedHours == nil,
               let windowMap = ((try? alt.decodeIfPresent([String: BusinessHourWindow].self, forKey: .businessHours)) ?? nil) {
                resolvedHours = windowMap.reduce(into: [String: String]()) { partial, item in
                    if let label = item.value.label { partial[item.key] = label }
                }
            }
            if resolvedHours == nil,
               let windowMap = ((try? alt.decodeIfPresent([String: BusinessHourWindow].self, forKey: .hoursJSON)) ?? nil) {
                resolvedHours = windowMap.reduce(into: [String: String]()) { partial, item in
                    if let label = item.value.label { partial[item.key] = label }
                }
            }

            if resolvedHours == nil,
               let arrayHours = ((try? alt.decodeIfPresent([BusinessHourEntry].self, forKey: .providerHours)) ?? nil) {
                resolvedHours = Dictionary(uniqueKeysWithValues: arrayHours.map { ($0.day, $0.time) })
            }
            if resolvedHours == nil,
               let arrayHours = ((try? alt.decodeIfPresent([BusinessHourEntry].self, forKey: .businessHours)) ?? nil) {
                resolvedHours = Dictionary(uniqueKeysWithValues: arrayHours.map { ($0.day, $0.time) })
            }

            if resolvedHours == nil, let hoursString = ((try? alt.decodeIfPresent(String.self, forKey: .hoursJSON)) ?? nil) {
                if let data = hoursString.data(using: .utf8) {
                    resolvedHours = (try? JSONDecoder().decode([String: String].self, from: data))
                    if resolvedHours == nil,
                       let arrayHours = try? JSONDecoder().decode([BusinessHourEntry].self, from: data) {
                        resolvedHours = Dictionary(uniqueKeysWithValues: arrayHours.map { ($0.day, $0.time) })
                    }
                    if resolvedHours == nil,
                       let windowMap = try? JSONDecoder().decode([String: BusinessHourWindow].self, from: data) {
                        resolvedHours = windowMap.reduce(into: [String: String]()) { partial, item in
                            if let label = item.value.label { partial[item.key] = label }
                        }
                    }
                }
            }
        }
        hours = resolvedHours
    }
}

struct ServicesResponse: Decodable {
    let services: [BusinessService]
}

struct BusinessService: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let description: String?
    let priceCents: Int?
    let durationMin: Int?
    let sortOrder: Int?
    let requiresTime: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case priceCents = "price_cents"
        case durationMin = "duration_min"
        case sortOrder = "sort_order"
        case requiresTime = "requires_time"
    }

    var priceLabel: String {
        guard let priceCents else { return "Custom" }
        return NumberFormatter.currency.string(from: NSNumber(value: Double(priceCents) / 100.0)) ?? "$"
    }

    var requiresExactTime: Bool {
        requiresTime != false
    }
}

struct BusinessSummary: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let slug: String?
    let description: String?
    let address: String?
    let lat: Double?
    let lng: Double?
    let serviceTags: [String]
    let coverURL: URL?
    let mediaURLs: [URL]
    let phone: String?
    let website: String?
    let calendlyURL: String?
    let rating: Double?
    let reviewCount: Int?
    let priceTier: Int?
    let distanceMiles: Double?
    let founder50: Bool?
    let availabilityStatus: String?

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
        case distanceMiles = "distance_miles"
        case founder50
        case availabilityStatus = "availability_status"
    }

    var primaryCategory: String {
        guard let firstTag = serviceTags.first else { return "General" }
        return firstTag
            .split(separator: "_")
            .map { $0.capitalized }
            .joined(separator: " ")
    }

    var distanceLabel: String {
        guard let distanceMiles else { return address ?? "Nearby" }
        if distanceMiles < 0.1 {
            return "Nearby"
        }
        return String(format: "%.1f mi away", distanceMiles)
    }

    var ratingLabel: String {
        guard let rating else { return "New" }
        return String(format: "%.1f", rating)
    }

    var reviewLabel: String {
        "\(reviewCount ?? 0) reviews"
    }

    var priceLabel: String? {
        guard let priceTier, priceTier > 0 else { return nil }
        return String(repeating: "$", count: priceTier)
    }

    var heroImageURL: URL? {
        coverURL ?? mediaURLs.first
    }

    var isNew: Bool { (reviewCount ?? 0) == 0 }

    var isOpen: Bool {
        switch availabilityStatus {
        case "closed", "break": return false
        default: return true
        }
    }

    var openStatusLabel: String {
        switch availabilityStatus {
        case "closed": return "Closed"
        case "break": return "On break"
        case "busy": return "Busy"
        default: return "Open"
        }
    }
}

struct BookingsResponse: Decodable {
    let bookings: [BookingSummary]
}

struct BookingSummary: Decodable, Identifiable, Hashable {
    let id: String
    let service: String
    let status: String
    let createdAt: Date
    let scheduledAt: Date?
    let amountCents: Int?
    let paidAt: Date?
    let note: String?
    let businessID: String?
    let businessName: String?
    let businessPhone: String?
    let businessEmail: String?
    let stripePaymentMethodID: String?
    let stripeCustomerID: String?
    let stripeSetupIntentID: String?

    enum CodingKeys: String, CodingKey {
        case id
        case service
        case status
        case createdAt = "created_at"
        case scheduledAt = "scheduled_at"
        case amountCents = "amount_cents"
        case paidAt = "paid_at"
        case note
        case businessID = "business_id"
        case businessName = "business_name"
        case businessPhone = "business_phone"
        case businessEmail = "business_email"
        case stripePaymentMethodID = "stripe_payment_method_id"
        case stripeCustomerID = "stripe_customer_id"
        case stripeSetupIntentID = "stripe_setup_intent_id"
    }

    var statusLabel: String {
        status
            .split(separator: "_")
            .map { $0.capitalized }
            .joined(separator: " ")
    }

    var amountLabel: String? {
        guard let amountCents else { return nil }
        return NumberFormatter.currency.string(from: NSNumber(value: Double(amountCents) / 100.0))
    }
}

struct ThreadsResponse: Decodable {
    let threads: [MessageThread]
}

struct MessagesResponse: Decodable {
    let messages: [ConversationMessage]
    let thread: MessageThread?
    let hasMore: Bool?

    enum CodingKeys: String, CodingKey {
        case messages
        case thread
        case hasMore = "has_more"
    }
}

struct SendMessageResponse: Decodable {
    let message: ConversationMessage
}

struct NotificationsResponse: Decodable {
    let notifications: [AppNotification]
}

struct AppNotification: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String?
    let createdAt: Date
    let bookingID: String?
    let businessID: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case subtitle
        case createdAt = "created_at"
        case bookingID = "booking_id"
        case businessID = "business_id"
    }

    static func fromBooking(_ booking: BookingSummary) -> AppNotification {
        AppNotification(
            id: booking.id,
            title: "Booking \(booking.statusLabel)",
            subtitle: booking.businessName ?? "ScheduleMe",
            createdAt: booking.createdAt,
            bookingID: booking.id,
            businessID: booking.businessID
        )
    }
}

struct MessageThread: Decodable, Identifiable, Hashable {
    let id: String
    let businessID: String?
    let bookingID: String?
    let bookingIDs: [String]?
    let service: String
    let status: String
    let createdAt: Date
    let businesses: ThreadBusiness?
    let lastMessage: ConversationMessage?
    let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case businessID = "business_id"
        case bookingID = "booking_id"
        case bookingIDs = "booking_ids"
        case service
        case status
        case createdAt = "created_at"
        case businesses
        case lastMessage
        case unreadCount
    }

    var title: String {
        businesses?.name ?? service
    }

    var subtitle: String {
        lastMessage?.content ?? service
    }
}

struct ThreadBusiness: Decodable, Hashable {
    let id: String?
    let name: String?
    let phone: String?
}

struct ConversationMessage: Decodable, Identifiable, Hashable {
    let id: String
    let bookingID: String?   // optional — lastMessage inside thread list omits booking_id
    let senderType: String
    let content: String
    let imageURL: String?
    let messageType: String?
    let read: Bool?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case bookingID = "booking_id"
        case senderType = "sender_type"
        case content
        case imageURL = "image_url"
        case messageType = "message_type"
        case read
        case createdAt = "created_at"
    }

    var isFromUser: Bool {
        senderType == "user"
    }
}

struct SendMessageRequest: Encodable {
    let bookingID: String
    let senderType: String
    let content: String

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case senderType = "sender_type"
        case content
    }
}

struct FeedbackRequest: Encodable {
    let topic: String?
    let message: String
    let email: String?
}

struct FeedbackResponse: Decodable {
    let success: Bool?
    let error: String?
}

// MARK: - Booking Creation

struct BookingCreateRequest: Encodable {
    let businessID: String
    let service: String
    let userName: String
    let userPhone: String
    let userEmail: String
    let note: String?
    let scheduledStart: String?
    let scheduledEnd: String?
    let timezone: String?
    let servicePriceCents: Int?

    enum CodingKeys: String, CodingKey {
        case businessID = "business_id"
        case service
        case userName = "user_name"
        case userPhone = "user_phone"
        case userEmail = "user_email"
        case note
        case scheduledStart = "scheduled_start"
        case scheduledEnd = "scheduled_end"
        case timezone
        case servicePriceCents = "service_price_cents"
    }
}

struct BookingCreateResponse: Decodable {
    let booking: BookingCreatePayload?
    let warning: String?
}

struct BookingCreatePayload: Decodable {
    let id: String
    let status: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case createdAt = "created_at"
    }
}

// MARK: - Reviews

struct ReviewRequest: Encodable {
    let bookingID: String
    let businessID: String
    let rating: Int
    let comment: String

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case businessID = "business_id"
        case rating
        case comment
    }
}

struct ReviewResponse: Decodable {
    let success: Bool?
    let error: String?
}

struct BusinessReview: Decodable, Identifiable {
    let id: String
    let rating: Int
    let comment: String?
    let createdAt: Date
    let reviewerName: String?

    enum CodingKeys: String, CodingKey {
        case id
        case rating
        case comment
        case createdAt = "created_at"
        case reviewerName = "reviewer_name"
    }
}

struct ReviewsResponse: Decodable {
    let reviews: [BusinessReview]
}

// MARK: - Payment Methods

struct PaymentMethod: Decodable, Identifiable, Hashable {
    let id: String
    let brand: String
    let last4: String
    let expMonth: Int
    let expYear: Int
    let isDefault: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case brand
        case card
        case last4
        case last4Alt = "last_4"
        case expMonth = "exp_month"
        case expMonthAlt = "expMonth"
        case expYear = "exp_year"
        case expYearAlt = "expYear"
        case isDefault = "is_default"
        case isDefaultAlt = "default"
    }

    enum CardCodingKeys: String, CodingKey {
        case brand
        case last4
        case expMonth = "exp_month"
        case expYear = "exp_year"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        if let nestedCard = try? container.nestedContainer(keyedBy: CardCodingKeys.self, forKey: .card) {
            brand = (try? nestedCard.decode(String.self, forKey: .brand)) ?? "card"
            last4 = (try? nestedCard.decode(String.self, forKey: .last4)) ?? "0000"
            expMonth = (try? nestedCard.decode(Int.self, forKey: .expMonth)) ?? 1
            expYear = (try? nestedCard.decode(Int.self, forKey: .expYear)) ?? 2000
        } else {
            brand = (try? container.decode(String.self, forKey: .brand)) ?? "card"
            last4 = (try? container.decode(String.self, forKey: .last4))
                ?? (try? container.decode(String.self, forKey: .last4Alt))
                ?? "0000"
            expMonth = (try? container.decode(Int.self, forKey: .expMonth))
                ?? (try? container.decode(Int.self, forKey: .expMonthAlt))
                ?? 1
            expYear = (try? container.decode(Int.self, forKey: .expYear))
                ?? (try? container.decode(Int.self, forKey: .expYearAlt))
                ?? 2000
        }
        isDefault = (try? container.decode(Bool.self, forKey: .isDefault))
            ?? (try? container.decode(Bool.self, forKey: .isDefaultAlt))
            ?? false
    }

    var displayName: String { "\(brand.capitalized) ···· \(last4)" }
    var expiryLabel: String { String(format: "%02d/%02d", expMonth, expYear % 100) }
}

struct PaymentMethodsResponse: Decodable {
    let paymentMethods: [PaymentMethod]
    let defaultID: String?

    enum CodingKeys: String, CodingKey {
        case paymentMethods = "methods"
        case paymentMethodsAlt = "payment_methods"
        case paymentMethodsLegacy = "data"
        case defaultID = "defaultId"
        case defaultIDAlt = "default_id"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let methods = (try? container.decode([PaymentMethod].self, forKey: .paymentMethods))
            ?? (try? container.decode([PaymentMethod].self, forKey: .paymentMethodsAlt))
            ?? (try? container.decode([PaymentMethod].self, forKey: .paymentMethodsLegacy))
            ?? []
        paymentMethods = methods
        defaultID = (try? container.decodeIfPresent(String.self, forKey: .defaultID))
            ?? (try? container.decodeIfPresent(String.self, forKey: .defaultIDAlt))
    }
}

struct CreateSetupIntentRequest: Encodable {
    let bookingID: String?
    let forceNew: Bool?
    let apiVersion: String?

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case forceNew = "force_new"
        case apiVersion = "api_version"
    }
}

struct SetupIntentResponse: Decodable {
    let clientSecret: String?
    let alreadySaved: Bool?
    let error: String?
    let customerId: String?
    let ephemeralKey: String?

    enum CodingKeys: String, CodingKey {
        case clientSecret = "client_secret"
        case alreadySaved = "already_saved"
        case error
        case customerId = "customer_id"
        case ephemeralKey = "ephemeral_key"
    }
}

struct StripeSyncResponse: Decodable {
    let customerId: String?
    let updated: Bool?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case customerId = "customerId"
        case customerIdAlt = "customer_id"
        case updated
        case error
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        customerId = (try? container.decodeIfPresent(String.self, forKey: .customerId))
            ?? (try? container.decodeIfPresent(String.self, forKey: .customerIdAlt))
        updated = try? container.decodeIfPresent(Bool.self, forKey: .updated)
        error = try? container.decodeIfPresent(String.self, forKey: .error)
    }
}

struct EmptyRequest: Encodable {}

struct SetDefaultPaymentMethodRequest: Encodable {
    let paymentMethodID: String

    enum CodingKeys: String, CodingKey {
        case paymentMethodID = "payment_method_id"
    }
}

struct GenericSuccessResponse: Decodable {
    let success: Bool?
    let error: String?
}

struct PaymentMethodSavedRequest: Encodable {
    let bookingID: String

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
    }
}

struct AttachPaymentMethodRequest: Encodable {
    let paymentMethodID: String

    enum CodingKeys: String, CodingKey {
        case paymentMethodID = "payment_method_id"
    }
}

struct UpdateBookingStatusRequest: Encodable {
    let bookingID: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case status
    }
}
struct DeletePaymentMethodRequest: Encodable {
    let paymentMethodID: String

    enum CodingKeys: String, CodingKey {
        case paymentMethodID = "payment_method_id"
    }
}

struct DeletePaymentMethodResponse: Decodable {
    let success: Bool?
    let error: String?
}

struct PayBookingNowRequest: Encodable {
    let bookingID: String

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
    }
}

struct PayBookingNowResponse: Decodable {
    let ok: Bool?
    let alreadyPaid: Bool?
    let bookingID: String?
    let paymentIntentID: String?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case ok
        case alreadyPaid = "already_paid"
        case bookingID = "booking_id"
        case paymentIntentID = "payment_intent_id"
        case error
    }
}

struct PushTokenRequest: Encodable {
    let token: String
    let platform: String
}

enum DataStoreError: LocalizedError {
    case unauthenticated
    case missingLocation
    case invalidConfiguration(String)
    case server(String)

    var errorDescription: String? {
        switch self {
        case .unauthenticated:
            return "You need to sign in first."
        case .missingLocation:
            return "Enable location to see nearby businesses."
        case .invalidConfiguration(let message):
            return message
        case .server(let message):
            return message
        }
    }
}

extension NumberFormatter {
    static let currency: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 2
        return formatter
    }()
}

// MARK: - Favorites

struct FavoritesResponse: Decodable {
    let businessIDs: [String]
    enum CodingKeys: String, CodingKey {
        case businessIDs = "business_ids"
    }
}

struct FavoriteToggleRequest: Encodable {
    let businessID: String
    let userID: String
    enum CodingKeys: String, CodingKey {
        case businessID = "business_id"
        case userID = "user_id"
    }
}

struct FavoriteToggleResponse: Decodable {
    let success: Bool?
}

extension JSONDecoder {
    static let scheduleMe: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}

extension JSONEncoder {
    static let scheduleMe: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .useDefaultKeys
        return encoder
    }()
}
