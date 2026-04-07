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

    // MARK: Request-level cache markers to avoid unnecessary reloads while navigating tabs.
    private var messageCursor: Date?
    private var lastBusinessesFetchAt: Date?
    private var lastBusinessesCoordinate: CLLocationCoordinate2D?
    private var lastBookingsFetchAt: Date?
    private var lastThreadsFetchAt: Date?
    private let blockedThreadsDefaultsKey = "scheduleme_blocked_thread_ids"

    // MARK: - Campus businesses

    @Published private(set) var campusBusinesses: [BusinessSummary] = []
    @Published private(set) var campusFeatured: [BusinessSummary] = []
    @Published private(set) var isLoadingCampusBusinesses = false

    /// Loads EDU campus businesses + featured rows.
    /// Uses school domain / campus tag filters to mirror web campus feed behavior.
    func loadCampusBusinesses(schoolDomain: String?, campusTag: String?) async {
        isLoadingCampusBusinesses = true
        defer { isLoadingCampusBusinesses = false }

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
    }

    func closeActiveThread() {
        // Return from thread detail to thread list.
        activeThread = nil
        messages = []
    }

    /// Nearby business fetch with short cache window + distance threshold.
    func loadNearbyBusinesses(coordinate: CLLocationCoordinate2D?) async {
        let resolvedCoordinate = coordinate ?? LocationManager.simulatorFallbackCoordinate
        guard let coordinate = resolvedCoordinate else {
            businesses = []
            businessError = DataStoreError.missingLocation.localizedDescription
            return
        }
        if shouldUseNearbyBusinessesCache(for: coordinate) {
            return
        }

        isLoadingBusinesses = true
        defer { isLoadingBusinesses = false }

        do {
            let response: NearbyBusinessesResponse = try await APIClient.shared.get(
                path: "/api/nearby-businesses",
                queryItems: [
                    .init(name: "lat", value: String(coordinate.latitude)),
                    .init(name: "lng", value: String(coordinate.longitude)),
                    .init(name: "radius", value: "25"),
                    .init(name: "limit", value: "40"),
                ]
            )
            businesses = response.businesses
            businessError = nil
            lastBusinessesFetchAt = Date()
            lastBusinessesCoordinate = coordinate
        } catch {
            businesses = []
            businessError = error.localizedDescription
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
        defer { isLoadingBookings = false }

        do {
            let response: BookingsResponse = try await APIClient.shared.get(
                path: "/api/bookings",
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
        defer { isLoadingNotifications = false }

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
                let response: BookingsResponse = try await APIClient.shared.get(
                    path: "/api/bookings",
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
            let response: BookingsResponse = try await APIClient.shared.get(
                path: "/api/bookings",
                requiresAuth: true
            )
            let businessIDs = Array(Set(response.bookings.compactMap { $0.businessID }))
            var collected: [MessageThread] = []
            for businessID in businessIDs.prefix(20) {
                do {
                    let response: MessagesResponse = try await APIClient.shared.get(
                        path: "/api/messages",
                        queryItems: [.init(name: "thread_business_id", value: businessID)],
                        requiresAuth: true
                    )
                    if let thread = response.thread {
                        collected.append(thread)
                    }
                } catch {
                    continue
                }
            }
            threads = collected
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
        let resolvedUserID = userID ?? session?.user.id.uuidString
        guard let resolvedUserID else {
            threads = []
            messagesError = DataStoreError.unauthenticated.localizedDescription
            return
        }
        if let lastThreadsFetchAt, Date().timeIntervalSince(lastThreadsFetchAt) < 20, !threads.isEmpty {
            return
        }

        isLoadingThreads = true
        defer { isLoadingThreads = false }

        do {
            // UUID must be lowercase — backend compares against JWT `sub` case-sensitively.
            let response: ThreadsResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: [.init(name: "user_id", value: resolvedUserID.lowercased())],
                requiresAuth: true
            )
            threads = response.threads.filter { !blockedThreadIDs.contains($0.id) }
            messagesError = nil
            lastThreadsFetchAt = Date()
        } catch {
            let message = error.localizedDescription.lowercased()
            if message.contains("access denied") || message.contains("status 403") || message.contains("forbidden") {
                await fallbackThreadsFromBookings()
            } else {
                threads = []
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
        defer { isLoadingMessages = false }

        do {
            let queryItems: [URLQueryItem]
            if let businessID = thread.businessID {
                queryItems = [
                    .init(name: "thread_business_id", value: businessID),
                    .init(name: "limit", value: "40")
                ]
            } else if let bookingID = thread.bookingID {
                queryItems = [
                    .init(name: "booking_id", value: bookingID),
                    .init(name: "limit", value: "40")
                ]
            } else {
                throw DataStoreError.server("Unable to open this conversation.")
            }

            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: queryItems,
                requiresAuth: true
            )
            messages = response.messages.sorted { $0.createdAt < $1.createdAt }
            messageCursor = messages.first?.createdAt
            hasMoreMessages = response.hasMore ?? false
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
                if let index = threads.firstIndex(where: { $0.id == thread.id }) {
                    threads[index] = clearedThread
                }
            }
            let bookingIDs = response.thread?.bookingIDs ?? thread.bookingIDs ?? (thread.bookingID.map { [$0] } ?? [])
            if !bookingIDs.isEmpty {
                await markThreadRead(bookingIDs: bookingIDs)
            }
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
            let queryItems: [URLQueryItem]
            if let businessID = thread.businessID {
                queryItems = [
                    .init(name: "thread_business_id", value: businessID),
                    .init(name: "after", value: ISO8601DateFormatter().string(from: last)),
                    .init(name: "limit", value: "40")
                ]
            } else if let bookingID = thread.bookingID {
                queryItems = [
                    .init(name: "booking_id", value: bookingID),
                    .init(name: "after", value: ISO8601DateFormatter().string(from: last)),
                    .init(name: "limit", value: "40")
                ]
            } else {
                return
            }

            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: queryItems,
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
            let queryItems: [URLQueryItem]
            if let businessID = thread.businessID {
                queryItems = [
                    .init(name: "thread_business_id", value: businessID),
                    .init(name: "before", value: before),
                    .init(name: "limit", value: "40")
                ]
            } else if let bookingID = thread.bookingID {
                queryItems = [
                    .init(name: "booking_id", value: bookingID),
                    .init(name: "before", value: before),
                    .init(name: "limit", value: "40")
                ]
            } else {
                return
            }

            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: queryItems,
                requiresAuth: true
            )
            if !response.messages.isEmpty {
                let existing = Set(messages.map(\.id))
                let newMessages = response.messages.filter { !existing.contains($0.id) }
                messages.insert(contentsOf: newMessages, at: 0)
                messages.sort { $0.createdAt < $1.createdAt }
                messageCursor = messages.first?.createdAt
            }
            hasMoreMessages = response.hasMore ?? false
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

        let response: BookingCreateResponse = try await APIClient.shared.send(
            path: "/api/bookings",
            method: "POST",
            body: BookingCreateRequest(
                businessID: businessID,
                service: service,
                userName: userName,
                userPhone: userPhone,
                userEmail: userEmail,
                note: note,
                scheduledStart: scheduledStart.map { formatter.string(from: $0) },
                scheduledEnd: scheduledEnd.map { formatter.string(from: $0) },
                timezone: tz,
                servicePriceCents: servicePriceCents
            ),
            requiresAuth: true
        )
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
        guard let bookingID = activeThread?.bookingID ?? activeThread?.bookingIDs?.first else {
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
                    content: trimmed
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
                if let index = threads.firstIndex(where: { $0.id == updatedThread.id }) {
                    threads[index] = updatedThread
                }
            }
        } catch {
            messagesError = error.localizedDescription
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
}
