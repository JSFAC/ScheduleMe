import SwiftUI
import Foundation
import UIKit

struct ProviderAuthView: View {
    @Environment(\.openURL) private var openURL
    @Binding var step: AuthView.AuthStep
    @Binding var email: String
    @Binding var password: String
    @Binding var isLoading: Bool
    @Binding var errorText: String?
    @Binding var noticeText: String?

    let onEmailAuth: () -> Void
    let onForgotPassword: () -> Void
    let onApple: () -> Void
    let onGoogle: () -> Void

    @State private var page = 0
    @State private var hasUnlockedAuthButtons = false
    @State private var showingProviderApplication = false
    @State private var isPasswordVisible = false

    private var consumerAppDeepLinkURL: URL {
        URL(string: "scheduleme://auth/callback")!
    }

    private var consumerAppFallbackURL: URL {
        let configured = (Bundle.main.object(forInfoDictionaryKey: "CONSUMER_APP_STORE_URL") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return URL(string: configured?.isEmpty == false ? configured! : "https://apps.apple.com")!
    }

    private func openConsumerApp() {
        openURL(consumerAppDeepLinkURL) { accepted in
            if !accepted {
                openURL(consumerAppFallbackURL)
            }
        }
    }

    private struct Slide: Identifiable {
        let id = UUID()
        let icon: String
        let eyebrow: String
        let title: String
        let body: String
    }

    private let slides: [Slide] = [
        .init(icon: "arrow.down.left.and.arrow.up.right.square", eyebrow: "Manage Anywhere", title: "Your business,\nin your pocket.", body: "Bookings, messages, and payouts all in one place. Run everything from your phone."),
        .init(icon: "dollarsign.circle", eyebrow: "Founder50", title: "Earn more as an\nearly provider.", body: "Get approved early for Founder50 and lock in stronger long-term economics for your campus."),
        .init(icon: "checkmark.seal", eyebrow: "Your Terms", title: "Accept only what\nworks for you.", body: "Set services, prices, and hours. Every booking request comes to you first.")
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "0D0D0D").ignoresSafeArea()
                DottedGrid(spacing: 20, dotSize: 1.6, color: Color.white.opacity(0.06)).ignoresSafeArea()

                switch step {
                case .welcome:
                    welcome
                case .login, .signup:
                    loginForm
                }
            }
            .navigationDestination(isPresented: $showingProviderApplication) {
                ProviderApplicationView()
            }
        }
        .preferredColorScheme(.dark)
        .animation(.spring(response: 0.35, dampingFraction: 0.86), value: step)
        .onChange(of: step) { _, _ in
            errorText = nil
        }
    }

    private var welcome: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 44)

            HStack(spacing: 0) {
                Text("ScheduleMe")
                    .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                    .foregroundStyle(Color.white)
                Text(" Provider")
                    .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                    .foregroundStyle(Color(hex: "0C9182"))
            }

            TabView(selection: $page) {
                ForEach(Array(slides.enumerated()), id: \.offset) { index, slide in
                    slideView(slide).tag(index)
                }
            }
            .frame(height: 330)
            .tabViewStyle(.page(indexDisplayMode: .never))
            .onAppear {
                if page == slides.count - 1 {
                    hasUnlockedAuthButtons = true
                }
            }
            .onChange(of: page) { _, newValue in
                if newValue == slides.count - 1 {
                    hasUnlockedAuthButtons = true
                }
            }

            ZStack {
                HStack(spacing: 10) {
                    providerActionButton(label: "Log in", filled: false) {
                        step = .login
                    }
                    providerActionButton(label: "Create account", filled: true) {
                        showingProviderApplication = true
                    }
                }
                .opacity(hasUnlockedAuthButtons ? 1 : 0)
                .offset(y: hasUnlockedAuthButtons ? 0 : 14)
                .scaleEffect(hasUnlockedAuthButtons ? 1 : 0.98)
                .allowsHitTesting(hasUnlockedAuthButtons)

                Text("Swipe to continue")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(Color(hex: "71717A"))
                    .opacity(hasUnlockedAuthButtons ? 0 : 1)
                    .offset(y: hasUnlockedAuthButtons ? -8 : 0)
            }
            .frame(height: 48)
            .padding(.horizontal, 24)
            .padding(.top, 10)
            .animation(.spring(response: 0.52, dampingFraction: 0.88), value: hasUnlockedAuthButtons)

            HStack(spacing: 7) {
                ForEach(0..<slides.count, id: \.self) { i in
                    Circle()
                        .fill(i == page ? Color.white : Color.white.opacity(0.35))
                        .frame(width: 6, height: 6)
                }
            }
            .padding(.top, 16)

            Button("Looking to book services? →") {
                openConsumerApp()
            }
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
            .foregroundStyle(Color(hex: "71717A"))
            .padding(.top, 14)
            .contentShape(Rectangle())
            .buttonStyle(.plain)

            Spacer(minLength: 26)
        }
    }

    private func slideView(_ slide: Slide) -> some View {
        VStack(spacing: 12) {
            ZStack {
                Circle().fill(Color(hex: "0C9182").opacity(0.15)).frame(width: 92, height: 92)
                Image(systemName: slide.icon)
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(Color(hex: "0C9182"))
            }

            Text("• \(slide.eyebrow.uppercased())")
                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                .tracking(1.5)
                .foregroundStyle(Color(hex: "0C9182"))

            Text(slide.title)
                .font(.custom(ScheduleMeTheme.fontName, size: 40).weight(.bold))
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .foregroundStyle(Color.white)
                .minimumScaleFactor(0.75)

            Text(slide.body)
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Color(hex: "A1A1AA"))
                .padding(.horizontal, 26)
        }
        .padding(.horizontal, 18)
    }

    private var loginForm: some View {
        VStack(spacing: 18) {
            HStack {
                Button {
                    step = .welcome
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.white)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(Color(hex: "1A1A1D")))
                        .clipShape(Circle())
                }
                .contentShape(Rectangle())
        .buttonStyle(.plain)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            HStack(spacing: 0) {
                Text("ScheduleMe")
                    .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                    .foregroundStyle(Color.white)
                Text(" Provider")
                    .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                    .foregroundStyle(Color(hex: "0C9182"))
            }
            .padding(.top, 6)

            VStack(spacing: 6) {
                Text("Log in")
                    .font(.custom(ScheduleMeTheme.fontName, size: 34).weight(.bold))
                    .foregroundStyle(Color.white)
                Text("Sign in to manage your provider dashboard.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                    .foregroundStyle(Color(hex: "A1A1AA"))
            }
            .padding(.bottom, 18)

            VStack(spacing: 12) {
                VStack(spacing: 10) {
                    providerField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    providerField("Password", text: $password, secure: true, isPasswordVisible: $isPasswordVisible)

                    if let errorText {
                        Text(errorText)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    if let noticeText {
                        Text(noticeText)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundStyle(Color(hex: "33C8B5"))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    Button("Forgot Password?") {
                        onForgotPassword()
                    }
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                    .foregroundStyle(Color(hex: "9CA3AF"))
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .contentShape(Rectangle())
                    .buttonStyle(.plain)

                    providerActionButton(label: isLoading ? "Please wait..." : "Continue", filled: true) {
                        onEmailAuth()
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                    .opacity(isLoading || email.isEmpty || password.isEmpty ? 0.55 : 1)
                }
                .padding(12)
                .background(Color(hex: "151515"))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(hex: "2C2C30")))

                providerActionButton(label: "Continue with Apple", filled: false, icon: "apple.logo") {
                    onApple()
                }
                .disabled(isLoading)

                providerActionButton(label: "Continue with Google", filled: false, imageAsset: "GoogleIcon") {
                    onGoogle()
                }
                .disabled(isLoading)
            }
            .padding(.horizontal, 20)

            Spacer()
        }
        .safeAreaPadding(.top, 8)
    }

    @ViewBuilder
    private func providerField(
        _ placeholder: String,
        text: Binding<String>,
        secure: Bool = false,
        isPasswordVisible: Binding<Bool>? = nil
    ) -> some View {
        Group {
            if secure {
                HStack(spacing: 8) {
                    Group {
                        if isPasswordVisible?.wrappedValue == true {
                            TextField("", text: text, prompt: Text(placeholder).foregroundStyle(Color(hex: "71717A")))
                        } else {
                            SecureField("", text: text, prompt: Text(placeholder).foregroundStyle(Color(hex: "71717A")))
                        }
                    }
                    .scheduleMePasteMenu(text)

                    if let isPasswordVisible {
                        Button {
                            isPasswordVisible.wrappedValue.toggle()
                        } label: {
                            Image(systemName: isPasswordVisible.wrappedValue ? "eye.slash" : "eye")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color(hex: "71717A"))
                                .frame(width: 26, height: 26)
                        }
                        .contentShape(Rectangle())
                        .buttonStyle(.plain)
                    }
                }
            } else {
                TextField("", text: text, prompt: Text(placeholder).foregroundStyle(Color(hex: "71717A")))
                    .scheduleMePasteMenu(text)
            }
        }
        .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
        .foregroundStyle(Color(hex: "E7EAF0"))
        .tint(Color(hex: "0C9182"))
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color(hex: "121212"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(hex: "2A2A2E"))
                .allowsHitTesting(false)
        )
    }

    @ViewBuilder
    private func providerActionButton(label: String, filled: Bool, icon: String? = nil, imageAsset: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                }
                if let imageAsset {
                    Image(imageAsset)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 16, height: 16)
                }
                Text(label)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
            }
            .foregroundStyle(filled ? Color.white : Color(hex: "E2E8F0"))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(filled ? Color(hex: "0C9182") : Color.clear)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "2A3038")))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .contentShape(Rectangle())
        .buttonStyle(.plain)
    }
}

