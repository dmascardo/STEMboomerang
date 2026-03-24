import os
from pathlib import Path

# =========================================================
# Paths + DB
# =========================================================
BASE_DIR = Path(__file__).resolve().parent  # backend/
DB_PATH = Path(os.getenv("SQLITE_PATH", str(BASE_DIR / "candidates.db"))).resolve()
UPLOADS_DIR = (BASE_DIR / "uploads").resolve()

BASE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"
