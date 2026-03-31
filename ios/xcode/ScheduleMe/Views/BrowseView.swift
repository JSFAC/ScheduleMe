import SwiftUI

struct BrowseView: View {
    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("Browse")
                    .font(.title2).bold()
                Text("Business discovery will live here.")
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding()
            .navigationTitle("Browse")
        }
    }
}
