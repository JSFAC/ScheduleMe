// FILE OVERVIEW:
// Shared theme tokens + reusable UI primitives used app-wide.
//
// DEBUG NOTES:
// For color/style consistency changes, update tokens/components here before per-view edits.

import SwiftUI
import Combine
import UIKit
import AuthenticationServices
import Supabase

// MARK: - Shared Theme + Reusable UI Primitives

enum ScheduleMeTheme {
    // Core semantic tokens.
    // Edit these first when changing brand/theme so all screens stay consistent.
    static let accent = Color(hex: "0F766E")
    static let accentSoft = Color.dynamic(light: Color(hex: "0F766E").opacity(0.12), dark: Color(hex: "0F766E").opacity(0.28))
    static let headerGreen = Color.dynamic(light: Color(hex: "2F6F63"), dark: Color(hex: "215B54"))
    static let sectionBlue = Color(hex: "EDF5FF")
    static let creamBackground = Color.dynamic(light: Color(hex: "F6F1EA"), dark: Color(hex: "0A0A0A"))
    static let pageBackground = Color.dynamic(light: Color(hex: "F9F7F2"), dark: Color(hex: "0A0A0A"))
    static let surface = Color.dynamic(light: .white, dark: Color(hex: "171717"))
    static let cardBorder = Color.dynamic(light: Color.black.opacity(0.09), dark: Color.white.opacity(0.12))
    static let cardBorderStrong = Color.dynamic(light: Color.black.opacity(0.2), dark: Color.white.opacity(0.24))
    static let mutedText = Color.dynamic(light: Color(hex: "6B7280"), dark: Color(hex: "9CA3AF"))
    static let titleText = Color.dynamic(light: Color(hex: "0F172A"), dark: Color(hex: "F3F4F6"))
    static let tagText = Color.dynamic(light: Color(hex: "0F766E"), dark: Color(hex: "9AE6D7"))
    static let tagBackground = Color.dynamic(light: Color(hex: "0F766E").opacity(0.12), dark: Color(hex: "0F766E").opacity(0.38))
    static let fontName = "PlusJakartaSans-Regular"
}

struct ScheduleMePage<Content: View>: View {
    @ViewBuilder let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()
            content
        }
    }
}

struct ScheduleMeBackground: View {
    var body: some View {
        ZStack {
            ScheduleMeTheme.creamBackground
            DottedGrid(spacing: 20, dotSize: 1.6, color: Color.dynamic(light: Color(hex: "CBD5E1"), dark: Color(hex: "262626")))
                .opacity(0.14)
        }
    }
}

struct DottedGrid: View {
    var spacing: CGFloat = 18
    var dotSize: CGFloat = 2
    var color: Color = Color(hex: "D1D5DB")

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            Path { path in
                for y in stride(from: 0, to: size.height, by: spacing) {
                    for x in stride(from: 0, to: size.width, by: spacing) {
                        path.addEllipse(in: CGRect(x: x, y: y, width: dotSize, height: dotSize))
                    }
                }
            }
            .fill(color)
        }
    }
}

struct ScheduleMeCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(ScheduleMeTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(ScheduleMeTheme.cardBorder)
        )
        .shadow(color: .black.opacity(0.035), radius: 8, y: 4)
    }
}

struct ScheduleMePrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(ScheduleMeTheme.accent.opacity(configuration.isPressed ? 0.85 : 1.0))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.99 : 1.0)
    }
}

