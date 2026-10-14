# RTMA Job Cards - Conversation Guide

Standalone app for RTMA job cards and logistics service notes, split out of
the RTMA Ops Dashboard (`C:\DEV\RTMA_operations\rtma-cases-dashboard-netlify`,
GitHub `WNVissie/rtma-cases-dashboard-netlify`) on 2026-10-14. GitHub
`WNVissie/RTMAjobcard`. Static page + 3 Netlify functions, no framework.

Treat the repository as business-confidential. Never paste secrets, service
role keys, customer data or raw production records into conversation or commits.

## How it fits

- **Same Supabase project as every RTMA app** (`abgxjfeofgvimmimxvpa`, RTMA_Ops).
  Logins are shared: any RTMA account can sign in (user decision, same as the
  dashboard) - no role table. Direct email/password login plus the SMART Hub
  token handoff (supabase-js defaults, `detectSessionInUrl` on - don't disable it).
  See the Route Planner repo's `docs/RTMA-ECOSYSTEM-CLAUDE.md` for the shared model.
- **Read-only.** Reads `cases`, `case_repairs`, `assets_live` and the
  `v_asset_history_events` view - all owned by the dashboard. Never write to them.
- **Login is checked on the server.** The page sends the user's access token
  (`Authorization: Bearer`, added by the `window.fetch` wrapper); every function
  calls `requireUser()` (`netlify/lib/common.js`) before reading anything.
  Job cards show store names, addresses and asset numbers - never add an
  endpoint without that check. (The dashboard's own `/api/*` functions do NOT
  check the login; don't copy that.)

## Files

- `public/index.html` - **generated, don't edit by hand.** Built by
  `npm run sync` (`scripts/sync-from-dashboard.mjs`) from
  `scripts/page.template.html` + the Job Card code copied out of the
  dashboard's `public/index.html`: the Job Card CSS, the `#jobCardTab` markup,
  the `jc*()` functions and the bulk printing functions (`displayServiceDate()`
  ... `printBulkCaseDocuments()`). The script rewrites the API paths to this
  app's functions, swaps `selectedCaseRows()` for the Bulk tab's
  `bulkSelectedRows()`, and fails if a marker it relies on has moved.
- `scripts/page.template.html` - this app's own shell: login, header, tabs,
  Bulk tab (paste up to 200 case numbers -> tick -> print), helpers
  (`escapeAttr`, `readJsonResponse`, `shortDate`), `startApp()`.
  Edit this for app-level changes, then `npm run sync`.
- `netlify/functions/jobcard-cases.js` - `?caseNumbers=a,b` (or `?caseNumber=`):
  case rows in the dashboard's row shape, barcodes from `assets_live`, SLA
  Status label as the dashboard shows it by default; returns `{cases, missing}`
  in the order given.
- `netlify/functions/jobcard-repairs.js` - `?caseNumbers=`: `case_repairs` lines
  of exactly those cases (Repairs Performed (This Case)).
- `netlify/functions/jobcard-asset-history.js` - `?asset_no=&from_date=&to_date=`:
  the asset's timeline; the page keeps earlier repair cases only.
- Links in: `?case=CAS-...` opens the Job Card tab with that case searched;
  `?cases=CAS-1,CAS-2` opens the Bulk tab with them loaded.

## User guide

- `public/user-guide.html` (2026-10-14): short staff guide, opened by the blue **User Guide**
  button in the header (`#userGuideBtn`). Self-contained, no data fetching, sample case numbers
  only (never paste real records). Outside the login like any static file - keep it free of data.
  **When the app's tabs, buttons or job card sections change, update the guide in the same change.**
  Required by `scripts/check-build.mjs`.

## Job card rules (same as the dashboard, 2026-10-13/14)

- Asset Repair History (Last 6 Months): the asset's earlier REPAIR cases only,
  one row per case, current case excluded - no logistics, no repair lines.
- Repairs Performed (This Case): `case_repairs` lines of this case only,
  fetched by case number (never from a capped list of all repairs).
- Symptoms: blank lines to fill in. Faults Found: hidden for now (still being developed).
- Print: A4 portrait. Bulk: one card per page.

## Keeping it in step with the dashboard

The dashboard still has its own Job Card tab and Bulk Job Cards (kept until
this app is live and checked - user decision; remove them in a follow-up).
Until then, a job card change made in the dashboard must be synced here:
`npm run sync`, check the page, commit. Once the dashboard's copy is
removed, `public/index.html` becomes the master - move the code into
`page.template.html` and drop the sync script.

## Deploy

- Netlify site from this repo; build `npm run build` (`scripts/check-build.mjs`),
  publish `public`, functions `netlify/functions`, `/api/*` redirect in `netlify.toml`.
- Netlify environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  (secret - Netlify only, never in a file).
- Verify after deploy: open the site signed out -> login screen; `/api/jobcard-cases?caseNumbers=X`
  in a private window -> 401; sign in, search a known case.
