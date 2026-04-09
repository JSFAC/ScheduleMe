// FILE OVERVIEW:
// Booking review and confirmation screen before final booking submit/payment.
//
// DEBUG NOTES:
// Verify pricing totals, selected card logic, and confirm action wiring here.

import SwiftUI
import WebKit
#if canImport(StripePaymentSheet)
import StripePaymentSheet
#endif
#if canImport(StripePayments)
import StripePayments
#endif
#if canImport(StripePaymentsUI)
import StripePaymentsUI
#endif

struct BookingCreationView: View {
    let business: BusinessSummary
    let initialService: String?
    let initialNote: String?
    let preferredDate: Date?
    let preferredTime: Date?
    let requiresExactTime: Bool
    let isCustomServiceRequest: Bool
    let servicePriceCents: Int?
    let serviceDurationMin: Int?
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var dataStore: ScheduleMeDataStore
    @EnvironmentObject private var tabRouter: TabRouter
    @Environment(\.dismiss) private var dismiss
    @AppStorage("scheduleme_display_name") private var storedDisplayName = ""

    enum BookingStep { case details, calendly, done }

    @State private var step: BookingStep = .details
    @State private var name = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var service = ""
    @State private var note = ""
    @State private var selectedDate = Date()
    @State private var selectedTime = Date()
    @State private var error: String?
    @State private var createdBookingID: String?
    @State private var selectedPaymentMethodID: String?
    @State private var showingCardEntry = false
    @State private var paymentError: String?
    @State private var bookingResultMessage: String?
    @State private var checkoutBookingID: String?
    @State private var checkoutURL: URL?
    @State private var showingHostedCheckout = false
    @State private var showingBookingConfirmation = false
#if canImport(StripePaymentSheet)
    @State private var paymentSheet: PaymentSheet?
    @State private var isPreparingSheet = false
    @State private var isPresentingSheet = false
    @State private var presenterRef: UIViewController?
#endif

