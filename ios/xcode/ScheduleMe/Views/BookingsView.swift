import SwiftUI

struct BookingsView: View {
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("Bookings")
                    .font(.title2).bold()
                Text("We'll pull your bookings from the API.")
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding()
            .navigationTitle("Bookings")
        }
    }
}
