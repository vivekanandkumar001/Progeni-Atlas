# Swami AI — Mobile App (Expo / React Native)

Same interview flow and same Flask backend (`../app.py`) as the website —
this is a native front-end alternative to the browser UI. Screens map 1:1
to the website's 3 screens: Setup → Interview → Report.

## Setup

```bash
cd mobile-app
npm install

# point the app at your Flask backend:
#   - running locally + testing on your phone: use your machine's LAN IP
#     e.g. edit api.js -> API_BASE_URL = "http://192.168.1.5:5000"
#   - deployed backend: use the public URL, e.g. "https://api.yourclient.com"

npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS) to run it on a phone, or
press `a` / `i` for an Android/iOS emulator.

## Building a real installable app (for client handoff)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android   # -> .apk / .aab
eas build --platform ios       # -> .ipa (needs Apple dev account)
```

## Notes

- Uses `expo-camera` for the front camera preview during the interview and
  `expo-av` for recording the spoken answer (uploaded to `/api/submit_answer`
  exactly like the website does).
- Resume upload uses `expo-document-picker` (PDF only, matches backend's parser).
- No separate backend needed — this app is a pure client for the same
  `app.py` API used by the website, so both stay in sync automatically.
- Full-session video capture (like the website's background recorder) is not
  wired in here to keep the app lightweight — add `expo-camera`'s
  `recordAsync()` on a loop if the client wants full video archived from
  mobile too.
