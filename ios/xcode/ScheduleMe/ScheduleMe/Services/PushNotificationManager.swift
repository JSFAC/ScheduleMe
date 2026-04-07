import Foundation
import Combine
import UIKit
import UserNotifications

@MainActor
final class PushNotificationManager: NSObject, ObservableObject {
    static let shared = PushNotificationManager()

    @Published private(set) var deviceToken: String?
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    private let tokenDefaultsKey = "scheduleme_apns_device_token"
    private var hasRegisteredRemoteNotifications = false

    private override init() {
        super.init()
        deviceToken = UserDefaults.standard.string(forKey: tokenDefaultsKey)
    }

    func configure() {
        UNUserNotificationCenter.current().delegate = self
        Task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            authorizationStatus = settings.authorizationStatus
        }
    }

    /// Requests notification permission and registers APNs token on success.
    func requestAuthorizationIfNeeded() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        authorizationStatus = settings.authorizationStatus

        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            registerForRemoteNotificationsIfNeeded()
        case .denied:
            return
        case .notDetermined:
            do {
                let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
                let refreshed = await center.notificationSettings()
                authorizationStatus = refreshed.authorizationStatus
                if granted {
                    registerForRemoteNotificationsIfNeeded()
                }
            } catch {
                return
            }
        @unknown default:
            return
        }
    }

    func handleRegisteredDeviceToken(_ tokenData: Data) {
        let token = tokenData.map { String(format: "%02.2hhx", $0) }.joined()
        guard !token.isEmpty else { return }
        deviceToken = token
        UserDefaults.standard.set(token, forKey: tokenDefaultsKey)
        Task { await syncTokenIfPossible() }
    }

    func syncTokenIfPossible() async {
        guard let token = deviceToken, !token.isEmpty else { return }
        do {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/push-tokens",
                method: "POST",
                body: PushTokenRequest(token: token, platform: "ios"),
                requiresAuth: true
            )
        } catch {
            // Best-effort sync; next app resume/login retries.
        }
    }

    func unregisterCurrentTokenIfPossible() async {
        guard let token = deviceToken, !token.isEmpty else { return }
        do {
            let _: GenericSuccessResponse = try await APIClient.shared.send(
                path: "/api/push-tokens",
                method: "DELETE",
                body: PushTokenRequest(token: token, platform: "ios"),
                requiresAuth: true
            )
        } catch {
            // Best-effort unregister.
        }
    }

    private func registerForRemoteNotificationsIfNeeded() {
        guard !hasRegisteredRemoteNotifications else { return }
        hasRegisteredRemoteNotifications = true
        UIApplication.shared.registerForRemoteNotifications()
    }
}

extension PushNotificationManager: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }
}