    var body: some View {
        NavigationStack {
            ScheduleMeScreen(showsTopBar: false) {
                VStack(spacing: 20) {
                    // Business summary card
                    ScheduleMeCard {
                        HStack(spacing: 14) {
                            AsyncImage(url: business.heroImageURL) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().scaledToFill()
                                default:
                                    Circle().fill(ScheduleMeTheme.accentSoft)
                                        .overlay(
                                            Text(String(business.name.prefix(1)))
                                                .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                                                .foregroundColor(ScheduleMeTheme.accent)
                                        )
                                }
                            }
                            .frame(width: 56, height: 56)
                            .clipShape(Circle())

                            VStack(alignment: .leading, spacing: 4) {
                                Text(business.name)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 17).weight(.bold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text(business.primaryCategory)
                                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                HStack(spacing: 4) {
                                    Image(systemName: "star.fill")
                                        .font(.system(size: 11))
                                        .foregroundColor(.orange)
                                    Text(business.ratingLabel)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.mutedText)
                                }
                            }
                            Spacer()
                        }
                    }
                    .padding(.horizontal, 20)

                    switch step {
                    case .details:
                        detailsSection
                    case .calendly:
                        calendlySection
                    case .done:
                        doneSection
                    }

                    Spacer(minLength: 30)
                }
                .padding(.top, 16)
            }
            .navigationTitle(stepTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                }
            }
        }
        .onAppear {
            if name.isEmpty {
                name = storedDisplayName.isEmpty
                    ? (appState.userEmail.flatMap { e in e.split(separator: "@").first.map(String.init) }?.capitalized ?? "")
                    : storedDisplayName
            }
            if email.isEmpty { email = appState.userEmail ?? "" }
            if service.isEmpty { service = initialService ?? business.primaryCategory }
            if note.isEmpty { note = initialNote ?? "" }
            if let preferredDate { selectedDate = preferredDate }
            if let preferredTime { selectedTime = preferredTime }
            if selectedPaymentMethodID == nil {
                selectedPaymentMethodID = dataStore.paymentDefaultID ?? dataStore.paymentMethods.first?.id
            }
        }
        .task {
            await dataStore.loadPaymentMethods()
            if dataStore.paymentMethods.isEmpty && dataStore.paymentMethodsError == nil {
                _ = await dataStore.syncStripeCustomer()
                await dataStore.ensureStripeCustomer()
                await dataStore.loadPaymentMethods()
            }
            if selectedPaymentMethodID == nil {
                selectedPaymentMethodID = dataStore.paymentDefaultID ?? dataStore.paymentMethods.first?.id
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
                            selectedPaymentMethodID = paymentMethodId
                        } catch {
                            paymentError = error.localizedDescription
                        }
                    }
                }
            )
        }
        .sheet(isPresented: $showingHostedCheckout) {
            HostedCheckoutSheet(
                url: checkoutURL ?? checkoutBookingID.flatMap { URL(string: "https://usescheduleme.com/pay/\($0)") }
            ) {
                Task { await dataStore.loadBookings() }
                showingBookingConfirmation = true
            }
        }
        .sheet(isPresented: $showingBookingConfirmation) {
            BookingConfirmationSheet(
                paid: (servicePriceCents ?? 0) > 0 && checkoutBookingID == nil,
                showSecureCheckout: checkoutBookingID != nil
            ) {
                completeBookingFlow(route: .home)
            } onOpenBookings: {
                completeBookingFlow(route: .bookings)
            } onSecureCheckout: {
                withAnimation(.easeInOut(duration: 0.22)) {
                    showingBookingConfirmation = false
                }
                showingHostedCheckout = true
            }
        }
    }

    private var stepTitle: String {
        switch step {
        case .details: return "Review Booking"
        case .calendly: return "Pick a time"
        case .done: return "Booking requested"
        }
    }

    // MARK: - Details step

    /// Main confirmation step where user reviews details, payment method, and total.
    private var detailsSection: some View {
        VStack(spacing: 16) {
            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("BOOKING SUMMARY")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .tracking(1.2)
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        Text("Review your selections")
                            .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }

                    if let error {
                        Text(error)
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundColor(.red)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Color.red.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("SERVICE")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        Text(service.isEmpty ? business.primaryCategory : service)
                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        if let price = servicePriceCents {
                            Text("$\(Double(price) / 100.0, specifier: "%.2f")")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.accent)
                        }
                        if let duration = serviceDurationMin {
                            Text("\(duration) min")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("PREFERRED DATE")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        Text(selectedDate.formatted(date: .long, time: .omitted))
                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("PREFERRED TIME")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        if requiresExactTime {
                            Text(selectedTime.formatted(date: .omitted, time: .shortened))
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.titleText)
                        } else {
                            Text("No exact time required")
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("NOTE")
                            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                        if note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            Text("No additional notes provided.")
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.mutedText)
                        } else {
                            Text(note)
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                                .foregroundColor(ScheduleMeTheme.titleText)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity)

            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("YOUR DETAILS")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)
                    Text(name)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Text(email)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity)

            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("PAYMENT METHOD")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    if dataStore.paymentMethods.isEmpty {
                        Text("No saved cards yet.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                    } else {
                        ForEach(dataStore.paymentMethods) { method in
                            let isSelected = selectedPaymentMethodID == method.id
                            Button {
                                selectedPaymentMethodID = method.id
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(method.displayName)
                                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                                            .foregroundColor(ScheduleMeTheme.titleText)
                                        Text("Expires \(method.expiryLabel)")
                                            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                            .foregroundColor(ScheduleMeTheme.mutedText)
                                    }
                                    Spacer()
                                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.cardBorder)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(isSelected ? ScheduleMeTheme.accentSoft : ScheduleMeTheme.surface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(isSelected ? ScheduleMeTheme.accent : ScheduleMeTheme.cardBorder, lineWidth: isSelected ? 1.5 : 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            .buttonStyle(.plain)
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
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity)

            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("PRICE BREAKDOWN")
                        .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                        .tracking(1.2)
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    HStack {
                        Text("Service")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        Spacer()
                        Text(serviceAmountLabel)
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }

                    HStack {
                        Text("ScheduleMe Protection Fee")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        Spacer()
                        Text(currencyLabel(protectionFeeCents))
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                    }

                    Divider()

                    HStack {
                        Text("Total")
                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)
                        Spacer()
                        Text(totalAmountLabel)
                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.accent)
                    }

                    Text("The total above includes the required $0.99 ScheduleMe Protection Fee.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity)

            Button {
                Task { await submitBooking() }
            } label: {
                if dataStore.isCreatingBooking {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Confirm Booking →")
                }
            }
            .buttonStyle(ScheduleMePrimaryButtonStyle())
            .padding(.horizontal, 20)
            .disabled(dataStore.isCreatingBooking || name.isEmpty)
        }
    }

    // MARK: - Calendly step

    private var calendlySection: some View {
        VStack(spacing: 16) {
            ScheduleMeCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Pick a time that works for you.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)

                    if let calendlyURL = business.calendlyURL, let url = URL(string: calendlyURL) {
                        CalendlyWebView(url: url)
                            .frame(height: 520)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
            .padding(.horizontal, 20)

            Button("I've scheduled my appointment →") {
                step = .done
            }
            .buttonStyle(ScheduleMeSecondaryButtonStyle())
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Done step

    private var doneSection: some View {
        ScheduleMeCard {
            VStack(spacing: 16) {
                Circle()
                    .fill(Color.green.opacity(0.12))
                    .frame(width: 72, height: 72)
                    .overlay(
                        Image(systemName: "checkmark")
                            .font(.system(size: 30, weight: .bold))
                            .foregroundColor(.green)
                    )

                VStack(spacing: 6) {
                    Text("Booking Requested!")
                        .font(.custom(ScheduleMeTheme.fontName, size: 22).weight(.bold))
                        .foregroundColor(ScheduleMeTheme.titleText)
                    Text("\(business.name) will confirm shortly.")
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                        .multilineTextAlignment(.center)
                    if !email.isEmpty {
                        Text("A confirmation email was sent to \(email)")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .multilineTextAlignment(.center)
                    }
                    if let bookingResultMessage {
                        Text(bookingResultMessage)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)
                            .multilineTextAlignment(.center)
                    }
                }

                VStack(spacing: 10) {
                    if let checkoutBookingID {
                        Button("Continue to Secure Checkout") {
                            self.checkoutBookingID = checkoutBookingID
                            showingHostedCheckout = true
                        }
                        .buttonStyle(ScheduleMePrimaryButtonStyle())
                    }
                    Button("Done") { dismiss() }
                        .buttonStyle(ScheduleMePrimaryButtonStyle())

                    Button("Back to Home") {
                        tabRouter.selected = .home
                        dismiss()
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())

                    Button("Open Bookings") {
                        tabRouter.selected = .bookings
                        dismiss()
                    }
                    .buttonStyle(ScheduleMeSecondaryButtonStyle())
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Actions

    /// Final booking submit path:
    /// 1) validates inputs, 2) creates booking, 3) routes to hosted checkout, 4) advances to done state.
    private func submitBooking() async {
        error = nil
        let trimmedService = service.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedService.isEmpty {
            error = "Please select a service before confirming."
            return
        }
        do {
            if let selected = selectedPaymentMethodID,
               selected != dataStore.paymentDefaultID {
                await dataStore.setDefaultPaymentMethod(id: selected)
            }
            let endDate: Date?
            let combinedDate: Date?
            if requiresExactTime {
                combinedDate = Calendar.current.date(
                    bySettingHour: Calendar.current.component(.hour, from: selectedTime),
                    minute: Calendar.current.component(.minute, from: selectedTime),
                    second: 0,
                    of: selectedDate
                )
            } else {
                combinedDate = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: selectedDate)
            }
            if requiresExactTime, let duration = serviceDurationMin {
                endDate = Calendar.current.date(byAdding: .minute, value: duration, to: combinedDate ?? selectedDate)
            } else {
                endDate = nil
            }
            let booking = try await dataStore.createBooking(
                businessID: business.id,
                service: trimmedService.isEmpty ? business.primaryCategory : trimmedService,
                userName: name,
                userPhone: phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "N/A" : phone,
                userEmail: email,
                note: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : note,
                scheduledStart: combinedDate ?? selectedDate,
                scheduledEnd: endDate,
                servicePriceCents: servicePriceCents
            )
            createdBookingID = booking.id
            bookingResultMessage = nil
            checkoutBookingID = nil
            checkoutURL = nil

            if isCustomServiceRequest {
                bookingResultMessage = "Request sent. Provider will confirm or set the final price before payment."
            } else if let amount = servicePriceCents, amount > 0 {
                do {
                    let payment = try await dataStore.payBookingNow(bookingID: booking.id)
                    if payment.ok == true || payment.alreadyPaid == true {
                        bookingResultMessage = "Payment received. Your booking is pending provider approval."
                    } else {
                        throw DataStoreError.server(payment.error ?? "Payment could not be completed.")
                    }
                } catch {
                    // Keep a manual fallback path only if in-app payment is unavailable.
                    checkoutBookingID = booking.id
                    checkoutURL = (try? await dataStore.createCheckoutSessionURL(bookingID: booking.id))
                        ?? URL(string: "https://usescheduleme.com/pay/\(booking.id)")
                    bookingResultMessage = "We couldn’t complete in-app payment. Use Secure Checkout to finish paying."
                }
            } else {
                bookingResultMessage = "Booking was created and is pending provider approval."
            }
            Task { await dataStore.loadBookings() }
            showingBookingConfirmation = true
        } catch {
            self.error = error.localizedDescription
        }
    }

    private var protectionFeeCents: Int { 99 }

    /// Service price + required protection fee shown in review breakdown.
    private var totalCents: Int? {
        guard let servicePriceCents else { return nil }
        return servicePriceCents + protectionFeeCents
    }

    private var serviceAmountLabel: String {
        guard let servicePriceCents else { return "Set by provider" }
        return currencyLabel(servicePriceCents)
    }

    private var totalAmountLabel: String {
        guard let totalCents else { return "Service + \(currencyLabel(protectionFeeCents))" }
        return currencyLabel(totalCents)
    }

    private func currencyLabel(_ cents: Int) -> String {
        NumberFormatter.currency.string(from: NSNumber(value: Double(cents) / 100.0))
            ?? String(format: "$%.2f", Double(cents) / 100.0)
    }

    private func completeBookingFlow(route: ScheduleMeTab) {
        withAnimation(.easeInOut(duration: 0.22)) {
            tabRouter.selected = route
            showingBookingConfirmation = false
        }
        dismiss()
    }

    // MARK: - Stripe / PaymentSheet

    /// Builds and presents Stripe PaymentSheet for adding/updating saved card methods.
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
            guard let customerId = response.customerId, let ephemeralKey = response.ephemeralKey else {
                paymentError = "Stripe setup missing customer or ephemeral key."
                return
            }

            var config = PaymentSheet.Configuration()
            config.merchantDisplayName = "ScheduleMe"
            let rawScheme = Bundle.main.object(forInfoDictionaryKey: "APP_URL_SCHEME") as? String
            let scheme = rawScheme?.trimmingCharacters(in: .whitespacesAndNewlines)
            let resolvedScheme = (scheme?.isEmpty == false) ? (scheme ?? "scheduleme") : "scheduleme"
            config.returnURL = "\(resolvedScheme)://stripe-redirect"
            config.customer = .init(id: customerId, ephemeralKeySecret: ephemeralKey)
            applyApplePayIfAvailable(config: &config)

            paymentSheet = PaymentSheet(setupIntentClientSecret: clientSecret, configuration: config)
            await MainActor.run {
                presentPaymentSheet()
            }
        } catch {
            paymentError = error.localizedDescription
        }
#else
        showingCardEntry = true
#endif
    }

    #if canImport(StripePaymentSheet)
    /// Enables Apple Pay inside PaymentSheet when device + merchant config are available.
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

    /// Presents PaymentSheet from the top-most visible UIKit controller.
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
                    selectedPaymentMethodID = dataStore.paymentDefaultID ?? dataStore.paymentMethods.first?.id
                }
            case .failed(let error):
                paymentError = error.localizedDescription
            case .canceled:
                break
            }
        }
