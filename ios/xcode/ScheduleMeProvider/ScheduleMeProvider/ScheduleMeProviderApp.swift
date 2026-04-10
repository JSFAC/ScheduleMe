// FILE OVERVIEW:
// Main app entry point, environment injection, tab bar appearance, and global style application.
//
// DEBUG NOTES:
// Dark mode global behavior and startup bootstrapping are configured here.

import SwiftUI
import CoreText
import UIKit
#if canImport(StripePaymentSheet)
import StripePaymentSheet
#endif

final class ScheduleMeProviderAppDelegate: NSObject, UIApplicationDelegate {
    @MainActor
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        PushNotificationManager.shared.configure()
        return true
    }

    @MainActor
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushNotificationManager.shared.handleRegisteredDeviceToken(deviceToken)
    }

    @MainActor
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        #if DEBUG
        print("APNs registration failed: \(error.localizedDescription)")
        #endif
    }
}

// MARK: - App Entry

private enum FontLoader {
    static func registerFonts() {
        ["PlusJakartaSans-VariableFont_wght", "PlusJakartaSans-Italic-VariableFont_wght"].forEach { name in
            let directURL = Bundle.main.url(forResource: name, withExtension: "ttf")
            let nestedURL = Bundle.main.url(forResource: name, withExtension: "ttf", subdirectory: "Resources/Fonts")
            [directURL, nestedURL].compactMap { $0 }.forEach { url in
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
}

@main
struct ScheduleMeProviderApp: App {
    @UIApplicationDelegateAdaptor(ScheduleMeProviderAppDelegate.self) private var appDelegate
    // Shared app-level state objects injected once and consumed by views via @EnvironmentObject.
    @StateObject private var appState = AppState()
    @StateObject private var dataStore = ScheduleMeDataStore()
    @StateObject private var providerDataStore = ProviderDataStore()
    @StateObject private var locationManager = LocationManager()
    @StateObject private var tabRouter = TabRouter()
    @StateObject private var providerTabRouter = ProviderTabRouter()
    // Single persisted source of truth for user-selected appearance.
    @AppStorage("scheduleme_dark_mode") private var darkModeEnabled = false

    init() {
        FontLoader.registerFonts()
#if canImport(StripePaymentSheet)
        if let key = Bundle.main.object(forInfoDictionaryKey: "STRIPE_PUBLISHABLE_KEY") as? String,
           !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            StripeAPI.defaultPublishableKey = key
        }
#endif
        let appearance = UITabBarAppearance()
        // Keep the native iOS tab bar material so we preserve the glassy selector behavior.
        appearance.configureWithDefaultBackground()
        let itemAppearance = UITabBarItemAppearance(style: .stacked)
        itemAppearance.normal.iconColor = UIColor(ScheduleMeTheme.mutedText)
        itemAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor(ScheduleMeTheme.mutedText)]
        itemAppearance.selected.iconColor = UIColor(ScheduleMeTheme.accent)
        itemAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor(ScheduleMeTheme.accent)]
        appearance.stackedLayoutAppearance = itemAppearance
        appearance.inlineLayoutAppearance = itemAppearance
        appearance.compactInlineLayoutAppearance = itemAppearance
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().isHidden = false
        UITabBar.appearance().isTranslucent = true
        UITabBar.appearance().unselectedItemTintColor = UIColor(ScheduleMeTheme.mutedText)
        UITabBar.appearance().tintColor = UIColor(ScheduleMeTheme.accent)
        UIWindow.appearance().backgroundColor = UIColor(ScheduleMeTheme.pageBackground)
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }

    var body: some Scene {
        WindowGroup {
            Group {
                #if PROVIDER_APP
                ProviderRootView()
                #else
                RootView()
                #endif
            }
                .environmentObject(appState)
                .environmentObject(dataStore)
                .environmentObject(providerDataStore)
                .environmentObject(locationManager)
                .environmentObject(tabRouter)
                .environmentObject(providerTabRouter)
                // SwiftUI-level scheme preference.
                #if PROVIDER_APP
                .preferredColorScheme(.dark)
                #else
                .preferredColorScheme(darkModeEnabled ? .dark : .light)
                #endif
                .onAppear {
                    // UIKit-level forcing so sheets/fullScreenCover also swap instantly.
                    applyInterfaceStyle()
                }
                .onChange(of: darkModeEnabled) { _, _ in
                    applyInterfaceStyle()
                }
                .onOpenURL { url in
                    appState.handleIncomingURL(url)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL {
                        appState.handleIncomingURL(url)
                    }
                }
        }
    }

    /// Forces every active UIWindow to the selected style.
    /// This is intentionally duplicated with SwiftUI `.preferredColorScheme`
    /// because some modal stacks lag if we only set one side.
    private func applyInterfaceStyle() {
        #if PROVIDER_APP
        let style: UIUserInterfaceStyle = .dark
        #else
        let style: UIUserInterfaceStyle = darkModeEnabled ? .dark : .light
        #endif
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .forEach { scene in
                scene.windows.forEach { window in
                    window.overrideUserInterfaceStyle = style
                }
            }
    }
}
