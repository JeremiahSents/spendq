"""Synthetic NCBA-style spend data with planted problems.

Deterministic: the same seed always gives the same data, so the demo never surprises us.
Every number here is invented for the demo. Vendor names are real companies so the
demo reads realistically; their prices are made up.

Planted problems (the detection engine must find all of them; see tests/):
  1. Zoom: 300 seats paid, 96 people active in the last 90 days        -> unused_licence
  2. Zoom overlaps Microsoft Teams (inside M365) for video calls        -> vendor_overlap
  3. Jira bought twice: IT and Digital Banking, under two vendor records -> duplicate_subscription
  4. Salesforce billed USD 180/seat since June; contract says USD 165   -> overbilling
  5. Liquid backup-link invoice for August paid twice                   -> duplicate_invoice
  6. AWS bill tripled in September 2026                                 -> anomaly
  7. Zoom auto-renews on 9 Jan 2027; notice deadline 10 Dec 2026        -> renewal_due
"""
import random
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.models import (
    BillingCycle, Contract, Currency, Department, Invoice, Licence, LicenceAssignment, Vendor,
)
from app.settings import ACTIVE_WINDOW_DAYS, DEMO_TODAY

SEED = 42

# Invoices cover the 12 months before DEMO_TODAY: Dec 2025 .. Nov 2026.
INVOICE_MONTHS = [date(2025, 12, 1)] + [date(2026, m, 1) for m in range(1, 12)]


@dataclass
class Dataset:
    departments: list[Department] = field(default_factory=list)
    vendors: list[Vendor] = field(default_factory=list)
    contracts: list[Contract] = field(default_factory=list)
    invoices: list[Invoice] = field(default_factory=list)
    licences: list[Licence] = field(default_factory=list)
    assignments: list[LicenceAssignment] = field(default_factory=list)


DEPARTMENTS = [
    # id, name, country, cost centre, headcount
    ("dep_it_ke", "IT", "KE", "CC-1100", 220),
    ("dep_digital_ke", "Digital Banking", "KE", "CC-1200", 260),
    ("dep_corporate_ke", "Corporate Banking", "KE", "CC-1300", 180),
    ("dep_retail_ke", "Retail Banking", "KE", "CC-1400", 700),
    ("dep_marketing_ke", "Marketing", "KE", "CC-1500", 90),
    ("dep_finance_ke", "Finance", "KE", "CC-1600", 110),
    ("dep_legal_ke", "Legal & Compliance", "KE", "CC-1700", 60),
    ("dep_admin_ke", "Admin & Facilities", "KE", "CC-1800", 120),
    ("dep_it_ug", "IT (Uganda)", "UG", "CC-2100", 190),
    ("dep_it_tz", "IT (Tanzania)", "TZ", "CC-3100", 150),
]

VENDORS = [
    # id, name exactly as in the vendor master, category, billing country
    ("ven_microsoft", "Microsoft Kenya Ltd", "software", "KE"),
    ("ven_microsoft_ie", "Microsoft Ireland Operations Ltd", "cloud", "IE"),
    ("ven_zoom", "Zoom Video Communications Inc", "software", "US"),
    ("ven_atlassian_1", "Atlassian Pty Ltd", "software", "AU"),
    ("ven_atlassian_2", "ATLASSIAN PTY. LIMITED", "software", "AU"),  # same company, second record
    ("ven_salesforce", "Salesforce.com EMEA Ltd", "software", "IE"),
    ("ven_adobe", "Adobe Systems Software Ireland Ltd", "software", "IE"),
    ("ven_docusign", "DocuSign International (EMEA) Ltd", "software", "IE"),
    ("ven_servicenow", "ServiceNow Nederland BV", "software", "NL"),
    ("ven_aws", "Amazon Web Services EMEA SARL", "cloud", "LU"),
    ("ven_datadog", "Datadog Inc", "software", "US"),
    ("ven_crowdstrike", "CrowdStrike UK Ltd", "security", "GB"),
    ("ven_oracle", "Oracle East Central Africa Ltd", "software", "KE"),
    ("ven_safaricom", "Safaricom PLC", "connectivity", "KE"),
    ("ven_liquid", "Liquid Intelligent Technologies Kenya Ltd", "connectivity", "KE"),
    ("ven_deloitte", "Deloitte & Touche LLP", "consulting", "KE"),
    ("ven_g4s", "G4S Kenya Ltd", "security_services", "KE"),
    ("ven_tbc", "Text Book Centre Ltd", "office_supplies", "KE"),
    ("ven_mtn_ug", "MTN Uganda Ltd", "connectivity", "UG"),
    ("ven_vodacom_tz", "Vodacom Tanzania PLC", "connectivity", "TZ"),
]

