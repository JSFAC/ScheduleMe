import SwiftUI
import UIKit

struct ProviderSettingsView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var providerStore: ProviderDataStore
    @Environment(\.openURL) private var openURL

    @State private var status: String = "open"
    @State private var businessName = ""
    @State private var ownerName = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var website = ""
    @State private var servicesCSV = ""
    @State private var isSavingProfile = false
    @State private var statusMessage: String?
    @State private var isHydrating = true
    @State private var showingDeleteAccountConfirm = false
    @State private var showingEduSheet = false
    @State private var showingRemoveEduConfirm = false
    @State private var isRemovingEduVerification = false
    @State private var hydratedProfileID: String?
    
    private var destructiveTextColor: Color {
        Color.dynamic(light: Color(hex: "B91C1C"), dark: Color(hex: "FCA5A5"))
    }

    private var destructiveBorderColor: Color {
        Color.dynamic(light: Color(hex: "FCA5A5"), dark: Color(hex: "3B1B21"))
    }

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            if isHydrating {
                VStack(spacing: 12) {
                    ScheduleMeLoadingBar(
                        tint: ScheduleMeTheme.accent,
                        track: ScheduleMeTheme.cardBorder,
                        width: 180,
                        height: 4
                    )
                    Text("Loading settings...")
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.mutedText)
                }
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        availabilityCard
                        profileCard
                        eduVerificationCard
                        stripeCard
                        legalCard
                        signOutButton
                        deleteAccountButton
                    }
                    .padding(16)
                }
            }

            if showingEduSheet {
                ZStack {
                    Color.black.opacity(0.6)
                        .ignoresSafeArea()

                    ProviderEduConnectSheet(
                        viewOnly: appState.eduVerified == true,
                        onClose: {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.9)) {
                                showingEduSheet = false
                            }
                        }
                    ) {
                        Task {
                            await appState.refreshEduVerification()
                            await providerStore.refreshAll(force: true)
                        }
                    }
                    .padding(.horizontal, 18)
                }
                .transition(.asymmetric(insertion: .opacity.combined(with: .scale(scale: 0.96, anchor: .center)), removal: .opacity))
                .zIndex(20)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            isHydrating = providerStore.profile == nil
            await providerStore.refreshAll(force: providerStore.profile == nil)
            hydrateFromProfileIfNeeded(force: true)
            isHydrating = false
        }
        .onChange(of: providerStore.profile?.id) { _, _ in
            hydrateFromProfileIfNeeded()
            if providerStore.profile != nil {
                isHydrating = false
            }
        }
        .safeAreaInset(edge: .bottom) {
            if let statusMessage {
                Text(statusMessage)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ScheduleMeTheme.surface)
                    .overlay(Rectangle().frame(height: 1).foregroundStyle(ScheduleMeTheme.cardBorder), alignment: .top)
            }
        }
    }

    private var availabilityCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Availability")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                HStack(spacing: 8) {
                    availabilityChip("open", "Open")
                    availabilityChip("busy", "Busy")
                    availabilityChip("closed", "Closed")
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func availabilityColor(for value: String) -> Color {
        switch value.lowercased() {
        case "busy":
            return Color(hex: "F59E0B")
        case "closed":
            return Color(hex: "EF4444")
        default:
            return ScheduleMeTheme.accent
        }
    }

    private func availabilityChip(_ value: String, _ label: String) -> some View {
        let isSelected = status.lowercased() == value.lowercased()
        let tint = availabilityColor(for: value)

        return Button {
            status = value
            Task {
                do {
                    try await providerStore.updateAvailabilityStatus(value)
                    statusMessage = "Availability updated."
                } catch {
                    statusMessage = error.localizedDescription
                }
            }
        } label: {
            Text(label)
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundStyle(isSelected ? Color.white : tint)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(isSelected ? tint : ScheduleMeTheme.surface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(isSelected ? Color.clear : tint.opacity(0.65)))
        }
        .contentShape(Rectangle())
        .buttonStyle(.plain)
    }

    private var profileCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Provider Profile")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                TextField("Provider name", text: $businessName)
                    .modifier(CompactSettingsFieldModifier())
                    .scheduleMePasteMenu($businessName)
                TextField("Owner name", text: $ownerName)
                    .modifier(CompactSettingsFieldModifier())
                    .scheduleMePasteMenu($ownerName)

                profileReadRow(title: "Email", value: providerStore.profile?.ownerEmail ?? "-")

                TextField("Phone", text: $phone)
                    .keyboardType(.phonePad)
                    .modifier(CompactSettingsFieldModifier())
                    .scheduleMePasteMenu($phone)
                TextField("Address / City", text: $address)
                    .modifier(CompactSettingsFieldModifier())
                    .scheduleMePasteMenu($address)
                TextField("Website", text: $website)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .modifier(CompactSettingsFieldModifier())
                    .scheduleMePasteMenu($website)
                TextField("Services (comma-separated)", text: $servicesCSV)
                    .modifier(CompactSettingsFieldModifier())
                    .scheduleMePasteMenu($servicesCSV)

                Button(isSavingProfile ? "Saving..." : "Save Profile") {
                    Task { await saveProfile() }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
                .disabled(isSavingProfile)
            }
        }
    }

    private func profileReadRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)
            Spacer()
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                .foregroundStyle(ScheduleMeTheme.titleText)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))
    }

    private var stripeCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Stripe Account")
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                        .foregroundStyle(ScheduleMeTheme.titleText)
                    Spacer()
                    Text((providerStore.profile?.stripeOnboarded ?? false) ? "Connected" : "Not Connected")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.bold))
                        .foregroundStyle((providerStore.profile?.stripeOnboarded ?? false) ? Color(hex: "22C55E") : Color(hex: "F59E0B"))
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(ScheduleMeTheme.surface.opacity(0.8))
                        .clipShape(Capsule())
                }

                Text((providerStore.profile?.stripeOnboarded ?? false)
                     ? "Bank account connected. Payouts usually arrive in 1–2 business days."
                     : "Connect Stripe to receive payouts.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)

                HStack {
                    Text("Available \(providerStore.stripeBalance.totalPayoutLabel)")
                    Spacer()
                    Text("Pending payout \(providerStore.stripeBalance.pendingPayoutLabel)")
                }
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                .foregroundStyle(ScheduleMeTheme.mutedText)

                Button((providerStore.profile?.stripeOnboarded ?? false) ? "Configure Stripe" : "Connect Stripe") {
                    Task {
                        do {
                            let url = try await providerStore.openStripeConnectURL()
                            await MainActor.run { UIApplication.shared.open(url) }
                        } catch {
                            statusMessage = error.localizedDescription
                        }
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())

                Text("New Stripe accounts may take up to 7 days for the first payout to arrive.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 2)
            }
        }
    }

    private var eduVerificationCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("EDU Verification")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                Text(eduStatusTitle)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                    .foregroundStyle(appState.eduVerified == true ? Color(hex: "22C55E") : ScheduleMeTheme.titleText)

                Text(eduStatusSubtitle)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)

                Button(appState.eduVerified == true ? "View EDU Status" : "Connect .edu Email") {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.86)) {
                        showingEduSheet = true
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())

                if appState.eduVerified == true || (appState.schoolDomain?.isEmpty == false) {
                    Button(isRemovingEduVerification ? "Removing..." : "Remove EDU Verification", role: .destructive) {
                        showingRemoveEduConfirm = true
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(destructiveTextColor)
                    .buttonStyle(.plain)
                    .disabled(isRemovingEduVerification)
                    .confirmationDialog("Remove EDU verification?", isPresented: $showingRemoveEduConfirm, titleVisibility: .visible) {
                        Button("Remove EDU Verification", role: .destructive) {
                            Task { await clearEduVerification() }
                        }
                        Button("Cancel", role: .cancel) {}
                    } message: {
                        Text("This will unlink your current EDU verification status. You can reconnect later.")
                    }
                }
            }
        }
    }

    private var legalCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Legal & Support")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

                legalRow(title: "Terms of Service", icon: "doc.text") {
                    openURL(URL(string: "https://www.usescheduleme.com/terms")!)
                }

                legalRow(title: "Privacy Policy", icon: "lock.shield") {
                    openURL(URL(string: "https://www.usescheduleme.com/privacy")!)
                }

                legalRow(title: "Contact Support", icon: "envelope") {
                    openURL(URL(string: "https://www.usescheduleme.com/support")!)
                }
            }
        }
    }

    private func legalRow(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(ScheduleMeTheme.accent)
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
        }
        .contentShape(Rectangle())
        .buttonStyle(.plain)
    }

    private var deleteAccountButton: some View {
        Button("Delete Account", role: .destructive) {
            showingDeleteAccountConfirm = true
        }
        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
        .foregroundStyle(destructiveTextColor)
        .padding(.top, 2)
        .frame(maxWidth: .infinity, alignment: .center)
        .contentShape(Rectangle())
        .buttonStyle(.plain)
        .confirmationDialog("Delete your account?", isPresented: $showingDeleteAccountConfirm, titleVisibility: .visible) {
            Button("Delete Account", role: .destructive) {
                Task {
                    do {
                        try await providerStore.deleteAccount()
                        await appState.signOut()
                        providerStore.reset()
                    } catch {
                        statusMessage = error.localizedDescription
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This is permanent and cannot be undone.")
        }
    }

    private var signOutButton: some View {
        Button("Sign Out", role: .destructive) {
            Task {
                await appState.signOut()
                providerStore.reset()
            }
        }
        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.bold))
        .foregroundStyle(destructiveTextColor)
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.vertical, 12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(destructiveBorderColor))
        .contentShape(Rectangle())
        .buttonStyle(.plain)
    }

    private func settingsCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            content()
        }
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(ScheduleMeTheme.cardBorder))
    }

    private func hydrateFromProfile() {
        status = providerStore.profile?.availabilityStatus ?? "open"
        businessName = providerStore.profile?.name ?? ""
        ownerName = providerStore.profile?.ownerName ?? ""
        phone = providerStore.profile?.phone ?? ""
        address = providerStore.profile?.address ?? ""
        website = providerStore.profile?.website ?? ""
        servicesCSV = providerStore.profile?.serviceTags.joined(separator: ", ") ?? ""
        hydratedProfileID = providerStore.profile?.id
    }

    private func hydrateFromProfileIfNeeded(force: Bool = false) {
        guard let profile = providerStore.profile else { return }
        let fieldsAreEmpty = businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            ownerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            website.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            servicesCSV.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let profileSwitched = hydratedProfileID != profile.id
        guard force || profileSwitched || fieldsAreEmpty else { return }
        hydrateFromProfile()
    }

    private func saveProfile() async {
        isSavingProfile = true
        defer { isSavingProfile = false }

        do {
            let serviceTags = servicesCSV
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            try await providerStore.updateProviderProfile(
                name: businessName.trimmingCharacters(in: .whitespacesAndNewlines),
                ownerName: ownerName.trimmingCharacters(in: .whitespacesAndNewlines),
                phone: phone.trimmingCharacters(in: .whitespacesAndNewlines),
                address: address.trimmingCharacters(in: .whitespacesAndNewlines),
                website: website.trimmingCharacters(in: .whitespacesAndNewlines),
                serviceTags: serviceTags
            )
            statusMessage = "Provider profile saved."
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private var eduStatusTitle: String {
        if appState.eduVerified == true { return "Verified" }
        return "Not Verified"
    }

    private var eduStatusSubtitle: String {
        if let domain = appState.schoolDomain, !domain.isEmpty {
            if appState.eduVerified == true {
                if let schoolEmail = appState.schoolEmail, !schoolEmail.isEmpty {
                    return "Connected to \(schoolEmail). Campus access is enabled."
                }
                return "Connected to \(domain). Campus access is enabled."
            }
            return "School domain: \(domain). Verification is not complete."
        }
        return "Connect your .edu email to unlock campus features."
    }

    private struct ClearEduRequest: Encodable {
        let action: String
        let accountType: String

        enum CodingKeys: String, CodingKey {
            case action
            case accountType = "account_type"
        }
    }

    private struct VerifyEduResponse: Decodable {
        let success: Bool?
        let message: String?
        let error: String?
    }

    private func clearEduVerification() async {
        guard !isRemovingEduVerification else { return }
        isRemovingEduVerification = true
        defer { isRemovingEduVerification = false }

        do {
            let response: VerifyEduResponse = try await APIClient.shared.send(
                path: "/api/verify-edu",
                method: "POST",
                body: ClearEduRequest(action: "clear", accountType: "business"),
                requiresAuth: true
            )
            if response.success == true {
                await appState.refreshEduVerification()
                await providerStore.refreshAll(force: true)
                statusMessage = response.message ?? "EDU verification removed."
            } else {
                statusMessage = response.error ?? "Unable to remove EDU verification."
            }
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}

private struct CompactSettingsFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
            .foregroundStyle(ScheduleMeTheme.titleText)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(ScheduleMeTheme.cardBorder)
                    .allowsHitTesting(false)
            )
    }
}

