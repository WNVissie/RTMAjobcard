# RTMA Job Cards

Job cards and logistics service notes for RTMA cases, from live case data.
Sign in with your RTMA account (the same login as the RTMA dashboard).

- **Job Card**: search one case, edit any field, add photos and a signature, print or save as PDF.
- **Bulk Job Cards**: paste case numbers, tick the ones you want, print job cards or logistics notes (one per page).

Nothing is saved to the server.

## Setup (Netlify)

1. In Netlify: **Add new site -> Import an existing project -> GitHub -> WNVissie/RTMAjobcard**.
   Build settings come from `netlify.toml` (build `npm run build`, publish `public`).
2. **Site configuration -> Environment variables**, add:
   - `SUPABASE_URL` = `https://abgxjfeofgvimmimxvpa.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = the service role key (same value as the dashboard's site; mark it secret)
3. Deploy, then check: the site shows the login screen; after signing in, a known case number loads.

## Updating

`public/index.html` is generated from the dashboard's Job Card code:

```
npm install
npm run sync      # copies the Job Card code from ../rtma-cases-dashboard-netlify
npm run build     # checks the files
```

See `CLAUDE.md` for how it works.