struct ScheduleMeSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.semibold))
            .foregroundStyle(ScheduleMeTheme.titleText)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(ScheduleMeTheme.surface.opacity(configuration.isPressed ? 0.8 : 1.0))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct ScheduleMeLoadingBar: View {
    var width: CGFloat? = 120
    var height: CGFloat = 7
    var tint: Color = ScheduleMeTheme.accent
    var track: Color = ScheduleMeTheme.cardBorder.opacity(0.65)
    var minimumFill: CGFloat = 0.06
    var completesOnFirstRun: Bool = false
    var finishSignal: Bool = false
    var progressOverride: CGFloat? = nil
    var shimmerOpacity: CGFloat = 0.22
    var onCompleted: (() -> Void)? = nil

    @State private var progress: CGFloat = 0.06
    @State private var animationTask: Task<Void, Never>?
    @State private var didNotifyCompletion = false
    @State private var shouldFinishSinglePass = false
    @State private var shimmerPhase: CGFloat = -0.4

    var body: some View {
        ZStack(alignment: .leading) {
            Capsule()
                .fill(track)

            GeometryReader { proxy in
                let fillWidth = max(proxy.size.width * progress, proxy.size.width * minimumFill)
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [tint.opacity(0.78), tint],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: fillWidth)
                    .overlay(alignment: .leading) {
                        Rectangle()
                            .fill(
                                LinearGradient(
                                    colors: [.clear, .white.opacity(shimmerOpacity), .clear],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                            )
                            .frame(width: proxy.size.width * 0.22, height: height * 2.4)
                            .rotationEffect(.degrees(18))
                            .offset(x: proxy.size.width * shimmerPhase)
                    }
                    .mask(
                        Capsule()
                            .frame(width: fillWidth)
                    )
            }
        }
        .frame(width: width, height: height)
        .clipShape(Capsule())
        .onAppear {
            shimmerPhase = -0.4
            withAnimation(.linear(duration: 1.05).repeatForever(autoreverses: false)) {
                shimmerPhase = 1.35
            }
            if let progressOverride {
                progress = max(minimumFill, min(progressOverride, 1.0))
                if progress >= 1.0, !didNotifyCompletion {
                    didNotifyCompletion = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.19) {
                        onCompleted?()
                    }
                }
                return
            }
            shouldFinishSinglePass = finishSignal
            startProgressAnimation()
        }
        .onChange(of: progressOverride) { _, newValue in
            guard let newValue else { return }
            animationTask?.cancel()
            animationTask = nil
            let clamped = max(minimumFill, min(newValue, 1.0))
            withAnimation(.easeOut(duration: 0.22)) {
                progress = clamped
            }
            if clamped >= 1.0, !didNotifyCompletion {
                didNotifyCompletion = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.19) {
                    onCompleted?()
                }
            }
        }
        .onChange(of: finishSignal) { _, newValue in
            guard progressOverride == nil else { return }
            if newValue {
                shouldFinishSinglePass = true
            }
        }
        .onDisappear {
            animationTask?.cancel()
            animationTask = nil
            shimmerPhase = -0.4
        }
    }

    private func startProgressAnimation() {
        animationTask?.cancel()
        didNotifyCompletion = false
        animationTask = Task {
            if completesOnFirstRun {
                await runSinglePass()
                return
            }

            while !Task.isCancelled {
                await runSinglePass()
                try? await Task.sleep(nanoseconds: 150_000_000)
            }
        }
    }

    private func runSinglePass() async {
        await MainActor.run {
            progress = minimumFill
        }
        if completesOnFirstRun {
            // Single startup pass: smooth fill to near-complete, then finish only when root data is ready.
            await animateProgress(to: 0.45, duration: 0.55, curve: .linear)
            await animateProgress(to: 0.72, duration: 0.55, curve: .linear)
            await animateProgress(to: 0.88, duration: 0.50, curve: .easeOut)
            await animateProgress(to: 0.94, duration: 0.46, curve: .easeOut)
            while !Task.isCancelled {
                let ready = await MainActor.run { shouldFinishSinglePass }
                if ready { break }
                try? await Task.sleep(nanoseconds: 80_000_000)
            }
            await animateProgress(to: 1.0, duration: 0.12)
        } else {
            // In-page pass: still responsive, but less synthetic-looking.
            await animateProgress(to: 0.6, duration: 0.14, curve: .easeOut)
            await animateProgress(to: 0.82, duration: 0.18, curve: .easeOut)
            await animateProgress(to: 0.94, duration: 0.22, curve: .easeOut)
            await animateProgress(to: 0.985, duration: 0.20, curve: .easeOut)
            try? await Task.sleep(nanoseconds: 50_000_000)
            await animateProgress(to: 1.0, duration: 0.09)
        }

        if completesOnFirstRun, !didNotifyCompletion {
            await MainActor.run {
                didNotifyCompletion = true
                onCompleted?()
            }
        }
    }

    private enum ProgressCurve {
        case linear
        case easeOut
    }

    private func animateProgress(to value: CGFloat, duration: Double, curve: ProgressCurve = .easeOut) async {
        await MainActor.run {
            let animation: Animation = {
                switch curve {
                case .linear:
                    return .linear(duration: duration)
                case .easeOut:
                    return .easeOut(duration: duration)
                }
            }()
            withAnimation(animation) {
                progress = max(minimumFill, min(value, 1.0))
            }
        }
        let nanos = UInt64(duration * 1_000_000_000)
        try? await Task.sleep(nanoseconds: nanos)
    }
}

