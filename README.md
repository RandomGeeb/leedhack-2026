# Where's My Professor?

> **LeedsHack 2026** — Three-factor lecture attendance verified by facial recognition, GPS geofencing, and real-time emotion analysis.

Students snap a photo of their lecturer and the app does the rest: identifies the professor via face recognition, confirms the student is physically in the lecture hall, analyses their emotional engagement from a selfie, and logs verified attendance — all in seconds.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Expo / React Native App                                            │
│  ┌───────────┐  ┌──────────────┐  ┌────────────────────────────┐   │
│  │ VisionCam │  │ expo-location │  │ Clerk Auth (Student/Staff) │   │
│  │ dual-snap │  │ GPS geofence  │  │                            │   │
│  └─────┬─────┘  └──────┬───────┘  └────────────────────────────┘   │
│        │               │                                            │
└────────┼───────────────┼────────────────────────────────────────────┘
         │               │
         ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker  (Hono)            wheresmyprofessor-api.rcn.sh  │
│                                                                     │
│  /search ──► Python FastAPI ──► DeepFace (Facenet512 + RetinaFace)  │
│              extract embedding     │                                │
│                                    ▼                                │
│                              Weaviate Vector DB                     │
│                              nearVector search                      │
│                                                                     │
│  /analyse ──► HuggingFace Inference Endpoint (emotion classifier)   │
│  /emotion-score ──► Gemini 3 Flash via OpenRouter (score 0-100)     │
│                                                                     │
│  /attendance, /student, /lecturer, /lecture ──► MongoDB Atlas        │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo SDK 54, react-native-vision-camera |
| Auth | Clerk |
| API | Hono on Cloudflare Workers |
| Face Recognition | DeepFace (Facenet512) + Weaviate vector DB |
| Emotion Analysis | HuggingFace Inference Endpoint + Gemini 3 Flash (OpenRouter) |
| Database | MongoDB Atlas |
| Validation | Zod |
| GPS | expo-location + geolib |

---

## Features

### Student Experience
- **One-tap attendance** — photograph the lecturer (back camera), auto-snap a selfie (front camera), done
- **Three-factor verification** — face recognition confirms the lecturer, GPS confirms the location, selfie confirms the student
- **Weekly timetable** — view scheduled lectures by day, pulled from the backend
- **Attendance stats** — track attendance percentage and module count

### Lecturer Experience
- **Engagement score** — average emotion score across all sessions
- **Attendance rate** — percentage of students showing up
- **Activity heatmap** — GitHub-style 20-week grid of daily engagement, colour-coded by sentiment
- **Next session** — upcoming lecture with historical engagement target
- **Per-lecture breakdown** — attendees and average engagement for every session

---

## Project Structure

```
leedhack-2026/
├── expo-app/                         # React Native (Expo) mobile app
│   ├── App.js                        # Main app — camera flow, student & lecturer tabs
│   ├── .env                          # Runtime env vars (not committed)
│   └── package.json
│
└── wmp-backend/
    ├── cv-worker/                    # Cloudflare Worker (Hono + TypeScript)
    │   ├── index.ts                  # Entry — routes, /analyse, /emotion-score, /search
    │   ├── client.ts                 # Weaviate face search client
    │   ├── mongo.ts                  # MongoDB connection pool with health-check reconnect
    │   ├── env.ts                    # Env type definitions
    │   ├── wrangler.toml             # Cloudflare Workers config
    │   └── routes/
    │       ├── attendance.ts         # CRUD for attendance records
    │       ├── student.ts            # Student profile, schedule, emotions
    │       ├── lecturer.ts           # Lecturer profile, heatmap, next session, lectures
    │       ├── lecture.ts            # CRUD for lectures
    │       └── records.ts            # Generic collection query gateway
    │
    └── python/
        ├── embeddings.py             # FastAPI service — DeepFace embedding extraction
        ├── populate.py               # Seed Weaviate with lecturer face photos
        ├── requirements.txt
        └── photos/                   # Reference photos for face enrollment
```

---

