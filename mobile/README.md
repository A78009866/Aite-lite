# Aite Mobile (Android)

A Capacitor 8 Android wrapper that packages the existing Aite web views and uses the live backend for data. It targets Android 16 (API 36) for current Google Play submissions.

## Requirements

- Node.js 22+
- JDK 21
- Android SDK Platform 36 and Build-Tools 36.x
- Android Studio 2025.2.1+ (optional for command-line builds)

## Build

```bash
cd mobile
npm ci
npm run android:debug     # Debug APK
npm run android:release   # Signed release APK (requires private keystore.properties)
npm run android:bundle    # Signed release AAB for Play Console (requires private keystore.properties)
```

The web assets are generated from `../views/` by `npm run build`; `npm run sync` also runs `npx cap sync android`.

### Private signing setup

A sample property file is at `android/keystore.properties.example`. Copy it to `android/keystore.properties`, create/provide a private upload key in `android/keystore/`, and fill in the actual alias and passwords locally. Both paths are ignored by Git. Never commit or send signing keys/passwords in chat.

The old release keystore and passwords were removed because they had been committed to the public repository. If this app already has a Play listing, do not create a random replacement key: match the Play Console upload key or reset it through Play Console first. Set a versionCode higher than the one already uploaded.

### App navigation

A launcher start clears stale route state and returns to the normal app entry flow: signed-in users go to `chat_list`, signed-out users to `accounts`/login. Internal pages remain navigable through the WebView history.

### Push notifications

Push notifications require `android/app/google-services.json`, registered for application ID `com.aite.app`. It is intentionally not tracked in Git.
