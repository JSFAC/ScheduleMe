import SwiftUI

struct HomeView: View {
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("Welcome to ScheduleMe")
                    .font(.title2).bold()
                Text("This is the native app shell. We'll wire your real data next.")
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding()
            .navigationTitle("Home")
        }
    }
}