#endif
    }

    private func topMostViewController(_ root: UIViewController) -> UIViewController {
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }

    /// Hard timeout guard to recover if Stripe sheet presentation hangs.
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

    /// Wraps setup-intent call in timeout race so UI doesn't stall indefinitely.
    private func createSetupIntentWithTimeout() async throws -> SetupIntentResponse {
        try await withThrowingTaskGroup(of: SetupIntentResponse.self) { group in
            group.addTask {
                try await dataStore.createSetupIntentForAccount(apiVersion: nil)
            }
            group.addTask {
                try await Task.sleep(for: .seconds(15))
                throw BookingPaymentSheetError.timeout
            }
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }
}

private struct HostedCheckoutSheet: View {
    let url: URL?
    let onDismiss: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            PaymentWebView(url: url)
                .navigationTitle("Secure Checkout")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") {
                            dismiss()
                            onDismiss()
                        }
                    }
                }
        }
    }
}

private struct BookingConfirmationSheet: View {
    let paid: Bool
    let showSecureCheckout: Bool
    let onBackHome: () -> Void
    let onOpenBookings: () -> Void
    let onSecureCheckout: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Circle()
                    .fill(Color.green.opacity(0.14))
                    .frame(width: 66, height: 66)
                    .overlay(
                        Image(systemName: "checkmark")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(Color.green)
                    )

