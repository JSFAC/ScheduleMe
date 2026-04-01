import CoreLocation
import Foundation
import Combine

@MainActor
final class ScheduleMeDataStore: ObservableObject {
    @Published private(set) var businesses: [BusinessSummary] = []
    @Published private(set) var bookings: [BookingSummary] = []
    @Published private(set) var threads: [MessageThread] = []
    @Published private(set) var messages: [ConversationMessage] = []
    @Published private(set) var activeThread: MessageThread?

    @Published var businessError: String?
    @Published var bookingsError: String?
    @Published var messagesError: String?

    @Published private(set) var isLoadingBusinesses = false
    @Published private(set) var isLoadingBookings = false
    @Published private(set) var isLoadingThreads = false
    @Published private(set) var isLoadingMessages = false
    @Published private(set) var isSendingMessage = false

    func reset() {
        businesses = []
        bookings = []
        threads = []
        messages = []
        activeThread = nil
        businessError = nil
        bookingsError = nil
        messagesError = nil
    }

    func closeActiveThread() {
        activeThread = nil
        messages = []
    }

    func loadNearbyBusinesses(coordinate: CLLocationCoordinate2D?) async {
        let fallbackCoordinate = CLLocationCoordinate2D(latitude: 39.8283, longitude: -98.5795)
        let resolvedCoordinate = coordinate ?? fallbackCoordinate
        let radius = coordinate == nil ? "2000" : "25"
        let limit = coordinate == nil ? "50" : "24"

        isLoadingBusinesses = true
        defer { isLoadingBusinesses = false }

        do {
            let response: NearbyBusinessesResponse = try await APIClient.shared.get(
                path: "/api/nearby-businesses",
                queryItems: [
                    .init(name: "lat", value: String(resolvedCoordinate.latitude)),
                    .init(name: "lng", value: String(resolvedCoordinate.longitude)),
                    .init(name: "radius", value: radius),
                    .init(name: "limit", value: limit),
                ]
            )
            businesses = response.businesses
            businessError = nil
        } catch {
            businesses = []
            businessError = error.localizedDescription
        }
    }

    func loadBookings() async {
        isLoadingBookings = true
        defer { isLoadingBookings = false }

        do {
            let response: BookingsResponse = try await APIClient.shared.get(
                path: "/api/bookings",
                requiresAuth: true
            )
            bookings = response.bookings
            bookingsError = nil
        } catch {
            bookings = []
            bookingsError = error.localizedDescription
        }
    }

    func loadThreads(for userID: String?) async {
        guard let userID else {
            threads = []
            messagesError = DataStoreError.unauthenticated.localizedDescription
            return
        }

        isLoadingThreads = true
        defer { isLoadingThreads = false }

        do {
            let response: ThreadsResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: [.init(name: "user_id", value: userID)],
                requiresAuth: true
            )
            threads = response.threads
            messagesError = nil
        } catch {
            threads = []
            messagesError = error.localizedDescription
        }
    }

    func openThread(_ thread: MessageThread) async {
        activeThread = thread
        isLoadingMessages = true
        defer { isLoadingMessages = false }

        do {
            let queryItems: [URLQueryItem]
            if let businessID = thread.businessID {
                queryItems = [.init(name: "thread_business_id", value: businessID)]
            } else if let bookingID = thread.bookingID {
                queryItems = [.init(name: "booking_id", value: bookingID)]
            } else {
                throw DataStoreError.server("Unable to open this conversation.")
            }

            let response: MessagesResponse = try await APIClient.shared.get(
                path: "/api/messages",
                queryItems: queryItems,
                requiresAuth: true
            )
            messages = response.messages
            if let updatedThread = response.thread {
                activeThread = updatedThread
                if let index = threads.firstIndex(where: { $0.id == thread.id }) {
                    threads[index] = updatedThread
                }
            }
            messagesError = nil
        } catch {
            messages = []
            messagesError = error.localizedDescription
        }
    }

    func sendMessage(_ content: String) async {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
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
}
