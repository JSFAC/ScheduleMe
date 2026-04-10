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

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "090B10"), Color(hex: "10141B")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            if isHydrating && providerStore.profile == nil {
                VStack(spacing: 12) {
                    ProgressView()
                        .tint(ScheduleMeTheme.accent)
                    Text("Loading settings...")
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundStyle(Color(hex: "94A3B8"))
                }
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        availabilityCard
                        profileCard
                        stripeCard
                        legalCard
                        signOutButton
                        deleteAccountButton
                    }
                    .padding(16)
                }
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            isHydrating = true
            await providerStore.refreshAll(force: false)
            hydrateFromProfile()
            isHydrating = false
        }
        .safeAreaInset(edge: .bottom) {
            if let statusMessage {
                Text(statusMessage)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                    .foregroundStyle(Color(hex: "94A3B8"))
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ScheduleMeTheme.surface)
                    .overlay(Rectangle().frame(height: 1).foregroundStyle(Color(hex: "273141")), alignment: .top)
            }
        }
    }

    private var availabilityCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Availability")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(Color.white)

                HStack(spacing: 8) {
                    availabilityChip("open", "Open")
                    availabilityChip("busy", "Busy")
                    availabilityChip("closed", "Closed")
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func availabilityChip(_ value: String, _ label: String) -> some View {
        Button {
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
                .foregroundStyle(status == value ? Color.white : Color(hex: "D1D5DB"))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(status == value ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
        }
        .buttonStyle(.plain)
    }

    private var profileCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Provider Profile")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(Color.white)

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
                .foregroundStyle(Color(hex: "94A3B8"))
            Spacer()
            Text(value)
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                .foregroundStyle(Color.white)
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
                        .foregroundStyle(Color.white)
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
                    .foregroundStyle(Color(hex: "94A3B8"))

                HStack {
                    Text("Available \(providerStore.stripeBalance.totalPayoutLabel)")
                    Spacer()
                    Text("Pending payout \(providerStore.stripeBalance.pendingPayoutLabel)")
                }
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                .foregroundStyle(Color(hex: "64748B"))

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
                    .foregroundStyle(Color(hex: "94A3B8"))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 2)
            }
        }
    }

    private var legalCard: some View {
        settingsCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Legal & Support")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                    .foregroundStyle(Color.white)

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
                    .foregroundStyle(Color.white)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color(hex: "94A3B8"))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(ScheduleMeTheme.cardBorder))
        }
        .buttonStyle(.plain)
    }

    private var deleteAccountButton: some View {
        Button("Delete Account", role: .destructive) {
            showingDeleteAccountConfirm = true
        }
        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
        .foregroundStyle(Color(hex: "F87171"))
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color(hex: "160E11"))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Color(hex: "3B1B21")))
        .frame(maxWidth: .infinity, alignment: .center)
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
        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
        .foregroundStyle(Color(hex: "FCA5A5"))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(hex: "1A1114"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "3B1B21")))
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
}

private struct CompactSettingsFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
            .foregroundStyle(Color.white)
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
