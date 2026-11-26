# SpendQ backend

FastAPI + SQLModel. Neon Postgres when `DATABASE_URL` is set, SQLite otherwise. Python because the detection work (vendor matching,
anomaly detection, LLM contract extraction) lives in Python's libraries. FastAPI
publishes an OpenAPI schema, and the frontend's TypeScript types are generated from
it, so the two sides cannot drift.

## Run it

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
python -m scripts.seed          # builds demo.db
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest -q
```

The server also builds the database by itself on first start if it is empty.

## Layout

| Path | What it holds |
| --- | --- |
| `app/models.py` | Database tables. This file is the data contract. |
| `app/schemas.py` | API response shapes (what the frontend receives). |
| `app/main.py` | Endpoints. |
| `app/engine.py` | Detection engine: seven rules that produce findings and proposed actions. |
| `app/matching.py` | Vendor matching ("Atlassian Pty Ltd" = "ATLASSIAN PTY. LIMITED"). |
| `app/settings.py` | Demo date (30 Nov 2026), USD→KES rate (129), approval threshold, CORS. |
| `scripts/generate.py` | Synthetic data with seven planted problems. |
| `scripts/planted.py` | Answer key for the planted problems (used by tests). |
| `scripts/seed.py` | Rebuilds the database. |
| `scripts/export_fixtures.py` | Writes real API responses to `lib/api/mock/` for the frontend. |

## The planted problems

| # | Finding | Est. saving (KES) |
| --- | --- | --- |
| 1 | 204 of 300 Zoom seats unused in 90 days | 4,736,880 a year |
| 2 | Zoom overlaps Microsoft Teams | 2,229,120 a year |
| 3 | Jira bought twice under two vendor records | 745,749 a year |
| 4 | Salesforce billed USD 180 against a USD 165 contract, 6 months | 928,800 once |
| 5 | Liquid August invoice billed twice | 1,450,000 once |
| 6 | AWS bill 3x normal in September | to investigate |
| 7 | Zoom auto-renews 9 Jan 2027, notice due 10 Dec | deadline |

Findings come from the detection engine (`app/engine.py`): seven rules run over
the raw tables, with no knowledge of what was planted. `scripts/planted.py` is the
answer key; `tests/test_engine.py` checks the engine finds all seven with the same
savings. Rule thresholds sit at the top of `app/engine.py`.

## Endpoints

`GET /summary`, `/departments`, `/vendors`, `/vendors/{id}`, `/contracts`,
`/findings?type=&status=&department_id=`, `/findings/{id}`, `/findings/{id}/graph`,
`/actions?status=`, `/renewals?days=90`, `/ledger`, `/health`

`POST /actions/{id}/approve`, `/actions/{id}/reject`, `/actions/{id}/complete`
(body `{"approver": "Name"}`), `/admin/reset` (header `X-Admin-Token`).

An action moves proposed → approved → done. Done moves its saving into the ledger.

## For the frontend

- `lib/api/types.ts`: named types (`Finding`, `Summary`, `Graph`...).
- `lib/api/client.ts`: `api.summary()`, `api.findings()`... With
  `NEXT_PUBLIC_API_URL` unset it returns the mock JSON, so screens can be built now.
- `/findings/{id}/graph` returns `nodes` and `edges` ready for React Flow.

After changing `models.py` or `schemas.py`:

```bash
python -m scripts.export_fixtures                                   # mock JSON + openapi.json
npx openapi-typescript backend/openapi.json -o lib/api/schema.d.ts  # run from the repo root
```

## Database: Neon Postgres

The backend reads `DATABASE_URL` from the environment, or from `.env.local` / `.env`
in `backend/` or the repo root (where `neon deploy` writes it). With it unset, it uses
a local SQLite file. Tests and fixture export always use SQLite, never the real database.

Set up Neon from the repo root, in your own terminal:

```bash
npx neon@latest login
npx neon@latest init -y --org-id org-rough-salad-19330273 --project-id icy-bread-40738082 --branch production --services postgres
npx neon@latest deploy          # writes DATABASE_URL into .env.local
cd backend && uvicorn app.main:app --reload   # first start seeds Neon
```

Use Neon's pooled connection string (host contains `-pooler`). The engine checks each
connection before use, because Neon suspends idle databases. With Neon, data survives
restarts, so use `/admin/reset` to return the demo to its starting state.

## Deploy on Vercel (backend as its own project)

Vercel detects FastAPI by itself: `app/main.py` exports `app`. The backend runs as a
Vercel Function, so the database must be Neon (the filesystem is read-only).

1. Push the `backend` branch.
2. Vercel → Add New → Project → import the same repo again.
   - Root Directory: `backend`
   - Framework preset: FastAPI (auto-detected). No build command.
3. Environment variables on that project:
   - `DATABASE_URL`: Neon pooled connection string. Or add Neon from the Vercel
     Marketplace (Storage tab) and it sets the variable for you.
   - `ADMIN_TOKEN`: any secret, for `/admin/reset`.
4. Deploy, then open `https://<backend-project>.vercel.app/docs`.
5. On the frontend project, set `NEXT_PUBLIC_API_URL` to that URL and redeploy.

Seed Neon once before the first deploy, from your laptop, so the first visitor
doesn't wait for it:

```bash
cd backend
set DATABASE_URL=<neon pooled url>     # PowerShell: $env:DATABASE_URL="<url>"
python -m scripts.seed
```

Any `*.vercel.app` origin may call the API (CORS). Between judges, restore the demo:

```bash
curl -X POST https://<backend-project>.vercel.app/admin/reset -H "X-Admin-Token: <ADMIN_TOKEN>"
```

Alternatives: `render.yaml` (Render Blueprint) and the `Dockerfile` run the same app
as a normal long-running server.
