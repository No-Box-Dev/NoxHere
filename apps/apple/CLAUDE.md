# NoxFeed (macOS)

Menu-bar client for the NoxConnect API at `app.noxhere.com`.

## Project rules

- Shared backend changes belong in the `noxconnect` repository first.
- Never embed GitHub OAuth credentials. NoxConnect brokers GitHub Device Flow,
  then issues short-lived `nox_at_` access tokens and rotating `nox_rt_`
  refresh tokens through `/api/v1/auth/native/*`.
- Tokens stay in the macOS Keychain. Preferences and notification watermarks
  use the legacy `unticket-feed.*` UserDefaults namespace for upgrade
  compatibility.
- An `APIClient` is bound to one immutable login/organization scope. Create a
  new client after an account or org switch.
- New Swift files under `NoxFeed/` and `NoxFeedTests/` are discovered by
  XcodeGen. Regenerate `NoxFeed.xcodeproj` after changing `project.yml`.

## Architecture

- `AppState` owns account/org selection and creates scoped API clients.
- `AccountsStore` persists account metadata and Keychain-backed tokens.
- `FeedStore`, `MeStore`, and `TimelineStore` own their respective screens.
- `TimelineCache` provides app-lifetime stale-while-revalidate caches and is
  invalidated on account/org changes.
- `NotifierStore` polls independently of the popover, paginating event history
  back to its per-scope watermark before advancing it.
- `NoxFeedApp` hosts the menu-bar scene, global shortcut, and notifier.
- `service/` owns NoxFeed prompts and Slack presentation. A merged PR is rendered
  as one Slack message: the conversational Post first, then a divider and the
  structured Release Note, with one PR action at the end.

## Commands

```bash
xcodegen generate --spec project.yml
xcodebuild -project NoxFeed.xcodeproj -scheme NoxFeed \
  -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO test
xcodebuild -project NoxFeed.xcodeproj -scheme NoxFeed \
  -configuration Release CODE_SIGNING_ALLOWED=NO build
```

App Store build/upload/submission commands are documented in
`fastlane/README.md`.
