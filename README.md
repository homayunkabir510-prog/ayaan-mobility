# Ayaan Mobility — Step 1 & 2 Deliverables

These files follow the execution roadmap from your project instructions.

## Where these go inside `C:\Ayaan Mobility`

After you run the scaffold command below, drop these two files into the matching
folders (overwriting the placeholders Next.js/Prisma create):

```
C:\Ayaan Mobility
├── prisma\
│   └── schema.prisma      ← replace with the file in this package
└── lib\
    └── calculator.ts      ← add this file
```

## If the project isn't scaffolded yet

From `C:\`:

```bash
npx create-next-app@latest "Ayaan Mobility" --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd "Ayaan Mobility"
npm install @prisma/client lucide-react clsx tailwind-merge
npm install -D prisma
npx prisma init
```

Then copy `prisma/schema.prisma` and `lib/calculator.ts` from this package in, and run:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

## What's included

- **`prisma/schema.prisma`** — the full multi-tenant schema (User, Vehicle, Agreement,
  DutyLog, ExpenseClaim, Invoice, OwnerPayout, AuditLog, etc.) covering all four apps
  (Ayaan Mobility, Ayaan Fleet, Ayaan Go, Ayaan Auto Rentals).
- **`lib/calculator.ts`** — the pure calculation engine with three functions:
  - `calculateDailyDuty()` — KM, duty hours, overtime, fuel bill, lunch/dinner/tour
    allowances, toll & parking, and the daily total, per the Dynamic Agreement Engine rules.
  - `calculateMonthlyInvoice()` — aggregates a batch of duty logs into the Invoice
    line items, handling DAILY / WEEKLY / MONTHLY_CORPORATE base-rent logic.
  - `calculateOwnerPayout()` — applies the 1–25% commission tier and maintenance
    deductions to compute a car owner's net payout.

## Next step (Step 3 of the roadmap)

Server Actions for Duty Log submission and Admin overrides — say the word and I'll
build those against this schema and calculator next.
