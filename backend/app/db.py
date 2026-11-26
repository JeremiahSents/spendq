from sqlmodel import Session, SQLModel, create_engine

from app.settings import DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Neon suspends idle compute and closes idle connections: check each pooled
    # connection before use and recycle them well inside Neon's idle timeout.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300, pool_size=5, max_overflow=5)


def create_tables() -> None:
    from app import models  # noqa: F401  (registers the tables)
    SQLModel.metadata.create_all(engine)


def drop_tables() -> None:
    from app import models  # noqa: F401
    SQLModel.metadata.drop_all(engine)


_ready = False


def ensure_ready() -> None:
    """Create tables and seed demo data if the database is empty. Runs once per process:
    from the app's startup hook, or on the first request where a host skips startup hooks."""
    global _ready
    if _ready:
        return
    create_tables()
    from sqlmodel import select
    from app.models import Department
    with Session(engine) as s:
        empty = s.exec(select(Department)).first() is None
    if empty:
        from scripts.seed import seed
        seed()
    _ready = True


def get_session():
    ensure_ready()
    with Session(engine) as session:
        yield session
