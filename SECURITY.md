# Security overview

This document summarizes safeguards that exist in the tracked repository.
It does **not** claim that every setting is active on a live hosted project.
Hosted Supabase Auth providers, Edge Function secrets, and dashboard toggles still need manual activation by the project owner.

## What the repository implements

| Area | Where |
| :--- | :--- |
| Client input validation (names, IDs, upload size, avatars, public config) | [`src/lib/security.js`](src/lib/security.js) |
| Initial tables, RLS, and private Storage buckets | [`supabase/8bitspace-setup.sql`](supabase/8bitspace-setup.sql) |
| Hardening: request windows, upload guards, tighter Storage policies | [`supabase/migrations/20260911094338_security_hardening.sql`](supabase/migrations/20260911094338_security_hardening.sql) |
| HTTP security headers for Vercel deployments | [`vercel.json`](vercel.json) |
| Secret scan helper | [`scripts/scan-secrets.js`](scripts/scan-secrets.js) |
| Automated checks (Vitest / Playwright / CI) | [`tests/`](tests/), [`e2e/security.spec.js`](e2e/security.spec.js), [`.github/workflows/security.yml`](.github/workflows/security.yml) |

A longer walkthrough of the same files lives in [`STRUCTURE-AND-EXECUTION-FLOW.md`](STRUCTURE-AND-EXECUTION-FLOW.md). Contributor setup notes are in [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`supabase/README.md`](supabase/README.md).

## Database and Storage order

1. Run [`supabase/8bitspace-setup.sql`](supabase/8bitspace-setup.sql) once in the Supabase SQL Editor for a new project.
2. Apply [`supabase/migrations/20260911094338_security_hardening.sql`](supabase/migrations/20260911094338_security_hardening.sql) **once** after that initial setup.

**Do not rerun the original setup script after the hardening migration.** The setup script can restore older Storage policies and undo the migration’s tighter insert rules.

The migration is an upgrade for an already-initialized database, not a repeatedly rerunnable bootstrap script. Applying SQL in the dashboard is a hosted action; this repository only ships the scripts.

## Local automated checks

From the repository root:

```sh
npm run lint
npm test
npm run security:scan
npm run build
```

Optional browser checks (mocked Supabase responses; they do not validate a live backend):

```sh
npx playwright install chromium   # once
npm run test:browser
```

`npm test` includes Vitest coverage for local validation helpers and isolated policy tests. CI also runs `npm audit --audit-level=high`. Passing local checks does not prove that hosted Auth providers, service-role secrets, or dashboard Storage settings are configured correctly.

## Reporting issues

Please open a GitHub issue for security documentation gaps or suspected application bugs. Do not commit `.env.local`, service-role keys, or user data.
