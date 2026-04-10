// FILE OVERVIEW:
// Consumer account/profile screen with tabs (profile, payments, addresses, notifications, security).
//
// DEBUG NOTES:
// Dark mode toggle, profile save, and account tab UI issues are handled here.

import SwiftUI
import PostgREST
import Supabase
import UIKit
import PhotosUI

struct AccountView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var selectedTab: AccountTab = .profile
    @State private var fullName = ""
    @State private var emailAddress = ""
    @State private var phoneNumber = ""
    @State private var avatarItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false
    @State private var avatarError: String?
    @AppStorage("scheduleme_display_name") private var storedDisplayName = ""
    @AppStorage("scheduleme_dark_mode") private var darkModeEnabled = false
    @AppStorage("scheduleme_has_logged_in_ever") private var hasLoggedInEver = false
    @AppStorage("scheduleme_notify_booking") private var notifyBooking = true
    @AppStorage("scheduleme_notify_messages") private var notifyMessages = true
    @AppStorage("scheduleme_notify_reminders") private var notifyReminders = true
    @AppStorage("scheduleme_notify_promos") private var notifyPromos = false
    @State private var showingDeleteAlert = false
    @State private var isDeletingAccount = false
    @State private var deleteAccountError: String?
    @State private var showingSupportFallbackAlert = false
    @State private var supportFallbackMessage = ""
    @State private var profileSaveSuccess = false
    @State private var isLoadingProfile = true
    @State private var showingEduVerification = false
    private let openEduOnAppear: Bool
    @State private var addresses: [SavedAddress] = []
    @State private var showingAddAddress = false
    @State private var editingAddress: SavedAddress?
    private let addressesStorageKey = "scheduleme_saved_addresses_secure"
    private let legacyAddressesStorageKey = "scheduleme_saved_addresses"

    init(openEduOnAppear: Bool = false) {
        self.openEduOnAppear = openEduOnAppear
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false, respectsTabBarInset: false) {
                VStack(alignment: .leading, spacing: 18) {
                    ScheduleMeCard {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack(spacing: 14) {
                                PhotosPicker(selection: $avatarItem, matching: .images) {
                                    ZStack {
                                        avatarView
                                        if isUploadingAvatar {
                                            ProgressView()
                                                .tint(.white)
                                                .scaleEffect(0.8)
                                        }
                                    }
                                }
                                .buttonStyle(.plain)

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
                            if let avatarError {
                                Text(avatarError)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(.red)
                            }
                        }
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
                        case .payments:
                            PaymentSettingsView()
                        case .addresses:
                            addressesSection
                        case .notifications:
                            notificationsSection
                        case .security:
                            securitySection
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
                }
                .padding(.top, 12)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .frame(width: 32, height: 32)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .preferredColorScheme(effectiveDarkModeEnabled ? .dark : .light)
        .task {
            await loadProfile()
            loadAddresses()
        }
        .alert("Delete Account", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete Now", role: .destructive) {
                Task { await deleteAccountInApp() }
            }
            Button("Delete in Browser") {
                guard let url = URL(string: "https://usescheduleme.com/account") else { return }
                openURL(url)
            }
        } message: {
            Text("This permanently deletes your account and associated data. This action cannot be undone.")
        }
        .alert("Contact Support", isPresented: $showingSupportFallbackAlert) {
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(supportFallbackMessage)
        }
        .onAppear {
            if fullName.isEmpty {
                fullName = storedDisplayName.isEmpty ? displayNameFromEmail : storedDisplayName
            }
            if emailAddress.isEmpty {
                emailAddress = appState.userEmail ?? ""
            }
            if openEduOnAppear {
                showingEduVerification = true
            }
        }
        .sheet(isPresented: $showingEduVerification) {
            EduVerificationSheet(
                isVerified: appState.eduVerified == true,
                schoolDomain: appState.schoolDomain
            ) {
                Task { await appState.refreshEduVerification() }
            }
            .presentationDetents([.height(300)])
            .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showingAddAddress) {
            AddressEditorSheet(address: editingAddress) { updated in
                upsertAddress(updated)
            }
        }
        .onChange(of: avatarItem) { _, newItem in
            guard let newItem else { return }
            Task { await uploadAvatar(from: newItem) }
        }
        .onAppear {
            applyInterfaceStyleImmediately()
        }
        .onChange(of: darkModeEnabled) { _, _ in
            applyInterfaceStyleImmediately()
        }
    }

    // MARK: - Derived Display State

    private var displayName: String {
        if !fullName.isEmpty { return fullName }
        if !storedDisplayName.isEmpty { return storedDisplayName }
        return displayNameFromEmail
    }

    /// Applies the currently selected theme instantly to every active window,
    /// including this account sheet while it's already presented.
    private func applyInterfaceStyleImmediately() {
        let style: UIUserInterfaceStyle = effectiveDarkModeEnabled ? .dark : .light
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .forEach { scene in
                scene.windows.forEach { window in
                    window.overrideUserInterfaceStyle = style
                }
            }
    }

    private var effectiveDarkModeEnabled: Bool {
        hasLoggedInEver && darkModeEnabled
    }

    private var displayNameFromEmail: String {
        if let email = appState.userEmail, let localPart = email.split(separator: "@").first, !localPart.isEmpty {
            return localPart.capitalized
        }
        return "ScheduleMe user"
    }

    private var initials: String {
        let source = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if let first = source.first { return String(first).uppercased() }
        return "SM"
    }

    // MARK: - Tab Sections

    @ViewBuilder
    private var accountProfileSection: some View {
        if isLoadingProfile {
            AccountProfileSkeletonView()
        } else {
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
                        Text("Managed by Google.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("PHONE NUMBER")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        TextField("(000)-000-0000", text: formattedPhoneBinding)
                            .keyboardType(.phonePad)
                            .scheduleMeFieldStyle()
                        Text("Used for SMS and matching with local pros.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }

                    Button {
                        Task { await saveProfile() }
                    } label: {
                        Text(profileSaveSuccess ? "Saved ✓" : "Save Changes")
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())

                    Button(appState.eduVerified == true ? "View EDU Verification" : "Verify .edu Email") {
                        showingEduVerification = true
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(ScheduleMeTheme.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(ScheduleMeTheme.accent, lineWidth: 1.5)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
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

                    Toggle(isOn: Binding(
                        get: { darkModeEnabled },
                        set: { newValue in
                            darkModeEnabled = newValue
                            applyInterfaceStyleImmediately()
                        }
                    )) {
                        Text("Dark Mode")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }
                    .toggleStyle(SwitchToggleStyle(tint: ScheduleMeTheme.accent))
                    .scaleEffect(0.86)
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Legal")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        Button("Terms of Service") {
                            if let url = URL(string: "https://www.usescheduleme.com/terms") {
                                openURL(url)
                            }
                        }
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                        Button("Privacy Policy") {
                            if let url = URL(string: "https://www.usescheduleme.com/privacy") {
                                openURL(url)
                            }
                        }
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                        Button("Contact Support") {
                            contactSupport()
                        }
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                    }

                    Button("Sign Out") {
                        Task {
                            dataStore.reset()
                            await appState.signOut()
                        }
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())

                    Button(isDeletingAccount ? "Deleting..." : "Delete my account") {
                        showingDeleteAlert = true
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .disabled(isDeletingAccount)

                    if let deleteAccountError {
                        Text(deleteAccountError)
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                            .foregroundColor(.red)
                    }
                }
            }

            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("SHARE")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    if let shareURL = URL(string: "https://usescheduleme.com") {
                        ShareLink(item: shareURL) {
                            Label("Share ScheduleMe", systemImage: "square.and.arrow.up")
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(ScheduleMeTheme.accent)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        }
    }

    private var notificationsSection: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("NOTIFICATIONS")
                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                    .tracking(1.2)
                    .foregroundColor(ScheduleMeTheme.mutedText)
                Text("Alert Preferences")
                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)

                VStack(spacing: 10) {
                    NotifToggleRow(label: "Booking confirmations", description: "When a provider confirms your request", isOn: $notifyBooking)
                    NotifToggleRow(label: "New messages", description: "When a provider sends you a message", isOn: $notifyMessages)
                    NotifToggleRow(label: "Booking reminders", description: "24 hours before a scheduled appointment", isOn: $notifyReminders)
                    NotifToggleRow(label: "Promotions", description: "Deals and new pros in your area", isOn: $notifyPromos)
                }

                Text("Push notification settings are managed by iOS. Tap below to open Settings if needed.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)

                Button("Open iOS Settings") {
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                    UIApplication.shared.open(url)
                }
                .buttonStyle(ScheduleMeSecondaryButtonStyle())
            }
        }
    }

    private var securitySection: some View {
        VStack(spacing: 16) {
            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("SECURITY")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    Text("Account Security")
                        .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)

                    SecurityInfoRow(systemImage: "envelope.badge.shield.half.filled", label: "Email verified", value: appState.userEmail ?? "—")
                    SecurityInfoRow(systemImage: "person.badge.shield.checkmark", label: "Auth method", value: "Apple, Google, or Email")
                    SecurityInfoRow(systemImage: "lock.shield", label: "Session", value: "Active")

                    Text("Your account can be secured through Apple, Google, or email/password depending on how you signed in.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
            }

            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("ACTIVE SESSIONS")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color.green.opacity(0.12))
                            .frame(width: 32, height: 32)
                            .overlay(
                                Image(systemName: "iphone")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(.green)
                            )
                        VStack(alignment: .leading, spacing: 2) {
                            Text("This device")
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                            Text("Current session · Active now")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                        Spacer()
                    }

                    Button {
                        Task {
                            dataStore.reset()
                            await appState.signOut()
                        }
                    } label: {
                        Text("Sign Out All Devices")
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())
                }
            }
        }
    }

    private var addressesSection: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("ADDRESSES")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .tracking(1.2)
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        Text("Saved Addresses")
                            .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }
                    Spacer()
                    Button("Add") {
                        editingAddress = nil
                        showingAddAddress = true
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.accent)
                }

                if addresses.isEmpty {
                    Text("No saved addresses yet.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                } else {
                    VStack(spacing: 10) {
                        ForEach(addresses) { address in
                            Button {
                                editingAddress = address
                                showingAddAddress = true
                            } label: {
                                AddressRow(address: address)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Address Persistence

    private func loadAddresses() {
        if let data = KeychainStore.data(forKey: addressesStorageKey),
           let decoded = try? JSONDecoder().decode([SavedAddress].self, from: data) {
            addresses = decoded
            return
        }

        // One-time migration from legacy plain-text UserDefaults storage.
        if let legacyData = UserDefaults.standard.data(forKey: legacyAddressesStorageKey),
           let decoded = try? JSONDecoder().decode([SavedAddress].self, from: legacyData) {
            addresses = decoded
            if let reEncoded = try? JSONEncoder().encode(decoded) {
                KeychainStore.setData(reEncoded, forKey: addressesStorageKey)
            }
            UserDefaults.standard.removeObject(forKey: legacyAddressesStorageKey)
            return
        }

        addresses = []
    }

    private func persistAddresses() {
        if let data = try? JSONEncoder().encode(addresses) {
            KeychainStore.setData(data, forKey: addressesStorageKey)
            UserDefaults.standard.removeObject(forKey: legacyAddressesStorageKey)
        }
    }

    private func upsertAddress(_ address: SavedAddress) {
        if let index = addresses.firstIndex(where: { $0.id == address.id }) {
            addresses[index] = address
        } else {
            addresses.append(address)
        }
        persistAddresses()
    }

    private struct ProfileRow: Decodable {
        let name: String?
        let phone: String?
        let avatarURL: String?

        enum CodingKeys: String, CodingKey {
            case name
            case phone
            case avatarURL = "avatar_url"
        }
    }

    // MARK: - Profile IO

    /// Loads profile fields from Supabase `profiles` table into local form state.
    private func loadProfile() async {
        isLoadingProfile = true
        defer { isLoadingProfile = false }
        guard let userID = appState.userID else { return }
        do {
            let response: PostgrestResponse<ProfileRow> = try await SupabaseManager.shared.client
                .from("profiles")
                .select("name, phone, avatar_url")
                .eq("id", value: userID)
                .single()
                .execute()
            if let name = response.value.name, !name.isEmpty {
                fullName = name
                storedDisplayName = name
            }
            if let phone = response.value.phone {
                phoneNumber = formatPhoneForDisplay(phone)
            }
            if let avatar = response.value.avatarURL, !avatar.isEmpty {
                appState.avatarURL = avatar
            }
        } catch {
            // Ignore for now
        }
    }

    /// Saves editable profile fields (name/phone) back to Supabase.
    private func saveProfile() async {
        guard let userID = appState.userID else { return }
        struct UpdateProfile: Encodable {
            let name: String
            let phone: String?
        }
        do {
            _ = try await SupabaseManager.shared.client
                .from("profiles")
                .update(UpdateProfile(name: fullName, phone: normalizedPhoneForSave))
                .eq("id", value: userID)
                .execute()
            if !fullName.isEmpty {
                storedDisplayName = fullName
            }
            profileSaveSuccess = true
            try? await Task.sleep(for: .seconds(2))
            profileSaveSuccess = false
        } catch {
            // Ignore for now
        }
    }

    /// Attempts full in-app account deletion and signs out on success.
    private func deleteAccountInApp() async {
        isDeletingAccount = true
        deleteAccountError = nil
        defer { isDeletingAccount = false }

        do {
            try await dataStore.deleteAccount()
            dataStore.reset()
            await appState.signOut()
            dismiss()
        } catch {
            deleteAccountError = "Couldn’t delete account in-app. You can still delete from the website."
        }
    }

    private func contactSupport() {
        guard let supportURL = URL(string: "https://www.usescheduleme.com/support") else {
            supportFallbackMessage = "Could not open support page."
            showingSupportFallbackAlert = true
            return
        }
        openURL(supportURL) { accepted in
            guard accepted == false else { return }
            supportFallbackMessage = "Unable to open support page right now. Please visit https://www.usescheduleme.com/support."
            showingSupportFallbackAlert = true
        }
    }

    /// Uploads selected avatar image through the API and updates global avatar URL.
    private func uploadAvatar(from item: PhotosPickerItem) async {
        isUploadingAvatar = true
        avatarError = nil
        defer { isUploadingAvatar = false }

        guard let data = try? await item.loadTransferable(type: Data.self) else {
            avatarError = "Could not read the selected image."
            return
        }

        let contentType = item.supportedContentTypes.first
        let mimeType = contentType?.preferredMIMEType ?? "image/jpeg"
        let ext = contentType?.preferredFilenameExtension ?? "jpg"
        let base64 = data.base64EncodedString()
        let dataURL = "data:\(mimeType);base64,\(base64)"

        struct UploadAvatarRequest: Encodable {
            let file_data: String
            let file_type: String
            let file_name: String
        }
        struct UploadAvatarResponse: Decodable {
            let url: String
        }

        do {
            let response: UploadAvatarResponse = try await APIClient.shared.send(
                path: "/api/upload-avatar",
                method: "POST",
                body: UploadAvatarRequest(
                    file_data: dataURL,
                    file_type: mimeType,
                    file_name: "avatar.\(ext)"
                ),
                requiresAuth: true
            )
            appState.avatarURL = response.url
        } catch {
            avatarError = "Unable to upload avatar. Please try again."
        }
    }

    private var formattedPhoneBinding: Binding<String> {
        Binding(
            get: { phoneNumber },
            set: { newValue in
                phoneNumber = formatPhoneForDisplay(newValue)
            }
        )
    }

    private var normalizedPhoneForSave: String? {
        let digits = phoneNumber.filter(\.isNumber)
        return digits.isEmpty ? nil : digits
    }

    /// Formats raw digits into `(000)-000-0000` while typing.
    private func formatPhoneForDisplay(_ raw: String) -> String {
        let digits = String(raw.filter(\.isNumber).prefix(10))
        var result = ""
        for (index, char) in digits.enumerated() {
            if index == 0 { result.append("(") }
            if index == 3 { result.append(")-") }
            if index == 6 { result.append("-") }
            result.append(char)
        }
        return result
    }

    @ViewBuilder
    private var avatarView: some View {
        if let avatarURL = appState.avatarURL, let url = URL(string: avatarURL) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Circle()
                        .fill(ScheduleMeTheme.accent)
                        .overlay(
                            Text(initials)
                                .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                                .foregroundColor(.white)
                        )
                }
            }
            .frame(width: 56, height: 56)
            .clipShape(Circle())
            .overlay(Circle().stroke(Color.white, lineWidth: 1))
        } else {
            Circle()
                .fill(ScheduleMeTheme.accent)
                .frame(width: 56, height: 56)
                .overlay(
                    Text(initials)
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundColor(.white)
                )
        }
    }
}

private enum AccountTab: CaseIterable, Identifiable {
    case profile
    case payments
    case addresses
    case notifications
    case security

    var id: String { title }

    var title: String {
        switch self {
        case .profile: return "Profile"
        case .payments: return "Payments"
        case .addresses: return "Addresses"
        case .notifications: return "Notifications"
        case .security: return "Security"
        }
    }

    var systemImage: String {
        switch self {
        case .profile: return "person"
        case .payments: return "creditcard"
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
        .background(ScheduleMeTheme.surface)
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
            .foregroundColor(isSelected ? .white : ScheduleMeTheme.accent)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                    .opacity(isSelected ? 1 : 0.85)
            )
            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

private struct NotifToggleRow: View {
    let label: String
    let description: String
    @Binding var isOn: Bool

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(description)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }
            Spacer()
            Toggle("", isOn: $isOn)
                .toggleStyle(SwitchToggleStyle(tint: ScheduleMeTheme.accent))
                .labelsHidden()
                .scaleEffect(0.84)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(ScheduleMeTheme.cardBorder)
        )
    }
}

