# Aite Android build and release

The Android wrapper is on Capacitor 8 and targets Android 16 (API 36), the current Google Play target for new apps and updates.

## Build requirements

- Node.js 22 or newer
- JDK 21
- Android SDK Platform 36 and Android SDK Build-Tools 36.x
- Android Studio 2025.2.1 or newer (optional for command-line builds)

## Build a test APK

```bash
cd mobile
npm ci
npm run android:debug
```

Output: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## Sign a release APK and Play bundle

**Do not use the old key/passwords that were tracked in this public repository.** They are considered compromised and have been removed from the current source tree. If this app is already on Google Play, use the existing private upload key or request an upload-key reset in Play Console before building. If it is a first release, create a new private upload key and enroll in Play App Signing.

Generate a private upload key locally (never commit it):

```bash
cd mobile/android
mkdir -p keystore
keytool -genkeypair -v -keystore keystore/upload-key.jks -alias aite-upload \
  -keyalg RSA -keysize 2048 -validity 10000
cp keystore.properties.example keystore.properties
# Edit keystore.properties with the actual passwords/alias. Keep it private.
```

`keystore.properties` is ignored by Git. Then build:

```bash
cd ../
npm ci
npm run android:release   # signed APK
npm run android:bundle    # signed AAB for Google Play
```

Outputs:

- `mobile/android/app/build/outputs/apk/release/app-release.apk`
- `mobile/android/app/build/outputs/bundle/release/app-release.aab`

Back up the upload key securely and keep it for future updates. Do not send the key or its passwords in chat, commit them, or place them in a public repository. Increase `versionCode` in `mobile/android/app/build.gradle` for every Play update; the current value is only a starting value and must be checked against the app's Play Console listing.

## Backend deployment and reels

The reels pagination fix includes a change to `server.js`, so deploy the backend as well as rebuilding the mobile app. The mobile wrapper still calls the live backend at `https://aite-lite.vercel.app`.

Push notifications require the matching Firebase `google-services.json` in `mobile/android/app/` and the app ID `com.aite.app` registered in that Firebase project. This file is intentionally not tracked.