struct ScheduleMeFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
            .foregroundColor(ScheduleMeTheme.titleText)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(ScheduleMeTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
    }
}

struct ScheduleMeTag: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
            .foregroundStyle(ScheduleMeTheme.tagText)
            .lineLimit(1)
            .truncationMode(.tail)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(ScheduleMeTheme.tagBackground)
            .clipShape(Capsule())
    }
}

struct ScheduleMeSectionHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Circle()
                    .fill(ScheduleMeTheme.accent)
                    .frame(width: 5, height: 5)
                Text(eyebrow.uppercased())
                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
                    .tracking(1.4)
                    .foregroundStyle(ScheduleMeTheme.accent)
            }

            Text(title)
                .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                .foregroundStyle(ScheduleMeTheme.titleText)

            if let subtitle {
                Text(subtitle)
                    .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
            }
        }
    }
}

struct ScheduleMeEmptyState: View {
    let title: String
    let message: String
    let systemImage: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        ScheduleMeCard {
            VStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(ScheduleMeTheme.accent)
                Text(title)
                    .font(.custom(ScheduleMeTheme.fontName, size: 19).weight(.semibold))
                    .foregroundStyle(ScheduleMeTheme.titleText)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                    .foregroundStyle(ScheduleMeTheme.mutedText)
                    .multilineTextAlignment(.center)
                if let actionTitle, let action {
                    Button(actionTitle, action: action)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(ScheduleMeTheme.accent)
                        .clipShape(Capsule())
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

struct ScheduleMeTopBar: View {
    @EnvironmentObject private var appState: AppState
    @State private var showingAccount = false
    @State private var showingNotifications = false
    @AppStorage("scheduleme_display_name") private var storedDisplayName = ""

    var body: some View {
        HStack {
            HStack(spacing: 0) {
                #if PROVIDER_APP
                Text("ScheduleMe")
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text(" Pro")
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.accent)
                #else
                Text("Schedule")
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text("Me")
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.accent)
                #endif
            }
            Spacer()
            Button {
                showingNotifications = true
            } label: {
                Image(systemName: "bell")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .frame(width: 32, height: 32)
                    .background(ScheduleMeTheme.surface)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
            }
            .buttonStyle(.plain)
            .padding(.trailing, 6)
            Button {
                showingAccount = true
            } label: {
                avatarView
            }
            .buttonStyle(.plain)
            .fullScreenCover(isPresented: $showingAccount) {
                AccountView()
            }
            .fullScreenCover(isPresented: $showingNotifications) {
                NotificationsView()
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 0)
        .padding(.bottom, 4)
    }

    private var initials: String {
        if !storedDisplayName.isEmpty, let first = storedDisplayName.first {
            return String(first).uppercased()
        }
        guard let email = appState.userEmail, let first = email.first else { return "SM" }
        return String(first).uppercased()
    }

    @ViewBuilder
    private var avatarView: some View {
        if !appState.isAuthenticated {
            Circle()
                .fill(ScheduleMeTheme.surface)
                .frame(width: 30, height: 30)
                .overlay(
                    Image(systemName: "person.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                )
                .overlay(Circle().stroke(ScheduleMeTheme.cardBorder))
        } else
        if let avatarURL = appState.avatarURL, let url = URL(string: avatarURL) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    Text(initials)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(width: 30, height: 30)
            .background(ScheduleMeTheme.accent)
            .clipShape(Circle())
            .overlay(Circle().stroke(Color.white, lineWidth: 0.5))
        } else {
            Circle()
                .fill(ScheduleMeTheme.accent)
                .frame(width: 30, height: 30)
                .overlay(
                    Text(initials)
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                        .foregroundColor(.white)
                )
        }
    }
}

struct ScheduleMeHeaderBlock<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let subtitle: String
    let actionTitle: String?
    let action: (() -> Void)?
    @ViewBuilder let content: Content

    init(title: String, subtitle: String, actionTitle: String? = nil, action: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.actionTitle = actionTitle
        self.action = action
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(title)
                        .font(.custom(ScheduleMeTheme.fontName, size: 24).weight(.bold))
                        .foregroundColor(.white)
                    Text(subtitle)
                        .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                        .foregroundColor(.white.opacity(0.85))
                }
                Spacer()
                if let actionTitle, let action {
                    Button(action: action) {
                        HStack(spacing: 6) {
                            Image(systemName: "plus")
                            Text(actionTitle)
                                .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                        }
                        .foregroundColor(colorScheme == .dark ? .white : ScheduleMeTheme.headerGreen)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(colorScheme == .dark ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
                        .clipShape(Capsule())
                    }
                }
            }
            content
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 16)
        .background(ScheduleMeTheme.headerGreen)
    }
}

