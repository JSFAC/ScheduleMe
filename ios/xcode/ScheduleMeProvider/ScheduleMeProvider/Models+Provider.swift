import Foundation

// MARK: - Provider Dashboard Models

struct ProviderBookingsResponse: Decodable {
    let bookings: [ProviderBookingSummary]

    enum CodingKeys: String, CodingKey {
        case bookings
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let lossy = try? container.decode(LossyDecodableArray<ProviderBookingSummary>.self, forKey: .bookings) {
            bookings = lossy.values
        } else {
            bookings = try container.decodeIfPresent([ProviderBookingSummary].self, forKey: .bookings) ?? []
        }
    }
}

struct ProviderBookingSummary: Decodable, Identifiable, Hashable {
    let id: String
    let service: String
    let status: String
    let createdAt: Date
    let scheduledStart: Date?
    let scheduledEnd: Date?
    let amountCents: Int?
    let paidAt: Date?
    let updatedAt: Date?
    let completedAt: Date?
    let cancelledAt: Date?
    let notes: String?
    let customerCounterAmountCents: Int?
    let profile: ProviderCustomerProfile?

    enum CodingKeys: String, CodingKey {
        case id
        case service
        case status
        case createdAt = "created_at"
        case scheduledStart = "scheduled_start"
        case scheduledEnd = "scheduled_end"
        case amountCents = "amount_cents"
        case paidAt = "paid_at"
        case updatedAt = "updated_at"
        case completedAt = "completed_at"
        case cancelledAt = "cancelled_at"
        case notes
        case customerCounterAmountCents = "customer_counter_amount_cents"
        case customerAmountCents = "customer_amount_cents"
        case disputedAmountCents = "disputed_amount_cents"
        case proposedAmountCents = "proposed_amount_cents"
        case profile = "profiles"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        service = (try? container.decode(String.self, forKey: .service)) ?? "Service"
        status = (try? container.decode(String.self, forKey: .status)) ?? "pending"
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        scheduledStart = try? container.decodeIfPresent(Date.self, forKey: .scheduledStart)
        scheduledEnd = try? container.decodeIfPresent(Date.self, forKey: .scheduledEnd)
        paidAt = try? container.decodeIfPresent(Date.self, forKey: .paidAt)
        updatedAt = try? container.decodeIfPresent(Date.self, forKey: .updatedAt)
        completedAt = try? container.decodeIfPresent(Date.self, forKey: .completedAt)
        cancelledAt = try? container.decodeIfPresent(Date.self, forKey: .cancelledAt)
        notes = try? container.decodeIfPresent(String.self, forKey: .notes)

        if let intAmount = try? container.decodeIfPresent(Int.self, forKey: .amountCents) {
            amountCents = intAmount
        } else if let doubleAmount = try? container.decodeIfPresent(Double.self, forKey: .amountCents) {
            amountCents = Int(doubleAmount.rounded())
        } else if let stringAmount = try? container.decodeIfPresent(String.self, forKey: .amountCents),
                  let parsed = Int(stringAmount) {
            amountCents = parsed
        } else {
            amountCents = nil
        }

        if let customerCounter = try? container.decodeIfPresent(Int.self, forKey: .customerCounterAmountCents) {
            customerCounterAmountCents = customerCounter
        } else if let customerAmount = try? container.decodeIfPresent(Int.self, forKey: .customerAmountCents) {
            customerCounterAmountCents = customerAmount
        } else if let disputedAmount = try? container.decodeIfPresent(Int.self, forKey: .disputedAmountCents) {
            customerCounterAmountCents = disputedAmount
        } else if let proposedAmount = try? container.decodeIfPresent(Int.self, forKey: .proposedAmountCents) {
            customerCounterAmountCents = proposedAmount
        } else {
            customerCounterAmountCents = nil
        }

