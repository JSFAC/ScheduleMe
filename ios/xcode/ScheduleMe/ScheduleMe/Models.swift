import Foundation

struct NearbyBusinessesResponse: Decodable {
    let businesses: [BusinessSummary]
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
}

struct SendMessageResponse: Decodable {
    let message: ConversationMessage
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
    let bookingID: String
    let senderType: String
    let content: String
    let read: Bool?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case bookingID = "booking_id"
        case senderType = "sender_type"
        case content
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
