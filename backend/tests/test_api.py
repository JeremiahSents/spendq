"""Smoke tests: every endpoint answers, the planted problems are all present,
and the approve -> complete flow moves money into the ledger.

    pytest -q
"""
import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"  # never run tests against a real database

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from scripts.seed import seed  # noqa: E402

PLANTED = {"unused_licence", "vendor_overlap", "duplicate_subscription", "overbilling",
           "duplicate_invoice", "anomaly", "renewal_due"}


def client() -> TestClient:
    seed()
    return TestClient(app)


def test_every_planted_problem_is_present():
    c = client()
    types = {f["type"] for f in c.get("/findings").json()}
    assert types == PLANTED


def test_read_endpoints_answer():
    c = client()
    for path in ["/health", "/summary", "/departments", "/vendors", "/vendors/ven_zoom", "/contracts",
                 "/findings", "/findings/fnd_001", "/findings/fnd_001/graph", "/actions", "/renewals", "/ledger"]:
        r = c.get(path)
        assert r.status_code == 200, (path, r.text)


def test_vendor_matching_groups_atlassian():
    c = client()
    v = {x["id"]: x for x in c.get("/vendors").json()}
    assert v["ven_atlassian_1"]["canonical_vendor_id"] == v["ven_atlassian_2"]["canonical_vendor_id"]
    assert v["ven_zoom"]["canonical_vendor_id"] != v["ven_microsoft"]["canonical_vendor_id"]


def test_approve_then_complete_moves_saving_into_ledger():
    c = client()
    before = c.get("/ledger").json()["realised_kes"]
    a = c.post("/actions/act_001/approve", json={"approver": "Test"}).json()
    assert a["status"] == "approved"
    done = c.post("/actions/act_001/complete", json={"approver": "Test"}).json()
    after = c.get("/ledger").json()["realised_kes"]
    assert round(after - before, 2) == round(done["est_saving_kes"], 2)
    assert c.post("/actions/act_001/approve", json={}).status_code == 409


def test_reset_restores_demo_state():
    c = client()
    c.post("/actions/act_001/approve", json={})
    assert c.post("/admin/reset").status_code == 200
    statuses = {a["id"]: a["status"] for a in c.get("/actions").json()}
    assert statuses["act_001"] == "proposed"