struct ScheduleMePill: View {
    let text: String
    let isActive: Bool

    var body: some View {
        Text(text)
            .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
            .foregroundColor(isActive ? .white : ScheduleMeTheme.accent)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isActive ? ScheduleMeTheme.accent : ScheduleMeTheme.surface)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
    }
}

enum ScheduleMeTab: Hashable {
    case campus, home, browse, bookings, messages
}

final class TabRouter: ObservableObject {
    @Published var selected: ScheduleMeTab = .home
    @Published var browsePrefillQuery: String? = nil
    @Published var pendingMessageBusinessID: String? = nil
    @Published var pendingMessageBookingID: String? = nil
}

struct ScheduleMeScreen<Content: View>: View {
    @ViewBuilder let content: Content
    var showsTopBar: Bool = true
    var scrolls: Bool = true
    var showsTopFade: Bool = true
    var allowsBounce: Bool = false
    var respectsTabBarInset: Bool = true
    var onRefresh: (() async -> Void)? = nil
    @Environment(\.floatingTabBarHeight) private var floatingTabBarHeight

    init(
        showsTopBar: Bool = true,
        scrolls: Bool = true,
        showsTopFade: Bool = true,
        allowsBounce: Bool = false,
        respectsTabBarInset: Bool = true,
        onRefresh: (() async -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.showsTopBar = showsTopBar
        self.scrolls = scrolls
        self.showsTopFade = showsTopFade
        self.allowsBounce = allowsBounce
        self.respectsTabBarInset = respectsTabBarInset
        self.onRefresh = onRefresh
        self.content = content()
    }

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            Group {
                if scrolls {
                    ScrollView {
                        VStack(spacing: 0) {
                            content
                        }
                        .frame(maxWidth: .infinity, alignment: .top)
                    }
                    .scrollBounceBehavior(allowsBounce ? .always : .basedOnSize)
                    .refreshable {
                        guard let onRefresh else { return }
                        await onRefresh()
                    }
                } else {
                    VStack(spacing: 0) {
                        content
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
            }
            .clipped()
            .safeAreaInset(edge: .top) {
                if showsTopBar {
                    // Top bar is injected as a safe area inset so content naturally scrolls under it.
                    ScheduleMeTopBar()
                        .background(TopBarBackground(showsFade: showsTopFade))
                }
            }
            .safeAreaInset(edge: .bottom) {
                if respectsTabBarInset, floatingTabBarHeight > 0 {
                    Color.clear.frame(height: floatingTabBarHeight)
                }
            }
        }
    }
}

private struct TopBarBackground: View {
    let showsFade: Bool

    var body: some View {
        ZStack(alignment: .bottom) {
            ScheduleMeTheme.creamBackground
            if showsFade {
                LinearGradient(
                    colors: [
                        ScheduleMeTheme.creamBackground,
                        ScheduleMeTheme.creamBackground.opacity(0.16),
                        ScheduleMeTheme.creamBackground.opacity(0.05),
                        ScheduleMeTheme.creamBackground.opacity(0)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 12)
            }
        }
    }
}

private struct FloatingTabBarHeightKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

extension EnvironmentValues {
    var floatingTabBarHeight: CGFloat {
        get { self[FloatingTabBarHeightKey.self] }
        set { self[FloatingTabBarHeightKey.self] = newValue }
    }
}

struct SkeletonBlock: View {
    var width: CGFloat? = nil
    var height: CGFloat
    var cornerRadius: CGFloat = 14
    var color: Color = Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "2C2C2E"))

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(color)
            .frame(width: width, height: height)
    }
}

