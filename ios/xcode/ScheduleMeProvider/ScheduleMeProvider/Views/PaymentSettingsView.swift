// FILE OVERVIEW:
// Saved card management screen, Stripe setup intent, and Apple Pay card entry trigger.
//
// DEBUG NOTES:
// Payment-method add/remove/default issues are primarily debugged here.

import SwiftUI
#if canImport(StripePaymentSheet)
import StripePaymentSheet
#endif
#if canImport(StripePayments)
import StripePayments
#endif
#if canImport(StripePaymentsUI)
import StripePaymentsUI
#endif

struct PaymentSettingsView: View {
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @State private var toDelete: PaymentMethod?
    @State private var showingDeleteAlert = false
    @State private var isSyncing = false
#if canImport(StripePaymentSheet)
    @State private var paymentSheet: PaymentSheet?
    @State private var isPreparingSheet = false
    @State private var isPresentingSheet = false
    @State private var presenterRef: UIViewController?
#endif
    @State private var paymentError: String?
    @State private var showingCardEntry = false
    @State private var toastMessage: String?
    @State private var showToast = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if dataStore.isLoadingPaymentMethods && dataStore.paymentMethods.isEmpty {
                PaymentMethodsSkeletonList()
            } else if let error = dataStore.paymentMethodsError {
                ScheduleMeEmptyState(
                    title: "Payment methods unavailable",
                    message: error,
                    systemImage: "creditcard.trianglebadge.exclamationmark"
                )
            } else if dataStore.paymentMethods.isEmpty {
                ScheduleMeEmptyState(
                    title: "No saved cards",
                    message: "Add a payment method to speed up future bookings. If you already added one on the web, tap Sync.",
                    systemImage: "creditcard"
                )
                Button(isSyncing ? "Syncing..." : "Sync Payment Methods") {
                    Task {
                        isSyncing = true
                        let response = await dataStore.syncStripeCustomer()
                        if response == nil {
                            paymentError = "Unable to reach Stripe sync. Check your connection and try again."
                        } else if response?.customerId == nil && response?.updated != true {
                            paymentError = response?.error ?? "No Stripe customer found for this email."
                        } else {
                            paymentError = nil
                        }
                        await dataStore.ensureStripeCustomer()
                        await dataStore.loadPaymentMethods()
                        if dataStore.paymentMethods.isEmpty && dataStore.paymentMethodsError == nil {
                            paymentError = "No cards found for this account yet."
                        }
                        isSyncing = false
                    }
                }
                .buttonStyle(ScheduleMeSecondaryButtonStyle())
            } else {
                VStack(spacing: 12) {
                    ForEach(dataStore.paymentMethods) { card in
                        PaymentCardRow(
                            card: card,
                            isDefault: (dataStore.paymentDefaultID ?? dataStore.paymentMethods.first?.id) == card.id,
                            onMakeDefault: {
                                Task { await dataStore.setDefaultPaymentMethod(id: card.id) }
                            },
                            onDelete: {
                                toDelete = card
                                showingDeleteAlert = true
                            }
                        )
                    }
                }
            }

            if let paymentError {
                Text(paymentError)
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(.red)
            }
            
