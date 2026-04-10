// FILE OVERVIEW:
// Shared theme tokens + reusable UI primitives used app-wide.
//
// DEBUG NOTES:
// For color/style consistency changes, update tokens/components here before per-view edits.

import SwiftUI
import Combine
import UIKit

// MARK: - Shared Theme + Reusable UI Primitives

enum ScheduleMeTheme {
    // Core semantic tokens.
    // Edit these first when changing brand/theme so all screens stay consistent.
    static let accent = Color(hex: "0F766E")
    static let accentSoft = Color.dynamic(light: Color(hex: "0F766E").opacity(0.12), dark: Color(hex: "0F766E").opacity(0.28))
    static let headerGreen = Color.dynamic(light: Color(hex: "2F6F63"), dark: Color(hex: "215B54"))
    static let sectionBlue = Color(hex: "EDF5FF")
    static let creamBackground = Color.dynamic(light: Color(hex: "F6F1EA"), dark: Color(hex: "0A0A0A"))
    #if PROVIDER_APP
    static let pageBackground = Color(hex: "0A0A0A")
    static let surface = Color(hex: "171717")
    static let cardBorder = Color.white.opacity(0.12)
    static let cardBorderStrong = Color.white.opacity(0.24)
    static let mutedText = Color(hex: "9CA3AF")
    static let titleText = Color(hex: "F3F4F6")
    #else
    static let pageBackground = Color.dynamic(light: Color(hex: "F9F7F2"), dark: Color(hex: "0A0A0A"))
    static let surface = Color.dynamic(light: .white, dark: Color(hex: "171717"))
    static let cardBorder = Color.dynamic(light: Color.black.opacity(0.09), dark: Color.white.opacity(0.12))
    static let cardBorderStrong = Color.dynamic(light: Color.black.opacity(0.2), dark: Color.white.opacity(0.24))
    static let mutedText = Color.dynamic(light: Color(hex: "6B7280"), dark: Color(hex: "9CA3AF"))
    static let titleText = Color.dynamic(light: Color(hex: "0F172A"), dark: Color(hex: "F3F4F6"))
    #endif
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
        .safeAreaPadding(.top, 6)
        .overlay(alignment: .top) {
            ScheduleMeStatusBarScrim()
        }
    }
}

struct ScheduleMeStatusBarScrim: View {
    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [
                    Color(hex: "090B10").opacity(1.0),
                    Color(hex: "0B0F15").opacity(0.95),
                    Color(hex: "0F141C").opacity(0.32),
                    Color(hex: "10141B").opacity(0.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 42)
            Spacer()
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

struct ScheduleMeWordmark: View {
    var size: CGFloat = 28

    var body: some View {
        Text("Schedule\(Text("Me").foregroundStyle(ScheduleMeTheme.accent))")
            .foregroundStyle(Color(hex: "F3F4F6"))
        .font(.custom(ScheduleMeTheme.fontName, size: size).weight(.bold))
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
}

struct ScheduleMeShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -0.9

    func body(content: Content) -> some View {
        content
            .overlay {
                GeometryReader { geo in
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.0),
                            Color.white.opacity(0.05),
                            Color.white.opacity(0.0)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(width: geo.size.width * 0.42)
                    .offset(x: geo.size.width * phase)
                }
                .allowsHitTesting(false)
            }
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.35).repeatForever(autoreverses: false)) {
                    phase = 1.2
                }
            }
    }
}

extension View {
    func scheduleMeShimmer() -> some View {
        modifier(ScheduleMeShimmerModifier())
    }
}

struct CompactToggleStyle: ToggleStyle {
    var onColor: Color = ScheduleMeTheme.accent
    var offColor: Color = Color(hex: "2A313D")
    var width: CGFloat = 44
    var height: CGFloat = 24

    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(spacing: 8) {
                configuration.label
                Spacer(minLength: 8)
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(configuration.isOn ? onColor : offColor)
                    .frame(width: width, height: height)
                    .overlay(alignment: configuration.isOn ? .trailing : .leading) {
                        Circle()
                            .fill(Color.white)
                            .frame(width: max(12, height - 8), height: max(12, height - 8))
                            .padding(3)
                    }
            }
        }
        .buttonStyle(.plain)
    }
}

struct ScheduleMeBackground: View {
    var body: some View {
        ZStack {
            #if PROVIDER_APP
            ScheduleMeTheme.pageBackground
            DottedGrid(spacing: 20, dotSize: 1.6, color: Color(hex: "262626"))
                .opacity(0.14)
            #else
            ScheduleMeTheme.creamBackground
            DottedGrid(spacing: 20, dotSize: 1.6, color: Color.dynamic(light: Color(hex: "CBD5E1"), dark: Color(hex: "262626")))
                .opacity(0.14)
            #endif
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
                    .allowsHitTesting(false)
            )
    }
}

struct ScheduleMeTag: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.custom(ScheduleMeTheme.fontName, size: 10).weight(.semibold))
            .foregroundStyle(ScheduleMeTheme.tagText)
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
        if let url = appState.resolvedAvatarURL {
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
}

struct ScheduleMeScreen<Content: View>: View {
    @ViewBuilder let content: Content
    var showsTopBar: Bool = true
    var scrolls: Bool = true
    var showsTopFade: Bool = true
    var allowsBounce: Bool = false
    var respectsTabBarInset: Bool = true
    @Environment(\.floatingTabBarHeight) private var floatingTabBarHeight

    init(
        showsTopBar: Bool = true,
        scrolls: Bool = true,
        showsTopFade: Bool = true,
        allowsBounce: Bool = false,
        respectsTabBarInset: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.showsTopBar = showsTopBar
        self.scrolls = scrolls
        self.showsTopFade = showsTopFade
        self.allowsBounce = allowsBounce
        self.respectsTabBarInset = respectsTabBarInset
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
                    .defaultScrollAnchor(.top)
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
    var color: Color = Color.black.opacity(0.08)

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(color)
            .frame(width: width, height: height)
            .shimmer()
    }
}

struct SkeletonCircle: View {
    var size: CGFloat
    var color: Color = Color.black.opacity(0.08)

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .shimmer()
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
                            Color.white.opacity(0.45),
                            Color.white.opacity(0.0)
                        ]),
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: width * 0.6)
                    .offset(x: phase * width * 2)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.35).repeatForever(autoreverses: false)) {
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

    /// Adds a long-press paste fallback for custom-styled fields.
    func scheduleMePasteMenu(_ text: Binding<String>) -> some View {
        self
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.35).onEnded { _ in
                    guard let value = UIPasteboard.general.string, !value.isEmpty else { return }
                    text.wrappedValue = text.wrappedValue.isEmpty ? value : (text.wrappedValue + value)
                }
            )
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