        if let objectProfile = try? container.decodeIfPresent(ProviderCustomerProfile.self, forKey: .profile) {
            profile = objectProfile
        } else if let arrayProfile = try? container.decodeIfPresent([ProviderCustomerProfile].self, forKey: .profile) {
            profile = arrayProfile.first
        } else {
            profile = nil
        }
    }

    var statusLabel: String {
        if isDerivedPricePending {
            return "Price Pending"
        }
        switch status.lowercased() {
        case "price_disputed", "disputed":
            return "Price Disputed"
        case "price_pending":
            return "Price Pending"
        case "payment_pending":
            return "Pending"
        case "confirmed":
            return "Active"
        default:
            return status.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    var isDerivedPricePending: Bool {
        let normalized = status.lowercased()
        return normalized == "pending" && (amountCents ?? 0) > 0 && paidAt == nil
    }

    var amountLabel: String {
        guard let amountCents else { return "Price not set" }
        return NumberFormatter.currency.string(from: NSNumber(value: Double(amountCents) / 100.0)) ?? "$0"
    }

    var customerDisplayName: String {
        profile?.displayName ?? "Customer"
    }

    var customerCounterAmountLabel: String {
        if let cents = customerCounterAmountCents {
            return NumberFormatter.currency.string(from: NSNumber(value: Double(cents) / 100.0)) ?? "$0"
        }
        return amountLabel
    }

    var statusChangedAt: Date {
        let statusLower = status.lowercased()
        if statusLower == "cancelled" {
            return cancelledAt ?? updatedAt ?? createdAt
        }
        if statusLower == "completed" || statusLower == "paid" {
            return completedAt ?? paidAt ?? updatedAt ?? createdAt
        }
        return updatedAt ?? createdAt
    }
}

struct ProviderCustomerProfile: Decodable, Hashable {
    let id: String?
    let name: String?
    let fullName: String?
    let username: String?
    let email: String?
    let phone: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case fullName = "full_name"
        case username
        case email
        case phone
    }

    init(
        id: String?,
        name: String?,
        fullName: String?,
        username: String?,
        email: String?,
        phone: String?
    ) {
        self.id = id
        self.name = name
        self.fullName = fullName
        self.username = username
        self.email = email
        self.phone = phone
    }

    var displayName: String {
        if let fullName, !fullName.isEmpty { return fullName }
        if let name, !name.isEmpty { return name }
        if let username, !username.isEmpty { return username }
        if let email, !email.isEmpty { return email.components(separatedBy: "@").first ?? "Customer" }
        return "Customer"
    }
}

struct ProviderMessageThreadsResponse: Decodable {
    let threads: [ProviderMessageThread]

    enum CodingKeys: String, CodingKey {
        case threads
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let lossy = try? container.decode(LossyDecodableArray<ProviderMessageThread>.self, forKey: .threads) {
            threads = lossy.values
        } else {
            threads = try container.decodeIfPresent([ProviderMessageThread].self, forKey: .threads) ?? []
        }
    }
}

struct ProviderMessageThread: Decodable, Identifiable, Hashable {
    let id: String
    let bookingID: String?
    let service: String
    let status: String
    let createdAt: Date
    let profile: ProviderCustomerProfile?
    let lastMessage: ProviderConversationMessage?
    let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case bookingID = "booking_id"
        case service
        case status
        case createdAt = "created_at"
        case profile = "profiles"
        case lastMessage
        case unreadCount
    }

