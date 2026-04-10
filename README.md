# ScheduleMe Provider iOS

Provider app path:
`ios/xcode/ScheduleMeProvider`

## Local config (required)

Public client keys are not committed in source. Create a local config file:

1. Copy:
   `ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Config.local.example.xcconfig`
2. To:
   `ios/xcode/ScheduleMeProvider/ScheduleMeProvider/Config.local.xcconfig`
3. Fill values for:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_PUBLISHABLE_KEY`, and any other app-specific keys.

`Config.local.xcconfig` is gitignored.
