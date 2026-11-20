# Ayaan Mobility — Production-check milestone

## Completed in this branch
- [x] Treat the attached verified ZIP as source of truth and mirror it onto a feature branch based on GitHub `main`.
- [x] Upgrade to Prisma ORM 7; validate schema/client generation and add PostgreSQL driver adapter and explicit pool settings.
- [x] Patch dependency advisories and document upstream sources; `npm audit --audit-level=high` reports 0 vulnerabilities.
- [x] Add shared PostgreSQL login throttling (10 attempts / 15 minutes, HMAC account key, no raw phone/IP header storage) and regression coverage.
- [x] Enforce bcrypt UTF-8 byte limit, scope evidence queries, and restrict duty review/correction grants.
- [x] Add required environment checks, health/readiness endpoints, staging-safe smoke script and CI workflow.
- [x] Verify from a clean lockfile install: lint, TypeScript, 22 unit tests, 4 local PostgreSQL login-throttle integration tests, environment validation, Prisma validation, both migrations applied/status up-to-date, production build, HTTP smoke checks, dependency audit, and `git diff --check`.
- [x] Update README and add Bengali staging checklist/product-modernization roadmap.
- [x] Complete independent read-only security review; no blocking findings. Review did not substitute for staging acceptance.

## Remaining before staging / production
- [ ] Add dedicated Server Action denial tests for wrong-role, missing-profile and cross-tenant evidence IDs; the current PostgreSQL integration suite covers the login limiter only.
- [ ] Supply a dedicated staging PostgreSQL, Supabase private Storage, and hosting configuration; validate real permissions, schema baseline, upload/signed-link behavior, backups/restoration, HTTPS and deployment. None was supplied for this milestone.
- [ ] Record product decisions for holiday calendar, assignment windows/reassignment, claims, client approvals, invoice cycle, commission, payout threshold/method, and payment evidence.
- [ ] Implement and test remaining production workflows: full account onboarding, MFA/recovery, agreement versioning, complete invoice/payment, owner settlement, operational notifications and account lifecycle.
- [ ] Complete staging role-by-role acceptance, load/monitoring verification and a rollback/restore drill before any production deployment.
- [ ] Commit and push the reviewed feature branch and open a review PR; do not merge or deploy without staging evidence and explicit release authorization.
