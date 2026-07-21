# Aite-lite

A Node.js + Express backend for the Aite social/chat web app, with static HTML views and a Capacitor Android wrapper.

## Quick start

1. Copy the environment template and fill in your Firebase / R2 credentials:
   ```bash
   cp .env.example .env
   # edit .env with your credentials
   ```

2. Install dependencies and run the backend:
   ```bash
   npm install
   npm start
   ```

3. To preview only the static frontend (no Firebase required):
   ```bash
   npm run preview
   ```

## What was fixed

- Restored all `views/*.html` files from the pre-shutdown commit, bringing the web app back online.
- Made Firebase initialization robust: the server now starts even when `SERVICE_ACCOUNT_KEY` is missing, and falls back to a memory-backed session store for local development.
- Fixed SSE `Access-Control-Allow-Origin` headers that were calling a function as if it were an array.
- Removed a duplicate/unreachable `/api/messages/:chatId` route.
- Fixed a `from_id`/`fromId` typo in friend-request push notifications.
- Reduced unbounded Firebase reads in the heaviest endpoints: `/api/search`, `/api/stories`, `/api/users`, `/api/users/all`, `/api/reels/feed`, `/partials/posts`, `/partials/chat_content`, and `/api/notifications`.

## Mobile build

See `INSTALL_MOBILE.md` and the `mobile/` directory.