D = date.fromisoformat
CONTRACTS = [
    # id, vendor, department, title, service_category, capabilities, billing, unit, unit_price, currency, qty, start, end, auto_renew, notice_days
    ("con_m365_ke", "ven_microsoft", "dep_it_ke", "Microsoft 365 E3 enterprise agreement", "productivity_suite",
     ["email", "documents", "chat", "video_conferencing"], "monthly", "seat/month", 36.0, "USD", 1700, D("2025-07-01"), D("2028-06-30"), False, 90),
    ("con_m365_ug", "ven_microsoft", "dep_it_ug", "Microsoft 365 E3 (Uganda)", "productivity_suite",
     ["email", "documents", "chat", "video_conferencing"], "monthly", "seat/month", 36.0, "USD", 190, D("2025-07-01"), D("2028-06-30"), False, 90),
    ("con_m365_tz", "ven_microsoft", "dep_it_tz", "Microsoft 365 E3 (Tanzania)", "productivity_suite",
     ["email", "documents", "chat", "video_conferencing"], "monthly", "seat/month", 36.0, "USD", 150, D("2025-07-01"), D("2028-06-30"), False, 90),
    ("con_azure", "ven_microsoft_ie", "dep_it_ke", "Azure consumption", "cloud_infrastructure",
     ["compute", "storage"], "usage", "month", 24000.0, "USD", 1, D("2025-01-01"), D("2027-12-31"), False, 60),
    ("con_zoom_mkt", "ven_zoom", "dep_marketing_ke", "Zoom Business licences", "video_conferencing",
     ["video_conferencing", "webinars"], "monthly", "seat/month", 15.0, "USD", 300, D("2025-01-10"), D("2027-01-09"), True, 30),
    ("con_jira_it", "ven_atlassian_1", "dep_it_ke", "Jira Software Cloud Standard", "project_tracking",
     ["issue_tracking", "agile_boards"], "monthly", "seat/month", 7.75, "USD", 400, D("2025-04-01"), D("2027-03-31"), True, 30),
    ("con_jira_dig", "ven_atlassian_2", "dep_digital_ke", "Jira Software Cloud (team plan)", "project_tracking",
     ["issue_tracking", "agile_boards"], "monthly", "seat/month", 8.60, "USD", 120, D("2025-09-01"), D("2027-08-31"), True, 30),
    ("con_sfdc", "ven_salesforce", "dep_corporate_ke", "Sales Cloud Enterprise", "crm",
     ["crm", "pipeline"], "monthly", "seat/month", 165.0, "USD", 80, D("2025-06-01"), D("2028-05-31"), False, 90),
    ("con_adobe", "ven_adobe", "dep_marketing_ke", "Creative Cloud for teams", "design_tools",
     ["design"], "monthly", "seat/month", 85.0, "USD", 40, D("2025-03-01"), D("2027-02-28"), True, 30),
    ("con_docusign", "ven_docusign", "dep_legal_ke", "DocuSign Business Pro", "e_signature",
     ["e_signature"], "monthly", "seat/month", 40.0, "USD", 60, D("2024-02-15"), D("2027-02-14"), True, 60),
    ("con_servicenow", "ven_servicenow", "dep_it_ke", "ServiceNow ITSM", "it_service_management",
     ["ticketing"], "annual", "year", 210000.0, "USD", 1, D("2025-10-01"), D("2028-09-30"), False, 120),
    ("con_aws", "ven_aws", "dep_digital_ke", "AWS consumption (digital lending platform)", "cloud_infrastructure",
     ["compute", "storage"], "usage", "month", 20000.0, "USD", 1, D("2025-01-01"), D("2027-12-31"), False, 60),
    ("con_datadog", "ven_datadog", "dep_it_ke", "Datadog infrastructure monitoring", "monitoring",
     ["monitoring"], "monthly", "host/month", 23.0, "USD", 180, D("2025-05-01"), D("2027-04-30"), True, 30),
    ("con_crowdstrike", "ven_crowdstrike", "dep_it_ke", "Falcon endpoint protection", "endpoint_security",
     ["endpoint_security"], "annual", "year", 96000.0, "USD", 1, D("2025-12-01"), D("2028-11-30"), False, 90),
    ("con_oracle", "ven_oracle", "dep_it_ke", "Oracle Database support", "database_support",
     ["database"], "annual", "year", 18500000.0, "KES", 1, D("2024-07-01"), D("2027-06-30"), True, 90),
    ("con_safaricom", "ven_safaricom", "dep_it_ke", "Branch connectivity (primary links)", "connectivity",
     ["wan"], "monthly", "month", 2350000.0, "KES", 1, D("2024-01-01"), D("2027-12-31"), True, 90),
    ("con_liquid", "ven_liquid", "dep_it_ke", "Branch connectivity (backup links)", "connectivity",
     ["wan"], "monthly", "month", 1450000.0, "KES", 1, D("2024-06-01"), D("2027-05-31"), True, 90),
    ("con_deloitte", "ven_deloitte", "dep_finance_ke", "IFRS 9 model review", "advisory",
     ["advisory"], "one_off", "engagement", 7800000.0, "KES", 1, D("2026-02-01"), D("2026-07-31"), False, 0),
    ("con_g4s", "ven_g4s", "dep_admin_ke", "Branch guarding services", "security_services",
     ["guarding"], "monthly", "month", 4100000.0, "KES", 1, D("2025-01-01"), D("2027-12-31"), True, 90),
    ("con_mtn_ug", "ven_mtn_ug", "dep_it_ug", "Branch connectivity (Uganda)", "connectivity",
     ["wan"], "monthly", "month", 9800.0, "USD", 1, D("2025-01-01"), D("2027-12-31"), True, 60),
    ("con_vodacom_tz", "ven_vodacom_tz", "dep_it_tz", "Branch connectivity (Tanzania)", "connectivity",
     ["wan"], "monthly", "month", 8700.0, "USD", 1, D("2025-01-01"), D("2027-12-31"), True, 60),
]