struct ProviderApplicationView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    @State private var businessName = ""
    @State private var ownerName = ""
    @State private var yearsInBusiness = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var serviceCategory = ""
    @State private var city = ""
    @State private var zipCode = ""
    @State private var serviceRadiusMiles: Double = 25
    @State private var licenseNumber = ""
    @State private var website = ""
    @State private var instagram = ""
    @State private var campusProvider = false
    @State private var schoolName = ""
    @State private var acceptedTerms = false
    @State private var isSubmitting = false
    @State private var resultMessage: String?
    @State private var submissionError: String?
    @State private var emailInUseWarning: String?
    @State private var emailCheckTask: Task<Void, Never>?
    @State private var didSubmitSuccessfully = false
    @State private var showSubmissionConfirmationModal = false

    private var serviceRadiusLabel: String {
        "\(Int(serviceRadiusMiles.rounded())) miles"
    }

    private var trimmedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var trimmedPhone: String {
        phone.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var normalizedSchoolNamePreview: String? {
        guard campusProvider else { return nil }
        let normalized = normalizedCampusName(schoolName)
        guard !normalized.isEmpty else { return nil }
        return normalized
    }

    private var emailValidationMessage: String? {
        guard !trimmedEmail.isEmpty else { return nil }
        let pattern = #"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$"#
        let valid = trimmedEmail.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
        return valid ? nil : "Enter a valid email address."
    }

    private var phoneValidationMessage: String? {
        guard !trimmedPhone.isEmpty else { return nil }
        let digits = trimmedPhone.filter(\.isNumber)
        return (10...15).contains(digits.count) ? nil : "Enter a valid phone number (10-15 digits)."
    }

    private var canSubmit: Bool {
        !businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !ownerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !trimmedEmail.isEmpty &&
        !trimmedPhone.isEmpty &&
        emailValidationMessage == nil &&
        emailInUseWarning == nil &&
        phoneValidationMessage == nil &&
        !city.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !zipCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !serviceCategory.isEmpty &&
        (!campusProvider || !schoolName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) &&
        acceptedTerms &&
        !isSubmitting &&
        !didSubmitSuccessfully
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 12) {
                header
                sectionOne
                sectionTwo
                sectionThree
                sectionSocials
                sectionFour
                termsSection

                if let submissionError {
                    Text(submissionError)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let resultMessage {
                    Text(resultMessage)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .foregroundStyle(Color(hex: "0C9182"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(isSubmitting ? "Submitting..." : "Submit Application") {
                    Task { await submit() }
                }
                .buttonStyle(ScheduleMePrimaryButtonStyle())
                .disabled(!canSubmit)
                .opacity(canSubmit ? 1 : 0.6)
            }
            .padding(16)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(
            KeyboardDismissTapCatcher {
                dismissKeyboard()
            }
        )
        .background(Color(hex: "0D0D0D").ignoresSafeArea())
        .overlay {
            if showSubmissionConfirmationModal {
                ZStack {
                    Color.black.opacity(0.55)
                        .ignoresSafeArea()

                    VStack(alignment: .leading, spacing: 14) {
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundStyle(Color(hex: "0C9182"))
                            Text("Application Submitted")
                                .font(.custom(ScheduleMeTheme.fontName, size: 22).weight(.bold))
                                .foregroundStyle(Color.white)
                        }

                        Text("Your provider application was received. Please wait for an email from ScheduleMe with either approval or denial after review.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                            .foregroundStyle(Color(hex: "C5CBD6"))
                            .fixedSize(horizontal: false, vertical: true)

                        Text("Typical review time: 24-48 hours.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                            .foregroundStyle(Color(hex: "8FA6A1"))

                        Button("I Understand") {
                            dismiss()
                        }
                        .buttonStyle(ScheduleMePrimaryButtonStyle())
                        .padding(.top, 4)
                    }
                    .padding(18)
                    .background(Color(hex: "17191E"))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(Color(hex: "2C323A"))
                    )
                    .padding(.horizontal, 22)
                }
            }
        }
        .navigationTitle("Provider Application")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(Color(hex: "0D0D0D"), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .preferredColorScheme(.dark)
        .onChange(of: email) { _, newValue in
            scheduleEmailInUseCheck(for: newValue)
        }
        .onDisappear {
            emailCheckTask?.cancel()
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.white)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(Color(hex: "1A1A1D")))
                        .clipShape(Circle())
                }
                .contentShape(Rectangle())
        .buttonStyle(.plain)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PROVIDER APPLICATION")
                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                .tracking(1.2)
                .foregroundStyle(Color(hex: "0C9182"))
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Create your provider profile")
                .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                .foregroundStyle(Color.white)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("Takes about 5 minutes. Free to join, with Founder50 eligibility for early approved providers.")
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                .foregroundStyle(Color(hex: "A1A1AA"))
                .frame(maxWidth: .infinity, alignment: .leading)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    headerPill("SSL Encrypted")
                    headerPill("Verified Platform")
                    headerPill("Free to Join")
                    headerPill("Founder50 Eligible")
                }
                .padding(.vertical, 2)
            }
        }
    }

    private var sectionOne: some View {
        applicationSection(number: "1", title: "Provider Information") {
            appField("Business name *", text: $businessName)
            HStack(spacing: 8) {
                appField("Owner name *", text: $ownerName)
                    .frame(maxWidth: .infinity)
                appField("Years in field (optional)", text: $yearsInBusiness, fontSize: 12)
                    .frame(width: 168)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            appField("License number (optional)", text: $licenseNumber)
        }
    }

    private var sectionTwo: some View {
        applicationSection(number: "2", title: "Contact Details") {
            appField("Email *", text: $email)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            if let emailValidationMessage {
                Text(emailValidationMessage)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let emailInUseWarning {
                Text(emailInUseWarning)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            appField("Phone *", text: $phone)
                .keyboardType(.phonePad)
            if let phoneValidationMessage {
                Text(phoneValidationMessage)
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var sectionThree: some View {
        applicationSection(number: "3", title: "Service & Location") {
            appField("Category *", text: $serviceCategory)
            if !serviceCategory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("Normalized as: \(ProviderCategoryNormalizer.label(for: serviceCategory))")
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .foregroundStyle(Color(hex: "6FAEA6"))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack(spacing: 8) {
                appField("City *", text: $city)
                appField("ZIP *", text: $zipCode)
                    .keyboardType(.numberPad)
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Service radius *")
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundStyle(Color(hex: "A1A1AA"))
                    Spacer()
                    Text(serviceRadiusLabel)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundStyle(Color(hex: "0C9182"))
                }

                Slider(value: $serviceRadiusMiles, in: 5...75, step: 5)
                    .tint(Color(hex: "0C9182"))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(hex: "121212"))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "2A2A2E")))

        }
    }

    private var sectionSocials: some View {
        applicationSection(number: "4", title: "Socials") {
            appField("Website (optional)", text: $website)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

            appField("Instagram (optional)", text: $instagram)
        }
    }

    private var sectionFour: some View {
        applicationSection(number: "5", title: "Campus Marketplace (optional)") {
            Toggle("I serve college students", isOn: $campusProvider)
                .toggleStyle(SwitchToggleStyle(tint: Color(hex: "0C9182")))
                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                .foregroundStyle(Color.white)

            if campusProvider {
                appField("Campus name *", text: $schoolName)
                if let normalizedSchoolNamePreview {
                    Text("Normalized as: \(normalizedSchoolNamePreview)")
                        .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                        .foregroundStyle(Color(hex: "6FAEA6"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private var termsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            paymentsInfoCard

            Button {
                acceptedTerms.toggle()
            } label: {
                HStack(alignment: .top, spacing: 10) {
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(acceptedTerms ? Color(hex: "0C9182") : Color.clear)
                        .frame(width: 16, height: 16)
                        .overlay {
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .stroke(Color(hex: acceptedTerms ? "0C9182" : "595965"), lineWidth: 1.5)
                        }
                        .overlay {
                            if acceptedTerms {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(Color.white)
                            }
                        }

                    Text(termsAgreementText)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                        .multilineTextAlignment(.leading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .contentShape(Rectangle())
        .buttonStyle(.plain)

            HStack(spacing: 4) {
                termsLink("Terms of Service", url: "https://www.usescheduleme.com/terms")
                Text("•")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundStyle(Color(hex: "71717A"))
                termsLink("Privacy Policy", url: "https://www.usescheduleme.com/privacy")
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text("We verify provider applications and usually respond within 24–48 hours.")
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                .foregroundStyle(Color(hex: "71717A"))
        }
        .padding(12)
        .background(Color(hex: "151515"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "2C2C30")))
    }

    @ViewBuilder
    private func termsLink(_ label: String, url: String) -> some View {
        Button {
            guard let destination = URL(string: url) else { return }
            openURL(destination)
        } label: {
            Text(label)
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundStyle(Color(hex: "0C9182"))
        }
        .contentShape(Rectangle())
        .buttonStyle(.plain)
    }

    private func applicationSection<Content: View>(number: String, title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(number)
                    .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.bold))
                    .foregroundStyle(Color.white)
                    .frame(width: 18, height: 18)
                    .background(Color(hex: "0C9182"))
                    .clipShape(Circle())
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                    .foregroundStyle(Color.white)
            }

            content()
        }
        .padding(12)
        .background(Color(hex: "151515"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "2C2C30")))
    }

    private var paymentsInfoCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "dollarsign.circle")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color(hex: "0C9182"))
                Text("How payments work")
                    .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                    .foregroundStyle(Color.white)
            }

            Text(paymentsLineOne)
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))

            Text(paymentsLineTwo)
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))

            Text(paymentsLineThree)
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
        }
        .padding(12)
        .background(Color(hex: "151515"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "2C2C30")))
    }

    private var paymentsLineOne: AttributedString {
        var result = AttributedString("Joining is completely free. ScheduleMe takes a ")
        result.foregroundColor = Color(hex: "A1A1AA")

        var emphasis = AttributedString("12% platform fee")
        emphasis.foregroundColor = Color(hex: "0C9182")
        result.append(emphasis)

        var tail = AttributedString(" only when a customer books you. No monthly fees, no per-lead charges.")
        tail.foregroundColor = Color(hex: "A1A1AA")
        result.append(tail)
        return result
    }

    private var paymentsLineTwo: AttributedString {
        var label = AttributedString("Founder50: ")
        label.foregroundColor = Color(hex: "0C9182")

        var body = AttributedString("Only have a 6% lifetime service fee! Founder50 is assigned after approval to the first 50 providers per campus.")
        body.foregroundColor = Color(hex: "A1A1AA")

        label.append(body)
        return label
    }

    private var paymentsLineThree: AttributedString {
        var label = AttributedString("Featured: ")
        label.foregroundColor = Color(hex: "0C9182")

        var body = AttributedString("Complete 3 bookings (or get selected) and get featured at the top of your campus feed for 7 days.")
        body.foregroundColor = Color(hex: "A1A1AA")

        label.append(body)
        return label
    }

    private var termsAgreementText: AttributedString {
        var text = AttributedString("I agree to the ")
        text.foregroundColor = Color(hex: "A1A1AA")

        var terms = AttributedString("Terms of Service")
        terms.foregroundColor = Color(hex: "0C9182")
        text.append(terms)

        var commaOne = AttributedString(", ")
        commaOne.foregroundColor = Color(hex: "A1A1AA")
        text.append(commaOne)

        var privacy = AttributedString("Privacy Policy")
        privacy.foregroundColor = Color(hex: "0C9182")
        text.append(privacy)

        var commaTwo = AttributedString(", and the ")
        commaTwo.foregroundColor = Color(hex: "A1A1AA")
        text.append(commaTwo)

        var commission = AttributedString("commission structure")
        commission.foregroundColor = Color(hex: "0C9182")
        text.append(commission)

        var tail = AttributedString(" on completed jobs.")
        tail.foregroundColor = Color(hex: "A1A1AA")
        text.append(tail)

        return text
    }

    @ViewBuilder
    private func appField(_ placeholder: String, text: Binding<String>, fontSize: CGFloat = 14) -> some View {
        TextField("", text: text, prompt: Text(placeholder).foregroundStyle(Color(hex: "6B7280")))
            .font(.custom(ScheduleMeTheme.fontName, size: fontSize).weight(.medium))
            .foregroundStyle(Color(hex: "E7EAF0"))
            .tint(Color(hex: "0C9182"))
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(hex: "121212"))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color(hex: "2A2A2E"))
                    .allowsHitTesting(false)
            )
    }

    @ViewBuilder
    private func headerPill(_ title: String) -> some View {
        Text(title)
            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
            .foregroundStyle(Color(hex: "8EA09D"))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(hex: "141A1E"))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color(hex: "29313A")))
    }

    private func submit() async {
        submissionError = nil
        resultMessage = nil
        guard !didSubmitSuccessfully else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        struct ApplicationResponse: Decodable {
            let success: Bool?
            let businessId: String?
            let error: String?
        }

        struct MobileApplicationRequest: Encodable {
            let businessName: String
            let ownerName: String
            let email: String
            let phone: String?
            let serviceCategory: String
            let otherCategory: String?
            let city: String
            let website: String?
            let instagram: String?
            let campusProvider: Bool
            let schoolName: String?
        }

        let trimmedBusinessName = businessName.trimmingCharacters(in: .whitespacesAndNewlines)
        if let invalid = ProviderInputValidator.invalidNameMessage(trimmedBusinessName) {
            submissionError = invalid
            return
        }

        let rawCategory = serviceCategory.trimmingCharacters(in: .whitespacesAndNewlines)
        if let invalid = ProviderInputValidator.invalidCategoryMessage(rawCategory) {
            submissionError = invalid
            return
        }
        let canonicalCategoryKey = ProviderCategoryNormalizer.normalizeServiceTag(rawCategory, allowFallback: true)
        if canonicalCategoryKey.isEmpty {
            submissionError = "Please select a valid category."
            return
        }
        let canonicalCategoryLabel = ProviderCategoryNormalizer.label(for: canonicalCategoryKey)

        let mobilePayload = MobileApplicationRequest(
            businessName: trimmedBusinessName,
            ownerName: ownerName.trimmingCharacters(in: .whitespacesAndNewlines),
            email: trimmedEmail,
            phone: trimmedPhone.isEmpty ? nil : trimmedPhone,
            serviceCategory: canonicalCategoryKey,
            otherCategory: canonicalCategoryLabel.caseInsensitiveCompare(rawCategory) == .orderedSame ? nil : rawCategory,
            city: city.trimmingCharacters(in: .whitespacesAndNewlines),
            website: normalizedWebsite(website),
            instagram: instagram.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : instagram.trimmingCharacters(in: .whitespacesAndNewlines),
            campusProvider: campusProvider,
            schoolName: campusProvider ? normalizedCampusName(schoolName) : nil
        )

        do {
            let response: ApplicationResponse = try await APIClient.shared.send(
                path: "/api/mobile-business-signup",
                method: "POST",
                body: mobilePayload,
                requiresAuth: false
            )
            if response.success == true {
                didSubmitSuccessfully = true
                submissionError = nil
                resultMessage = nil
                showSubmissionConfirmationModal = true
                return
            }
            let backendMessage = response.error?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if backendMessage.lowercased().contains("already exists") {
                submissionError = "This email is already linked to an existing provider application."
            } else {
                submissionError = backendMessage.isEmpty
                    ? "Unable to submit application right now. Please try again."
                    : backendMessage
            }
        } catch {
            let message = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
            let lower = message.lowercased()
            if lower.contains("already exists") || lower.contains("already linked to an existing provider") {
                submissionError = "This email is already linked to an existing provider application."
            } else if lower.contains("authentication required") || lower.contains("invalid or expired session") || lower.contains("sign in") {
                submissionError = "Please sign in again, then submit your provider application."
            } else {
                submissionError = message.isEmpty
                    ? "Unable to submit application right now. Please try again."
                    : message
            }
        }
    }

    private func dismissKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private func normalizedWebsite(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") {
            return trimmed
        }
        return "https://\(trimmed)"
    }

    private func normalizedCampusName(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        let collapsed = trimmed.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        let lower = collapsed.lowercased()

        let knownAcronyms: [String: String] = [
            "ucsc": "UCSC",
            "ucla": "UCLA",
            "ucsb": "UCSB",
            "ucsd": "UCSD",
            "ucd": "UCD",
            "uc davis": "UC Davis",
            "sjsu": "SJSU",
            "sfsu": "SFSU",
            "nyu": "NYU",
            "usc": "USC",
            "mit": "MIT",
            "ucla extension": "UCLA Extension"
        ]
        if let mapped = knownAcronyms[lower] { return mapped }

        if lower.range(of: #"^[a-z]{2,6}$"#, options: .regularExpression) != nil {
            return lower.uppercased()
        }

        return collapsed
            .split(separator: " ")
            .map { token in
                let part = String(token)
                if part.count <= 4, part.range(of: #"^[A-Za-z]+$"#, options: .regularExpression) != nil {
                    return part.uppercased()
                }
                return part.prefix(1).uppercased() + part.dropFirst().lowercased()
            }
            .joined(separator: " ")
    }

    private struct ProviderEmailCheckResponse: Decodable {
        let exists: Bool
        let status: String?
    }

    private func scheduleEmailInUseCheck(for raw: String) {
        emailCheckTask?.cancel()
        emailInUseWarning = nil

        let normalized = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty, emailValidationMessage == nil else { return }

        emailCheckTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            await checkEmailInUse(normalized)
        }
    }

    private func checkEmailInUse(_ normalizedEmail: String) async {
        do {
            let response: ProviderEmailCheckResponse = try await APIClient.shared.get(
                path: "/api/provider-email-check",
                queryItems: [URLQueryItem(name: "email", value: normalizedEmail)],
                requiresAuth: false
            )
            guard !Task.isCancelled else { return }
            await MainActor.run {
                if email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() != normalizedEmail {
                    return
                }
                guard response.exists else {
                    emailInUseWarning = nil
                    return
                }
                let normalizedStatus = response.status?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if normalizedStatus == "pending" {
                    emailInUseWarning = "An application with this email is pending review. Please wait for the approval or denial email."
                } else if normalizedStatus == "approved" {
                    emailInUseWarning = "This email is already linked to an approved provider account."
                } else {
                    emailInUseWarning = "This email is already linked to a provider application."
                }
            }
        } catch {
            guard !Task.isCancelled else { return }
            await MainActor.run {
                emailInUseWarning = nil
            }
        }
    }
}

