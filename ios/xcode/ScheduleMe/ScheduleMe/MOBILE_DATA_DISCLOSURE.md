# ScheduleMe iOS Data Disclosure (Mobile)

This file documents mobile-app data handling language to keep Privacy Policy and App Store disclosures aligned with the iOS implementation.

## Saved Addresses (iOS)

- Data fields: label, street line 1, street line 2, city, state, ZIP.
- Source: user enters data in Account -> Addresses.
- Purpose: app functionality (faster booking checkout and address reuse).
- Storage location: local device only, stored in iOS Keychain (`scheduleme_saved_addresses_secure`).
- Retention: retained until the user edits/removes addresses or removes the app/device data.
- Deletion:
  - User can delete/edit addresses in app.
  - Address data is removed when overwritten/deleted in app.
  - Local keychain data is removed when the app data is removed from the device.

## Policy / Store Sync Checklist

- Ensure App Store Connect App Privacy answers include contact-info style address handling as linked to user identity for app functionality.
- Ensure the public Privacy Policy explicitly lists saved address fields, purpose, retention, and deletion behavior above.
