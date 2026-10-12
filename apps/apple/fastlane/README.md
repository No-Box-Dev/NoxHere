fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios fetch_signing

```sh
[bundle exec] fastlane ios fetch_signing
```

Create or download the iOS App Store certificate and profile

### ios release

```sh
[bundle exec] fastlane ios release
```

Archive and upload NoxHere for iPhone and iPad

### ios upload_build

```sh
[bundle exec] fastlane ios upload_build
```

Upload a prebuilt NoxHere iOS .ipa

### ios build_status

```sh
[bundle exec] fastlane ios build_status
```

Show the latest iOS builds' processing state in App Store Connect

### ios submit_for_review

```sh
[bundle exec] fastlane ios submit_for_review
```

Upload iOS metadata and screenshots, then submit the latest build for review

### ios prepare_listing

```sh
[bundle exec] fastlane ios prepare_listing
```

Upload iOS metadata and screenshots without submitting

### ios submit_ready_version

```sh
[bundle exec] fastlane ios submit_ready_version
```

Select the prepared iOS build and submit it without replacing listing assets

### ios listing_status

```sh
[bundle exec] fastlane ios listing_status
```

Inspect the iOS version localization and screenshot sets

### ios publish

```sh
[bundle exec] fastlane ios publish
```

Build, upload, and submit the iPhone and iPad companion

----


## Mac

### mac generate

```sh
[bundle exec] fastlane mac generate
```

Regenerate the Xcode project from project.yml

### mac build_only

```sh
[bundle exec] fastlane mac build_only
```

Archive + export the MAS .pkg only (no upload) — verifies signing/export

### mac create_app

```sh
[bundle exec] fastlane mac create_app
```

Register the App ID + create the ASC app record (run once)

### mac which_app

```sh
[bundle exec] fastlane mac which_app
```

List App Store Connect app records (name + bundle id)

### mac fetch_profile

```sh
[bundle exec] fastlane mac fetch_profile
```

Download the Mac App Store provisioning profile (run once per machine)

### mac reset_profile

```sh
[bundle exec] fastlane mac reset_profile
```

Recreate the MAS profile cleanly as 'NoxFeed App Store' (run once)

### mac release

```sh
[bundle exec] fastlane mac release
```

Build + sign + package the app as a MAS .pkg, upload to ASC

### mac push_metadata

```sh
[bundle exec] fastlane mac push_metadata
```

Push metadata to App Store Connect (no build)

### mac push_screenshots

```sh
[bundle exec] fastlane mac push_screenshots
```

Push screenshots to App Store Connect (overwrites existing)

### mac upload_build

```sh
[bundle exec] fastlane mac upload_build
```

Upload a prebuilt NoxHere .pkg to ASC (pass pkg:/path/to/NoxHere.pkg)

### mac build_status

```sh
[bundle exec] fastlane mac build_status
```

Show the latest builds' processing state in App Store Connect

### mac submit_for_review

```sh
[bundle exec] fastlane mac submit_for_review
```

Submit the latest uploaded build for App Store review

### mac publish_next

```sh
[bundle exec] fastlane mac publish_next
```

Full publish: metadata + screenshots + build + submit for review

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