                Text(paid ? "Payment Received" : "Booking Requested")
                    .font(.custom(ScheduleMeTheme.fontName, size: 22).weight(.bold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                    .multilineTextAlignment(.center)

                Text(
                    paid
                    ? "Your payment has been received and your booking is now pending provider approval."
                    : "Your booking request was sent and is now pending provider approval."
                )
                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                .foregroundStyle(ScheduleMeTheme.mutedText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 6)

                if showSecureCheckout {
                    Button("Continue to Secure Checkout") {
                        onSecureCheckout()
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                }

                Button("Back to Home") {
                    onBackHome()
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())

                Button("Open Bookings") {
                    onOpenBookings()
                }
                .buttonStyle(ScheduleMeSecondaryButtonStyle())
            }
            .padding(20)
            .presentationDetents([.height(420)])
            .presentationDragIndicator(.visible)
        }
    }
}

private struct PaymentWebView: UIViewRepresentable {
    let url: URL?

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.allowsBackForwardNavigationGestures = true
        webView.navigationDelegate = context.coordinator
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard let url else { return }
        guard Coordinator.isAllowed(url: url) else { return }
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        static func isAllowed(url: URL) -> Bool {
            guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased() else { return false }
            if host == "usescheduleme.com" || host == "www.usescheduleme.com" { return true }
            if host == "checkout.stripe.com" || host == "js.stripe.com" { return true }
            if host.hasSuffix(".stripe.com") { return true }
            return false
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url else { return .cancel }
            return Self.isAllowed(url: url) ? .allow : .cancel
        }
    }
}

private enum BookingPaymentSheetError: LocalizedError {
    case timeout

    var errorDescription: String? {
        switch self {
        case .timeout:
            return "Payment sheet timed out. Please try again."
        }
    }
}

// MARK: - Calendly WKWebView wrapper

private struct CalendlyWebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.isScrollEnabled = true
        webView.navigationDelegate = context.coordinator
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard Coordinator.isAllowed(url: url) else { return }
        webView.load(URLRequest(url: url))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        static func isAllowed(url: URL) -> Bool {
            guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased() else { return false }
            if host == "calendly.com" || host.hasSuffix(".calendly.com") { return true }
            if host == "usescheduleme.com" || host == "www.usescheduleme.com" { return true }
            return false
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url else { return .cancel }
            return Self.isAllowed(url: url) ? .allow : .cancel
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
                    .background(ScheduleMeTheme.surface)
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
                Text("Secure card entry is available in our hosted checkout.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)

                Button("Open Secure Checkout") {
                    if let url = URL(string: "https://usescheduleme.com/account?tab=payments") {
                        openURL(url)
                    }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
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
                    else { continuation.resume(throwing: NSError(domain: "Stripe", code: -1)) }
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
