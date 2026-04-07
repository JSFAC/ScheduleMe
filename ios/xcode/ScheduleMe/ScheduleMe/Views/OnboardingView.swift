// FILE OVERVIEW:
// Pre-auth onboarding swipe experience for first-time users.
//
// DEBUG NOTES:
// If onboarding completion persistence fails, inspect this file and RootView routing.

import SwiftUI

// MARK: - Consumer Onboarding

struct OnboardingView: View {
    // Persisted gate consumed by RootView.
    @AppStorage("scheduleme_onboarding_complete") private var completed = false
    @State private var page = 0

    var body: some View {
        ScheduleMePage {
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 20) {
                    TabView(selection: $page) {
                        OnboardingPage(
                            title: "Book trusted students",
                            subtitle: "Find vetted campus pros for everything from haircuts to tutoring.",
                            systemImage: "graduationcap.fill"
                        )
                        .tag(0)

                        OnboardingPage(
                            title: "Fast, secure bookings",
                            subtitle: "Compare services, set times, and pay safely — all in one place.",
                            systemImage: "calendar.badge.checkmark"
                        )
                        .tag(1)

                        OnboardingPage(
                            title: "Support your campus",
                            subtitle: "Every booking keeps money and talent within your student community.",
                            systemImage: "person.3.fill"
                        )
                        .tag(2)
                    }
                    .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))

                    HStack(spacing: 8) {
                        ForEach(0..<3, id: \.self) { index in
                            Circle()
                                .fill(index == page ? ScheduleMeTheme.accent : ScheduleMeTheme.cardBorder)
                                .frame(width: 6, height: 6)
                        }
                    }

                    Button(page == 2 ? "Get Started" : "Continue") {
                        // Last page completes onboarding; earlier pages advance the pager.
                        if page < 2 {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                page += 1
                            }
                        } else {
                            completed = true
                        }
                    }
                    .buttonStyle(ScheduleMePrimaryButtonStyle())
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 28)
                    .padding(.bottom, 30)
                }

                Button("Skip") {
                    completed = true
                }
                .font(.custom(ScheduleMeTheme.fontName, size: 14).weight(.semibold))
                .foregroundColor(ScheduleMeTheme.mutedText)
                .padding(.top, 12)
                .padding(.trailing, 20)
            }
        }
    }
}

private struct OnboardingPage: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Circle()
                .fill(ScheduleMeTheme.accentSoft)
                .frame(width: 90, height: 90)
                .overlay(
                    Image(systemName: systemImage)
                        .font(.system(size: 38, weight: .semibold))
                        .foregroundColor(ScheduleMeTheme.accent)
                )

            Text(title)
                .font(.custom(ScheduleMeTheme.fontName, size: 26).weight(.bold))
                .foregroundColor(ScheduleMeTheme.titleText)
                .multilineTextAlignment(.center)

            Text(subtitle)
                .font(.custom(ScheduleMeTheme.fontName, size: 15).weight(.medium))
                .foregroundColor(ScheduleMeTheme.mutedText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
            Spacer()
        }
        .padding(.top, 40)
    }
}