## Getting Started

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 18.17 | [nvm](https://github.com/nvm-sh/nvm) recommended |
| pnpm | >= 9 | `npm i -g pnpm` |
| Python | >= 3.10 | For the embedding service |
| Wrangler | >= 4 | `npm i -g wrangler` (Cloudflare Workers CLI) |

### 1. Clone

```bash
git clone https://github.com/<your-org>/leedhack-2026.git
cd leedhack-2026
```

### 2. Backend — Cloudflare Worker

```bash
cd wmp-backend/cv-worker
pnpm install
```

Set secrets via Wrangler (never commit these):

```bash
wrangler secret put WEAVIATE_CLUSTER_URL
wrangler secret put WEAVIATE_API_KEY
wrangler secret put PYTHON_EMBEDDING_URL
wrangler secret put HF_API_KEY
wrangler secret put MONGODB_URI
wrangler secret put OPENROUTER_API_KEY
```

Run locally or deploy:

```bash
pnpm dev          # local dev server
pnpm deploy       # deploy to Cloudflare
```

Verify:

```bash
curl http://localhost:8787/health
# { "ok": true, "mongo": "reachable" }
```

### 3. Backend — Python Embedding Service

```bash
cd wmp-backend/python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python embeddings.py
# Runs on http://localhost:8000
```

To seed Weaviate with lecturer face embeddings:

```bash
python populate.py
```

### 4. Expo App

```bash
cd expo-app
pnpm install
```

Create `.env`:

```dotenv
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_MONGO_API_URL=https://wheresmyprofessor-api.rcn.sh
EXPO_PUBLIC_EMOTION_ML_URL=https://wheresmyprofessor-api.rcn.sh/analyse
```

Run on device:

```bash
pnpm expo run:android    # Android
pnpm expo run:ios        # iOS (requires Xcode + CocoaPods)
```

> After changing any `EXPO_PUBLIC_*` variable, restart Metro for changes to take effect.

---

## API Reference

All routes are served from the Cloudflare Worker at `https://wheresmyprofessor-api.rcn.sh`.

### Health & CV

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Ping MongoDB connection |
| `POST` | `/analyse` | Emotion classification from face image (base64) |
| `POST` | `/emotion-score` | LLM-derived 0-100 engagement score from emotion array |
| `POST` | `/search` | Face recognition — identify a person from base64 image |
| `GET` | `/people` | List all enrolled people in the face database |
| `GET` | `/stats` | Total embeddings and people count |

### Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/attendance` | List records (filter by `student_id`, `lecture_id`) |
| `GET` | `/attendance/:id` | Get single record by ObjectId |
| `POST` | `/attendance` | Create record: `{ student_id, lecture_id, emotion_score, timestamp }` |
| `PUT` | `/attendance/:id` | Update a record |
| `DELETE` | `/attendance/:id` | Delete a record |

### Student

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/student` | List all students |
| `POST` | `/student` | Create student: `{ student_id, fullname }` |
| `GET` | `/student/:id/profile` | Attendance %, modules, lecture count |
| `GET` | `/student/:id/schedule?date=YYYY-MM-DD` | Timetable for a given day |
| `GET` | `/student/:id/emotions` | Emotion score history with averages |

### Lecturer

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/lecturer` | List all lecturers |
| `POST` | `/lecturer` | Create lecturer: `{ lecturer_id, fullname }` |
| `GET` | `/lecturer/:id/profile` | Engagement, attendance rate, student count |
| `GET` | `/lecturer/:id/heatmap` | Daily engagement scores for heatmap |
| `GET` | `/lecturer/:id/next-session` | Next upcoming lecture with target score |
| `GET` | `/lecturer/:id/lectures` | All lectures with per-session stats |

### Lecture

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/lecture` | List lectures (filter by `lecturer_id`) |
| `GET` | `/lecture/:id` | Get single lecture |
| `POST` | `/lecture` | Create: `{ lecture_id, lecturer_id, datetime, location }` |
| `PUT` | `/lecture/:id` | Update a lecture |
| `DELETE` | `/lecture/:id` | Delete a lecture |

### Records (Generic)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/records?collection=X&limit=20` | List documents from any collection |
| `POST` | `/records/query` | Advanced query with filter, projection, sort |

---

## MongoDB Collections

| Collection | Key Fields | Purpose |
|------------|-----------|---------|
| `Student` | `student_id`, `fullname` | Enrolled students |
| `Lecturer` | `lecturer_id`, `fullname` | Teaching staff |
| `Lecture` | `lecture_id`, `lecturer_id`, `datetime`, `location` | Scheduled sessions |
| `Attendance` | `student_id`, `lecture_id`, `emotion_score`, `timestamp` | Verified attendance records |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Network request failed` on device | Check that the API URL in `.env` is reachable from the device's network |
| MongoDB TLS/SSL error | Whitelist your IP in Atlas Network Access (or `0.0.0.0/0` for dev) |
| `ExpoLocation` native module missing | Run `pnpm expo install expo-location` then rebuild |
| `Cannot find native module` | Rebuild native: `cd ios && pod install && cd ..` then re-run |
| Emotion/search endpoints return 500 | Check that `HF_API_KEY`, `WEAVIATE_API_KEY`, and `PYTHON_EMBEDDING_URL` secrets are set |
| Attendance silently failing | Check browser/device console for `Attendance save failed` warnings |

---

## License

Built at [LeedsHack 2026](https://leedshack.com).