private struct ProviderEduConnectSheet: View {
    @EnvironmentObject private var appState: AppState

    let viewOnly: Bool
    let onClose: () -> Void
    let onVerified: () -> Void

    @State private var eduEmail = ""
    @State private var verificationCode = ""
    @State private var codeSent = false
    @State private var isWorking = false
    @State private var errorText: String?
    @State private var successText: String?
    @State private var showVerifiedModal = false

    private var requiredDomain: String? {
        appState.schoolDomain?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private var resolvedEduEmail: String {
        let fromState = appState.schoolEmail?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !fromState.isEmpty { return fromState.lowercased() }
        return ""
    }

    private var canSendCode: Bool {
        let normalized = eduEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard normalized.hasSuffix(".edu") else { return false }
        if let requiredDomain, !requiredDomain.isEmpty {
            return normalized.hasSuffix(requiredDomain)
        }
        return true
    }

    private var canVerifyCode: Bool {
        verificationCode.trimmingCharacters(in: .whitespacesAndNewlines).count == 6
    }

    var body: some View {
        ZStack {
            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("EDU Verification")
                            .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
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

                    Text(viewOnly
                         ? "Your .edu verification is active for this account."
                         : "Use your .edu email to unlock campus-only features.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    if let requiredDomain, !requiredDomain.isEmpty {
                        Text("Approved school domain: \(requiredDomain)")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    }

                    if !viewOnly {
                        if codeSent {
                            Text("Verification code")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            TextField("", text: $verificationCode)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled(true)
                                .keyboardType(.numberPad)
                                .foregroundColor(ScheduleMeTheme.titleText)
                                .modifier(CompactSettingsFieldModifier())
                                .overlay(alignment: .leading) {
                                    if verificationCode.isEmpty {
                                        Text("6-digit code")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                            .foregroundColor(ScheduleMeTheme.mutedText)
                                            .padding(.leading, 16)
                                            .allowsHitTesting(false)
                                    }
                                }

                            HStack(spacing: 10) {
                                Button(isWorking ? "Verifying..." : "Verify code") {
                                    Task { await verifyCode() }
                                }
                                .buttonStyle(ScheduleMePrimaryButtonStyle())
                                .disabled(isWorking || !canVerifyCode)

                                Button(isWorking ? "Sending..." : "Resend") {
                                    Task { await sendCode() }
                                }
                                .buttonStyle(ScheduleMeSecondaryButtonStyle())
                                .disabled(isWorking)
                            }
                        } else {
                            Text("School email")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.mutedText)

                            TextField("", text: $eduEmail)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled(true)
                                .keyboardType(.emailAddress)
                                .foregroundColor(ScheduleMeTheme.titleText)
                                .modifier(CompactSettingsFieldModifier())
                                .overlay(alignment: .leading) {
                                    if eduEmail.isEmpty {
                                        Text("name@school.edu")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                            .foregroundColor(ScheduleMeTheme.mutedText)
                                            .padding(.leading, 16)
                                            .allowsHitTesting(false)
                                    }
                                }

                            Button(isWorking ? "Sending..." : "Send verification code") {
                                Task { await sendCode() }
                            }
                            .buttonStyle(ScheduleMePrimaryButtonStyle())
                            .disabled(!canSendCode || isWorking)
                        }
                    } else {
                        Text("School email")
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)

                        TextField("", text: $eduEmail)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled(true)
                            .keyboardType(.emailAddress)
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .modifier(CompactSettingsFieldModifier())
                            .disabled(true)
                            .overlay(alignment: .leading) {
                                if eduEmail.isEmpty {
                                    Text("name@school.edu")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                        .padding(.leading, 16)
                                        .allowsHitTesting(false)
                                }
                            }
                    }

                    if let successText {
                        Text(successText)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.accent)
                    }