    init(
        id: String,
        bookingID: String?,
        service: String,
        status: String,
        createdAt: Date,
        profile: ProviderCustomerProfile?,
        lastMessage: ProviderConversationMessage?,
        unreadCount: Int
    ) {
        self.id = id
        self.bookingID = bookingID
        self.service = service
        self.status = status
        self.createdAt = createdAt
        self.profile = profile
        self.lastMessage = lastMessage
        self.unreadCount = unreadCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedBookingID = Self.decodeFlexibleString(container, key: .bookingID)
        let decodedID =
            Self.decodeFlexibleString(container, key: .id) ??
            decodedBookingID ??
            UUID().uuidString
        id = decodedID
        bookingID = decodedBookingID ?? decodedID
        service = (try? container.decode(String.self, forKey: .service)) ?? "Service"
        status = (try? container.decode(String.self, forKey: .status)) ?? "pending"
        if let decodedDate = try? container.decode(Date.self, forKey: .createdAt) {
            createdAt = decodedDate
        } else {
            createdAt = Date()
        }
        lastMessage = try? container.decodeIfPresent(ProviderConversationMessage.self, forKey: .lastMessage)

        if let profileObj = try? container.decodeIfPresent(ProviderCustomerProfile.self, forKey: .profile) {
            profile = profileObj
        } else if let profileArray = try? container.decodeIfPresent([ProviderCustomerProfile].self, forKey: .profile) {
            profile = profileArray.first
        } else {
            profile = nil
        }

        if let intUnread = try? container.decodeIfPresent(Int.self, forKey: .unreadCount) {
            unreadCount = intUnread
        } else if let stringUnread = try? container.decodeIfPresent(String.self, forKey: .unreadCount),
                  let parsed = Int(stringUnread) {
            unreadCount = parsed
        } else {
            unreadCount = 0
        }
    }

    private static func decodeFlexibleString(
        _ container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) -> String? {
        if let value = try? container.decode(String.self, forKey: key), !value.isEmpty {
            return value
        }
        if let intValue = try? container.decode(Int.self, forKey: key) {
            return String(intValue)
        }
        if let doubleValue = try? container.decode(Double.self, forKey: key) {
            return String(Int(doubleValue.rounded()))
        }
        return nil
    }
}

struct ProviderMessagesResponse: Decodable {
    let messages: [ProviderConversationMessage]

    enum CodingKeys: String, CodingKey {
        case messages
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let lossy = try? container.decode(LossyDecodableArray<ProviderConversationMessage>.self, forKey: .messages) {
            messages = lossy.values
        } else {
            messages = try container.decodeIfPresent([ProviderConversationMessage].self, forKey: .messages) ?? []
        }
    }
}

struct ProviderConversationMessage: Decodable, Identifiable, Hashable {
    let id: String
    let bookingID: String?
    let senderType: String
    let content: String
    let read: Bool?
    let createdAt: Date
    let imageURL: String?
    let messageType: String?

    enum CodingKeys: String, CodingKey {
        case id
        case bookingID = "booking_id"
        case threadID = "thread_id"
        case conversationID = "conversation_id"
        case senderType = "sender_type"
        case sender
        case role
        case content
        case text
        case message
        case body
        case read
        case createdAt = "created_at"
        case imageURL = "image_url"
        case messageType = "message_type"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id =
            Self.decodeFlexibleString(container, key: .id) ??
            UUID().uuidString
        bookingID =
            Self.decodeFlexibleString(container, key: .bookingID) ??
            Self.decodeFlexibleString(container, key: .threadID) ??
            Self.decodeFlexibleString(container, key: .conversationID)

        senderType =
            ((try? container.decode(String.self, forKey: .senderType)) ??
             (try? container.decode(String.self, forKey: .sender)) ??
             (try? container.decode(String.self, forKey: .role)) ??
             "user")
            .lowercased()

        content =
            (try? container.decode(String.self, forKey: .content)) ??
            (try? container.decode(String.self, forKey: .text)) ??
            (try? container.decode(String.self, forKey: .message)) ??
            (try? container.decode(String.self, forKey: .body)) ??
            ""
        read = try? container.decodeIfPresent(Bool.self, forKey: .read)
        imageURL = try? container.decodeIfPresent(String.self, forKey: .imageURL)
        messageType = try? container.decodeIfPresent(String.self, forKey: .messageType)

        if let decodedDate = try? container.decode(Date.self, forKey: .createdAt) {
            createdAt = decodedDate
        } else {
            createdAt = Date()
        }
    }

    var isBusinessMessage: Bool {
        senderType == "business" || senderType == "provider"
    }

