# Contributing to 8bitSpace

Thanks for helping improve 8bitSpace. For a first contribution, pick one small issue, comment that you would like to work on it, and discuss any change to authentication, database policies, or uploads before implementing it.

## Local setup

1. Install Node.js **22.12.0 or newer** and npm. Clone the repository and open its root directory.
2. Install the versions in `package-lock.json` with `npm ci` (`npm install` also works when intentionally updating dependencies).
3. Copy `.env.example` to `.env.local` and set:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
   ```

   Get both values from your own Supabase project. The publishable/anon key is intended for the browser; **never** put a service-role key or other secret in a `VITE_` variable or commit `.env.local`.

4. Prepare a disposable Supabase project for development. In its **SQL Editor**, run the complete `supabase/8bitspace-setup.sql` script once, then run `supabase/migrations/20260911094338_security_hardening.sql` once. The first script creates the tables, row-level security policies, and private Storage buckets. The migration strengthens upload and Storage rules. **Do not rerun the initial setup after the migration**; it can restore older Storage policies. See `supabase/README.md` for the repository's setup notes.
5. In Supabase **Authentication → URL Configuration**, allow `http://127.0.0.1:5173` as a redirect URL. Email/password authentication can be used without configuring OAuth providers. Google and GitHub sign-in require their own provider configuration; the repository does not contain those provider credentials.
6. Start the app with `npm run dev` and open the local URL printed by Vite (normally `http://127.0.0.1:5173`).

The `delete-account` Edge Function has its own deployment and privileged server configuration. It is not started by `npm run dev`; a local frontend alone cannot exercise that live deletion flow. Do not place `SUPABASE_SERVICE_ROLE_KEY` in frontend environment files. Coordinate Edge Function or database changes with the maintainer before testing them against any shared project.

## Checks

Run these from the repository root before opening a pull request:

```sh
npm run lint
npm test
npm run security:scan
npm run build
```

`npm test` runs the Vitest suite, including local database policy tests. The production build requires valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values in `.env.local`. For browser tests, first run `npm run build`, install Playwright Chromium if needed with `npx playwright install chromium`, then run `npm run test:browser`. Playwright starts a Vite preview on `127.0.0.1:4173`; its current scenarios mock Supabase responses, so they do not validate a live Supabase or OAuth setup. CI also runs `npm audit --audit-level=high`.

## Contribution workflow

1. Check open issues, choose a focused task, and comment before starting. For a larger behavior or schema change, agree on the approach with the maintainer first.
2. Create a branch from the latest `main`. Make the smallest change that solves the issue, and add or update meaningful tests for changed behavior.
3. Keep `.env.local`, service keys, test account credentials, and user data out of commits. Preserve ownership checks, row-level security, upload limits, and safe error handling.
4. Run the relevant checks above. Test affected UI at desktop and mobile widths when applicable.
5. Open a pull request against `main`. Link the issue, explain the change and how you tested it, and include screenshots for visible UI changes. Respond to review feedback and keep the pull request focused on one issue.

If a check needs hosted configuration you do not have, say exactly which check could not run in the pull request rather than claiming it passed.
