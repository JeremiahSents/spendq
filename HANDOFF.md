# SpendIQ — handoff prompt for the remaining work

Paste everything below the line into a new Claude Code session opened in this repo.

---

You are finishing SpendIQ, an NCBA Bank hackathon spend-management dashboard in this repo (Next.js 16 App Router, React 19, Tailwind v4, TypeScript, pnpm, shadcn "base-nova" on @base-ui/react — composition uses the `render` prop, not `asChild` — hugeicons, recharts via components/ui/chart.tsx, TanStack Table v9 via components/shared/data-table.tsx). Read AGENTS.md first: this Next.js version differs from older ones; docs are in node_modules/next/dist/docs. The user runs their own dev server on http://localhost:3000. Do not start a second one. Branch: `frontend` (push to origin/frontend). Never edit app/globals.css (NCBA tokens: --primary charcoal, --brand sky blue #39B3E5, --accent/--secondary pale blue).

## How the app is built (read these before changing anything)
- lib/data/types.ts, lib/data/seed.ts — the frontend data model (the source of truth) and seed data, USD, TODAY fixed at 2026-11-26.
- lib/store/spend-store.tsx — single React-context store. Actions include approve/dismiss/reset recommendations, submitRequest/decideRequest (procurement), addResource/addVendor (create data live), resetDemo, openDrawer. Demo state is saved to localStorage (`STORAGE_KEY` "spendiq-demo-v1"): decisions, purchase requests, settings, integrations, workspace, range, and items created in the demo (`createdInDemo: true`). Reset clears it.
- lib/store/selectors.ts — all derived numbers. lib/store/create.ts — rules that flag newly created resources/vendors. lib/procurement/engine.ts — deterministic procurement engine (demo: $500/mo request → $180/mo, $320/mo avoided, $3,840/yr, 64%).
- lib/api/* — the teammate's FastAPI backend contract (branch `origin/backend`, folder backend/). lib/api/adapter.ts converts backend contracts → Vendors (ids `be-<contractId>`) and findings+actions → Recommendations (`actionId` set), KES→USD at 129. lib/api/backend-data.ts loads the exported fixtures in lib/api/mock, or live data when NEXT_PUBLIC_API_URL is set; approve/dismiss then also POST to the API (lib/store/use-rec-actions.ts).
- Pages: app/(dashboard)/{page,cloud,vendors,procurement,recommendations,integrations,settings}. Shell: components/layout/*. Drawers: components/drawers/* (opened via openDrawer). Copilot: components/copilot/*.

## Remaining work, in order
1. Create-data forms (may be partly done by a previous agent — check what exists first):
   - components/forms/add-resource-dialog.tsx → `AddResourceDialog({ open, onOpenChange })`: shadcn Dialog form for a cloud resource (name, provider with BrandLogo, type, environment, region, size, department, vCPU, memory GB, "has metrics" switch, avg CPU %, avg memory %, monthly cost). Inline validation, a live "rule preview" using RESOURCE_RULES from lib/store/create.ts, "Load example" buttons ("Idle dev box": dc-loadtest-runner-03, AWS EC2 c6i.4xlarge, Development, af-south-1, Digital Channels, 16 vCPU, 32 GB, CPU 2, memory 6, $496; "Oversized prod API": cbs-statements-api-prod, Azure App Service P3v3, Production, South Africa North, Core Banking, 8 vCPU, 32 GB, CPU 18, memory 27, $620). Submit → `addResource(input)` → toast "Saved in this browser" with a View action → open the resource drawer.
   - components/forms/add-vendor-dialog.tsx → `AddVendorDialog({ open, onOpenChange })` (components/vendors/vendors-view.tsx ALREADY imports this exact path and export, so typecheck fails until it exists). Fields: name, brand (BrandLogo; "Other" → "SpendIQ"), category, plan, department, unit seats/hosts, unit price $/mo, purchased, active (≤ purchased), term months, start date, renewal date, auto-renew, notice days, owner. Live preview of monthly/annual cost, utilization and whether the <80% license rule fires. Examples: "Underused Miro" (Miro Enterprise, Collaboration, Enterprise, Digital Channels, seats, $16, 250 purchased, 112 active, 12 mo, 2026-02-01 → 2027-02-01, auto-renew, 30 days, Head of Product) and "Healthy Postman" (Postman Enterprise, Developer tools, Enterprise, Cloud Platform, seats, $49, 60/57, 12 mo, 2026-05-01 → 2027-05-01, auto-renew, 30 days, Head of Platform Engineering). Submit → `addVendor(input)` → toast + View → vendor drawer.
   - components/forms/add-data-menu.tsx → `AddDataMenu()`: "Add data" dropdown (Cloud resource, Vendor contract, Purchase request → /procurement?new=1; make components/procurement/procurement-view.tsx open its NewRequestDialog for that query param, then clear it). Put it in the Overview header actions (components/overview/overview-page.tsx) and an "Add resource" button in the Cloud page header (app/(dashboard)/cloud/page.tsx). Show an "Added in demo" tag next to created resource names in components/cloud/resource-inventory.tsx (vendors already have it).
2. Verify: `npx tsc --noEmit -p .`, `npx eslint app components lib`, `pnpm build` — all must pass.
3. Demo click-through on http://localhost:3000 (light and dark):
   - Settings → Reset demo, then Overview loads with the KPIs.
   - Procurement → New purchase request → Load demo request → submit → the request drawer shows the recommended $180/mo, $320/mo avoided, $3,840/yr, 64% → Approve optimized plan → the Avoided card rises by $320 and Overview "Approved projected" rises by $320/mo.
   - Recommendations → "Contracts & invoices" pill shows the 7 SpendQ findings; open Zoom's (204 unused seats, $3,060/mo) and approve it; it moves to the Savings ledger.
   - Add data → load "Idle dev box" → submit → a new Idle recommendation appears and potential savings rise by $496/mo. Refresh: it is still there. Reset demo: it is gone.
4. Commit on `frontend` with a clear message and push to origin/frontend.

## Known follow-ups (only if time remains)
- Mobile: bottom dock nav on phones (Overview, Cloud, Vendors, Recommendations with pending badge, More sheet), compact header, DataTable `renderMobileRow` stacked cards for every table, full-width drawers and dialogs, no sideways scroll at 375px.
- Vendor type could get an explicit `billing: "usage"` field instead of detecting usage contracts by purchased = active = 1 (components/vendors/vendor-status.tsx `isUsageBased`).
- Monorepo (apps/web + apps/api + packages/ui) was discussed and postponed until after the demo.
