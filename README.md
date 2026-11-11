# BHŪMI 3D

**Intelligent Land Record Digitization, Validation & 3D/4D Property Identity**

A working full-stack hackathon prototype for **Smart India Hackathon 2026** (Biocreate Innovators). BHŪMI 3D connects the written land record, the cadastral map and ground evidence into one explainable evidence chain — ending in a **Parcel Trust Score** and a **human officer decision**, never an automatic certification.

> All records, owners, identifiers, geometries, scores and histories in this repository are **illustrative demo data**. This is not a government service and produces no legal title or certificate.

---

## What works

| Module | Route | Highlights |
| --- | --- | --- |
| Landing | `/` | Problem framing, solution, workflow, score explainer, demo accounts |
| Login | `/login` | Email/password plus one-click demo role buttons |
| Dashboard | `/dashboard` | KPIs, search/filters, 3 charts, cadastral map, review queue, audit feed |
| Land records | `/records` | Searchable/sortable register, create record, CSV export |
| Record details | `/records/:id` | Evidence bundle, extracted fields, validation findings, score explanation, history, audit, decisions |
| Document intake | `/documents/upload` | Upload + SHA-256, preview, browser OCR (Tesseract.js), editable fields, manual fallback, revalidation |
| Cadastral map | `/map` | Pan/zoom parcel map, overlap hatching, draw & save demo polygon |
| Validation center | `/validation` | Nine-rule catalog, run validation, findings, weighted score decomposition |
| Officer review | `/review` | Queue, evidence, findings, approve / reject / request correction / escalate, receipt |
| Property passport | `/passport/:id` | Identity, ownership, evidence, score, receipt, integrity seal, print/PDF |
| 3D viewer | `/viewer/:id` | Interactive isometric floors/units, rotate, select |
| 4D history | `/history/:id` | Year timeline, epoch geometry, area & centroid change, metadata deltas |
| Reports | `/reports` | Live CSV, GeoJSON and per-record PDF exports |
| Administration | `/admin` | Users/roles/active state, weights (must total 100%), thresholds, revalidate all, reset demo |

## Demo accounts

Password for all accounts: `demo123`

| Role | Email | Can do |
| --- | --- | --- |
| Citizen | `citizen@bhumidemo.in` | View records, passport, upload evidence |
| Surveyor | `surveyor@bhumidemo.in` | Upload/extract evidence, run validation, draw geometry |
| Revenue Officer | `officer@bhumidemo.in` | Review queue and record decisions, issue receipts |
| Administrator | `admin@bhumidemo.in` | Users, weights, thresholds, revalidation, reset |

## Suggested demo journey

1. **Sign in as Surveyor** → `/dashboard` → open **Survey 118/2** (Parbhani).
2. Note the **82/100** score, the `AREA_MISMATCH` (+6%) and `LAND_USE_MISMATCH` findings.
3. **Document intake** → upload a file from `public/samples/` (e.g. `seven-twelve.svg`) → run browser OCR or load the sample extraction → correct a field → save. Validation and the score recompute.
4. **Cadastral map** → inspect overlaps and draw a demo polygon.
5. **Validation center** → explain the four weighted components and every deduction.
6. **Sign in as Officer** → `/review` → open 118/2 → add a comment → **Approve & certify**.
7. Inspect the **SHA-256 receipt**, then open the **Property Passport**, **3D viewer** and **4D history**.
8. **Sign in as Administrator** → change a weight (keeping the total at 100%) → save → **Revalidate all records** → reset the dataset when finished.

## Trust Score model

| Component | Default weight |
| --- | --- |
| Text integrity | 30% |
| Text-to-map consistency | 30% |
| Ground-truth match | 25% |
| Change & audit history | 15% |

Routing thresholds: **≥ 90** auto-verification eligible · **60–89** officer review · **< 60** escalate / re-survey. Even an eligible record requires an authorized officer to certify it.

Reason codes: `AREA_MISMATCH`, `OWNER_SHARE_MISMATCH`, `SUBDIVISION_AREA_MISMATCH`, `DUPLICATE_SURVEY_NUMBER`, `PARCEL_OVERLAP`, `LAND_USE_MISMATCH`, `BOUNDARY_SHIFT`, `MISSING_EVIDENCE`, `LOW_OCR_CONFIDENCE`.

## Seeded records

| Survey | Score | Routing | Notable findings |
| --- | --- | --- | --- |
| 118/2 | 82 | Officer review | Area mismatch, land-use mismatch, boundary shift, missing evidence |
| 119/1 | 98 | Auto-eligible | Clean high-confidence bundle |
| 120/3 | 57 | Escalate | Parcel overlap, missing evidence |
| 121/2 | 77 | Officer review | Owner-share mismatch |
| 122/1 | 98 | Auto-eligible | Clean residential parcel |
| 123/4 | 63 | Officer review | Low OCR confidence |
| 124/2 | 99 | Verified (demo) | Seeded officer decision + receipt |

Survey **118/2** also carries 2024 → 2025 → 2026 epochs (G+1 → additional floor/units → boundary shift & extension).

## Tech stack

- **Next.js 16.3** App Router, React 19, TypeScript
- **Tailwind CSS v4** + shadcn/ui primitives
- **SQLite via `node:sqlite`** (`DatabaseSync`) — zero external database, auto-seeded on first use
- **Route Handlers** under `src/app/api/**` with an auth guard per role
- **scrypt** password hashing + opaque session cookies
- **Tesseract.js** for optional browser OCR (manual entry always available)
- **Recharts** for analytics and **custom SVG** for the map and isometric 3D viewer
- **Custom PDF writer** (`src/lib/pdf.ts`) — no external PDF dependency

## Getting started

```bash
bun install
bun run dev --port 4000
```

Open `http://localhost:4000`. The database is created and seeded automatically at `data/bhumi.sqlite` on first request. Uploaded files are stored in `uploads/`.

```bash
bun run typecheck   # TypeScript verification
```

> Do not run `next build` in the sandbox; `bun run typecheck` is the standard verification step.

## Project structure

```
src/
  app/
    (app)/               # authenticated workspace (shared sidebar shell)
      dashboard/ records/ documents/upload/ map/ validation/
      review/ passport/[id]/ viewer/[id]/ history/[id]/ reports/ admin/
    api/                 # REST route handlers (auth, records, documents, OCR,
                         # validation, trust-score, reviews, passport, history,
                         # parcels, reports, admin)
    login/ page.tsx      # public login and landing
  components/
    app/                 # shell, badges, cards, trust ring, audit timeline
    charts/ map/ viewer/ # analytics, cadastral map, isometric 3D
    ui/                  # shadcn/ui primitives
  lib/                   # db, seed, scoring, validation, geo, auth, service, pdf
public/samples/          # illustrative SVG documents for the OCR demo
```

## Important limitations (by design)

- **Illustrative data only.** No real land records or personal data should be uploaded.
- **AI/rules never certify.** Findings are decision support; the officer decision is mandatory.
- **OCR is best-effort.** Tesseract.js loads language data from a CDN; if unavailable, the workflow continues with manual field entry.
- **Geometry is synthetic.** Areas and boundaries are loosely placed, not surveyed coordinates.
- **Receipts are prototype artefacts.** They demonstrate hashing and auditability, not legal validity.