struct SkeletonCircle: View {
    var size: CGFloat
    var color: Color = Color.dynamic(light: Color(hex: "E5E7EB"), dark: Color(hex: "2C2C2E"))

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
    }
}

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -0.6

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { proxy in
                    let width = proxy.size.width
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.white.opacity(0.0),
                            Color.white.opacity(0.78),
                            Color.white.opacity(0.0)
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: width * 0.52)
                    .offset(x: phase * width * 2)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) {
                    phase = 0.6
                }
            }
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

extension View {
    func scheduleMeFieldStyle() -> some View {
        modifier(ScheduleMeFieldModifier())
    }
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let r, g, b, a: Double
        switch cleaned.count {
        case 6:
            r = Double((int >> 16) & 0xFF) / 255.0
            g = Double((int >> 8) & 0xFF) / 255.0
            b = Double(int & 0xFF) / 255.0
            a = 1.0
        case 8:
            r = Double((int >> 24) & 0xFF) / 255.0
            g = Double((int >> 16) & 0xFF) / 255.0
            b = Double((int >> 8) & 0xFF) / 255.0
            a = Double(int & 0xFF) / 255.0
        default:
            r = 0
            g = 0
            b = 0
            a = 1.0
        }
        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }

    static func dynamic(light: Color, dark: Color) -> Color {
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}

// MARK: - Provider Onboarding

