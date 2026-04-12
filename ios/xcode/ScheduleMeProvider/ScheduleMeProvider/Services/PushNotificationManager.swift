import Foundation
import Combine
import UIKit
import UserNotifications
import Security

@MainActor
final class PushNotificationManager: NSObject, ObservableObject {
    static let shared = PushNotificationManager()

    @Published private(set) var deviceToken: String?
    @Published private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    private let tokenKeychainService = "com.usescheduleme.provider.push"
    private let tokenKeychainAccount = "scheduleme_apns_device_token"
    private var hasRegisteredRemoteNotifications = false

    private override init() {
        super.init()
        deviceToken = KeychainTokenStore.shared.read(service: tokenKeychainService, account: tokenKeychainAccount)
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
        KeychainTokenStore.shared.write(token, service: tokenKeychainService, account: tokenKeychainAccount)
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
            deviceToken = nil
            KeychainTokenStore.shared.delete(service: tokenKeychainService, account: tokenKeychainAccount)
        } catch {
            // Best-effort unregister.
        }
    }

    private func registerForRemoteNotificationsIfNeeded() {
        guard !hasRegisteredRemoteNotifications else { return }
        guard hasAPNsEntitlement else { return }
        hasRegisteredRemoteNotifications = true
        UIApplication.shared.registerForRemoteNotifications()
    }

    private var hasAPNsEntitlement: Bool {
        guard let entitlements = Bundle.main.entitlements else { return false }
        return entitlements["aps-environment"] != nil
    }
}

private final class KeychainTokenStore {
    static let shared = KeychainTokenStore()

    private init() {}

    func read(service: String, account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let token = String(data: data, encoding: .utf8),
              !token.isEmpty else {
            return nil
        }
        return token
    }

    func write(_ value: String, service: String, account: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var add = query
            add.merge(update) { _, new in new }
            _ = SecItemAdd(add as CFDictionary, nil)
        }
    }

    func delete(service: String, account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        _ = SecItemDelete(query as CFDictionary)
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

private extension Bundle {
    var entitlements: [String: Any]? {
        guard let url = url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let raw = String(data: data, encoding: .isoLatin1),
              let plistStart = raw.range(of: "<plist"),
              let plistEnd = raw.range(of: "</plist>") else {
            return nil
        }
        let plistString = String(raw[plistStart.lowerBound...plistEnd.upperBound])
        guard let plistData = plistString.data(using: .utf8),
              let plist = try? PropertyListSerialization.propertyList(from: plistData, options: [], format: nil),
              let root = plist as? [String: Any],
              let ents = root["Entitlements"] as? [String: Any] else {
            return nil
        }
        return ents
    }
}
