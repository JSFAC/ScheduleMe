import SwiftUI

struct MessagesView: View {
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("Messages")
                    .font(.title2).bold()
                Text("Live messaging will be wired here.")
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding()
            .navigationTitle("Messages")
        }
    }
}
