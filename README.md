# Aite-lite

A Node.js + Express backend for the Aite social/chat web app, with static HTML views and a Capacitor Android wrapper.

## Quick start

1. Copy `.env.example` to `.env` and add the Firebase/R2 credentials.
2. Install dependencies and run the backend:
   ```bash
   npm install
   npm start
   ```
3. Preview only the static frontend with `npm run preview`.

## Recent fixes

- Reels now load in cursor-based pages, including older records and legacy reels whose timestamp is missing; the Android feed appends pages as the user swipes.
- A fresh Android launcher start clears stale route state and returns through the app entry flow (signed-in users go to `chat_list`; signed-out users go to accounts/login).
- Upgraded the Android shell to Capacitor 8 / Android API 36, as required for current Google Play submissions.
- Removed the previously committed Android keystore and passwords. Those signing values were public and must not be reused for a Play release.

## Android build / release

See `INSTALL_MOBILE.md`. A release APK/AAB must be signed with the private upload key associated with the Play Console app. Never commit that key or its password.