struct ProviderOnboardingSheet: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    let onCreated: ((String?) -> Void)?

    private enum EntryMode: Hashable {
        case newProvider
        case existingAccount
    }

    @State private var businessName = ""
    @State private var ownerName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var loginEmail = ""
    @State private var loginPassword = ""
    @State private var agreedToProviderTerms = false
    @State private var isSubmitting = false
    @State private var isSigningIn = false
    @State private var isOAuthLoading = false
    @State private var oauthProviderInFlight: Provider?
    @State private var errorText: String?
    @State private var successText: String?
    @State private var entryMode: EntryMode = .newProvider
    @AppStorage("scheduleme_provider_terms_accepted") private var hasAcceptedProviderTerms = false

    init(onCreated: ((String?) -> Void)? = nil) {
        self.onCreated = onCreated
    }

    private var canSubmit: Bool {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasRequired = !businessName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !ownerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !trimmedEmail.isEmpty
            && trimmedEmail.contains("@")
        return hasRequired && agreedToProviderTerms
    }

    var body: some View {
        NavigationStack {
            ScheduleMePage {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Spacer()
                            Button {
                                dismiss()
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                    .frame(width: 34, height: 34)
                                    .background(ScheduleMeTheme.surface)
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }

                        Text("Create your provider account")
                            .font(.custom(ScheduleMeTheme.fontName, size: 34).weight(.bold))
                            .foregroundColor(ScheduleMeTheme.titleText)

                        Text(entryMode == .newProvider
                             ? "Create your listing in minutes. First-time provider setup requires agreement to provider terms."
                             : "Already have an account? Sign in and continue in Provider Hub without re-entering terms.")
                            .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.medium))
                            .foregroundColor(ScheduleMeTheme.mutedText)

                        ScheduleMeCard {
                            entryModeToggle

                            if entryMode == .newProvider {
                                newProviderFields
                            } else {
                                existingAccountFields
                            }

                            VStack(alignment: .leading, spacing: 0) {
                                if let errorText {
                                    Text(errorText)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                        .foregroundColor(.red)
                                } else if let successText {
                                    Text(successText)
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.accent)
                                } else if isOAuthLoading {
                                    Text("Opening \(oauthProviderInFlight == .apple ? "Apple" : "Google") sign in…")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                        .foregroundColor(ScheduleMeTheme.accent)
                                }
                            }
                            .frame(minHeight: 34, alignment: .topLeading)

                            if entryMode == .newProvider {
                                Button(isSubmitting ? "Creating account..." : "Create provider account") {
                                    Task { await submit() }
                                }
                                .buttonStyle(ScheduleMePrimaryButtonStyle())
                                .disabled(isSubmitting || isSigningIn || isOAuthLoading || !canSubmit)
                            } else {
                                Button(isSigningIn ? "Signing in..." : (appState.isAuthenticated ? "Continue to Provider Hub" : "Sign in and continue")) {
                                    Task { await signInWithEmailAccount() }
                                }
                                .buttonStyle(ScheduleMePrimaryButtonStyle())
                                .disabled(
                                    isSubmitting
                                    || isSigningIn
                                    || isOAuthLoading
                                    || (!appState.isAuthenticated && (loginEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || loginPassword.isEmpty))
                                )
                            }

                            HStack(spacing: 10) {
                                Rectangle()
                                    .fill(ScheduleMeTheme.cardBorder)
                                    .frame(height: 1)
                                Text("or continue with")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                Rectangle()
                                    .fill(ScheduleMeTheme.cardBorder)
                                    .frame(height: 1)
                            }

                            Button {
                                if requireTermsAcceptanceForSocialSignIn() {
                                    Task { await signInWithOAuth(.google) }
                                }
                            } label: {
                                HStack(spacing: 8) {
                                    if isOAuthLoading && oauthProviderInFlight == .google {
                                        ProgressView()
                                            .controlSize(.small)
                                    } else {
                                    Image("GoogleIcon")
                                        .resizable()
                                        .scaledToFit()
                                        .frame(width: 18, height: 18)
                                    }
                                    Text("Continue with Google")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                }
                            }
                            .buttonStyle(ScheduleMeSecondaryButtonStyle())
                            .disabled(isSubmitting || isSigningIn || isOAuthLoading)

                            Button {
                                if requireTermsAcceptanceForSocialSignIn() {
                                    Task { await signInWithOAuth(.apple) }
                                }
                            } label: {
                                HStack(spacing: 8) {
                                    if isOAuthLoading && oauthProviderInFlight == .apple {
                                        ProgressView()
                                            .controlSize(.small)
                                    } else {
                                        Image(systemName: "apple.logo")
                                            .font(.system(size: 14, weight: .semibold))
                                    }
                                    Text("Continue with Apple")
                                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                                }
                            }
                            .buttonStyle(ScheduleMeSecondaryButtonStyle())
                            .disabled(isSubmitting || isSigningIn || isOAuthLoading)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 14)
                    .padding(.bottom, 28)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .onAppear {
                agreedToProviderTerms = hasAcceptedProviderTerms
                let defaultName = appState.userFirstName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if ownerName.isEmpty, !defaultName.isEmpty {
                    ownerName = defaultName
                }
                let defaultEmail = appState.userEmail?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if email.isEmpty, !defaultEmail.isEmpty {
                    email = defaultEmail
                }
                if loginEmail.isEmpty, !defaultEmail.isEmpty {
                    loginEmail = defaultEmail
                }
                entryMode = appState.isAuthenticated ? .existingAccount : .newProvider
            }
        }
    }

    private var entryModeToggle: some View {
        HStack(spacing: 0) {
            ForEach([EntryMode.newProvider, .existingAccount], id: \.self) { mode in
                let active = entryMode == mode
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        entryMode = mode
                        errorText = nil
                        successText = nil
                    }
                } label: {
                    Text(mode == .newProvider ? "New provider" : "Already have account")
                        .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(active ? .bold : .semibold))
                        .foregroundColor(active ? ScheduleMeTheme.accent : ScheduleMeTheme.mutedText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(active ? ScheduleMeTheme.accentSoft : Color.clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(ScheduleMeTheme.surface)
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ScheduleMeTheme.cardBorder))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var newProviderFields: some View {
        VStack(alignment: .leading, spacing: 10) {
            field("Business / provider name", text: $businessName, placeholder: "e.g. Mike R. Plumbing")
            field("Full name", text: $ownerName, placeholder: "Jamie Rivera")
            field("Email", text: $email, placeholder: "you@example.com", keyboard: .emailAddress, noCap: true)
            field("Phone (optional)", text: $phone, placeholder: "(555)-555-5555", keyboard: .phonePad)

            HStack(alignment: .top, spacing: 10) {
                Image(systemName: agreedToProviderTerms ? "checkmark.square.fill" : "square")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(agreedToProviderTerms ? ScheduleMeTheme.accent : ScheduleMeTheme.mutedText)
                    .padding(.top, 1)
                Text("I agree to the Terms of Service, Privacy Policy, and the 12% commission structure on completed jobs.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 13).weight(.semibold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
            .onTapGesture { agreedToProviderTerms.toggle() }

            HStack(spacing: 10) {
                Button("Terms of Service") {
                    if let url = URL(string: "https://www.usescheduleme.com/terms") {
                        openURL(url)
                    }
                }
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundColor(ScheduleMeTheme.accent)

                Button("Privacy Policy") {
                    if let url = URL(string: "https://www.usescheduleme.com/privacy") {
                        openURL(url)
                    }
                }
                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                .foregroundColor(ScheduleMeTheme.accent)
            }

            Text("Founder50 note: standard platform fee is 12%; Founder50 members are locked into 6%.")
                .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.medium))
                .foregroundColor(ScheduleMeTheme.mutedText)
        }
    }

    private var existingAccountFields: some View {
        VStack(alignment: .leading, spacing: 10) {
            if appState.isAuthenticated {
                Text("You're already signed in. Continue to Provider Hub to finish your listing setup.")
                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                    .foregroundColor(ScheduleMeTheme.mutedText)
            } else {
                field("Email", text: $loginEmail, placeholder: "you@example.com", keyboard: .emailAddress, noCap: true)
                field("Password", text: $loginPassword, placeholder: "Password", secure: true)
            }
        }
    }

    @ViewBuilder
    private func field(
        _ label: String,
        text: Binding<String>,
        placeholder: String,
        keyboard: UIKeyboardType = .default,
        noCap: Bool = false,
        secure: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased())
                .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
                .tracking(1.2)
                .foregroundColor(ScheduleMeTheme.mutedText)
            Group {
                if secure {
                    SecureField(placeholder, text: text)
                } else {
                    TextField(placeholder, text: text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(noCap ? .never : .words)
                        .autocorrectionDisabled(noCap)
                }
            }
            .scheduleMeFieldStyle()
        }
    }

    private func submit() async {
        errorText = nil
        successText = nil
        isSubmitting = true
        defer { isSubmitting = false }

        struct Request: Encodable {
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
        struct Response: Decodable {
            let success: Bool?
            let businessId: String?
            let status: String?
            let error: String?
        }

        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let trimmedPhone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload = Request(
            businessName: businessName.trimmingCharacters(in: .whitespacesAndNewlines),
            ownerName: ownerName.trimmingCharacters(in: .whitespacesAndNewlines),
            email: trimmedEmail,
            phone: trimmedPhone.isEmpty ? nil : trimmedPhone,
            serviceCategory: "other",
            otherCategory: nil,
            city: "Not set",
            website: nil,
            instagram: nil,
            campusProvider: false,
            schoolName: nil
        )

        do {
            let response: Response = try await APIClient.shared.send(
                path: "/api/mobile-business-signup",
                method: "POST",
                body: payload,
                requiresAuth: false
            )
            if response.success == true {
                hasAcceptedProviderTerms = true
                successText = "Provider account created. Finish your listing setup and publish from Provider Hub."
                onCreated?(response.businessId)
                try? await Task.sleep(for: .seconds(0.5))
                dismiss()
                return
            }
            errorText = response.error ?? "Could not create listing."
        } catch {
            errorText = normalizeProviderSetupError(error)
        }
    }

    private func signInWithEmailAccount() async {
        errorText = nil
        successText = nil

        if appState.isAuthenticated {
            onCreated?(nil)
            dismiss()
            return
        }

        isSigningIn = true
        defer { isSigningIn = false }
        let normalizedEmail = loginEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        do {
            do {
                try await SupabaseManager.shared.signInViaMobileEmailAuth(
                    email: normalizedEmail,
                    password: loginPassword,
                    isSignup: false
                )
            } catch {
                try await SupabaseManager.shared.client.auth.signIn(email: normalizedEmail, password: loginPassword)
            }
            appState.setAuthMethodHint("email")
            await appState.bootstrap(context: .signingIn)
            onCreated?(nil)
            dismiss()
        } catch {
            errorText = normalizeSignInError(error)
        }
    }

    private func signInWithOAuth(_ provider: Provider) async {
        successText = nil
        if let configError = SupabaseManager.shared.oauthConfigurationError() {
            errorText = configError
            return
        }
        isOAuthLoading = true
        oauthProviderInFlight = provider
        defer {
            isOAuthLoading = false
            oauthProviderInFlight = nil
        }
        do {
            guard let callbackScheme = SupabaseManager.shared.redirectURL.scheme else {
                throw DataStoreError.invalidConfiguration("SUPABASE_REDIRECT_URL is missing a URL scheme.")
            }
            let queryParams: [(name: String, value: String?)] = provider == .google
                ? [(name: "prompt", value: "select_account")]
                : []
            try await SupabaseManager.shared.client.auth.signInWithOAuth(
                provider: provider,
                redirectTo: SupabaseManager.shared.redirectURL,
                queryParams: queryParams,
                launchFlow: { @MainActor url in
                    let useEphemeral = provider != .google
                    return try await authenticateEphemeral(url: url, callbackScheme: callbackScheme, prefersEphemeral: useEphemeral)
                }
            )
            appState.setAuthMethodHint(provider == .apple ? "apple" : "google")
            await appState.bootstrap(context: .signingIn)

            let defaultName = appState.userFirstName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if ownerName.isEmpty, !defaultName.isEmpty {
                ownerName = defaultName
            }
            let defaultEmail = appState.userEmail?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if email.isEmpty, !defaultEmail.isEmpty {
                email = defaultEmail
            }
            if loginEmail.isEmpty, !defaultEmail.isEmpty {
                loginEmail = defaultEmail
            }

            if entryMode == .existingAccount {
                onCreated?(nil)
                dismiss()
            } else {
                successText = provider == .google
                    ? "Signed in with Google. Complete details, agree to terms, then create your provider account."
                    : "Signed in with Apple. Complete details, agree to terms, then create your provider account."
            }
        } catch {
            errorText = userFacingOAuthError(error)
        }
    }

    @MainActor
    private func authenticateEphemeral(url: URL, callbackScheme: String, prefersEphemeral: Bool) async throws -> URL {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: DataStoreError.server("Missing callback URL."))
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session.prefersEphemeralWebBrowserSession = prefersEphemeral
            session.presentationContextProvider = ProviderOAuthPresentationProvider.shared
            session.start()
        }
    }

    private func userFacingOAuthError(_ error: Error) -> String {
        let raw = (error as NSError).localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = raw.lowercased()
        if normalized.contains("no api key found in request") {
            return "Google/Apple sign in isn't set up. Add SUPABASE_PUBLISHABLE_KEY in Config.local.xcconfig."
        }
        if normalized.contains("webauthenticationsession error 1")
            || normalized.contains("aswebauthenticationsession")
            || normalized.contains("canceled login") {
            return "Sign in was canceled."
        }
        if raw.isEmpty { return "Could not complete sign in." }
        return raw
    }

    private func normalizeProviderSetupError(_ error: Error) -> String {
        let raw = (error as NSError).localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = raw.lowercased()
        if normalized.contains("no api key found in request") {
            return "Provider setup isn't fully configured. Add SUPABASE_PUBLISHABLE_KEY in Config.local.xcconfig."
        }
        if raw.isEmpty {
            return "Could not create listing."
        }
        return raw
    }

    private func requireTermsAcceptanceForSocialSignIn() -> Bool {
        if entryMode == .existingAccount {
            return true
        }
        guard agreedToProviderTerms else {
            errorText = "Please accept the Terms, Privacy Policy, and commission structure before continuing with Apple or Google."
            return false
        }
        hasAcceptedProviderTerms = true
        return true
    }

    private func normalizeSignInError(_ error: Error) -> String {
        let raw = (error as NSError).localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = raw.lowercased()
        if normalized.contains("invalid login credentials")
            || normalized.contains("invalid credentials")
            || normalized.contains("wrong password")
            || normalized.contains("incorrect password") {
            return "Incorrect email or password."
        }
        if normalized.contains("no api key found in request") {
            return "Provider sign in isn't set up. Add SUPABASE_PUBLISHABLE_KEY in Config.local.xcconfig."
        }
        if raw.isEmpty {
            return "Could not sign in right now. Please try again."
        }
        return raw
    }
}

private final class ProviderOAuthPresentationProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = ProviderOAuthPresentationProvider()
    private override init() {}

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let windowScenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
        if let keyWindow = windowScenes.flatMap(\.windows).first(where: \.isKeyWindow) {
            return keyWindow
        }
        if let windowScene = windowScenes.first {
            return ASPresentationAnchor(windowScene: windowScene)
        }
        preconditionFailure("No active UIWindowScene available for web authentication presentation.")
    }
}