private struct SecurityInfoRow: View {
    let systemImage: String
    let label: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(ScheduleMeTheme.accentSoft)
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: systemImage)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                    .tracking(0.5)
                Text(value)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .lineLimit(1)
            }
            Spacer()
        }
    }
}

private struct SavedAddress: Codable, Identifiable, Hashable {
    let id: String
    var label: String
    var line1: String
    var line2: String
    var city: String
    var state: String
    var zip: String

    var formattedLine: String {
        line2.isEmpty ? line1 : "\(line1), \(line2)"
    }

    var formattedCity: String {
        "\(city), \(state) \(zip)"
    }
}

private struct AddressRow: View {
    let address: SavedAddress

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(ScheduleMeTheme.accentSoft)
                .frame(width: 36, height: 36)
                .overlay(
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(ScheduleMeTheme.accent)
                )
            VStack(alignment: .leading, spacing: 4) {
                Text(address.label)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(address.formattedLine)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                Text(address.formattedCity)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            }
            Spacer()
        }
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
    }
}

private struct AccountProfileSkeletonView: View {
    var body: some View {
        VStack(spacing: 16) {
            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        SkeletonCircle(size: 64)
                        VStack(alignment: .leading, spacing: 6) {
                            SkeletonBlock(width: 120, height: 16, cornerRadius: 8)
                            SkeletonBlock(width: 180, height: 12, cornerRadius: 6)
                        }
                        Spacer()
                    }
                    SkeletonBlock(width: 90, height: 10, cornerRadius: 5)
                    SkeletonBlock(width: 120, height: 20, cornerRadius: 8)
                    SkeletonBlock(height: 44, cornerRadius: 14)
                    SkeletonBlock(height: 44, cornerRadius: 14)
                    SkeletonBlock(height: 44, cornerRadius: 14)
                    SkeletonBlock(height: 46, cornerRadius: 16)
                    SkeletonBlock(height: 46, cornerRadius: 14)
                }
            }

            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(width: 80, height: 10, cornerRadius: 5)
                    SkeletonBlock(width: 100, height: 18, cornerRadius: 8)
                    SkeletonBlock(height: 34, cornerRadius: 10)
                    SkeletonBlock(width: 120, height: 12, cornerRadius: 6)
                    SkeletonBlock(width: 90, height: 12, cornerRadius: 6)
                    SkeletonBlock(height: 44, cornerRadius: 14)
                }
            }
        }
    }
}

