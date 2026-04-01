import SwiftUI
import CoreText

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
struct ScheduleMeApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var dataStore = ScheduleMeDataStore()
    @StateObject private var locationManager = LocationManager()
    @StateObject private var tabRouter = TabRouter()

    init() {
        FontLoader.registerFonts()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(dataStore)
                .environmentObject(locationManager)
                .environmentObject(tabRouter)
                .onOpenURL { url in
                    appState.handleIncomingURL(url)
                }
        }
    }
}
