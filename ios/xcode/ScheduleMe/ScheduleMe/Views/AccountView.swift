// FILE OVERVIEW:
// Unified account screen with Customer/Provider modes and mode-specific tabs.
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
    @AppStorage("scheduleme_account_mode") private var storedAccountModeRaw = AccountMode.customer.rawValue
    @State private var accountMode: AccountMode = .customer
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
    @State private var showingAuth = false
    @State private var authInitialStep: AuthView.AuthStep = .login
    @State private var showingEduVerification = false
    @State private var showingEduStatus = false
    private let openEduOnAppear: Bool
    private let openProviderOnAppear: Bool
    @State private var addresses: [SavedAddress] = []
    @State private var showingAddAddress = false
    @State private var editingAddress: SavedAddress?
    @State private var providerBusiness: ProviderOwnedBusiness?
    @State private var providerChecklist: ProviderPublishChecklist?
    @State private var providerIsLive = false
    @State private var providerPublishedAt: Date?
    @State private var providerTrustStatus = "clear"
    @State private var providerServicesCount = 0
    @State private var isLoadingProvider = false
    @State private var providerActionInFlight = false
    @State private var providerErrorText: String?
    @State private var providerInfoText: String?
    @State private var showingProviderOnboarding = false
    private let addressesStorageKey = "scheduleme_saved_addresses_secure"
    private let legacyAddressesStorageKey = "scheduleme_saved_addresses"

    init(openEduOnAppear: Bool = false, openProviderOnAppear: Bool = false) {
        self.openEduOnAppear = openEduOnAppear
        self.openProviderOnAppear = openProviderOnAppear
    }

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false, respectsTabBarInset: false) {
                VStack(alignment: .leading, spacing: 18) {
                    if !appState.isAuthenticated {
                        ScheduleMeCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Browsing as guest")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text("Sign in to book services, message providers, and manage your account.")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)

                                HStack(spacing: 10) {
                                    Button("Log in") {
                                        authInitialStep = .login
                                        showingAuth = true
                                    }
                                    .buttonStyle(ScheduleMeSecondaryButtonStyle())

                                    Button("Sign up") {
                                        authInitialStep = .signup
                                        showingAuth = true
                                    }
                                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                                }

                                Button("Become a provider") {
                                    showingProviderOnboarding = true
                                }
                                .buttonStyle(ScheduleMeSecondaryButtonStyle())

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
                            }
                        }
                        .padding(.horizontal, 20)
                    } else {
                        ScheduleMeCard {
                            VStack(alignment: .leading, spacing: 16) {
                                HStack(spacing: 14) {
                                    PhotosPicker(selection: $avatarItem, matching: .images) {
                                        ZStack {
                                            avatarView
                                            if isUploadingAvatar {
                                                ScheduleMeLoadingBar(
                                                    width: 36,
                                                    height: 5,
                                                    tint: .white,
                                                    track: Color.white.opacity(0.28),
                                                    minimumFill: 0.18
                                                )
                                            }
                                        }
                                    }
                                    .buttonStyle(.plain)

                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(fullName.isEmpty ? "ScheduleMe user" : fullName)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                                            .foregroundColor(ScheduleMeTheme.titleText)
                                        Text(accountEmailDisplay)
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

                        modeSwitcher
                            .padding(.horizontal, 20)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(modeTabs) { tab in
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
                            case .provider:
                                providerSection
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
                }
                .padding(.top, 12)
            }
            .overlay(alignment: .bottom) {
                LinearGradient(
                    colors: [
                        ScheduleMeTheme.creamBackground.opacity(0),
                        ScheduleMeTheme.creamBackground.opacity(0.85),
                        ScheduleMeTheme.creamBackground
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 36)
                .allowsHitTesting(false)
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
                emailAddress = usingApplePrivateRelay ? "Apple ID" : (appState.userEmail ?? "")
            }
            if let restoredMode = AccountMode(rawValue: storedAccountModeRaw) {
                accountMode = restoredMode
            } else {
                accountMode = .customer
            }
            if openProviderOnAppear {
                accountMode = .provider
                selectedTab = .provider
            }
            ensureTabSelectionValidForMode()
            if openEduOnAppear {
                withAnimation(.spring(response: 0.34, dampingFraction: 0.9)) {
                    if appState.eduVerified == true {
                        showingEduVerification = false
                        showingEduStatus = true
                    } else {
                        showingEduStatus = false
                        showingEduVerification = true
                    }
                }
            }
        }
        .sheet(isPresented: $showingAddAddress) {
            AddressEditorSheet(address: editingAddress) { updated in
                upsertAddress(updated)
            }
        }
        .fullScreenCover(isPresented: $showingProviderOnboarding) {
            ProviderOnboardingSheet { _ in
                accountMode = .provider
                selectedTab = .provider
                Task { await loadProviderHub() }
            }
        }
        .fullScreenCover(isPresented: $showingAuth) {
            AuthView(
                initialStep: authInitialStep,
                onContinueAsGuest: {
                    showingAuth = false
                }
            )
        }
        .overlay {
            if showingEduVerification {
                ZStack {
                    Color.black.opacity(0.45)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showingEduVerification = false
                            }
                        }

                    EduVerificationSheet(
                        initialEmail: nil,
                        onSendCode: { email in
                            try await appState.requestEduVerificationCode(email: email)
                        },
                        onVerifyCode: { code in
                            try await appState.confirmEduVerificationCode(code: code)
                        },
                        onClose: { showingEduVerification = false }
                    )
                    .padding(.horizontal, 20)
                    .transition(.scale(scale: 0.95).combined(with: .opacity))
                }
                .transition(.opacity)
            }
        }
        .animation(.spring(response: 0.34, dampingFraction: 0.9), value: showingEduVerification)
        .overlay {
            if showingEduStatus {
                ZStack {
                    Color.black.opacity(0.45)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showingEduStatus = false
                            }
                        }

                    EduVerificationStatusModal(
                        isVerified: appState.eduVerified == true,
                        schoolDomain: appState.schoolDomain,
                        onClose: { showingEduStatus = false },
                        onRefresh: {
                            Task { await appState.refreshEduVerification() }
                        }
                    )
                    .padding(.horizontal, 20)
                    .transition(.scale(scale: 0.95).combined(with: .opacity))
                }
                .transition(.opacity)
            }
        }
        .animation(.spring(response: 0.34, dampingFraction: 0.9), value: showingEduStatus)
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
        .onChange(of: selectedTab) { _, tab in
            guard tab == .provider else { return }
            Task { await loadProviderHub() }
        }
        .onChange(of: accountMode) { _, newMode in
            storedAccountModeRaw = newMode.rawValue
            ensureTabSelectionValidForMode()
            if selectedTab == .provider {
                Task { await loadProviderHub() }
            }
        }
    }

    // MARK: - Derived Display State

    private var displayName: String {
        if !fullName.isEmpty { return fullName }
        if !storedDisplayName.isEmpty { return storedDisplayName }
        return displayNameFromEmail
    }

    private var usingApplePrivateRelay: Bool {
        let auth = appState.authMethodDisplay.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let email = appState.userEmail?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        return auth == "apple" && email.contains("privaterelay.appleid.com")
    }

    private var accountEmailDisplay: String {
        if usingApplePrivateRelay { return "Apple ID" }
        if !emailAddress.isEmpty { return emailAddress }
        return appState.userEmail ?? ""
    }

    private var managedByLabel: String {
        let auth = appState.authMethodDisplay.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch auth {
        case "apple":
            return usingApplePrivateRelay ? "Managed by Apple (Private Relay)." : "Managed by Apple."
        case "google":
            return "Managed by Google."
        case "email/password":
            return "Managed by email/password sign-in."
        default:
            return "Managed by your sign-in provider."
        }
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

    private var modeTabs: [AccountTab] {
        switch accountMode {
        case .customer:
            return [.profile, .payments, .addresses, .notifications, .security]
        case .provider:
            return [.provider, .payments, .notifications, .security]
        }
    }

    private var modeSwitcher: some View {
        HStack(spacing: 10) {
            AccountModeButton(
                title: "Customer",
                systemImage: "person",
                isSelected: accountMode == .customer
            ) {
                withAnimation(.easeInOut(duration: 0.2)) {
                    accountMode = .customer
                }
            }

            AccountModeButton(
                title: "Provider",
                systemImage: "briefcase",
                isSelected: accountMode == .provider
            ) {
                withAnimation(.easeInOut(duration: 0.2)) {
                    accountMode = .provider
                }
            }
        }
    }

    private func ensureTabSelectionValidForMode() {
        if modeTabs.contains(selectedTab) { return }
        selectedTab = modeTabs.first ?? .profile
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
                            .disabled(usingApplePrivateRelay)
                            .opacity(usingApplePrivateRelay ? 0.75 : 1.0)
                        Text(managedByLabel)
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
                        if appState.eduVerified == true {
                            showingEduStatus = true
                        } else {
                            showingEduVerification = true
                        }
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

    private var providerSection: some View {
        VStack(spacing: 16) {
            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 12) {
                    Text("PROVIDER HUB")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    Text(providerBusiness?.name ?? "Create your listing")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)

                    if providerBusiness != nil {
                        Text(providerIsLive ? "Live and bookable" : "Hidden until you publish")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundColor(providerIsLive ? Color(hex: "16a34a") : Color(hex: "ca8a04"))
                    } else {
                        Text("Start your listing, then finish setup and publish when you're ready.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }

                    if let providerErrorText {
                        Text(providerErrorText)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(.red)
                    }
                    if let providerInfoText {
                        Text(providerInfoText)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.accent)
                    }

                    if isLoadingProvider {
                        ScheduleMeLoadingBar(width: 120, height: 8, tint: ScheduleMeTheme.accent)
                    }

                    if providerBusiness == nil {
                        Button("Create Listing") {
                            showingProviderOnboarding = true
                        }
                        .buttonStyle(ScheduleMePrimaryButtonStyle())
                    } else {
                        HStack(spacing: 10) {
                            Button("Refresh") {
                                Task { await loadProviderHub() }
                            }
                            .buttonStyle(ScheduleMeSecondaryButtonStyle())
                            .disabled(isLoadingProvider || providerActionInFlight)

                            Button(providerIsLive ? "Unpublish" : "Publish") {
                                Task { await setPublishState(makeLive: !providerIsLive) }
                            }
                            .buttonStyle(ScheduleMePrimaryButtonStyle())
                            .disabled(isLoadingProvider || providerActionInFlight)
                        }
                    }
                }
            }

            if let checklist = providerChecklist, providerBusiness != nil {
                ScheduleMeCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("PUBLISH CHECKLIST")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .tracking(1.2)
                            .foregroundColor(ScheduleMeTheme.mutedText)

                        checklistRow("Core profile", done: checklist.coreProfile)
                        checklistRow("Services", done: checklist.services, trailing: providerServicesCount > 0 ? "\(providerServicesCount)" : nil)
                        checklistRow("Media", done: checklist.media)
                        checklistRow("Stripe connected", done: checklist.stripe)
                        checklistRow("Trust clear", done: checklist.trustClear, trailing: providerTrustStatus.replacingOccurrences(of: "_", with: " ").capitalized)

                        if let providerBusiness {
                            HStack(spacing: 10) {
                                Button("Manage Stripe") {
                                    Task { await openStripeConnect(for: providerBusiness.id) }
                                }
                                .buttonStyle(ScheduleMeSecondaryButtonStyle())
                                .disabled(providerActionInFlight)

                                Button("Open setup dashboard") {
                                    if let url = URL(string: "https://usescheduleme.com/business/dashboard?id=\(providerBusiness.id)") {
                                        openURL(url)
                                    }
                                }
                                .buttonStyle(ScheduleMeSecondaryButtonStyle())
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func checklistRow(_ title: String, done: Bool, trailing: String? = nil) -> some View {
        HStack(spacing: 10) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(done ? Color(hex: "16a34a") : ScheduleMeTheme.mutedText)
            Text(title)
                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                .foregroundColor(ScheduleMeTheme.titleText)
            Spacer()
            if let trailing, !trailing.isEmpty {
                Text(trailing)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.mutedText)
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

                    SecurityInfoRow(
                        systemImage: "envelope.badge.shield.half.filled",
                        label: "Email verified",
                        value: usingApplePrivateRelay ? "Apple ID" : (appState.userEmail ?? "—")
                    )
                    SecurityInfoRow(systemImage: appState.authMethodSymbol, label: "Auth method", value: appState.authMethodDisplay)
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

    private struct ProviderOwnedBusiness: Decodable {
        let id: String
        let name: String?
        let description: String?
        let address: String?
        let city: String?
        let zip: String?
        let phone: String?
        let website: String?
        let instagram: String?
        let serviceTags: [String]?
        let coverURL: String?
        let mediaURLs: [String]?
        let stripeOnboarded: Bool?
        let stripeAccountID: String?
        let publicVisibility: Bool?
        let isOnboarded: Bool?
        let trustStatus: String?
        let trustFlagged: Bool?
        let publishedAt: Date?

        enum CodingKeys: String, CodingKey {
            case id
            case name
            case description
            case address
            case city
            case zip
            case phone
            case website
            case instagram
            case serviceTags = "service_tags"
            case coverURL = "cover_url"
            case mediaURLs = "media_urls"
            case stripeOnboarded = "stripe_onboarded"
            case stripeAccountID = "stripe_account_id"
            case publicVisibility = "public_visibility"
            case isOnboarded = "is_onboarded"
            case trustStatus = "trust_status"
            case trustFlagged = "trust_flagged"
            case publishedAt = "published_at"
        }
    }

    private struct ProviderPublishChecklist: Decodable {
        let coreProfile: Bool
        let services: Bool
        let media: Bool
        let stripe: Bool
        let trustClear: Bool
        let readyToPublish: Bool

        enum CodingKeys: String, CodingKey {
            case coreProfile = "coreProfile"
            case services
            case media
            case stripe
            case trustClear = "trustClear"
            case readyToPublish = "readyToPublish"
        }
    }

    private struct ProviderPublishStatusResponse: Decodable {
        let checklist: ProviderPublishChecklist?
        let isLive: Bool?
        let trustStatus: String?
        let publishedAt: Date?

        enum CodingKeys: String, CodingKey {
            case checklist
            case isLive = "is_live"
            case trustStatus = "trust_status"
            case publishedAt = "published_at"
        }
    }

    private struct ProviderPublishMutationResponse: Decodable {
        let success: Bool?
        let action: String?
        let checklist: ProviderPublishChecklist?
        let error: String?
    }

    private struct ServicesResponse: Decodable {
        let services: [ServiceItem]
    }

    private struct ServiceItem: Decodable, Identifiable {
        let id: String
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
                appState.userFirstName = name
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .split(separator: " ")
                    .first
                    .map { String($0).capitalized }
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
                appState.userFirstName = fullName
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .split(separator: " ")
                    .first
                    .map { String($0).capitalized }
            }
            profileSaveSuccess = true
            try? await Task.sleep(for: .seconds(2))
            profileSaveSuccess = false
        } catch {
            // Ignore for now
        }
    }

    private func loadProviderHub() async {
        guard appState.isAuthenticated else { return }
        isLoadingProvider = true
        providerErrorText = nil
        providerInfoText = nil
        defer { isLoadingProvider = false }

        do {
            providerBusiness = try await fetchOwnedBusiness()
        } catch {
            providerBusiness = nil
        }

        guard let business = providerBusiness else {
            providerChecklist = nil
            providerIsLive = false
            providerPublishedAt = nil
            providerTrustStatus = "clear"
            providerServicesCount = 0
            return
        }

        do {
            let status: ProviderPublishStatusResponse = try await APIClient.shared.get(
                path: "/api/provider-publish",
                requiresAuth: true
            )
            providerChecklist = status.checklist
            providerIsLive = status.isLive ?? (business.publicVisibility == true)
            providerPublishedAt = status.publishedAt ?? business.publishedAt
            providerTrustStatus = status.trustStatus ?? business.trustStatus ?? "clear"
        } catch {
            providerChecklist = nil
            providerIsLive = business.publicVisibility == true
            providerPublishedAt = business.publishedAt
            providerTrustStatus = business.trustStatus ?? "clear"
            providerErrorText = error.localizedDescription
        }

        do {
            let response: ServicesResponse = try await APIClient.shared.get(
                path: "/api/services",
                queryItems: [.init(name: "business_id", value: business.id)],
                requiresAuth: false
            )
            providerServicesCount = response.services.count
        } catch {
            providerServicesCount = 0
        }
    }

    private func fetchOwnedBusiness() async throws -> ProviderOwnedBusiness? {
        guard let userID = appState.userID else { return nil }
        let selectClause = "id,name,description,address,city,zip,phone,website,instagram,service_tags,cover_url,media_urls,stripe_onboarded,stripe_account_id,public_visibility,is_onboarded,trust_status,trust_flagged,published_at"

        if let ownerResult: PostgrestResponse<[ProviderOwnedBusiness]> = try? await SupabaseManager.shared.client
            .from("businesses")
            .select(selectClause)
            .eq("owner_id", value: userID)
            .limit(1)
            .execute() {
            if let first = ownerResult.value.first {
                return first
            }
        }

        if let email = appState.userEmail?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
           !email.isEmpty,
           let emailResult: PostgrestResponse<[ProviderOwnedBusiness]> = try? await SupabaseManager.shared.client
            .from("businesses")
            .select(selectClause)
            .eq("owner_email", value: email)
            .limit(1)
            .execute() {
            if let first = emailResult.value.first {
                return first
            }
        }

        return nil
    }

    private func setPublishState(makeLive: Bool) async {
        guard appState.isAuthenticated else { return }
        providerActionInFlight = true
        providerErrorText = nil
        providerInfoText = nil
        defer { providerActionInFlight = false }

        struct Request: Encodable { let action: String }
        let payload = Request(action: makeLive ? "publish" : "unpublish")
        do {
            let response: ProviderPublishMutationResponse = try await APIClient.shared.send(
                path: "/api/provider-publish",
                method: "POST",
                body: payload,
                requiresAuth: true
            )
            if response.success == true {
                providerInfoText = makeLive ? "Profile is now live." : "Profile unpublished."
                if let checklist = response.checklist {
                    providerChecklist = checklist
                }
                await loadProviderHub()
            } else {
                providerErrorText = response.error ?? "Could not update publish state."
            }
        } catch {
            providerErrorText = error.localizedDescription
        }
    }

    private func openStripeConnect(for businessId: String) async {
        providerActionInFlight = true
        providerErrorText = nil
        providerInfoText = nil
        defer { providerActionInFlight = false }

        struct Request: Encodable { let businessId: String }
        struct Response: Decodable { let url: String?; let error: String? }

        do {
            let response: Response = try await APIClient.shared.send(
                path: "/api/stripe-connect",
                method: "POST",
                body: Request(businessId: businessId),
                requiresAuth: true
            )
            if let urlString = response.url, let url = URL(string: urlString) {
                await MainActor.run {
                    UIApplication.shared.open(url)
                }
                providerInfoText = "Opening Stripe setup…"
            } else {
                providerErrorText = response.error ?? "Could not open Stripe."
            }
        } catch {
            providerErrorText = error.localizedDescription
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
        if data.count > 8 * 1024 * 1024 {
            let sizeMB = Double(data.count) / 1_048_576.0
            avatarError = "Image is \(String(format: "%.1f", sizeMB))MB. Max allowed is 8MB."
            return
        }
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
            avatarError = error.localizedDescription
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
    case provider
    case payments
    case addresses
    case notifications
    case security

    var id: String { title }

    var title: String {
        switch self {
        case .profile: return "Profile"
        case .provider: return "Provider Hub"
        case .payments: return "Payments"
        case .addresses: return "Addresses"
        case .notifications: return "Notifications"
        case .security: return "Security"
        }
    }

    var systemImage: String {
        switch self {
        case .profile: return "person"
        case .provider: return "briefcase"
        case .payments: return "creditcard"
        case .addresses: return "mappin.and.ellipse"
        case .notifications: return "bell"
        case .security: return "lock"
        }
    }
}

private enum AccountMode: String {
    case customer
    case provider
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

private struct AccountModeButton: View {
    let title: String
    let systemImage: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 13, weight: .semibold))
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
            }
            .foregroundColor(isSelected ? .white : ScheduleMeTheme.accent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
        }
        .buttonStyle(.plain)
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
    let initialEmail: String?
    let onSendCode: (String) async throws -> Void
    let onVerifyCode: (String) async throws -> Void
    let onClose: () -> Void
    private enum Step { case email, code }
    @State private var eduEmail = ""
    @State private var verificationCode = ""
    @State private var step: Step = .email
    @State private var isSending = false
    @State private var isVerifying = false
    @State private var statusMessage: String?
    @State private var errorMessage: String?

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("EDU Verification")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .frame(width: 28, height: 28)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .buttonStyle(.plain)
                }

                Text("Use your .edu email to unlock campus-only providers.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)

                if step == .email {
                    Text("School email")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    TextField("", text: $eduEmail)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .keyboardType(.emailAddress)
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .scheduleMeFieldStyle()
                        .overlay(alignment: .leading) {
                            if eduEmail.isEmpty {
                                Text("name@school.edu")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                    .foregroundColor(Color.secondary.opacity(0.9))
                                    .padding(.leading, 16)
                                    .allowsHitTesting(false)
                            }
                        }

                    Button(isSending ? "Sending..." : "Send verification code") {
                        Task { await sendCode() }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                    .disabled(isSending)
                } else {
                    Text("Verification code")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    TextField("", text: $verificationCode)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                        .keyboardType(.numberPad)
                        .foregroundColor(ScheduleMeTheme.titleText)
                        .scheduleMeFieldStyle()
                        .overlay(alignment: .leading) {
                            if verificationCode.isEmpty {
                                Text("6-digit code")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                    .foregroundColor(Color.secondary.opacity(0.9))
                                    .padding(.leading, 16)
                                    .allowsHitTesting(false)
                            }
                        }

                    HStack(spacing: 10) {
                        Button(isVerifying ? "Verifying..." : "Verify code") {
                            Task { await verifyCode() }
                        }
                        .buttonStyle(ScheduleMePrimaryButtonStyle())
                        .disabled(isVerifying || verificationCode.trimmingCharacters(in: .whitespacesAndNewlines).count < 6)

                        Button(isSending ? "Sending..." : "Resend") {
                            Task { await resendCode() }
                        }
                        .buttonStyle(ScheduleMeSecondaryButtonStyle())
                        .disabled(isSending)
                    }

                    Text("Code expires in 15 minutes.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }

                if let statusMessage {
                    Text(statusMessage)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                        .foregroundColor(.red)
                }
            }
            .padding(16)
        }
        .frame(maxWidth: 420)
        .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
        .padding(.vertical, 28)
        .onAppear {
            if eduEmail.isEmpty {
                eduEmail = initialEmail ?? ""
            }
        }
    }

    private func sendCode() async {
        guard !isSending else { return }
        errorMessage = nil
        statusMessage = nil
        isSending = true
        defer { isSending = false }

        do {
            try await onSendCode(eduEmail)
            step = .code
            statusMessage = "Verification code sent to your .edu email."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func resendCode() async {
        await sendCode()
    }

    private func verifyCode() async {
        guard !isVerifying else { return }
        errorMessage = nil
        statusMessage = nil
        isVerifying = true
        defer { isVerifying = false }

        do {
            try await onVerifyCode(verificationCode)
            statusMessage = "Email verified successfully."
            onClose()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/* Legacy sheet implementation kept intentionally removed:
 Edu verification is now a minimal floating modal card by request. */

private struct EduVerificationStatusModal: View {
    let isVerified: Bool
    let schoolDomain: String?
    let onClose: () -> Void
    let onRefresh: () -> Void

    private var campusName: String {
        if let domain = schoolDomain, !domain.isEmpty {
            return domain.replacingOccurrences(of: ".edu", with: "").uppercased()
        }
        return "Campus"
    }

    var body: some View {
        ScheduleMeCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("EDU Verification")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .frame(width: 28, height: 28)
                            .background(ScheduleMeTheme.surface)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
                    }
                    .buttonStyle(.plain)
                }

                Text(isVerified ? "Verified Student" : "Verification Needed")
                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(isVerified ? "Campus access unlocked." : "Use your .edu email to unlock campus-only providers.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
                Text("Campus: \(campusName)")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.accent)

                Button("Refresh status") {
                    onRefresh()
                }
                .buttonStyle(ScheduleMeSecondaryButtonStyle())
            }
            .padding(16)
        }
        .frame(maxWidth: 420)
        .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
        .padding(.vertical, 28)
    }
}
