# Mandarin Flashcards

Full-stack spaced repetition flashcard app for learning Mandarin Chinese.

**Tech Stack:**
- Frontend: React + TypeScript + Vite
- Backend: Hono + Node.js
- Database: PostgreSQL
- Authentication: Better Auth with email/password + username
- Deployment: Docker Compose / Portainer

## Quick Start with Docker

1. Clone the repository and navigate to the project directory.

2. Start all services with Docker Compose:
   ```bash
   docker compose up
   ```

3. Access the app:
   - Frontend (Vite dev): http://localhost:5173
   - Backend API: http://localhost:3000
   - PostgreSQL: localhost:5432

## Local Development Setup

### Backend
```bash
cd backend
npm install
npm run db:migrate  # Run Better Auth migrations (includes username plugin)
npm run dev         # Start development server on port 3000
```

### Frontend
```bash
cd frontend
npm install
npm run dev         # Start development server on port 5173
```

### Database
Set up PostgreSQL locally or use Docker:
```bash
docker run --name flashcard-postgres \
  -e POSTGRES_USER=flashcard \
  -e POSTGRES_PASSWORD=flashcard \
  -e POSTGRES_DB=flashcard \
  -p 5432:5432 -d postgres:17
```

## Authentication

Sign-up requires **email**, **username**, name, and password. Sign-in accepts **either email or username** (detected by the presence of `@`). Powered by Better Auth's `username` plugin — the first `db:migrate` adds the required columns.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Space / Enter | Reveal answer / advance |
| 1 | Again |
| 2 | Hard |
| 3 | Good |
| 4 | Easy |
| C | Copy hanzi to clipboard |
| Z | Undo last grade |

## Features

### Learning Features
- **SM-2 spaced repetition algorithm** for optimal card scheduling
- **CEFR level filtering** (A1–C2 or ALL) to focus on appropriate difficulty
- **Configurable daily new card limit** (default: 5)
- **Pinyin mnemonics** in English and Italian, displayed whenever pinyin is visible. Toggle each language independently from the toolbar.
- **"Again" cards re-queued** within the session for immediate review
- **Undo support** to correct grading mistakes
- **Browse mode** to view all cards and their current status

### User Features
- **Authentication** with email or username + password
- **Cross-device sync** — progress saved to PostgreSQL
- **Session persistence** — resume your study session anytime
- **Statistics tracking** — retention %, daily reviews, streaks
- **Dark mode support** for comfortable studying
- **Import/export** deck + stats + settings as JSON backup

### Technical Features
- Responsive design for mobile and desktop
- RESTful API backend with gzip-compressed responses
- Dataset served filtered by CEFR via `GET /api/raw-deck?cefr=...` (A1 slice is ~80 KB on the wire vs. ~29 MB uncompressed)
- Docker-based deployment with multi-arch images
- Type-safe TypeScript throughout

## Dataset

The app uses a Mandarin vocabulary dataset enriched with pinyin mnemonics (English + Italian), stored at `backend/mandarin.json` (~29 MB). The backend loads it once at startup and serves filtered slices via the API — the frontend does not download the full file directly.

A duplicate at the repo root (`mandarin_with_pinyin_mnemonics.json`) is used by the companion Python script (`hsk_flashcards.py`) and is kept in sync manually.

Base dataset derived from:
https://github.com/vbvss199/Language-Learning-decks/blob/main/mandarin/mandarin.json

## Configuration

### Environment Variables

**Backend** (set in [docker-compose.yml](docker-compose.yml) / [docker-compose.portainer.yml](docker-compose.portainer.yml)):
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — Secret key for authentication (change in production!)
- `BETTER_AUTH_URL` — Public base URL for authentication callbacks

**Frontend**:
- `API_URL` — Backend API URL (used by the static server's `/api/*` proxy)

## Deployment (Portainer)

Prebuilt images are exported to `dist-images/` by running the following from the repo root:
```bash
docker build -t flashcard-mandarin-server:latest ./backend
docker build -t flashcard-mandarin-client:latest ./frontend
docker save flashcard-mandarin-server:latest -o dist-images/flashcard-mandarin-server.tar
docker save flashcard-mandarin-client:latest -o dist-images/flashcard-mandarin-client.tar
```

On the Portainer host:
1. **Images → Import** — upload each `.tar` (or `docker load -i <file>.tar`).
2. **Stacks → Add Stack** — paste [docker-compose.portainer.yml](docker-compose.portainer.yml) and set `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `PUBLIC_URL`.
3. App becomes available on port `3888`.

## Project Layout

```
backend/          Hono API + Better Auth + mandarin.json dataset
frontend/         React SPA + static server (serve.ts) with /api/* proxy
hsk_flashcards.py Standalone Python Tk version (coworker's workflow)
deck_mandarin.json                 Python progress state (not used by web app)
mandarin_with_pinyin_mnemonics.json Python data source (duplicate of backend/mandarin.json)
dist-images/      Built Docker image tars for Portainer deployment
```
