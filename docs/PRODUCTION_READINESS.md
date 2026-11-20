# Ayaan Mobility: production-check readiness ও আধুনিকীকরণ পরিকল্পনা

## এখনকার অবস্থা

প্রকল্পটি production-check পর্যায়ে নেওয়ার জন্য branch-এ প্রস্তুত; এটি production launch নয়। Prisma ORM 7-এ migration, database-backed login throttling, server-side access-scope tightening, health/readiness endpoint এবং CI smoke gate যোগ হয়েছে। পরীক্ষা করা হয়েছে কেবল disposable local PostgreSQL-এ—কোনো live database, Supabase Storage বা hosting account-এ নয়।

বর্তমান যাচাই: lint ও TypeScript পাস; ২২টি unit test এবং PostgreSQL-এ ২০টি integration test পাস (৪টি login-throttle, ১৬টি Server Action authorization denial); Prisma schema valid, দুই migration deploy ও status up-to-date; production build এবং health, readiness, login, protected-route smoke checks পাস; `npm audit --audit-level=high`-এ ০ vulnerability।

নতুন authorization suite-এ বর্তমান protected action-গুলোর duty, expense-claim এবং evidence পরিবার পরীক্ষা করা হয়েছে: অন্য driver-এর vehicle/duty-তে duty শুরু/শেষ ও claim submission প্রত্যাখ্যান, global duty correction/approval/rejection এবং claim review-এ ভুল role প্রত্যাখ্যান, upload-এর তিন variant-এ foreign record denial, এবং client/driver/owner-এর cross-tenant signed-link denial। প্রতিটি test disposable PostgreSQL-এর আসল fixture ও query ব্যবহার করে; session identity, Next.js cache invalidation এবং বাইরের Supabase Storage adapter mock করা। `src/actions/dutyLog.ts`-এর পাঁচটি legacy export fail-closed থাকে—এগুলো authenticated cross-tenant ভাবে পরীক্ষা করা সম্ভব নয়, কারণ `src/actions/utils.ts:getAuthUser()` এখনো সবসময় `null` ফেরায়।

## Staging-এ যাওয়ার আগে

1. **আলাদা staging database দিন।** বিদ্যমান data থাকলে backup নিন, live schema ও Prisma migration history মিলিয়ে দেখুন, প্রয়োজনে reviewed baseline করুন; তারপর staging-এ `npm run db:deploy`, `npm run db:status` ও integration/smoke checks চালান। disposable local test database-কে staging বা production ভাববেন না।
2. **Secrets ও access প্রস্তুত করুন।** staging-এর জন্য আলাদা `DATABASE_URL`, শক্তিশালী `SESSION_SECRET`, Supabase URL, service-role key ও bucket name নিরাপদ secret store-এ দিন; service-role key কখনো client bundle-এ নয়। প্রথম SUPER_ADMIN শুধু empty staging-এ guarded bootstrap দিয়ে তৈরি করুন।
3. **Storage নিজে যাচাই করুন।** bucket private কি না, upload/delete policy, signed URL expiry, driver/client/owner-এর cross-tenant denial, file size/type limits ও evidence retention যাচাই করুন। বর্তমান local smoke test Supabase permission যাচাই করে না।
4. **ব্যবসার নিয়ম লিখিতভাবে স্থির করুন।** শুক্রবার/সরকারি ছুটির ক্যালেন্ডার, claims কে অনুমোদন করবে, assignment/reassignment window, client approval, invoice period, commission, payout minimum ও payment evidence—এসব সিদ্ধান্ত ছাড়া billing/settlement চালু করবেন না। কোনো প্রোডাক্ট সিদ্ধান্ত এই milestone-এ ধরে নেওয়া হয়নি।
5. **রিলিজ নিরাপত্তা নিশ্চিত করুন।** HTTPS/domain, production secret isolation, backup এবং restore drill, monitoring/alert, initial admin MFA/strong authentication, incident owner ও rollback plan নিশ্চিত করে staging-এ driver, operations, client ও owner—প্রতিটি role-এর positive/negative workflow পরীক্ষা করুন।

## আধুনিকীকরণের প্রস্তাবিত ধাপ

### P0 — production-এর আগে দরকার

- Staging database, private Storage ও deployment integration-এর বাস্তব end-to-end যাচাই; migration backup/restore ও rollback runbook।
- MFA বা passkey-সমর্থিত admin login, recovery policy এবং least-privilege account lifecycle।
- অনুমোদিত business rules অনুযায়ী admin onboarding, document verification, agreement versioning এবং effective-dated vehicle/driver assignment।
- Duty review থেকে client approval, invoice draft/issue/payment tracking এবং owner payout পর্যন্ত audited state machine; maker-checker separation এবং idempotent retries।

### P1 — অপারেশন আধুনিক ও নির্ভরযোগ্য করতে

- Driver-এর mobile-first installable PWA: দুর্বল নেটওয়ার্কে নিরাপদ local capture, ছবির queue, retry ও idempotent sync; client-সাইড হিসাব নয়—server-ই চূড়ান্ত।
- Operations dashboard-এ pending duty/claim, odometer anomaly, document expiry ও SLA queue; প্রতিটি role-এ স্পষ্ট loading/error/empty/offline states।
- Email/SMS/push notification adapter, delivery log ও retry; প্রথমে manual approval, provider credentials ও delivery consent যাচাইয়ের পরেই সক্রিয়।
- Searchable audit history, CSV/PDF exports, মাসভিত্তিক invoice reconciliation এবং owner settlement statement।

### P2 — scale ও decision support

- Structured logs, auth/failed-action/slow-query metrics, alerts, error tracking এবং database-pool/load monitoring।
- স্বয়ংক্রিয় encrypted backup, নির্ধারিত restore drill, retention/deletion policy, file lifecycle cleanup ও incident response।
- API/webhook integration (fleet, accounting বা payment provider) কেবল versioning, signature verification, idempotency এবং reconciliation-সহ।
- Evidence OCR বা odometer anomaly detection সহায়ক হিসেবে ব্যবহার করা যেতে পারে; human review ছাড়া কোনো AI ফল billing, rejection বা payout পরিবর্তন করবে না।

## বর্তমান সীমা

এই milestone-এ live credential না থাকায় production database migration, Supabase bucket test, hosting deployment, DNS/TLS, backup restore বা বাস্তব user data যাচাই করা হয়নি। নতুন denial tests বাস্তব session extraction, missing-profile denial বা authorized success flow যাচাই করে না; এগুলো আলাদা test gap। Full onboarding, invoice lifecycle, payment/payout execution, MFA ও account recovery অসম্পূর্ণ—এগুলো roadmap, সম্পন্ন feature নয়।

## যাচাই ও নির্ভরযোগ্য তথ্য

Dependency migration ও advisory patch-এর primary reference [dependency-security-sources.md](dependency-security-sources.md)-এ রাখা হয়েছে। Prisma 7 migration, adapter pool এবং GitHub security advisory-র upstream links সেখানে আছে।
