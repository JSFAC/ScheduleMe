// FILE OVERVIEW:
// Provider-specific screen implementations grouped in one file.
//
// DEBUG NOTES:
// Use this when provider dashboard or provider list/detail sections need updates.

import SwiftUI

// MARK: - Provider Dashboard

struct ProviderDashboardView: View {
    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                VStack(alignment: .leading, spacing: 16) {
                    ScheduleMeHeaderBlock(
                        title: "Business Dashboard",
                        subtitle: "Track revenue, requests, and reviews",
                        actionTitle: nil,
                        action: nil
                    ) {
                        EmptyView()
                    }
                    .padding(.top, -6)

                    VStack(alignment: .leading, spacing: 12) {
                        ScheduleMeCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Today")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                Text("$0")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 28).weight(.bold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text("Revenue will appear here once bookings complete.")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }
                        }

                        ScheduleMeCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Next Up")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                                Text("No upcoming jobs")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 16).weight(.semibold))
                                    .foregroundColor(ScheduleMeTheme.titleText)
                                Text("Your confirmed bookings will show here.")
                                    .font(.custom(ScheduleMeTheme.fontName, size: 12).weight(.medium))
                                    .foregroundColor(ScheduleMeTheme.mutedText)
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Provider Bookings

struct ProviderBookingsView: View {
    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                ScheduleMeHeaderBlock(
                    title: "Requests",
                    subtitle: "Approve and manage incoming bookings",
                    actionTitle: nil,
                    action: nil
                ) {
                    EmptyView()
                }
                .padding(.top, -6)

                ScheduleMeEmptyState(
                    title: "No requests yet",
                    message: "Incoming requests will show here for you to approve or decline.",
                    systemImage: "calendar"
                )
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Provider Services

struct ProviderServicesView: View {
    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                ScheduleMeHeaderBlock(
                    title: "Services",
                    subtitle: "Edit pricing, availability, and offerings",
                    actionTitle: "Add service",
                    action: {}
                ) {
                    EmptyView()
                }
                .padding(.top, -6)

                ScheduleMeEmptyState(
                    title: "No services yet",
                    message: "Your live services will show here once added.",
                    systemImage: "briefcase"
                )
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Provider Messages

struct ProviderMessagesView: View {
    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                ScheduleMeHeaderBlock(
                    title: "Messages",
                    subtitle: "Stay in touch with customers",
                    actionTitle: nil,
                    action: nil
                ) {
                    EmptyView()
                }
                .padding(.top, -6)

                ScheduleMeEmptyState(
                    title: "No messages yet",
                    message: "Customer conversations will appear here.",
                    systemImage: "bubble.left.and.bubble.right"
                )
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Provider Account

struct ProviderAccountView: View {
    var body: some View {
        NavigationStack {
            ScheduleMeScreen {
                ScheduleMeHeaderBlock(
                    title: "Account",
                    subtitle: "Business settings and payout details",
                    actionTitle: nil,
                    action: nil
                ) {
                    EmptyView()
                }
                .padding(.top, -6)

                ScheduleMeEmptyState(
                    title: "Provider settings",
                    message: "Connect payouts, edit business info, and manage availability.",
                    systemImage: "person.crop.circle"
                )
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 30)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