    private static func decodeFlexibleString(
        _ container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) -> String? {
        if let value = try? container.decode(String.self, forKey: key), !value.isEmpty {
            return value
        }
        if let intValue = try? container.decode(Int.self, forKey: key) {
            return String(intValue)
        }
        if let doubleValue = try? container.decode(Double.self, forKey: key) {
            return String(Int(doubleValue.rounded()))
        }
        return nil
    }
}

struct ProviderServicesResponse: Decodable {
    let services: [ProviderService]
}

struct ProviderServiceMutationResponse: Decodable {
    let service: ProviderService?
    let success: Bool?
}

struct ProviderSimpleSuccessResponse: Decodable {
    let success: Bool?
}

struct ProviderService: Decodable, Identifiable, Hashable {
    let id: String
    let businessID: String?
    let name: String
    let description: String?
    let priceCents: Int?
    let durationMin: Int?
    let sortOrder: Int?
    let active: Bool?
    let requiresExactTime: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case businessID = "business_id"
        case name
        case description
        case priceCents = "price_cents"
        case durationMin = "duration_min"
        case sortOrder = "sort_order"
        case active
        case requiresExactTime = "requires_exact_time"
        case exactTimeRequired = "exact_time_required"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? container.decode(String.self, forKey: .id)) ?? UUID().uuidString
        businessID = try? container.decodeIfPresent(String.self, forKey: .businessID)
        name = (try? container.decode(String.self, forKey: .name)) ?? "Service"
        description = try? container.decodeIfPresent(String.self, forKey: .description)
        if let value = try? container.decodeIfPresent(Int.self, forKey: .priceCents) {
            priceCents = value
        } else if let value = try? container.decodeIfPresent(Double.self, forKey: .priceCents) {
            priceCents = Int(value.rounded())
        } else if let value = try? container.decodeIfPresent(String.self, forKey: .priceCents), let intValue = Int(value) {
            priceCents = intValue
        } else {
            priceCents = nil
        }
        if let value = try? container.decodeIfPresent(Int.self, forKey: .durationMin) {
            durationMin = value
        } else if let value = try? container.decodeIfPresent(Double.self, forKey: .durationMin) {
            durationMin = Int(value.rounded())
        } else if let value = try? container.decodeIfPresent(String.self, forKey: .durationMin), let intValue = Int(value) {
            durationMin = intValue
        } else {
            durationMin = nil
        }
        if let value = try? container.decodeIfPresent(Int.self, forKey: .sortOrder) {
            sortOrder = value
        } else if let value = try? container.decodeIfPresent(Double.self, forKey: .sortOrder) {
            sortOrder = Int(value.rounded())
        } else if let value = try? container.decodeIfPresent(String.self, forKey: .sortOrder), let intValue = Int(value) {
            sortOrder = intValue
        } else {
            sortOrder = nil
        }
        active = try? container.decodeIfPresent(Bool.self, forKey: .active)

        if let exact = try? container.decodeIfPresent(Bool.self, forKey: .requiresExactTime) {
            requiresExactTime = exact
        } else if let exactAlt = try? container.decodeIfPresent(Bool.self, forKey: .exactTimeRequired) {
            requiresExactTime = exactAlt
        } else if let exactString = try? container.decodeIfPresent(String.self, forKey: .requiresExactTime) {
            requiresExactTime = ["true", "1", "yes", "y"].contains(exactString.lowercased())
        } else if let exactStringAlt = try? container.decodeIfPresent(String.self, forKey: .exactTimeRequired) {
            requiresExactTime = ["true", "1", "yes", "y"].contains(exactStringAlt.lowercased())
        } else {
            requiresExactTime = nil
        }
    }

    var priceLabel: String {
        guard let priceCents else { return "Custom" }
        return NumberFormatter.currency.string(from: NSNumber(value: Double(priceCents) / 100.0)) ?? "$0"
    }

    var durationLabel: String {
        guard let durationMin else { return "Flexible time" }
        return "\(durationMin) min"
    }
}

