# NoxHere for Apple platforms

NoxHere is the native macOS, iPhone, and iPad client for the unified NoxHere
workspace. Its first native surface is development activity backed by NoxConnect. The
macOS app lives in the menu bar and the iPhone app is its mobile companion.
Both show current pull requests, assigned issues, merged updates, and release
notes across the selected GitHub organization. NoxTicket remains a separate
product and is not part of the iPhone companion.

## Requirements

- macOS 14+
- iOS 17+ for the iPhone companion
- Xcode 15+ with an iOS platform and Simulator runtime installed
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)
- Ruby/Fastlane for App Store releases

## Development

The GitHub App client identifier lives in `NoxFeed/Services/Config.swift`.
Device Flow must be enabled for the NoxConnect GitHub App.

```bash
brew install xcodegen
xcodegen generate --spec project.yml
open NoxFeed.xcodeproj
```

Run the unit tests with:

```bash
xcodebuild -project NoxFeed.xcodeproj -scheme NoxFeed \
  -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO test
```

The generated project contains two application schemes:

- `NoxFeed` — legacy internal target name for the NoxHere macOS menu-bar app.
- `NoxFeedMobile` — legacy internal target name for the NoxHere iPhone and iPad app.

The iPhone app signs in independently through the same NoxConnect native-auth
flow and reads the same organization data. It does not connect directly to the
Mac or duplicate NoxConnect state locally.

## Generation service

`service/` contains the legacy private `noxfeed-response` Worker. It owns complete
post and release-note generation: prompt policy, managed Anthropic access,
provider retries, parsing, output validation, and Slack presentation. NoxConnect
triggers the operation through a private service binding, applies organization
enable/disable policy, and persists or delivers the validated result.

Configure `ANTHROPIC_API_KEY` as a Worker secret before deployment:

```bash
cd service
npx wrangler secret put ANTHROPIC_API_KEY
```

The generated Xcode project is intentionally ignored. Add Swift files under
`NoxFeed/`, iPhone-only files under `NoxFeedMobile/`, or tests under
`NoxFeedTests/`, then regenerate it.

## Release

The Mac App Store workflow is implemented in `fastlane/Fastfile`. Credentials
are loaded locally from NoxKey; signing keys and API credentials must not be
committed. See `fastlane/README.md` for build, upload, metadata, screenshot,
and submission lanes.