private struct KeyboardDismissTapCatcher: UIViewRepresentable {
    let onTapOutsideTextInput: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onTapOutsideTextInput: onTapOutsideTextInput)
    }

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.ensureRecognizerInstalled(from: uiView)
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        private let onTapOutsideTextInput: () -> Void
        private weak var hostView: UIView?
        private weak var recognizer: UITapGestureRecognizer?

        init(onTapOutsideTextInput: @escaping () -> Void) {
            self.onTapOutsideTextInput = onTapOutsideTextInput
        }

        deinit {
            if let recognizer, let hostView {
                hostView.removeGestureRecognizer(recognizer)
            }
        }

        func ensureRecognizerInstalled(from anchor: UIView) {
            DispatchQueue.main.async { [weak self, weak anchor] in
                guard let self, let anchor else { return }
                let targetHost = self.findScrollableHost(startingAt: anchor) ?? anchor.window
                guard let targetHost else { return }

                if self.hostView === targetHost, self.recognizer != nil { return }

                if let recognizer = self.recognizer, let hostView = self.hostView {
                    hostView.removeGestureRecognizer(recognizer)
                }

                let tap = UITapGestureRecognizer(target: self, action: #selector(Coordinator.handleTap(_:)))
                tap.cancelsTouchesInView = false
                tap.delegate = self
                targetHost.addGestureRecognizer(tap)

                self.hostView = targetHost
                self.recognizer = tap
            }
        }

        @objc
        private func handleTap(_ gesture: UITapGestureRecognizer) {
            onTapOutsideTextInput()
        }

        private func findScrollableHost(startingAt view: UIView) -> UIView? {
            var current = view.superview
            while let candidate = current {
                if candidate is UIScrollView {
                    return candidate
                }
                current = candidate.superview
            }
            return nil
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            var view = touch.view
            while let current = view {
                if current is UITextField || current is UITextView {
                    return false
                }
                view = current.superview
            }
            return true
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }
    }
}