            Button {
#if canImport(StripePaymentSheet)
                Task { await prepareAndPresentPaymentSheet() }
#else
                showingCardEntry = true
#endif
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "plus")
                    Text("Add Card / Apple Pay")
                }
            }
            .buttonStyle(ScheduleMeSecondaryButtonStyle())
        }
        .task {
            await dataStore.loadPaymentMethods()
            if dataStore.paymentMethods.isEmpty && dataStore.paymentMethodsError == nil {
                let response = await dataStore.syncStripeCustomer()
                if response == nil {
                    paymentError = "Unable to reach Stripe sync. Check your connection and try again."
                } else if response?.customerId == nil && response?.updated != true {
                    paymentError = response?.error ?? "No Stripe customer found for this email."
                } else {
                    paymentError = nil
                }
                await dataStore.ensureStripeCustomer()
                await dataStore.loadPaymentMethods()
                if dataStore.paymentMethods.isEmpty && dataStore.paymentMethodsError == nil {
                    paymentError = "No cards found for this account yet."
                }
            }
        }
        .alert("Remove Card", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) { toDelete = nil }
            Button("Remove", role: .destructive) {
                if let card = toDelete {
                    Task {
                        await dataStore.deletePaymentMethod(id: card.id)
                        if dataStore.paymentMethodsError == nil {
                            showToastMessage("Card removed")
                        }
                    }
                    toDelete = nil
                }
            }
        } message: {
            if let card = toDelete {
                Text("Remove \(card.displayName) ending in \(card.last4)?")
            } else {
                Text("Remove this card?")
            }
        }
        .sheet(isPresented: $showingCardEntry) {
            CardEntrySheet(
                isPresented: $showingCardEntry,
                onAdd: { paymentMethodId in
                    Task {
                        paymentError = nil
                        do {
                            try await dataStore.attachPaymentMethod(id: paymentMethodId)
                            await dataStore.loadPaymentMethods()
                            showToastMessage("Card added")
                        } catch {
                            paymentError = error.localizedDescription
                        }
                    }
                }
            )
        }
        .overlay(alignment: .bottom) {
            if showToast, let toastMessage {
                ToastView(message: toastMessage)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .padding(.bottom, 16)
            }
        }
    }

    // MARK: - Stripe / PaymentSheet

    /// Prepares setup intent and presents Stripe PaymentSheet for adding cards.
    private func prepareAndPresentPaymentSheet() async {
#if canImport(StripePaymentSheet)
        guard !isPreparingSheet, !isPresentingSheet else { return }
        paymentError = nil
        guard let key = Bundle.main.object(forInfoDictionaryKey: "STRIPE_PUBLISHABLE_KEY") as? String,
              !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            paymentError = "Stripe publishable key missing in Info.plist."
            return
        }

        StripeAPI.defaultPublishableKey = key
        isPreparingSheet = true
        defer { isPreparingSheet = false }

        do {
            let response = try await createSetupIntentWithTimeout()
            guard let clientSecret = response.clientSecret else {
                paymentError = response.error ?? "Unable to prepare payment sheet."
                return
            }

            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "ScheduleMe"
            let rawScheme = Bundle.main.object(forInfoDictionaryKey: "APP_URL_SCHEME") as? String
            let scheme = rawScheme?.trimmingCharacters(in: .whitespacesAndNewlines)
            let resolvedScheme = (scheme?.isEmpty == false) ? (scheme ?? "scheduleme") : "scheduleme"
            config.returnURL = "\(resolvedScheme)://stripe-redirect"
            applyApplePayIfAvailable(config: &config)
            guard let customerId = response.customerId, let ephemeralKey = response.ephemeralKey else {
                paymentError = "Stripe setup missing customer or ephemeral key."
                return
            }
            config.customer = .init(id: customerId, ephemeralKeySecret: ephemeralKey)
            paymentSheet = PaymentSheet(setupIntentClientSecret: clientSecret, configuration: config)
            await MainActor.run {
                presentPaymentSheet()
            }
        } catch {
            paymentError = error.localizedDescription
        }
#else
        paymentError = "Stripe is unavailable in this build."
#endif
    }

    #if canImport(StripePaymentSheet)
    /// Enables Apple Pay in the sheet when merchant config + device capability are present.
    private func applyApplePayIfAvailable(config: inout PaymentSheet.Configuration) {
        guard StripeAPI.deviceSupportsApplePay() else { return }
        guard let rawMerchantId = Bundle.main.object(forInfoDictionaryKey: "APPLE_PAY_MERCHANT_ID") as? String else { return }
        let merchantId = rawMerchantId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !merchantId.isEmpty else { return }
        let countryCode: String
        if #available(iOS 16.0, *) {
            countryCode = Locale.current.region?.identifier ?? "US"
        } else {
            countryCode = Locale.current.regionCode ?? "US"
        }
        config.applePay = .init(merchantId: merchantId, merchantCountryCode: countryCode)
    }
    #endif

    /// Presents PaymentSheet on the active top-most UIKit view controller.
    private func presentPaymentSheet() {
#if canImport(StripePaymentSheet)
        guard let paymentSheet else {
            paymentError = "Unable to prepare payment sheet."
            return
        }
        guard let root = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow })?.rootViewController else {
            paymentError = "Unable to present payment sheet."
            return
        }
        let presenter = topMostViewController(root)
        if presenter.isBeingPresented || presenter.presentedViewController != nil {
            paymentError = "Payment sheet is already opening. Please wait."
            return
        }
        isPresentingSheet = true
        presenterRef = presenter
        scheduleSheetTimeout()
        paymentSheet.present(from: presenter) { result in
            isPresentingSheet = false
            presenterRef = nil
            switch result {
            case .completed:
                Task {
                    await dataStore.loadPaymentMethods()
                }
            case .failed(let error):
                paymentError = error.localizedDescription
            case .canceled:
                break
            }
        }
