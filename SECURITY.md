# Security

This document summarizes security-related pieces that already exist in the repository. It is not a live audit of a hosted project, and it does not claim that production settings have been verified.

## Database setup order

1. In a disposable Supabase project, run `supabase/8bitspace-setup.sql` once (SQL Editor). That script creates the tables, row-level security policies, and the private `space-files` Storage bucket.
2. Then run `supabase/migrations/20260911094338_security_hardening.sql` once. It strengthens upload and Storage rules and adds request-window helpers.

**Do not rerun the initial setup script after the hardening migration.** Doing so can restore older Storage policies. Details for the SQL flow are in [`supabase/README.md`](supabase/README.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## What the codebase enforces locally

- Owner-scoped Row Level Security and write guards in the SQL scripts above.
- Frontend rejection of service-role / secret keys in `VITE_` configuration (see the Vitest suites under `tests/`).
- Optional secret scanning via `npm run security:scan` (`scripts/scan-secrets.js`).
- Static response headers in `vercel.json` (CSP, HSTS, framing, referrer, and permissions policy). Hosted activation of Auth providers, Edge Function secrets, and dashboard settings is outside this file.
- Account deletion flows documented in [`docs/oauth-account-deletion.md`](docs/oauth-account-deletion.md); browser tests mock Supabase and do not prove a live OAuth or deletion exchange.

## Local checks

From the repository root (requires Node.js 22.12+ and, for browser tests, Playwright Chromium):

```sh
npm run lint
npm test
npm run security:scan
npm audit --audit-level=high
npm run build
# optional, after `npx playwright install chromium` and a production build:
npm run test:browser
```

`npm test` includes local database policy tests where configured. A production build needs valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values in `.env.local`. Never put a service-role key in a `VITE_` variable or commit `.env.local`.

## Hosted configuration (operator responsibility)

These are not proved by the repository alone; configure them in your own Supabase / host project before production use:

- Supabase Auth URL allow-list and any Google/GitHub provider credentials.
- Deployment of the `delete-account` Edge Function and its privileged secrets.
- Matching CSP / connect targets in `vercel.json` to your real Supabase project hostnames if they differ from the placeholders already present.

If a check needs hosted configuration you do not have, say so in the pull request rather than claiming it passed.
