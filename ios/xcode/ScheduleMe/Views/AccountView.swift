import SwiftUI

struct AccountView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("Account")
                    .font(.title2).bold()
                if let email = appState.userEmail {
                    Text(email)
                        .foregroundColor(.secondary)
                }
                Button("Sign out") {
                    Task { await appState.signOut() }
                }
                .foregroundColor(.red)
                Spacer()
            }
            .padding()
            .navigationTitle("Account")
        }
    }
}
