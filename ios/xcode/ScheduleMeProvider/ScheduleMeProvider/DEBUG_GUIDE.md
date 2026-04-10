# ScheduleMe iOS Consumer Debug Guide

This file is a fast map of where core behavior lives so you can safely debug and edit.

## 1) App Entry + Routing
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/ScheduleMeProviderApp.swift`
  - App-wide environment objects
  - Global tab bar appearance
  - Global light/dark mode forcing (`@AppStorage("scheduleme_dark_mode")` + `applyInterfaceStyle()`)
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/RootView.swift`
  - Startup branching: onboarding -> loading -> main tabs -> auth
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/MainTabView.swift`
  - Tab shell + conditional Campus tab behavior

## 2) Theme + Shared UI System
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/DesignSystem.swift`
  - `ScheduleMeTheme` color tokens (light/dark)
  - Shared components: cards, fields, top bar, pills, empty states, screen wrapper
  - If dark mode looks off on many screens, start here first.

## 3) Data Loading + API Calls
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Services/ScheduleMeDataStore.swift`
  - Single source for businesses/bookings/messages/notifications/payment methods
  - Cache windows for smoothness
  - Fallback behavior when some APIs fail
  - Booking creation + review + payment methods methods

## 4) High-Traffic Screens
- Home: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/HomeView.swift`
- Campus: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/CampusView.swift`
- Browse: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BrowseView.swift`
- Business detail + booking time: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BusinessDetailView.swift`
- Booking review/confirm: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BookingCreationView.swift`
- Bookings list: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BookingsView.swift`
- Messages list/thread: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/MessagesView.swift`
- Account + preferences: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/AccountView.swift`
- Notifications screen: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/NotificationsView.swift`

## 5) Payments / Stripe / Apple Pay
- Payment settings UI: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/PaymentSettingsView.swift`
- Booking payment confirmation: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BookingCreationView.swift`
- App init publishable key: `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/ScheduleMeProviderApp.swift`
- Keys/config:
  - `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Config.xcconfig`
  - `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Info.plist`
  - `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/ScheduleMeProvider.entitlements`

## 6) Quick Debug Recipes
- Dark mode not updating immediately:
  1. Check toggle value in `AccountView` (`scheduleme_dark_mode`)
  2. Check `.preferredColorScheme` in `ScheduleMeApp`
  3. Check `applyInterfaceStyle()` is being called after toggle changes
- UI still light in dark mode:
  1. Search file for `Color.white`
  2. Replace with `ScheduleMeTheme.surface` (or token in `ScheduleMeTheme`)
- Bookings/messages data not refreshing:
  1. Check cache guards in `ScheduleMeDataStore` (`last*FetchAt`)
  2. Temporarily bypass cache conditions when testing
- Business hours wrong:
  1. Trace `BusinessDetailView` -> profile load -> `hoursSummaryForSelectedDate()`
  2. Verify API payload shape in `Models.swift`

## 7) Safe Editing Conventions
- Prefer editing theme tokens first over hardcoding per-view colors.
- Keep user-facing logic in views; keep networking/caching in `ScheduleMeDataStore`.
- If changing booking/payment flow, verify both:
  - Booking submit path
  - Payment method attach/setup path

## 8) Full File Index
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Services/APIClient.swift` - Shared API request layer.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Services/LocationManager.swift` - Location auth + coordinates.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Services/ScheduleMeDataStore.swift` - Main app data orchestration.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Services/SupabaseManager.swift` - Supabase client bootstrap.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/AccountView.swift` - Account/profile tabs and settings.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/AuthView.swift` - Login/signup flow.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BookingCreationView.swift` - Booking review and confirm.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BookingDetailView.swift` - Single booking detail.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BookingsView.swift` - Booking list hub.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BrowseView.swift` - Browse list/grid/map.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/BusinessDetailView.swift` - Business details + booking setup.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/CalendarMonthPicker.swift` - Reusable calendar component.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/CampusView.swift` - EDU campus feed.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/Components/FloatingTabBar.swift` - Floating tab bar component.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/Components/MapStyleHelpers.swift` - Shared map style helpers.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/HomeView.swift` - Home feed + matching.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/MainTabView.swift` - Consumer tab shell.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/MessagesView.swift` - Inbox + thread composer.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/NotificationsView.swift` - Notifications list/detail.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/OnboardingView.swift` - Onboarding carousel.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/PaymentSettingsView.swift` - Saved cards and setup intents.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/Provider/ProviderMainTabView.swift` - Provider tab shell.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/Provider/ProviderRootView.swift` - Provider root router.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/Provider/ProviderScreens.swift` - Provider screen set.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/Provider/ProviderTabRouter.swift` - Provider tab state router.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/ReviewSubmissionView.swift` - Review submit flow.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Views/RootView.swift` - Startup route gate.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/AppState.swift` - App auth/user state.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/ContentView.swift` - Legacy/preview shell.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/DesignSystem.swift` - Theme tokens + shared UI primitives.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Models.swift` - Data models and DTOs.
- `/Users/joshua/Documents/GitHub/ScheduleMeProvider-ios/ios/xcode/ScheduleMeProvider/ScheduleMeProvider/ScheduleMeProviderApp.swift` - App entry point + global setup.
