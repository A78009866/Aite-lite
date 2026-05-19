# Aite Mobile (Android)

A Capacitor 6 wrapper that turns the Aite web app into a fast native Android APK.

## Why this approach

* **Speed**: every HTML/CSS/JS file is copied out of `../views` and shipped inside the APK,
  so navigation between screens happens entirely from local storage. Only data calls go
  over the network.
* **No UI rewrite**: the bundled web app is the existing site verbatim. A small runtime
  shim (`scripts/aite-bridge.js`) is injected into every HTML page to:
  * absolutize `fetch`, `XMLHttpRequest`, and `EventSource` URLs to the live backend
    (`https://aite-lite.vercel.app`) with `credentials: include`,
  * map server-style URLs like `/profile/:userId` and `/check-status` to the matching
    bundled HTML file (or, for server-only routes, run the redirect logic locally), and
  * keep session cookies attached across the WebView boundary.
* **Real native APK**: Android Studio is not required to build; everything ships through
  `gradlew`.

## Project layout

```
mobile/
├── android/                       Capacitor-generated Android Studio project
├── scripts/
│   ├── aite-bridge.js             runtime shim injected into every page
│   ├── build-web.js               copies ../views -> www and injects the shim
│   └── gen-android-assets.sh      regenerates launcher icons + splash from icon-512.png
├── capacitor.config.json
└── package.json
```

## Build prerequisites

* Node.js 18+
* Java 17 (OpenJDK)
* Android SDK with `build-tools;34.0.0`, `platform-tools`, `platforms;android-34`
* `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) exported

Set `local.properties` in `android/` if `ANDROID_HOME` isn't visible to Gradle:

```
sdk.dir=/path/to/android-sdk
```

## Build a debug APK

```bash
cd mobile
npm install
npm run build        # copies views/ -> www/ and injects aite-bridge.js
npx cap sync android # copies www/ into android/app/src/main/assets/public
cd android
./gradlew assembleDebug
```

The APK ends up at `android/app/build/outputs/apk/debug/app-debug.apk` (~5 MB).

`npm run android:debug` does all three steps in one command.

## Build a release APK

```bash
cd mobile/android
./gradlew assembleRelease
```

Signing is not configured by default; add a `signingConfigs` block to
`android/app/build.gradle` (or use Android Studio's "Generate Signed Bundle / APK"
flow) before shipping a release build to a real device or Play Console.

## Backend changes required for cross-origin auth

The Capacitor shell loads pages from `https://localhost` and talks to
`https://aite-lite.vercel.app` for data. For session cookies to flow across that
boundary, `server.js` already has the following adjustments in this PR:

* `corsOptions.origin` now allows the production deployment, `https://localhost`,
  and the Capacitor / Ionic schemes — every other origin is still rejected.
* `session.cookie.sameSite` is set to `'none'` in production (and stays `'lax'`
  in local dev), so the Set-Cookie response from `aite-lite.vercel.app` is honored
  by the Capacitor WebView. `httpOnly` and `secure` are unchanged.

Once those changes are deployed to `aite-lite.vercel.app`, the APK can log in,
fetch posts, receive `EventSource` notifications, and so on, against the live
backend without any additional configuration.

## Regenerating launcher icons / splash

The Android launcher icon and splash screen are generated from `../views/icon-512.png`:

```bash
bash scripts/gen-android-assets.sh
```

Rerun this whenever the source icon changes.

## Adding a new server route

If `server.js` introduces a route that has no corresponding HTML file in `views/`
(for example, a server-only redirect like `/check-status`), add a clause to
`handleServerOnlyRoute` in `scripts/aite-bridge.js`. For new HTML pages, just add
them to `views/` — `npm run build` will pick them up. For URL patterns like
`/profile/:userId`, add a regex entry to `DYNAMIC_ROUTES` in the same file.