# Licence contracts: seats assigned and share of assigned users active in the window.
LICENCES = {
    "con_m365_ke": ("Microsoft 365 E3", 1672, 0.96),
    "con_m365_ug": ("Microsoft 365 E3", 186, 0.95),
    "con_m365_tz": ("Microsoft 365 E3", 147, 0.95),
    "con_zoom_mkt": ("Zoom Business", 262, None),       # planted: exactly ZOOM_ACTIVE active
    "con_jira_it": ("Jira Software", 388, 0.93),
    "con_jira_dig": ("Jira Software", 116, 0.92),
    "con_sfdc": ("Sales Cloud Enterprise", 78, 0.95),
    "con_adobe": ("Creative Cloud", 37, 0.90),
    "con_docusign": ("DocuSign Business Pro", 55, 0.90),
}
ZOOM_ACTIVE = 96
JIRA_SHARED_USERS = 45            # people holding a seat on both Jira contracts
SFDC_OVERBILL_FROM = date(2026, 6, 1)
SFDC_OVERBILL_PRICE = 180.0
AWS_SPIKE_MONTH = date(2026, 9, 1)
AWS_SPIKE_AMOUNT = 61400.0
LIQUID_DUPLICATE_MONTH = date(2026, 8, 1)

ETIMS_VENDOR_COUNTRY = "KE"  # only Kenyan billing entities issue eTIMS invoices