#else
        paymentError = "Stripe is unavailable in this build."
#endif
    }

    private func topMostViewController(_ root: UIViewController) -> UIViewController {
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }

    private func scheduleSheetTimeout() {
#if canImport(StripePaymentSheet)
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) {
            guard isPresentingSheet else { return }
            if let presenter = presenterRef, presenter.presentedViewController != nil {
                presenter.dismiss(animated: true)
            }
            isPresentingSheet = false
            paymentError = "Payment sheet timed out. Please try again."
        }
#endif
    }

    private func createSetupIntentWithTimeout() async throws -> SetupIntentResponse {
        try await withThrowingTaskGroup(of: SetupIntentResponse.self) { group in
            group.addTask {
                try await dataStore.createSetupIntentForAccount(apiVersion: nil)
            }
            group.addTask {
                try await Task.sleep(for: .seconds(15))
                throw PaymentSheetError.timeout
            }
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }

    private func showToastMessage(_ message: String) {
        toastMessage = message
        withAnimation(.easeInOut(duration: 0.2)) {
            showToast = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            withAnimation(.easeInOut(duration: 0.2)) {
                showToast = false
            }
        }
    }
}

private struct CardEntrySheet: View {
    @Binding var isPresented: Bool
    var onAdd: (String) -> Void
    @Environment(\.openURL) private var openURL
#if canImport(StripePayments)
    @State private var cardParams: STPPaymentMethodCardParams?
    @State private var isValid = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
#endif

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Add a card")
                    .font(.custom(ScheduleMeTheme.fontName, size: 18).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)

#if canImport(StripePayments)
                StripeCardField(cardParams: $cardParams, isValid: $isValid, autofocus: true)
                    .frame(height: 48)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(ScheduleMeTheme.cardBorder))

                if let errorMessage {
                    Text(errorMessage)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundColor(.red)
                }

                Button(isSubmitting ? "Adding..." : "Save Card") {
                    Task { await submit() }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
                .disabled(!isValid || isSubmitting)
#else
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(Color.orange.opacity(0.12))
                            .frame(width: 36, height: 36)
                            .overlay(
                                Image(systemName: "creditcard.trianglebadge.exclamationmark")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(.orange)
                            )
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Stripe not configured")
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                            Text("Add your Stripe key in Config.xcconfig to enable in-app card entry.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                    }
                    Button("Add Card on Web") {
                        if let url = URL(string: "https://usescheduleme.com/account?tab=payments") {
                            openURL(url)
                        }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                }
#endif

                Spacer()
            }
            .padding(20)
            .navigationTitle("Payment Method")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { isPresented = false }
                        .foregroundStyle(ScheduleMeTheme.accent)
                }
            }
        }
    }

#if canImport(StripePayments)
    private func submit() async {
        guard !isSubmitting else { return }
        guard let cardParams else {
            errorMessage = "Please enter a valid card."
            return
        }
        guard let key = Bundle.main.object(forInfoDictionaryKey: "STRIPE_PUBLISHABLE_KEY") as? String else {
            errorMessage = "Stripe publishable key is missing."
            return
        }
        let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedKey.isEmpty, !trimmedKey.contains("$(") else {
            errorMessage = "Stripe publishable key is not configured for this build."
            return
        }
        STPAPIClient.shared.publishableKey = trimmedKey
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        let params = STPPaymentMethodParams(card: cardParams, billingDetails: nil, metadata: nil)
        do {
            let paymentMethod = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<STPPaymentMethod, Error>) in
                STPAPIClient.shared.createPaymentMethod(with: params) { method, error in
                    if let error { continuation.resume(throwing: error) }
                    else if let method { continuation.resume(returning: method) }
                    else { continuation.resume(throwing: PaymentSheetError.timeout) }
                }
            }
            onAdd(paymentMethod.stripeId)
            isPresented = false
        } catch {
            errorMessage = error.localizedDescription
        }
    }
