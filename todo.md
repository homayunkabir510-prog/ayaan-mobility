# Ayaan Mobility — Production-check milestone

## Completed in this branch
- [x] Treat the attached verified ZIP as source of truth and mirror it onto a feature branch based on GitHub `main`.
- [x] Upgrade to Prisma ORM 7; validate schema/client generation and add PostgreSQL driver adapter and explicit pool settings.
- [x] Patch dependency advisories and document upstream sources; `npm audit --audit-level=high` reports 0 vulnerabilities.
- [x] Add shared PostgreSQL login throttling (10 attempts / 15 minutes, HMAC account key, no raw phone/IP header storage) and regression coverage.
- [x] Enforce bcrypt UTF-8 byte limit, scope evidence queries, and restrict duty review/correction grants.
- [x] Add required environment checks, health/readiness endpoints, staging-safe smoke script and CI workflow.
- [x] Verify from a clean lockfile install: lint, TypeScript, 22 unit tests, 20 local PostgreSQL integration tests (4 login-throttle and 16 authorization-denial), environment validation, Prisma validation, both migrations applied/status up-to-date, production build, HTTP smoke checks, dependency audit, and `git diff --check`.
- [x] Add PostgreSQL-backed denial coverage for every current protected action export in the duty-log, expense-claim, and evidence modules; test all five legacy duty exports as fail-closed.
- [x] Update README and add Bengali staging checklist/product-modernization roadmap.
- [x] Complete independent read-only security review; no blocking findings. Review did not substitute for staging acceptance.
- [x] Commit and push the reviewed feature branch; open draft PR #1 for review. Do not merge or deploy before staging evidence and explicit release authorization.

## Remaining before staging / production
- [ ] Replace the placeholder `src/actions/utils.ts:getAuthUser()` and then add authenticated tenant/ownership tests for legacy exports `submitDutyLog`, `approveDutyLog`, `overrideDutyLog`, `rejectDutyLog`, and `fetchDutyLogDetails`; they currently fail closed because the helper always returns `null`.
- [ ] Add explicit missing-profile denial and authorized success-path tests for current actions; the new suite targets cross-tenant/role denials and mocks session identity, so it does not verify real session extraction.
- [ ] Supply a dedicated staging PostgreSQL, Supabase private Storage, and hosting configuration; validate real permissions, schema baseline, upload/signed-link behavior, backups/restoration, HTTPS and deployment. None was supplied for this milestone.
- [ ] Record product decisions for holiday calendar, assignment windows/reassignment, claims, client approvals, invoice cycle, commission, payout threshold/method, and payment evidence.
- [ ] Implement and test remaining production workflows: full account onboarding, MFA/recovery, agreement versioning, complete invoice/payment, owner settlement, operational notifications and account lifecycle.
- [ ] Complete staging role-by-role acceptance, load/monitoring verification and a rollback/restore drill before any production deployment.