                    if let errorText {
                        Text(errorText)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundColor(.red)
                    }
                }
                .padding(16)
            }
            .frame(maxWidth: 420)
            .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
            .padding(.vertical, 28)

            if showVerifiedModal {
                Color.black.opacity(0.55)
                    .ignoresSafeArea()

                VStack(alignment: .leading, spacing: 10) {
                    Text("Campus Verification Complete")
                        .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.bold))
                        .foregroundStyle(ScheduleMeTheme.titleText)

                    Text("Your .edu email is confirmed. Wait for approval/denial email updates if your campus access is still pending.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundStyle(ScheduleMeTheme.mutedText)

                    Button("Confirm") {
                        showVerifiedModal = false
                        onVerified()
                        onClose()
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                }
                .padding(16)
                .background(ScheduleMeTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(ScheduleMeTheme.cardBorder)
                )
                .padding(.horizontal, 24)
            }
        }
        .onAppear {
            eduEmail = viewOnly ? resolvedEduEmail : ""
            if viewOnly {
                codeSent = false
                verificationCode = ""
            }
        }
    }

    private struct VerifyEduRequest: Encodable {
        let action: String?
        let schoolEmail: String?
        let code: String?
        let accountType: String

        enum CodingKeys: String, CodingKey {
            case action
            case schoolEmail = "school_email"
            case code
            case accountType = "account_type"
        }
    }

    private struct VerifyEduResponse: Decodable {
        let success: Bool?
        let message: String?
        let error: String?
    }

    private func sendCode() async {
        guard canSendCode else { return }
        await MainActor.run {
            isWorking = true
            errorText = nil
            successText = nil
        }
        defer { Task { @MainActor in isWorking = false } }

        let normalized = eduEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        do {
            let response: VerifyEduResponse = try await APIClient.shared.send(
                path: "/api/verify-edu",
                method: "POST",
                body: VerifyEduRequest(action: nil, schoolEmail: normalized, code: nil, accountType: "business"),
                requiresAuth: true
            )
            await MainActor.run {
                if response.success == true {
                    codeSent = true
                    successText = response.message ?? "Code sent."
                    errorText = nil
                } else {
                    errorText = response.error ?? "Unable to send code."
                }
            }
        } catch {
            await MainActor.run {
                errorText = error.localizedDescription
            }
        }
    }

    private func verifyCode() async {
        guard canVerifyCode else { return }
        await MainActor.run {
            isWorking = true
            errorText = nil
            successText = nil
        }
        defer { Task { @MainActor in isWorking = false } }

        let normalizedCode = verificationCode.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let response: VerifyEduResponse = try await APIClient.shared.send(
                path: "/api/verify-edu",
                method: "POST",
                body: VerifyEduRequest(action: "verify", schoolEmail: nil, code: normalizedCode, accountType: "business"),
                requiresAuth: true
            )
            await MainActor.run {
                if response.success == true {
                    successText = "Campus connected."
                    errorText = nil
                    showVerifiedModal = true
                } else {
                    errorText = response.error ?? "Verification failed."
                }
            }
        } catch {
            await MainActor.run {
                errorText = error.localizedDescription
            }
        }
    }
}
