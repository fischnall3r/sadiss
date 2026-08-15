# Releasing the Android app to Google Play

The app is published as **SADISS Client**, application ID `net.sadiss_client.app`.

## Prerequisites

- JDK 21 (`java -version`)
- Node 20+
- Android SDK platform 36 installed
- The release keystore, plus `app/android/keystore.properties` (see below)

### keystore.properties

The signing credentials are deliberately not in version control. Copy the example
and fill it in:

```
cp app/android/keystore.properties.example app/android/keystore.properties
```

`storeFile` is resolved relative to `app/android/`. Without this file the release
build stays unsigned and Play rejects the upload — it does not silently fall back
to the debug key.

Play App Signing is enabled for this app, so a lost upload key is recoverable: in
the Play Console under *Protect with Google Play* → *Google Play Store protection*
→ *Protect app signing key*, request a new upload key. Google takes about two days
to activate it, and doing so invalidates the previous one — so only request it once
the old keystore is genuinely gone.

## 1. Bump the version

Two files have to agree:

| file | field |
| --- | --- |
| `app/package.json` | `version` |
| `app/android/app/build.gradle` | `versionName`, `versionCode` |

`versionCode` must be strictly higher than the one already live in Play — Play
rejects a re-used code. Check the current one under *Test and release →
Production*. `versionName` is the human-facing string and should match
`package.json`, which feeds `VITE_APP_VERSION` and the version shown in the UI.

## 2. Build the bundle

```
cd app
npm ci
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

The signed bundle lands at:

```
app/android/app/build/outputs/bundle/release/app-release.aab
```

To sanity-check the signature before uploading:

```
jarsigner -verify -verbose -certs app/android/app/build/outputs/bundle/release/app-release.aab
```

## 3. Upload

1. Play Console → **Test and release** → **Production**
2. **Create new release**
3. Upload the `.aab`
4. Fill in the release notes
5. **Save** → **Review release** → **Start rollout**

Review typically takes a few hours to a few days.

Consider an **Internal testing** track first — same upload flow, but it reaches only
your listed testers and is available within minutes.

## Target API level

Play enforces a minimum `targetSdkVersion` and refuses uploads below it. The
requirement rises every year, roughly one year behind each Android release, so an
app that goes a long time without a release will eventually be blocked from
updating at all.

`targetSdkVersion` lives in `app/android/variables.gradle`. Raising it is not just a
number change — each level brings behaviour changes that need testing on a device
(Android 15 forcing edge-to-edge layout, for example).

## Developer account inactivity

Google closes developer accounts that stay inactive, which takes the published apps
down with them. Shipping a release resets this. It is a separate policy from the
target API requirement, with its own deadline.
