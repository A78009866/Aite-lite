# Aite-lite — Android APK integration

This archive is your full `Aite-lite` repo with the Android wrapper already added.

## What changed compared to your current `main` branch

| Path | What it is |
| --- | --- |
| `mobile/` (new) | Capacitor 6 Android wrapper project. Bundles all HTML/CSS/JS from `views/` into the APK so screens open instantly from local storage, and routes API calls to the live backend. |
| `server.js` (modified) | CORS now allows the Capacitor shell origins (`https://localhost`, `capacitor://localhost`, …), and the session cookie uses `SameSite=None; Secure` in production so it can cross the mobile origin. |

Nothing else in the repo is touched.

## Steps to publish

```bash
cd Aite-lite               # this folder, after you unzip
git checkout -b android-apk
git add mobile/ server.js
git commit -m "Add Capacitor Android APK wrapper"
git push -u origin android-apk
```

Open a PR on github.com/A78009866/Aite-lite from `android-apk` -> `main`.

Then push `server.js` (via the merge) to production so Vercel redeploys
`aite-lite.vercel.app` with the new CORS + cookie config. The APK needs that
deploy live to actually log in / fetch data.

## Build the APK yourself

Requirements:

* Node.js 18+
* Java 17 (OpenJDK)
* Android SDK with `platforms;android-34`, `build-tools;34.0.0`, `platform-tools`
* `ANDROID_HOME` env var pointing at the SDK

```bash
cd mobile
npm install
npm run android:debug      # -> android/app/build/outputs/apk/debug/app-debug.apk
# or
npm run android:release    # -> android/app/build/outputs/apk/release/app-release.apk (signed)
```

`npm run android:release` signs the APK using `mobile/android/keystore/aite-release.keystore`
and the passwords in `mobile/android/keystore.properties`.

> NOTE: that keystore is a self-generated dev keystore so the demo APK installs
> cleanly. **Replace it with a private keystore before publishing to Play Store**
> (`keytool -genkeypair -keystore my-release.keystore -alias aite -keyalg RSA
>  -keysize 2048 -validity 10950`), and never commit a real keystore /
> passwords to a public repo. Once you change the keystore, every future
> release must be signed with the same keystore — that's Android's upgrade
> identity rule. Back it up somewhere safe.

## How fast is "fast"?

Every page (`accounts.html`, `login.html`, `chat_list.html`, `reels.html`, etc.)
is bundled inside the APK. There is no network round-trip to load a screen —
only the actual data calls (`/api/...`) go over the wire. On the live site
each navigation re-downloads HTML+JS+CSS; in the APK it does not.

The runtime shim `mobile/scripts/aite-bridge.js` is injected into every page
by `mobile/scripts/build-web.js`. It:

1. Absolutizes `fetch`, `XMLHttpRequest`, and `EventSource` URLs to
   `https://aite-lite.vercel.app` with `credentials: 'include'`.
2. Translates server-style URLs (`/profile/:id`, `/post/:id`, etc.) into the
   matching local HTML file.
3. Handles synthetic server-only paths like `/check-status` and `/logout` by
   calling the backend and then redirecting locally.

## Adding a new server route

1. New HTML page — just drop it into `views/`. `npm run build` (inside
   `mobile/`) will copy it to `mobile/www` and inject the bridge.
2. New URL pattern like `/foo/:id` — add it to the `DYNAMIC_ROUTES` regex array
   in `mobile/scripts/aite-bridge.js`.
3. New server-only route like `/check-status` — add a clause to
   `handleServerOnlyRoute` in the same file, then rebuild.
