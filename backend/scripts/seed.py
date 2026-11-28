"""Rebuild the demo database from scratch.

    python -m scripts.seed
"""
from sqlmodel import Session

from app.db import create_tables, drop_tables, engine
from app.matching import canonical_groups
from scripts.generate import generate
from app.engine import run_engine


def seed() -> dict[str, int]:
    drop_tables()
    create_tables()
    ds = generate()

    # vendor matching runs here, the same way it would on real ERP data
    groups = canonical_groups([(v.id, v.name) for v in ds.vendors])
    for v in ds.vendors:
        v.canonical_vendor_id, v.canonical_name = groups[v.id]

    with Session(engine) as s:
        for batch in (ds.departments, ds.vendors, ds.contracts, ds.licences, ds.assignments, ds.invoices):
            s.add_all(batch)
            s.flush()
        s.commit()
        found = run_engine(s)  # findings come from the detection engine, not from the generator
    return {
        "departments": len(ds.departments), "vendors": len(ds.vendors), "contracts": len(ds.contracts),
        "licences": len(ds.licences), "assignments": len(ds.assignments), "invoices": len(ds.invoices),
        "findings": sum(found.values()), "actions": sum(found.values()),
    }


if __name__ == "__main__":
    for table, count in seed().items():
        print(f"{table:12} {count}")
