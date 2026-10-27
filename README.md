# 8bitSpace

A pixel-themed, folder-first cloud storage application built with React, Vite and Supabase.

## Features

- Supabase email/password authentication
- Google and GitHub sign-in through Supabase Auth (provider activation required before production use)
- Private user-owned folders and files
- Folder-first uploads enforced by the database
- Private Supabase Storage with expiring signed links
- Starred items, trash, restore and activity history
- Pixel avatar and profile preferences
- Responsive desktop and mobile interface

## Local development

1. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.

The database and Storage setup is documented in `supabase/8bitspace-setup.sql`.


## Security and automated checks

See [SECURITY.md](SECURITY.md) for a short overview of the safeguards that exist in this repository (client validation, SQL/RLS, the hardening migration, Vercel headers, and automated checks). Hosted Supabase settings still require manual activation and are not verified by this document.

Database order for a new project:

1. Run [`supabase/8bitspace-setup.sql`](supabase/8bitspace-setup.sql) once ([`supabase/README.md`](supabase/README.md)).
2. Apply [`supabase/migrations/20260911094338_security_hardening.sql`](supabase/migrations/20260911094338_security_hardening.sql) once afterward.

Do **not** rerun the original setup script after the hardening migration; it can restore older Storage policies. Contributor setup and check commands are also listed in [`CONTRIBUTING.md`](CONTRIBUTING.md).

```sh
npm test
npm run security:scan
npm run test:browser
```
