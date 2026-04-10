import SwiftUI
import Foundation

struct ProviderAuthView: View {
    @Binding var step: AuthView.AuthStep
    @Binding var email: String
    @Binding var password: String
    @Binding var isLoading: Bool
    @Binding var errorText: String?

    let onEmailAuth: () -> Void
    let onApple: () -> Void
    let onGoogle: () -> Void

    @State private var page = 0
    @State private var hasUnlockedAuthButtons = false
    @State private var showingProviderApplication = false

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

            Text("Looking to book services? →")
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundStyle(Color(hex: "71717A"))
                .padding(.top, 14)

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

                    providerField("Password", text: $password, secure: true)

                    if let errorText {
                        Text(errorText)
                            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

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
    private func providerField(_ placeholder: String, text: Binding<String>, secure: Bool = false) -> some View {
        Group {
            if secure {
                SecureField("", text: text, prompt: Text(placeholder).foregroundStyle(Color(hex: "71717A")))
            } else {
                TextField("", text: text, prompt: Text(placeholder).foregroundStyle(Color(hex: "71717A")))
            }
        }
        .scheduleMePasteMenu(text)
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
    @State private var otherCategory = ""
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

    private let categories = [
        "Plumbing", "Electrical", "HVAC", "Cleaning", "Handyman", "Home Repair / Handyman",
        "Painting", "Landscaping", "Roofing", "Carpentry", "Moving", "Photography",
        "Tutoring", "Hair & Beauty", "Salon / Beauty", "Auto Repair", "Automotive",
        "Arts & Crafts", "Pest Control", "Other"
    ]
    private var serviceRadiusLabel: String {
        "\(Int(serviceRadiusMiles.rounded())) miles"
    }

    private var canSubmit: Bool {
        !businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !ownerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !city.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !zipCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !serviceCategory.isEmpty &&
        (!campusProvider || !schoolName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) &&
        acceptedTerms &&
        !isSubmitting
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
        .background(Color(hex: "0D0D0D").ignoresSafeArea())
        .navigationTitle("Provider Application")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(Color(hex: "0D0D0D"), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
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
                appField("Years (optional)", text: $yearsInBusiness)
                    .frame(width: 138)
            }
            appField("License number (optional)", text: $licenseNumber)
        }
    }

    private var sectionTwo: some View {
        applicationSection(number: "2", title: "Contact Details") {
            appField("Email *", text: $email)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            appField("Phone *", text: $phone)
                .keyboardType(.phonePad)
        }
    }

    private var sectionThree: some View {
        applicationSection(number: "3", title: "Service & Location") {
            Menu {
                ForEach(categories, id: \.self) { category in
                    Button(category) { serviceCategory = category }
                }
            } label: {
                HStack {
                    Text(serviceCategory.isEmpty ? "Select category *" : serviceCategory)
                        .foregroundStyle(serviceCategory.isEmpty ? Color(hex: "6C6C75") : Color(hex: "ECECF0"))
                    Spacer()
                    Image(systemName: "chevron.down")
                        .foregroundStyle(Color(hex: "6C6C75"))
                }
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color(hex: "111317"))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "2A3038")))
            }

            if serviceCategory == "Other" {
                appField("Other category", text: $otherCategory)
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
            .background(Color(hex: "111317"))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "2A3038")))

        }
    }

    private var sectionSocials: some View {
        applicationSection(number: "4", title: "Socials") {
            appField("Website", text: $website)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()

            appField("Instagram", text: $instagram)
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
        .background(Color(hex: "16181C"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "252B33")))
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
        .background(Color(hex: "16181C"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "252B33")))
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
        .background(Color(hex: "102321"))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(hex: "0C9182").opacity(0.5)))
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
    private func appField(_ placeholder: String, text: Binding<String>) -> some View {
        TextField("", text: text, prompt: Text(placeholder).foregroundStyle(Color(hex: "6B7280")))
            .scheduleMePasteMenu(text)
            .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
            .foregroundStyle(Color(hex: "E7EAF0"))
            .tint(Color(hex: "0C9182"))
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(hex: "111317"))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color(hex: "2A3038"))
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
        isSubmitting = true
        defer { isSubmitting = false }

        struct ApplicationRequest: Encodable {
            let businessName: String
            let ownerName: String
            let email: String
            let phone: String?
            let serviceCategory: String
            let otherCategory: String?
            let city: String
            let zipCode: String
            let serviceRadiusMiles: String
            let licenseNumber: String?
            let website: String?
            let instagram: String?
            let campusProvider: Bool
            let schoolName: String?
        }

        struct ApplicationResponse: Decodable {
            let success: Bool?
            let businessId: String?
            let error: String?
        }

        guard let base = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
              let baseURL = URL(string: base),
              let url = URL(string: "/api/business-signup", relativeTo: baseURL) else {
            submissionError = "Invalid API configuration."
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = ApplicationRequest(
            businessName: businessName.trimmingCharacters(in: .whitespacesAndNewlines),
            ownerName: ownerName.trimmingCharacters(in: .whitespacesAndNewlines),
            email: email.trimmingCharacters(in: .whitespacesAndNewlines),
            phone: phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : phone.trimmingCharacters(in: .whitespacesAndNewlines),
            serviceCategory: serviceCategory,
            otherCategory: otherCategory.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : otherCategory.trimmingCharacters(in: .whitespacesAndNewlines),
            city: city.trimmingCharacters(in: .whitespacesAndNewlines),
            zipCode: zipCode.trimmingCharacters(in: .whitespacesAndNewlines),
            serviceRadiusMiles: "\(Int(serviceRadiusMiles.rounded()))",
            licenseNumber: licenseNumber.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : licenseNumber.trimmingCharacters(in: .whitespacesAndNewlines),
            website: website.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : website.trimmingCharacters(in: .whitespacesAndNewlines),
            instagram: instagram.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : instagram.trimmingCharacters(in: .whitespacesAndNewlines),
            campusProvider: campusProvider,
            schoolName: schoolName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : schoolName.trimmingCharacters(in: .whitespacesAndNewlines)
        )

        do {
            request.httpBody = try JSONEncoder().encode(payload)
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                submissionError = "Invalid server response."
                return
            }

            let decoded = try? JSONDecoder().decode(ApplicationResponse.self, from: data)

            if (200..<300).contains(http.statusCode), decoded?.success == true {
                resultMessage = "Application submitted successfully. We'll email you after review."
            } else {
                submissionError = decoded?.error ?? "Unable to submit application."
            }
        } catch {
            submissionError = error.localizedDescription
        }
    }
}