struct ProviderStripeConnectResponse: Decodable {
    let url: String?
    let error: String?
}

struct ProviderSetBookingAmountResponse: Decodable {
    let ok: Bool?
    let error: String?
}

struct ProviderProfile: Hashable {
    let id: String
    let name: String
    let ownerName: String
    let ownerEmail: String
    let phone: String
    let address: String
    let description: String
    let website: String
    let instagram: String
    let coverURL: String?
    let mediaURLs: [String]
    let serviceTags: [String]
    let stripeOnboarded: Bool
    let isOnboarded: Bool
    let schoolDomain: String?
    let eduVerified: Bool
    let founder50: Bool
    let platformFeePercent: Double?
    let rating: Double?
    let reviewCount: Int
    let hours: [String: String]
    let availabilityStatus: String
    let customRequestRequiresExactTime: Bool

    var ratingLabel: String {
        guard reviewCount > 0, let rating else { return "New" }
        return String(format: "%.1f", rating)
    }

    var isNew: Bool { reviewCount == 0 }
}

struct ProviderStripeBalance: Hashable {
    let totalPayoutCents: Int
    let thisMonthPayoutCents: Int
    let pendingPayoutCents: Int

    var totalPayoutLabel: String {
        NumberFormatter.currency.string(from: NSNumber(value: Double(totalPayoutCents) / 100.0)) ?? "$0"
    }

    var thisMonthPayoutLabel: String {
        NumberFormatter.currency.string(from: NSNumber(value: Double(thisMonthPayoutCents) / 100.0)) ?? "$0"
    }

    var pendingPayoutLabel: String {
        NumberFormatter.currency.string(from: NSNumber(value: Double(pendingPayoutCents) / 100.0)) ?? "$0"
    }
}

struct ProviderUpdateBookingStatusRequest: Encodable {
    let bookingID: String
    let status: String?
    let action: String?
    let proofNote: String?
    let proofPhotoURLs: [String]?
    let geoMetadata: [String: String]?
    let disputeReason: String?
    let disputeDetails: String?
    let disputeMediaURLs: [String]?

    init(
        bookingID: String,
        status: String? = nil,
        action: String? = nil,
        proofNote: String? = nil,
        proofPhotoURLs: [String]? = nil,
        geoMetadata: [String: String]? = nil,
        disputeReason: String? = nil,
        disputeDetails: String? = nil,
        disputeMediaURLs: [String]? = nil
    ) {
        self.bookingID = bookingID
        self.status = status
        self.action = action
        self.proofNote = proofNote
        self.proofPhotoURLs = proofPhotoURLs
        self.geoMetadata = geoMetadata
        self.disputeReason = disputeReason
        self.disputeDetails = disputeDetails
        self.disputeMediaURLs = disputeMediaURLs
    }

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case status
        case action
        case proofNote = "proof_note"
        case proofPhotoURLs = "proof_photo_urls"
        case geoMetadata = "geo_metadata"
        case disputeReason = "dispute_reason"
        case disputeDetails = "dispute_details"
        case disputeMediaURLs = "dispute_media_urls"
    }
}

struct ProviderSetBookingAmountRequest: Encodable {
    let bookingID: String
    let amountCents: Int

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case amountCents = "amount_cents"
    }
}

struct ProviderSendMessageRequest: Encodable {
    let bookingID: String
    let senderType: String
    let content: String
    let imageURL: String?

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case senderType = "sender_type"
        case content
        case imageURL = "image_url"
    }
}

struct ProviderSendMessageResponse: Decodable {
    let message: ProviderConversationMessage
}

struct ProviderUploadMessageMediaRequest: Encodable {
    let bookingID: String
    let mediaType: String
    let fileData: String
    let fileType: String
    let fileName: String

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case mediaType = "media_type"
        case fileData = "file_data"
        case fileType = "file_type"
        case fileName = "file_name"
    }
}

