import SwiftUI
import Combine

enum ScheduleMeTheme {
    static let accent = Color(hex: "0F766E")
    static let accentSoft = Color(hex: "0F766E").opacity(0.12)
    static let headerGreen = Color(hex: "2F6F63")
    static let sectionBlue = Color(hex: "EDF5FF")
    static let creamBackground = Color(hex: "F6F1EA")
    static let pageBackground = Color(hex: "F9F7F2")
    static let cardBorder = Color.black.opacity(0.08)
    static let mutedText = Color(hex: "6B7280")
    static let titleText = Color(hex: "0F172A")
    static let fontName = "PlusJakartaSans-Regular"
}

struct ScheduleMePage<Content: View>: View {
    @ViewBuilder let content: Content

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
            DottedGrid()
                .opacity(0.12)
        }
    }
}

struct DottedGrid: View {
    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            Path { path in
                let spacing: CGFloat = 18
                for y in stride(from: 0, to: size.height, by: spacing) {
                    for x in stride(from: 0, to: size.width, by: spacing) {
                        path.addEllipse(in: CGRect(x: x, y: y, width: 2, height: 2))
                    }
                }
            }
            .fill(Color(hex: "D1D5DB"))
        }
    }
}

struct ScheduleMeCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            content
        }
        .padding(18)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(ScheduleMeTheme.cardBorder)
        )
        .shadow(color: .black.opacity(0.06), radius: 18, y: 10)
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
            .background(Color.white.opacity(configuration.isPressed ? 0.8 : 1.0))
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
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(ScheduleMeTheme.cardBorder)
            )
    }
}

struct ScheduleMeTag: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.custom(ScheduleMeTheme.fontName, size: 11).weight(.semibold))
            .foregroundStyle(ScheduleMeTheme.accent)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(ScheduleMeTheme.accentSoft)
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

    var body: some View {
        HStack {
            HStack(spacing: 0) {
                Text("Schedule")
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.titleText)
                Text("Me")
                    .font(.custom(ScheduleMeTheme.fontName, size: 20).weight(.bold))
                    .foregroundColor(ScheduleMeTheme.accent)
            }
            Spacer()
            Button {
                showingAccount = true
            } label: {
                HStack(spacing: 8) {
                    Circle()
                        .fill(ScheduleMeTheme.accent)
                        .frame(width: 30, height: 30)
                        .overlay(
                            Text(initials)
                                .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.bold))
                                .foregroundColor(.white)
                        )
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(ScheduleMeTheme.mutedText)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Color.white)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(ScheduleMeTheme.cardBorder))
            }
            .buttonStyle(.plain)
            .fullScreenCover(isPresented: $showingAccount) {
                AccountView()
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 0)
        .padding(.bottom, 4)
    }

    private var initials: String {
        guard let email = appState.userEmail, let first = email.first else {
            return "SM"
        }
        return String(first).uppercased()
    }
}

struct ScheduleMeHeaderBlock<Content: View>: View {
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
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(title)
                        .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                        .foregroundColor(.white)
                    Text(subtitle)
                        .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.medium))
                        .foregroundColor(.white.opacity(0.85))
                }
                Spacer()
                if let actionTitle, let action {
                    Button(action: action) {
                        HStack(spacing: 6) {
                            Image(systemName: "plus")
                            Text(actionTitle)
                                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                        }
                        .foregroundColor(ScheduleMeTheme.headerGreen)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.white)
                        .clipShape(Capsule())
                    }
                }
            }
            content
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 22)
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
            .background(isActive ? ScheduleMeTheme.accent : Color.white)
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

    var body: some View {
        ZStack {
            ScheduleMeBackground()
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    content
                }
                .frame(maxWidth: .infinity, alignment: .top)
            }
            .scrollBounceBehavior(.basedOnSize)
            .safeAreaInset(edge: .top) {
                if showsTopBar {
                    ScheduleMeTopBar()
                        .background(Color.white)
                        .overlay(Rectangle().frame(height: 1).foregroundColor(ScheduleMeTheme.cardBorder), alignment: .bottom)
                }
            }
        }
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
}