def generate(seed: int = SEED) -> Dataset:
    rng = random.Random(seed)
    ds = Dataset()

    # departments and an employee pool per department
    employees: dict[str, list[str]] = {}
    n = 0
    for dep_id, name, country, cc, headcount in DEPARTMENTS:
        ds.departments.append(Department(id=dep_id, name=name, country=country, cost_centre=cc))
        employees[dep_id] = [f"emp_{n + i + 1:04d}" for i in range(headcount)]
        n += headcount

    ds.vendors = [Vendor(id=v, name=nm, category=cat, country=c) for v, nm, cat, c in VENDORS]
    vendor_country = {v.id: v.country for v in ds.vendors}

    for (cid, vid, dep, title, cat, caps, bill, unit, price, cur, qty, start, end, auto, notice) in CONTRACTS:
        ds.contracts.append(Contract(
            id=cid, vendor_id=vid, department_id=dep, title=title, service_category=cat, capabilities=caps,
            billing_cycle=BillingCycle(bill), unit=unit, unit_price=price, currency=Currency(cur), quantity=qty,
            start_date=start, end_date=end, auto_renew=auto, notice_days=notice,
            pdf_path=f"contracts/{cid}.pdf" if cid in ("con_zoom_mkt", "con_sfdc", "con_jira_it", "con_jira_dig", "con_liquid") else None,
        ))
    contracts = {c.id: c for c in ds.contracts}

    _licences(ds, contracts, employees, rng)
    _invoices(ds, contracts, vendor_country, rng)
    return ds


def _login_date(rng: random.Random, active: bool) -> date | None:
    if active:
        return DEMO_TODAY - timedelta(days=rng.randint(0, ACTIVE_WINDOW_DAYS - 1))
    if rng.random() < 0.3:
        return None  # never signed in
    return DEMO_TODAY - timedelta(days=rng.randint(ACTIVE_WINDOW_DAYS + 1, 400))


def _licences(ds: Dataset, contracts: dict[str, Contract], employees: dict[str, list[str]], rng: random.Random) -> None:
    ke_staff = [e for dep, staff in employees.items() if dep.endswith("_ke") for e in staff]
    digital = employees["dep_digital_ke"]
    jira_it_holders: list[str] = []

    for cid, (product, assigned, active_share) in LICENCES.items():
        contract = contracts[cid]
        lic = Licence(id=f"lic_{cid.removeprefix('con_')}", contract_id=cid, product_name=product, seats_paid=contract.quantity)
        ds.licences.append(lic)

        if cid == "con_m365_ug":
            people = rng.sample(employees["dep_it_ug"], assigned) if assigned <= 190 else []
        elif cid == "con_m365_tz":
            people = rng.sample(employees["dep_it_tz"], assigned)
        elif cid == "con_jira_it":
            # IT staff plus a slice of Digital Banking, so the overlap with the Digital contract is real
            people = employees["dep_it_ke"] + rng.sample(digital, assigned - len(employees["dep_it_ke"]))
            jira_it_holders = [p for p in people if p in set(digital)]
        elif cid == "con_jira_dig":
            shared = jira_it_holders[:JIRA_SHARED_USERS]
            others = [p for p in digital if p not in set(jira_it_holders)]
            people = shared + rng.sample(others, assigned - len(shared))
        else:
            people = rng.sample(ke_staff, assigned)

        if cid == "con_zoom_mkt":
            active_flags = [True] * ZOOM_ACTIVE + [False] * (assigned - ZOOM_ACTIVE)
            rng.shuffle(active_flags)
        else:
            active_flags = [rng.random() < active_share for _ in people]

        for person, active in zip(people, active_flags):
            assigned_on = contract.start_date + timedelta(days=rng.randint(0, 60))
            ds.assignments.append(LicenceAssignment(
                licence_id=lic.id, employee_id=person, assigned_date=assigned_on,
                last_login_date=_login_date(rng, active),
            ))


