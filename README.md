# Pitch Runner (FSN)

Soccer dodge runner with local and online multiplayer.

## Project layout

```
FSN/
├── frontend/   # Next.js + Phaser game
├── backend/    # FastAPI + Redis + SQLite leaderboards
└── docker-compose.yml
```

## Local development

### 1. Redis

```bash
docker compose up redis
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
copy .env.example .env          # Windows
python -m uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
copy .env.local.example .env.local   # Windows
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The API runs at [http://localhost:8000](http://localhost:8000).

## Environment

| Variable | Location | Default |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | `http://localhost:8000` |
| `REDIS_URL` | `backend/.env` | `redis://localhost:6379/0` |
| `SQLITE_PATH` | `backend/.env` | `backend/data/highscores.db` |
| `CORS_ORIGINS` | `backend/.env` | `http://localhost:3000` |
