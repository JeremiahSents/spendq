"""Write real API responses to JSON files for the frontend to build against,
plus the OpenAPI schema the TypeScript types are generated from.

    python -m scripts.export_fixtures            # writes ../lib/api/mock/*.json and openapi.json
"""
import json
import os
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./fixtures.db"  # fixtures always come from a throwaway database

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from scripts.seed import seed  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else BACKEND.parent / "lib" / "api" / "mock"

ENDPOINTS = {
    "summary": "/summary",
    "departments": "/departments",
    "vendors": "/vendors",
    "vendor-zoom": "/vendors/ven_zoom",
    "contracts": "/contracts",
    "findings": "/findings",
    "finding-fnd_001": "/findings/fnd_001",
    "finding-fnd_004": "/findings/fnd_004",
    "finding-fnd_006": "/findings/fnd_006",
    "graph-fnd_001": "/findings/fnd_001/graph",
    "graph-fnd_003": "/findings/fnd_003/graph",
    "actions": "/actions",
    "renewals": "/renewals",
    "ledger": "/ledger",
}


def main() -> None:
    seed()
    client = TestClient(app)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, path in ENDPOINTS.items():
        r = client.get(path)
        r.raise_for_status()
        (OUT / f"{name}.json").write_text(json.dumps(r.json(), indent=2) + "\n", encoding="utf-8")
        print(f"{path:28} -> {OUT / (name + '.json')}")
    # a ledger with entries, so the ledger screen has something to show
    for action_id in ("act_004", "act_005"):
        client.post(f"/actions/{action_id}/approve", json={"approver": "Accounts Payable Manager"}).raise_for_status()
        client.post(f"/actions/{action_id}/complete", json={"approver": "Accounts Payable Manager"}).raise_for_status()
    (OUT / "ledger-with-entries.json").write_text(json.dumps(client.get("/ledger").json(), indent=2) + "\n", encoding="utf-8")
    print(f"{'/ledger (after 2 approvals)':28} -> {OUT / 'ledger-with-entries.json'}")
    (BACKEND / "openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    print(f"{'openapi':28} -> {BACKEND / 'openapi.json'}")


if __name__ == "__main__":
    main()