#endif
}

#if canImport(StripePayments)
private struct StripeCardField: UIViewRepresentable {
    @Binding var cardParams: STPPaymentMethodCardParams?
    @Binding var isValid: Bool
    var autofocus: Bool = false

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .clear

        let field = STPPaymentCardTextField()
        field.delegate = context.coordinator
        field.borderColor = UIColor.clear
        field.backgroundColor = UIColor.clear
        field.isUserInteractionEnabled = true
        field.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(field)
        NSLayoutConstraint.activate([
            field.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            field.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            field.topAnchor.constraint(equalTo: container.topAnchor),
            field.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        context.coordinator.field = field
        if autofocus {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                field.becomeFirstResponder()
            }
        }
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if autofocus, let field = context.coordinator.field, !field.isFirstResponder {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                field.becomeFirstResponder()
            }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, STPPaymentCardTextFieldDelegate {
        var parent: StripeCardField
        weak var field: STPPaymentCardTextField?

        init(_ parent: StripeCardField) { self.parent = parent }

        func paymentCardTextFieldDidChange(_ textField: STPPaymentCardTextField) {
            parent.isValid = textField.isValid
            parent.cardParams = textField.paymentMethodParams.card
        }
    }
}
#endif

private struct ToastView: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
            .foregroundColor(ScheduleMeTheme.titleText)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(ScheduleMeTheme.pageBackground)
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.08), radius: 8, x: 0, y: 4)
    }
}

private enum PaymentSheetError: LocalizedError {
    case timeout

    var errorDescription: String? {
        switch self {
        case .timeout:
            return "Payment setup timed out. Please try again."
        }
    }
}

private struct PaymentCardRow: View {
    let card: PaymentMethod
    let isDefault: Bool
    let onMakeDefault: () -> Void
    let onDelete: () -> Void

    private var brandIcon: String {
        switch card.brand.lowercased() {
        case "visa": return "creditcard"
        case "mastercard": return "creditcard"
        case "amex": return "creditcard"
        default: return "creditcard"
        }
    }

    var body: some View {
        ScheduleMeCard {
            HStack(spacing: 14) {
                Circle()
                    .fill(ScheduleMeTheme.accentSoft)
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: brandIcon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(ScheduleMeTheme.accent)
                    )

                VStack(alignment: .leading, spacing: 4) {
                    Text(card.displayName)
                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    HStack(spacing: 6) {
                        Text("Expires \(card.expiryLabel)")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        if isDefault {
                            Text("DEFAULT")
                                .font(.custom(ScheduleMeTheme.fontName, size: 9).weight(.bold))
                                .tracking(0.8)
                                .foregroundColor(ScheduleMeTheme.accent)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(ScheduleMeTheme.accentSoft)
                                .clipShape(Capsule())
                        }
                    }
                }

                Spacer()

                VStack(spacing: 8) {
                    if !isDefault {
                        Button("Make default", action: onMakeDefault)
                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.accent)
                    }
                    Button(action: onDelete) {
                        Image(systemName: "trash")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.red.opacity(0.8))
                            .frame(width: 34, height: 34)
                            .background(Color.red.opacity(0.08))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct PaymentMethodsSkeletonList: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                ScheduleMeCard {
                    HStack(spacing: 12) {
                        SkeletonCircle(size: 40)
                        VStack(alignment: .leading, spacing: 6) {
                            SkeletonBlock(width: 140, height: 14, cornerRadius: 7)
                            SkeletonBlock(width: 90, height: 12, cornerRadius: 6)
                        }
                        Spacer()
                        SkeletonCircle(size: 30)
                    }
                }
            }
        }
    }
}
