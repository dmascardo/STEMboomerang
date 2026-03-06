# STEM Boomerang

Simple setup guide for local development.

## Prerequisites
- Node.js 18+
- Python 3.10+

## 1. Clone and open project
```bash
git clone <your-repo-url>
cd STEMboomerang
```

## 2. Set up backend (FastAPI)
From the project root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Run backend server:

```bash
uvicorn main:app --reload --port 8000
```

Backend URL: `http://127.0.0.1:8000`
Health check: `http://127.0.0.1:8000/health`

## 3. Set up frontend (Vite + React)
Open a new terminal in the project root:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

The frontend is already configured to proxy `/api` requests to `http://127.0.0.1:8000`.

## 4. Optional: enable OpenAI extraction
This app works without an API key (heuristic fallback mode).

If you want LLM extraction, set an environment variable before starting backend:

```bash
# Windows (PowerShell)
$env:OPENAI_API_KEY="sk-..."

# macOS/Linux
export OPENAI_API_KEY="sk-..."
```

Optional model override:

```bash
# Windows (PowerShell)
$env:OPENAI_MODEL="gpt-4o-mini"

# macOS/Linux
export OPENAI_MODEL="gpt-4o-mini"
```

## Common issues
- Port `8000` busy: run backend on another port and update proxy target in `vite.config.ts`.
- Port `5173` busy: Vite will suggest the next available port.
- CORS/API errors: make sure backend is running before frontend.
