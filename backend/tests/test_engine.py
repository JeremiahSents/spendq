"""The engine must find every planted problem, and nothing else, with the answer key's numbers."""
import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"  # never run tests against a real database

from sqlmodel import Session  # noqa: E402

from app.db import engine  # noqa: E402
from app.engine import detect  # noqa: E402
from scripts.generate import generate  # noqa: E402
from scripts.planted import build  # noqa: E402
from scripts.seed import seed  # noqa: E402


def test_engine_matches_answer_key():
    seed()
    with Session(engine) as s:
        found, _ = detect(s)
    expected, _ = build(generate())
    assert sorted(f.type.value for f in found) == sorted(f.type.value for f in expected)
    by_type = {f.type: f for f in found}
    for e in expected:
        f = by_type[e.type]
        assert round(f.est_saving_kes) == round(e.est_saving_kes), (e.type, f.est_saving_kes, e.est_saving_kes)
        assert round(f.amount_at_issue_kes) == round(e.amount_at_issue_kes), e.type
        assert set(f.contract_ids) == set(e.contract_ids), e.type
