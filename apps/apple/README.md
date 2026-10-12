# NoxHere for Apple platforms

NoxHere is the native macOS, iPhone, and iPad client for the unified NoxHere
workspace. Its first native surface is development activity backed by NoxHere. The
macOS app lives in the menu bar and the iPhone app is its mobile companion.
Both show current pull requests, assigned issues, merged updates, and release
notes across the selected GitHub organization. The Planning capability remains
available through NoxHere on the web and is not part of the iPhone companion.

## Requirements

- macOS 14+
- iOS 17+ for the iPhone companion
- Xcode 15+ with an iOS platform and Simulator runtime installed
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)
- Ruby/Fastlane for App Store releases

## Development

The GitHub App client identifier lives in `NoxHere/Services/Config.swift`.
Device Flow must be enabled for the NoxHere GitHub App.

```bash
brew install xcodegen
xcodegen generate --spec project.yml
open NoxHere.xcodeproj
```

Run the unit tests with:

```bash
xcodebuild -project NoxHere.xcodeproj -scheme NoxHere \
  -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO test
```

The generated project contains two application schemes:

- `NoxHere` — the NoxHere macOS menu-bar app.
- `NoxHereMobile` — the NoxHere iPhone and iPad app.

The iPhone app signs in independently through the same NoxHere native-auth
flow and reads the same organization data. It does not connect directly to the
Mac or duplicate NoxHere state locally.

The generated Xcode project is intentionally ignored. Add Swift files under
`NoxHere/`, iPhone-only files under `NoxHereMobile/`, or tests under
`NoxHereTests/`, then regenerate it.

## Distribution identity compatibility

The source, targets, schemes, and product name are NoxHere. The historical
bundle identifier, keychain service identifier, App Store SKU, and provisioning
profile names remain unchanged because Apple treats them as durable external
identities. Changing them would create a different app, break upgrades, and
disconnect existing keychain data. They are compatibility metadata only and
must not be used for new code, routes, services, or user-facing names.

## Release

The Mac App Store workflow is implemented in `fastlane/Fastfile`. Credentials
are loaded locally from NoxKey; signing keys and API credentials must not be
committed. See `fastlane/README.md` for build, upload, metadata, screenshot,
and submission lanes.