private struct AddressEditorSheet: View {
    let address: SavedAddress?
    let onSave: (SavedAddress) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var label = ""
    @State private var line1 = ""
    @State private var line2 = ""
    @State private var city = ""
    @State private var state = ""
    @State private var zip = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Label") {
                    TextField("Home, Work, Campus", text: $label)
                }
                Section("Address") {
                    TextField("Street address", text: $line1)
                    TextField("Apt, suite, etc", text: $line2)
                    TextField("City", text: $city)
                    TextField("State", text: $state)
                    TextField("ZIP", text: $zip)
                }
            }
            .navigationTitle(address == nil ? "Add Address" : "Edit Address")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let updated = SavedAddress(
                            id: address?.id ?? UUID().uuidString,
                            label: label.isEmpty ? "Saved Address" : label,
                            line1: line1,
                            line2: line2,
                            city: city,
                            state: state,
                            zip: zip
                        )
                        onSave(updated)
                        dismiss()
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear {
                if let address {
                    label = address.label
                    line1 = address.line1
                    line2 = address.line2
                    city = address.city
                    state = address.state
                    zip = address.zip
                }
            }
        }
    }
}

private struct EduVerificationSheet: View {
    let isVerified: Bool
    let schoolDomain: String?
    let onRefresh: () -> Void
    @Environment(\.dismiss) private var dismiss

    private var campusName: String {
        if let domain = schoolDomain, !domain.isEmpty {
            return domain.replacingOccurrences(of: ".edu", with: "").uppercased()
        }
        return "Campus"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("EDU Verification")
                    .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Spacer()
                Button("Done") { dismiss() }
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.accent)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(isVerified ? "Verified Student" : "Verification Needed")
                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(isVerified ? "Campus access unlocked" : "Use your .edu email to unlock campus-only providers.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                Text("Campus: \(campusName)")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.accent)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )

            Button("Refresh status") {
                onRefresh()
            }
            .buttonStyle(ScheduleMePrimaryButtonStyle())
        }
        .padding(20)
        .background(ScheduleMeTheme.pageBackground)
    }
}
