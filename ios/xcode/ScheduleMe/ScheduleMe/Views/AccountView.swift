import SwiftUI
import PostgREST
import UIKit

struct AccountView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @State private var selectedTab: AccountTab = .profile
    @State private var fullName = ""
    @State private var emailAddress = ""
    @State private var phoneNumber = ""
    @State private var preferredContact = "Text message"
    @State private var serviceRadius = "Within 5 miles"
    @State private var darkModeEnabled = false

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false) {
                VStack(alignment: .leading, spacing: 18) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack(spacing: 14) {
                                Circle()
                                    .fill(ScheduleMeTheme.accent)
                                    .frame(width: 56, height: 56)
                                    .overlay(
                                        Text(initials)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                                            .foregroundColor(.white)
                                    )

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(fullName.isEmpty ? "ScheduleMe user" : fullName)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.titleText)
                                    Text(emailAddress.isEmpty ? (appState.userEmail ?? "") : emailAddress)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                }
                                Spacer()
                            }

                            Button(action: { tabRouter.selected = .browse }) {
                                Text("+ New Request")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 10)
                                    .background(ScheduleMeTheme.accent)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, 20)

                    HStack(spacing: 12) {
                        AccountStatCard(
                            title: "Completed",
                            value: "\(completedCount)",
                            systemImage: "checkmark"
                        )
                        AccountStatCard(
                            title: "Saved Addresses",
                            value: "0",
                            systemImage: "mappin.and.ellipse"
                        )
                    }
                    .padding(.horizontal, 20)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(AccountTab.allCases) { tab in
                                AccountTabButton(
                                    title: tab.title,
                                    systemImage: tab.systemImage,
                                    isSelected: tab == selectedTab
                                ) {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        selectedTab = tab
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                    }

                    Group {
                        switch selectedTab {
                        case .profile:
                            accountProfileSection
                        case .addresses:
                            accountPlaceholder(title: "Addresses", message: "Add and manage saved addresses here.")
                        case .notifications:
                            accountPlaceholder(title: "Notifications", message: "Notification preferences are coming soon.")
                        case .security:
                            accountPlaceholder(title: "Security", message: "Security settings are coming soon.")
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
                }
                .padding(.top, 12)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            await loadProfile()
        }
        .onAppear {
            if fullName.isEmpty {
                fullName = displayName
            }
            if emailAddress.isEmpty {
                emailAddress = appState.userEmail ?? ""
            }
        }
    }

    private var completedCount: Int {
        dataStore.bookings.filter { $0.statusLabel.lowercased() == "completed" }.count
    }

    private var displayName: String {
        if let email = appState.userEmail, let localPart = email.split(separator: "@").first, !localPart.isEmpty {
            return localPart.capitalized
        }
        return "ScheduleMe user"
    }

    private var initials: String {
        guard let first = displayName.first else { return "SM" }
        return String(first).uppercased()
    }

    private var accountProfileSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("PERSONAL")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    Text("Your Info")
                        .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("FULL NAME")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        TextField("Your name", text: $fullName)
                            .scheduleMeFieldStyle()
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("EMAIL ADDRESS")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        TextField("you@email.com", text: $emailAddress)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .scheduleMeFieldStyle()
                            .disabled(true)
                        Text("Managed by Google.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("PHONE NUMBER")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        TextField("(555) 000-1234", text: $phoneNumber)
                            .keyboardType(.phonePad)
                            .scheduleMeFieldStyle()
                        Text("Used for SMS and matching with local pros.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }

                    Button("Save Changes") {
                        Task { await saveProfile() }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())

                    Button(appState.eduVerified == true ? "View EDU Verification" : "Verify .edu Email") {
                        openEduVerification()
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())
                }
            }

            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("PREFERENCES")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    Text("Service Settings")
                        .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)

                    Picker("Preferred contact", selection: $preferredContact) {
                        Text("Text message").tag("Text message")
                        Text("Email").tag("Email")
                        Text("Phone call").tag("Phone call")
                    }
                    .pickerStyle(.menu)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))

                    Picker("Service radius", selection: $serviceRadius) {
                        Text("Within 5 miles").tag("Within 5 miles")
                        Text("Within 10 miles").tag("Within 10 miles")
                        Text("Within 25 miles").tag("Within 25 miles")
                    }
                    .pickerStyle(.menu)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
                }
            }

            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("ACCOUNT")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    Text("Manage")
                        .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)

                    Toggle(isOn: $darkModeEnabled) {
                        Text("Dark Mode")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }
                    .toggleStyle(SwitchToggleStyle(tint: ScheduleMeTheme.accent))

                    Button("Sign Out") {
                        Task {
                            dataStore.reset()
                            await appState.signOut()
                        }
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())

                    Button("Delete my account") {
                        guard let url = URL(string: "https://usescheduleme.com/account") else { return }
                        UIApplication.shared.open(url)
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func accountPlaceholder(title: String, message: String) -> some View {
        ScheduleMeEmptyState(
            title: title,
            message: message,
            systemImage: "rectangle.stack"
        )
    }

    private func openEduVerification() {
        guard let url = URL(string: "https://usescheduleme.com/account") else { return }
        UIApplication.shared.open(url)
    }

    private struct ProfileRow: Decodable {
        let name: String?
        let phone: String?
    }

    private func loadProfile() async {
        guard let userID = appState.userID else { return }
        do {
            let response: PostgrestResponse<ProfileRow> = try await SupabaseManager.shared.client.database
                .from("profiles")
                .select("name, phone")
                .eq("id", value: userID)
                .single()
                .execute()
            if let name = response.value.name, !name.isEmpty {
                fullName = name
            }
            if let phone = response.value.phone {
                phoneNumber = phone
            }
        } catch {
            // Ignore for now
        }
    }

    private func saveProfile() async {
        guard let userID = appState.userID else { return }
        struct UpdateProfile: Encodable {
            let name: String
            let phone: String?
        }
        do {
            _ = try await SupabaseManager.shared.client.database
                .from("profiles")
                .update(UpdateProfile(name: fullName, phone: phoneNumber.isEmpty ? nil : phoneNumber))
                .eq("id", value: userID)
                .execute()
        } catch {
            // Ignore for now
        }
    }
}

private enum AccountTab: CaseIterable, Identifiable {
    case profile
    case addresses
    case notifications
    case security

    var id: String { title }

    var title: String {
        switch self {
        case .profile: return "Profile"
        case .addresses: return "Addresses"
        case .notifications: return "Notifications"
        case .security: return "Security"
        }
    }

    var systemImage: String {
        switch self {
        case .profile: return "person"
        case .addresses: return "mappin.and.ellipse"
        case .notifications: return "bell"
        case .security: return "lock"
        }
    }
}

private struct AccountStatCard: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(ScheduleMeTheme.accentSoft)
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: systemImage)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }

            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(ScheduleMeTheme.cardBorder))
    }
}

private struct AccountTabButton: View {
    let title: String
    let systemImage: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.system(size: 12, weight: .semibold))
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
            }
            .foregroundColor(isSelected ? .white : ScheduleMeTheme.titleText)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(isSelected ? ScheduleMeTheme.accent : Color.white)
                    .opacity(isSelected ? 1 : 0.85)
            )
            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}
