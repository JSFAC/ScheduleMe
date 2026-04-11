// FILE OVERVIEW:
// Main app entry point, environment injection, tab bar appearance, and global style application.
//
// DEBUG NOTES:
// Dark mode global behavior and startup bootstrapping are configured here.

import SwiftUI
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
#if PROVIDER_APP
    @AppStorage("scheduleme_dark_mode") private var darkModeEnabled = true
#else
    @AppStorage("scheduleme_dark_mode") private var darkModeEnabled = false
#endif

    init() {
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
        UIWindow.appearance().backgroundColor = UIColor(
            red: 17.0 / 255.0,
            green: 17.0 / 255.0,
            blue: 17.0 / 255.0,
            alpha: 1.0
        )
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
                .preferredColorScheme(resolvedColorScheme)
#if PROVIDER_APP
                .progressViewStyle(.linear)
#endif
                .onAppear {
                    // UIKit-level forcing so sheets/fullScreenCover also swap instantly.
                    applyInterfaceStyle()
                }
                .onChange(of: darkModeEnabled) { _, _ in
                    applyInterfaceStyle()
                }
                .onChange(of: appState.isAuthenticated) { _, _ in
                    applyInterfaceStyle()
                }
                .onChange(of: appState.isSigningOut) { _, _ in
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
        let style: UIUserInterfaceStyle = resolvedColorScheme == .dark ? .dark : .light
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .forEach { scene in
                scene.windows.forEach { window in
                    window.overrideUserInterfaceStyle = style
                }
            }
    }

    private var resolvedColorScheme: ColorScheme {
        if !appState.isAuthenticated || appState.isSigningOut {
            return .dark
        }
        return darkModeEnabled ? .dark : .light
    }
}
