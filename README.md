# Mandarin Flashcards

Full-stack spaced repetition flashcard app for learning Mandarin Chinese.

**Tech Stack:**
- Frontend: React + TypeScript + Vite
- Backend: Hono + Node.js
- Database: PostgreSQL
- Authentication: Better Auth with email/password
- Deployment: Docker Compose

## Quick Start with Docker

1. Clone the repository and navigate to the project directory

2. Start all services with Docker Compose:
   ```bash
   docker-compose up
   ```

3. Access the app:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - PostgreSQL: localhost:5432

## Local Development Setup

### Backend
```bash
cd backend
npm install
npm run db:migrate  # Run database migrations
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
- **CEFR level filtering** (A1-C2 or ALL) to focus on appropriate difficulty
- **Configurable daily new card limit** to control learning pace
- **"Again" cards re-queued** within the session for immediate review
- **Undo support** to correct grading mistakes
- **Browse mode** to view all cards and their current status

### User Features
- **User authentication** with email/password
- **Cross-device sync** - progress saved to PostgreSQL database
- **Session persistence** - resume your study session anytime
- **Statistics tracking** - view your learning progress and card statistics
- **Dark mode support** for comfortable studying

### Technical Features
- Responsive design for mobile and desktop
- RESTful API backend
- Docker-based deployment
- Type-safe TypeScript throughout

## Dataset

The app uses the Mandarin vocabulary dataset from:
https://github.com/vbvss199/Language-Learning-decks/blob/main/mandarin/mandarin.json

The dataset is already included in [frontend/public/mandarin.json](frontend/public/mandarin.json).

## Configuration

### Environment Variables

**Backend** (set in [docker-compose.yml](docker-compose.yml)):
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Secret key for authentication (change in production!)
- `BETTER_AUTH_URL` - Base URL for authentication callbacks

**Frontend**:
- `API_URL` - Backend API URL (configured in [vite.config.ts](frontend/vite.config.ts))
