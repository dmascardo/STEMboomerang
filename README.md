# STEM Boomerang

Dockerized prototype for resume parsing (FastAPI backend + static frontend).

## Prerequisites
- Docker Desktop (or Docker Engine + Docker Compose plugin)

## Project Structure
```text
project-root/
  backend/
    main.py
    requirements.txt
    Dockerfile
  frontend/
    Dockerfile
    nginx.conf
    src/
  docker-compose.yml
  .env.example
  README.md
```

## Quick Start (Local)
1. Copy environment template:
```bash
cp .env.example .env
```
On Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

2. Start everything:
```bash
docker compose up --build
```

3. Open the app:
- Frontend: `http://localhost:5173`
- Backend API through frontend proxy: `http://localhost:5173/api`
- Backend health check through frontend proxy: `http://localhost:5173/api/health`
- Direct backend health check: `http://localhost:8000/health`

## Stop the Project
```bash
docker compose down
```

To also remove persisted volumes:
```bash
docker compose down -v
```

## How the Containers Work Together
- `backend`:
  - Built from `backend/Dockerfile` (Python 3.11).
  - Installs `backend/requirements.txt`.
  - Runs `uvicorn main:app --host 0.0.0.0 --port 8000`.
  - Persists SQLite DB at `/app/data/candidates.db` using a named Docker volume (`db_data`).
  - Persists uploaded files at `/app/uploads` using `uploads_data`.
- `frontend`:
  - Built from `frontend/Dockerfile`.
  - Uses Node to build static assets, then serves them via Nginx.
  - Exposed at `http://localhost:5173`.
  - Calls backend API through `VITE_API_BASE_URL` (set in `.env`, defaults to `/api`).

## Environment Variables
Use `.env` (copied from `.env.example`) for secrets/config:
- `OPENAI_API_KEY`: optional for LLM extraction.
- `OPENAI_MODEL`: default model.
- `FRONTEND_ORIGINS`: allowed browser origins for backend CORS.
- `VITE_API_BASE_URL`: frontend API base URL at build time. Use `/api` for the default Docker setup.
- `VITE_OPENAI_API_KEY`: optional frontend key (not recommended for production).

## Local Run Instructions
1. Clone repo and open in terminal.
2. Copy `.env.example` to `.env`.
3. Add API keys in `.env` if needed.
4. Run `docker compose up --build`.
5. Use `http://localhost:5173`.

## Railway Deployment
- This repo now includes a root `Dockerfile` for a single Railway service.
- That container serves the frontend and proxies `/api/*` requests to the FastAPI backend internally.
- Railway should build from the repo root and expose the service on its default public domain.
- Set these Railway variables:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `FRONTEND_ORIGINS`
- Recommended `FRONTEND_ORIGINS` value: your Railway frontend domain, for example `https://your-app.up.railway.app`
- SQLite inside a container is not durable. For production persistence, attach a Railway volume or move to PostgreSQL.
