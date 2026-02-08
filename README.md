# Where's My Professor?

> LeedsHack 2026 — Facial recognition attendance & emotion tracking system.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18.17 | `brew install node` or [nvm](https://github.com/nvm-sh/nvm) |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Xcode | ≥ 15 | Mac App Store |
| CocoaPods | ≥ 1.14 | `brew install cocoapods` |
| ngrok | latest | `brew install ngrok` (free account at [ngrok.com](https://ngrok.com)) |

---

## 1. Clone the repo

```bash
git clone https://github.com/<your-org>/leedhack-2026.git
cd leedhack-2026
```

---

## 2. Mongo Backend Setup

```bash
cd mongo-backend
pnpm install
```

Create the environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```dotenv
PORT=8787
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=WheresMyProfDB
MONGODB_DEFAULT_COLLECTION=records
```

Start the dev server:

```bash
pnpm dev
```

Verify it's running:

```bash
curl http://localhost:8787/health
# Should return: { "ok": true, "mongo": "reachable" }
```

### Expose via ngrok (required for physical device testing)

In a **separate terminal**:

```bash
ngrok http 8787
```

Copy the `https://...ngrok-free.dev` forwarding URL — you'll need it for the Expo app.

---

## 3. Expo App Setup

```bash
cd expo-app
pnpm install
```

Create the environment file:

```bash
touch .env
```

Add the following to `.env` (replace the ngrok URL with your own):

```dotenv
EXPO_PUBLIC_MONGO_API_URL=https://<your-ngrok-subdomain>.ngrok-free.dev
EXPO_PUBLIC_EMOTION_ML_URL=https://wheresmyprofessor-api.rcn.sh/analyse
EXPO_PUBLIC_SAVE_URL=https://<your-ngrok-subdomain>.ngrok-free.dev/records
```

### iOS (physical device)

```bash
# Install native dependencies
cd ios && pod install && cd ..

# Build and run on your plugged-in iPhone
pnpm expo run:ios --device
```

### iOS (simulator)

```bash
pnpm expo run:ios
```

### Android

```bash
pnpm expo run:android
```

> **Note:** After changing any `EXPO_PUBLIC_*` variable, restart the Metro bundler for changes to take effect.

---

## 4. Project Structure

```
leedhack-2026/
├── expo-app/           # React Native (Expo) mobile app
│   ├── App.js          # Main app with Camera, Student & Lecturer tabs
│   ├── .env            # Runtime environment variables (not committed)
│   └── ios/            # Native iOS project
├── mongo-backend/      # Hono + MongoDB REST API
│   ├── src/
│   │   ├── index.ts    # Server entry point
│   │   ├── routes/
│   │   │   ├── records.ts    # Generic collection query endpoints
│   │   │   ├── student.ts    # Student profile, schedule, emotions
│   │   │   └── lecturer.ts   # Lecturer profile, heatmap, next session
│   │   └── services/
│   │       └── mongo.ts      # MongoDB connection pool
│   └── .env            # Server environment variables (not committed)
└── wmp-backend/        # CV worker + Python embeddings
```

---

## 5. API Reference (mongo-backend)

### Health
- `GET /health` — Ping MongoDB

### Student
- `GET /student/:studentId/profile` — Attendance %, modules, name
- `GET /student/:studentId/schedule?date=YYYY-MM-DD` — Lectures for a day
- `GET /student/:studentId/emotions` — Emotion score history

### Lecturer
- `GET /lecturer/:lecturerId/profile` — Engagement, attendance, lecture & student counts
- `GET /lecturer/:lecturerId/heatmap` — Daily engagement scores
- `GET /lecturer/:lecturerId/next-session` — Next upcoming lecture
- `GET /lecturer/:lecturerId/lectures` — All lectures with per-lecture stats

### Records (generic)
- `GET /records?limit=20&skip=0&collection=Attendance` — List documents
- `POST /records/query` — Advanced query with filter/projection/sort

---

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Network request failed` on iPhone | Make sure ngrok is running and the URL in `expo-app/.env` matches |
| `ExpoLocation` native module missing | Run `pnpm expo install expo-location` then rebuild: `pnpm expo run:ios --device` |
| MongoDB TLS/SSL error | Whitelist your IP in Atlas → Network Access (or use `0.0.0.0/0` for testing) |
| ngrok URL changed | Update `EXPO_PUBLIC_MONGO_API_URL` in `expo-app/.env` and restart Metro |
| `Cannot find native module` | Always rebuild native after adding packages: `cd ios && pod install && cd .. && pnpm expo run:ios --device` |
