"""Demo-wide constants. Override with environment variables when deploying."""
import os
from datetime import date, timedelta, timezone
from pathlib import Path


def _load_env_files() -> None:
    """Read KEY=value lines from .env.local / .env (backend folder first, then repo root).
    `neon deploy` writes DATABASE_URL into the repo root's .env.local. Real environment
    variables (e.g. set on Render) always win."""
    backend = Path(__file__).resolve().parent.parent
    for path in (backend / ".env.local", backend / ".env", backend.parent / ".env.local", backend.parent / ".env"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip().removeprefix("export ").strip(), value.strip().strip("'\""))


_load_env_files()

# The "today" the demo pretends it is, so renewals and 90-day activity stay stable.
DEMO_TODAY = date.fromisoformat(os.getenv("DEMO_TODAY", "2026-11-30"))

# All timestamps are stored timezone-aware, in East Africa Time.
TZ = timezone(timedelta(hours=3), "EAT")

# Fixed demo exchange rate. Every KES figure in the API uses this.
USD_TO_KES = float(os.getenv("USD_TO_KES", "129.0"))

# Actions saving this much or more need CFO approval; below it, a manager.
CFO_APPROVAL_THRESHOLD_KES = float(os.getenv("CFO_APPROVAL_THRESHOLD_KES", "1000000"))

# A seat counts as active if its user signed in within this many days.
ACTIVE_WINDOW_DAYS = int(os.getenv("ACTIVE_WINDOW_DAYS", "90"))

# Renewals inside this window show up on the renewals screen.
RENEWAL_WINDOW_DAYS = int(os.getenv("RENEWAL_WINDOW_DAYS", "90"))

def _sqlalchemy_url(url: str) -> str:
    """Neon gives postgres:// or postgresql:// URLs; SQLAlchemy needs the psycopg driver named."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


# Neon Postgres when DATABASE_URL is set (pooled connection string recommended); SQLite otherwise.
# On Vercel only /tmp is writable, and it is wiped between instances: set DATABASE_URL there.
_DEFAULT_SQLITE = "sqlite:////tmp/spendq-demo.db" if os.getenv("VERCEL") else "sqlite:///./demo.db"
DATABASE_URL = _sqlalchemy_url(os.getenv("DATABASE_URL", _DEFAULT_SQLITE))

# Comma-separated list of allowed frontend origins, e.g. "https://our-app.vercel.app".
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]


def to_kes(amount: float, currency: str) -> float:
    return round(amount * USD_TO_KES, 2) if currency == "USD" else round(amount, 2)
