# Ayaan Mobility

A role-based fleet operations workspace built with Next.js, PostgreSQL, Prisma ORM 7, and private Supabase Storage. This repository includes authenticated driver, operations-admin, company-client, and vehicle-owner portals.

## Current routes

- `/` — product landing page
- `/login` — phone-and-password sign-in
- `/go` — driver duty start/end, private evidence upload, expense claims, and recent duty history
- `/admin` — completed duty and expense-claim review queue
- `/fleet` — completed duty visibility scoped to the signed-in client's company
- `/owner` — vehicles scoped to the signed-in owner's profile

Every protected page and Server Action checks the current account and role on the server. Driver-entered duty submissions and claims remain pending until an authorized person reviews them. Client records are queried by the session's company ID, and evidence is stored in a private bucket and served through short-lived signed links.

## Requirements

- Node.js 22.x
- PostgreSQL
- A Supabase project with a **private** Storage bucket for duty and receipt evidence

## Local setup

1. Install dependencies and create your local environment file:

   ```bash
   npm ci
   cp .env.example .env
   ```

2. Set `DATABASE_URL`, a random `SESSION_SECRET` of at least 32 characters, and the Supabase project URL, service-role key, and private bucket name. Keep `.env` and all service-role credentials out of Git, browser code, client bundles, and screenshots.

3. Validate the schema and deploy migrations to a new, empty database:

   ```bash
   npm run env:check
   npm run db:validate
   npm run db:deploy
   ```

   **Existing database warning:** do not apply the initial migration to an existing database without first taking a backup and comparing its live schema. If it already contains this schema, baseline it using a reviewed Prisma migration plan rather than running the initial migration blindly.

4. Provision the first administrator once, using environment variables supplied through a secure local secret manager or deployment secret store:

   ```bash
   BOOTSTRAP_ADMIN_NAME='Admin name' \
   BOOTSTRAP_ADMIN_PHONE='+8801XXXXXXXXX' \
   BOOTSTRAP_ADMIN_TARGET='db.example.com:5432/ayaan_mobility' \
   BOOTSTRAP_ADMIN_PASSWORD='a-unique-16+-character-secret' \
   npm run admin:bootstrap
   ```

   Set `BOOTSTRAP_ADMIN_TARGET` to the exact hostname, port (if present), and database name from `DATABASE_URL`. The script refuses a mismatch and also refuses to run after a `SUPER_ADMIN` already exists; it hashes the password with bcrypt and creates no default account. Do not put a real password in shell history or a committed file.

5. Start the app:

   ```bash
   npm run dev
   ```

## Quality checks

The repository's CI and local release gate use:

```bash
npm run lint
npm run typecheck
npm test
npm run env:check
npm run db:validate
npm run db:deploy
npm run test:integration
npm run db:status
npm run build
npm run ci:smoke
npm audit --audit-level=high
git diff --check
```

The suite includes 22 unit tests and 20 PostgreSQL-backed integration tests: 4 login-throttle cases and 16 authorization-denial cases. The new cases cover every current protected action family: cross-driver duty start/end and claim submission; wrong-role denials for global duty correction/approval/rejection and claim review; all three evidence-upload variants; and cross-tenant signed-link denials for client, driver, and owner users. The action checks use real rows and predicates in disposable PostgreSQL; session identity, Next.js cache invalidation, and external Supabase Storage are mocked. All five legacy exports in `src/actions/dutyLog.ts` are tested to fail closed, but authenticated ownership tests are impossible until `src/actions/utils.ts:getAuthUser()` stops returning `null`. These tests do not verify real session extraction or Supabase policies. CI applies migrations to an ephemeral PostgreSQL service, builds the production bundle, and smoke-tests `/api/health`, `/api/ready`, login rendering, and the unauthenticated protected-route redirect. A passing local build does **not** prove that production database credentials, Supabase storage permissions, or the live schema are correct.

## Security and production readiness

- There is no public sign-up or default password. Use the guarded bootstrap script for the first administrator.
- Login attempts are throttled in shared PostgreSQL state: at most 10 attempts per normalized account key per 15-minute window. Only an HMAC digest is stored; raw phone numbers are not stored for throttling. The design does not trust client-supplied forwarding/IP headers. A trusted edge-level abuse control can be added when the hosting platform is selected.
- Prisma ORM 7 uses the PostgreSQL driver adapter with a bounded pool and explicit connection timeouts. Dependency overrides are documented and continuously checked; the current `npm audit --audit-level=high` result is clean. See [dependency and advisory references](docs/dependency-security-sources.md).
- Evidence lookups are constrained by driver/client/owner scope in database predicates. Duty-review and correction grants are limited to the documented role matrix. Client tenant authorization remains server-side.
- `/api/health` is a liveness check and `/api/ready` checks database readiness. Security headers include HSTS, anti-framing, MIME-sniffing, referrer, and permissions-policy controls. HSTS only protects users when production is served over HTTPS.
- The Supabase evidence bucket must be private. The service-role key bypasses Storage RLS, so uploads and signed-link creation must remain server-only.
- The current release does **not** include complete onboarding for all account types, versioned agreement administration, all client approval/invoice/payment flows, owner settlement processing, account recovery, or MFA. These require product decisions and additional implementation before financial operations or broad production use.
- No live PostgreSQL/Supabase storage configuration or hosting credentials were available for this milestone. Production schema, actual bucket permissions, deployment, DNS/TLS, backup restoration, and real-user workflows have not been verified.

Read the Bengali [production/staging readiness checklist and modernization roadmap](docs/PRODUCTION_READINESS.md) before staging. This branch is prepared for a production-readiness review; it is not a production release.

## Database deployment

`prisma/migrations/20261119000000_init/migration.sql` creates the original schema, and `prisma/migrations/20261121000000_login_rate_limit/migration.sql` adds the shared login-throttle table and index. Apply migrations with `npm run db:deploy` only after reviewing the target schema and backup/restore plan. Use a reviewed baseline for any existing database; do not run `prisma migrate dev` against production.
