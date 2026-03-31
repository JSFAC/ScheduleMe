import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
            BrowseView()
                .tabItem { Label("Browse", systemImage: "magnifyingglass") }
            BookingsView()
                .tabItem { Label("Bookings", systemImage: "calendar") }
            MessagesView()
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right") }
            AccountView()
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
        .tint(Color(red: 0/255, green: 126/255, blue: 109/255))
    }
}
