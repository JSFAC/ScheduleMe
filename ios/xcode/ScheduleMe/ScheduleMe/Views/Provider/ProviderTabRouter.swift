// FILE OVERVIEW:
// Provider tab state object and tab selection routing helpers.
//
// DEBUG NOTES:
// Provider tab selection bugs are easiest to isolate here.

import Combine
import Foundation

// MARK: - Provider Tab Routing

enum ProviderTab: Hashable {
    case dashboard, bookings, services, messages, account
}

final class ProviderTabRouter: ObservableObject {
    // Selected provider tab (single source of truth for provider shell navigation).
    @Published var selected: ProviderTab = .dashboard
}