def _invoice(ds, rng, contract, vendor_country, inv_date, description, qty, unit_price, seq, number=None):
    vid = contract.vendor_id
    prefix = vid.removeprefix("ven_").split("_")[0].upper()[:4]
    ds.invoices.append(Invoice(
        id=f"inv_{len(ds.invoices) + 1:04d}",
        invoice_number=number or f"{prefix}-{inv_date:%y%m}-{seq:04d}",
        vendor_id=vid, contract_id=contract.id, department_id=contract.department_id,
        invoice_date=inv_date, description=description, quantity=qty, unit_price=round(unit_price, 2),
        amount=round(qty * unit_price, 2), currency=contract.currency,
        etims_number=f"ETIMS-{rng.randint(10**9, 10**10 - 1)}" if vendor_country[vid] == ETIMS_VENDOR_COUNTRY else None,
    ))


def _invoices(ds: Dataset, contracts: dict[str, Contract], vendor_country: dict[str, str], rng: random.Random) -> None:
    seq = 1000
    for month in INVOICE_MONTHS:
        inv_date = month.replace(day=5)
        for c in ds.contracts:
            if not (c.start_date <= inv_date <= c.end_date):
                continue
            seq += 1
            label = f"{c.title}, {month:%B %Y}"
            if c.billing_cycle == BillingCycle.monthly:
                price = c.unit_price
                if c.id == "con_sfdc" and month >= SFDC_OVERBILL_FROM:
                    price = SFDC_OVERBILL_PRICE  # planted overbilling
                _invoice(ds, rng, c, vendor_country, inv_date, label, c.quantity, price, seq)
                if c.id == "con_liquid" and month == LIQUID_DUPLICATE_MONTH:
                    seq += 1  # planted duplicate: same bill, new number, 3 days later
                    _invoice(ds, rng, c, vendor_country, inv_date + timedelta(days=3), label, c.quantity, price, seq)
            elif c.billing_cycle == BillingCycle.usage:
                amount = c.unit_price * rng.uniform(0.92, 1.08)
                if c.id == "con_aws" and month == AWS_SPIKE_MONTH:
                    amount = AWS_SPIKE_AMOUNT  # planted anomaly
                _invoice(ds, rng, c, vendor_country, inv_date, f"{label} (usage)", 1, amount, seq)
            elif c.billing_cycle == BillingCycle.annual and month.month == c.start_date.month:
                _invoice(ds, rng, c, vendor_country, c.start_date.replace(year=month.year),
                         f"{c.title}, annual fee {month.year}-{month.year + 1}", 1, c.unit_price, seq)

    # one-off engagement billed in three milestones
    deloitte = contracts["con_deloitte"]
    for i, m in enumerate([date(2026, 3, 20), date(2026, 5, 20), date(2026, 7, 20)], start=1):
        seq += 1
        _invoice(ds, rng, deloitte, vendor_country, m, f"{deloitte.title}, milestone {i} of 3", 1, deloitte.unit_price / 3, seq)

    # off-contract spend: office supplies with no contract behind them
    for month in INVOICE_MONTHS:
        seq += 1
        amount = round(rng.uniform(180000, 260000), -2)
        ds.invoices.append(Invoice(
            id=f"inv_{len(ds.invoices) + 1:04d}", invoice_number=f"TBC-{month:%y%m}-{seq:04d}",
            vendor_id="ven_tbc", contract_id=None, department_id="dep_admin_ke",
            invoice_date=month.replace(day=12), description=f"Office supplies, {month:%B %Y}",
            quantity=1, unit_price=amount, amount=amount, currency=Currency.KES,
            etims_number=f"ETIMS-{rng.randint(10**9, 10**10 - 1)}",
        ))
