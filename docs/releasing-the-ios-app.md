# Releasing the iOS app to the App Store

The app is published as **SADISS Client**. Its bundle identifier is
`app.sadiss.test` — the name reads like a placeholder, but a bundle ID cannot be
changed after publishing. Changing it creates a *different* app with a new store
listing and abandons the existing one, so leave it alone.

## Hardware and toolchain

This is the part that blocks people, so check it first:

| requirement | why |
| --- | --- |
| Mac with **Apple Silicon** (M1 or later) | Xcode 26 does not run on Intel |
| **macOS 26.2** or later | required by Xcode 26.6 |
| **Xcode 26** or later | App Store Connect requirement since 2026-04-28 |
| CocoaPods 1.15+ | older versions break against recent Xcode |

An Intel Mac cannot publish to the App Store at all, regardless of macOS version.
There is no workaround short of different hardware, a rented cloud Mac, or a CI
service with macOS runners.

Check with:

```
uname -m          # must print arm64
sw_vers
xcodebuild -version
pod --version
```

## What can be done without a Mac

`npx cap sync ios` runs on Linux. It copies the web assets and regenerates the
Podfile from the installed plugins, skipping only `pod install` and the
`xcodebuild` clean step. So dependency changes can be prepared anywhere; only the
build and upload genuinely need macOS.

## 1. Bump the version

| file | field |
| --- | --- |
| `app/package.json` | `version` |
| `app/ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` |
| `app/ios/App/App.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION` |

`MARKETING_VERSION` is the user-visible version and should match `package.json`
and the Android `versionName`. `CURRENT_PROJECT_VERSION` is the build number; it
only has to be unique within a given `MARKETING_VERSION`, so it can restart at 1
whenever the version string changes.

## 2. Build

```
cd app
npm ci
npm run build
npx cap sync ios
cd ios/App
pod install
```

Then open `app/ios/App/App.xcworkspace` in Xcode — the **workspace**, not the
`.xcodeproj`, or the pods will not be linked.

In Xcode: select **Any iOS Device** as the destination, then **Product → Archive**.
When the Organizer opens, **Distribute App → App Store Connect**.

## 3. Submit

1. App Store Connect → the app → **+ Version**
2. Enter the version number, select the uploaded build
3. Fill in "What's New"
4. **Add for Review** → **Submit**

Review usually takes a day or two.

## Deployment target

`IPHONEOS_DEPLOYMENT_TARGET` lives in the Xcode project and is mirrored by the
`platform :ios` line in `app/ios/App/Podfile`. Both must agree.

It is pinned by the pods, not by choice: every Capacitor 8 pod declares a
deployment target of 15.0. Raising the Capacitor major version is what moves this
number, and it drops support for older iPhones each time.

## Things that block a submission

- **Apple Developer Program membership** must be current. If it lapses the app is
  delisted.
- **Age rating questionnaire** — Apple has required updated answers since
  2026-01-31. An unanswered questionnaire interrupts submission.
- **App access** — the app is unusable without a QR code from a live performance,
  so a reviewer cannot reach any functionality unaided. If review is rejected for
  this, provide instructions and a QR code pointing at a performance that stays
  reachable for the duration of the review.

## Signing

Unlike Android, a lost signing identity is not a crisis: iOS distribution
certificates and provisioning profiles are regenerated from the Apple Developer
portal in minutes. Xcode's automatic signing handles it if the account has the
right role.