struct ProviderUploadMessageMediaResponse: Decodable {
    let url: String?
    let error: String?
}

struct ProviderUploadBusinessMediaRequest: Encodable {
    let businessID: String
    let mediaType: String
    let fileData: String
    let fileType: String
    let fileName: String

    enum CodingKeys: String, CodingKey {
        case businessID = "business_id"
        case mediaType = "media_type"
        case fileData = "file_data"
        case fileType = "file_type"
        case fileName = "file_name"
    }
}

struct ProviderUploadBusinessMediaResponse: Decodable {
    let url: String?
    let error: String?
}

struct ProviderMarkReadRequest: Encodable {
    let bookingID: String
    let readerType: String

    enum CodingKeys: String, CodingKey {
        case bookingID = "booking_id"
        case readerType = "reader_type"
    }
}

struct ProviderServiceCreateRequest: Encodable {
    let businessID: String
    let name: String
    let description: String?
    let priceCents: Int
    let durationMin: Int
    let requiresExactTime: Bool?

    enum CodingKeys: String, CodingKey {
        case businessID = "business_id"
        case name
        case description
        case priceCents = "price_cents"
        case durationMin = "duration_min"
        case requiresExactTime = "requires_exact_time"
    }
}

struct ProviderServiceUpdateRequest: Encodable {
    let id: String
    let businessID: String
    let name: String
    let description: String?
    let priceCents: Int
    let durationMin: Int
    let requiresExactTime: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case businessID = "business_id"
        case name
        case description
        case priceCents = "price_cents"
        case durationMin = "duration_min"
        case requiresExactTime = "requires_exact_time"
    }
}

struct ProviderServiceCreateCompatibilityRequest: Encodable {
    let businessID: String
    let name: String
    let description: String?
    let priceCents: Int
    let durationMin: Int
    let requiresExactTime: Bool?

    enum CodingKeys: String, CodingKey {
        case businessID = "business_id"
        case name
        case description
        case priceCents = "price_cents"
        case durationMin = "duration_min"
        case requiresExactTime = "requires_exact_time"
        case exactTimeRequired = "exact_time_required"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(businessID, forKey: .businessID)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encode(priceCents, forKey: .priceCents)
        try container.encode(durationMin, forKey: .durationMin)
        try container.encodeIfPresent(requiresExactTime, forKey: .requiresExactTime)
        try container.encodeIfPresent(requiresExactTime, forKey: .exactTimeRequired)
    }
}

struct ProviderServiceUpdateCompatibilityRequest: Encodable {
    let id: String
    let businessID: String
    let name: String
    let description: String?
    let priceCents: Int
    let durationMin: Int
    let requiresExactTime: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case serviceID = "service_id"
        case businessID = "business_id"
        case name
        case description
        case priceCents = "price_cents"
        case durationMin = "duration_min"
        case requiresExactTime = "requires_exact_time"
        case exactTimeRequired = "exact_time_required"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(id, forKey: .serviceID)
        try container.encode(businessID, forKey: .businessID)
        try container.encode(name, forKey: .name)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encode(priceCents, forKey: .priceCents)
        try container.encode(durationMin, forKey: .durationMin)
        try container.encodeIfPresent(requiresExactTime, forKey: .requiresExactTime)
        try container.encodeIfPresent(requiresExactTime, forKey: .exactTimeRequired)
    }
}

struct ProviderServiceDeleteRequest: Encodable {
    let id: String
    let businessID: String

    enum CodingKeys: String, CodingKey {
        case id
        case businessID = "business_id"
    }
}

struct ProviderStripeConnectRequest: Encodable {
    let businessId: String
}

private struct LossyDecodableArray<Element: Decodable>: Decodable {
    private struct AnyDecodableValue: Decodable {}
    var values: [Element] = []

    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        while !container.isAtEnd {
            if let value = try? container.decode(Element.self) {
                values.append(value)
            } else {
                _ = try? container.decode(AnyDecodableValue.self)
            }
        }
    }
}
