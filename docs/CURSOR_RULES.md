# Cursor Rules — Crypto Prediction Market MVP

**Source of truth:** `docs/BLUEPRINT.md` and `docs/SCHEMA.sql`. Do not invent features or change the database structure unless explicitly told.

---

## 1. Core rules

- **Do not invent features outside the blueprint.** If it is not in docs/BLUEPRINT.md, do not add it.
- **Do not change database structure unless explicitly told.** Tables, columns, enums, and functions are defined in docs/SCHEMA.sql.
- **Do not skip validation.** All forms and API inputs must be validated (Zod + server-side checks).
- **Do not generate placeholder logic where real logic is already defined in the schema.** Use schema functions (e.g. `approve_deposit`, `place_trade`, `settle_market`) and ledger-based wallet updates.
- **Implement in small, reviewed steps.** One phase or sub-phase at a time.
- **After each step:** explain what was added, what files were changed, and what is left.

---

## 2. Stack choices

| Layer | Choice |
|-------|--------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js Route Handlers or server actions; optional modular service layer in `lib/services/` |
| Database & auth | Supabase (PostgreSQL, Supabase Auth) |
| Hosting | Vercel |
| Validation | Zod |
| Forms | React Hook Form + @hookform/resolvers |
| Utilities | clsx, class-variance-authority, lucide-react, date-fns |

No Prisma unless explicitly introduced later; use Supabase client and direct queries.

---

## 3. Naming conventions

- **Files:** kebab-case for routes and components (e.g. `market-detail/page.tsx`, `wallet-transactions.tsx`). PascalCase for React components in imports.
- **Components:** PascalCase (e.g. `MarketCard`, `DepositForm`).
- **API routes:** kebab-case paths; handlers in `app/api/` (e.g. `app/api/deposits/route.ts`, `app/api/admin/deposits/[id]/approve/route.ts`).
- **Database:** schema uses `snake_case` for tables and columns; TypeScript types can mirror or use camelCase in app code with a clear mapping.
- **Env:** `NEXT_PUBLIC_*` for client-safe vars; no prefix for server-only (e.g. Supabase service role).

---

## 4. File organization

```
app/
  (public)/          # landing, marketing
  (auth)/            # login, signup, promoter signup
  (dashboard)/       # user dashboard, wallet, markets, portfolio
  admin/             # admin-only routes
  api/               # route handlers by domain (auth, promoters, deposits, markets, trades, admin)
components/
  ui/                # shadcn and primitives
  layout/            # nav, sidebar, page container
  auth/
  markets/
  wallet/
  promoter/
  portfolio/
  admin/
lib/
  supabase/          # server and client Supabase instances
  auth/              # get-current-user, require-user, require-admin, require-promoter
  validations/       # Zod schemas
  services/          # domain services (profile, promoter, wallet, deposit, market, trade, commission, admin)
  helpers/
  constants/
types/               # domain and DTO types
docs/                # BLUEPRINT.md, SCHEMA.sql, CURSOR_RULES.md
tasks/               # IMPLEMENTATION_CHECKLIST.md, PHASE_TRACKER.md
```

Keep route groups and domain boundaries clear; do not mix admin logic in user routes.

---

## 5. Validation rules

- **Every form:** Zod schema + React Hook Form resolver; validate on submit and surface field errors.
- **Every API route / server action:** Validate body/params with Zod (or equivalent) before using; return 400 with clear error shape for validation failures.
- **Financial and state-changing actions:** Re-validate on the server even if the client validated (e.g. balance checks, market status, deposit status).
- **Ids (UUIDs):** Validate format and existence before use; return 404 when entity not found.

---

## 6. Security rules

- **Role-based access:** User, promoter, and admin routes must check profile role (require-user, require-promoter, require-admin). Redirect or 403 when unauthorized.
- **Row-level:** Users see only their own wallet, deposits, trades, portfolio. Promoters see only their referrals and commissions. Admins see all; admin routes must enforce admin role.
- **Financial logic:** Only on the server. No balance calculation or trade execution from client state; no bypassing ledger entries. Use schema functions and wallet_transactions for every balance change.
- **Admin actions:** Log to admin_logs (e.g. deposit approve/reject, market settle, commission status change).
- **Input:** Sanitize and validate all inputs; never trust client for amounts, statuses, or entity ownership.

---

## 7. No feature drift

- Do not add tables, columns, or enums not in docs/SCHEMA.sql unless explicitly requested.
- Do not add pages, flows, or API routes not described in docs/BLUEPRINT.md.
- If the blueprint and schema disagree, flag the mismatch before implementing; do not guess.
- Out-of-scope for V1 (do not build unless explicitly asked): order book, on-chain settlement, automated withdrawals, custody, promoter payout automation, fiat onboarding, mobile app, complex charting.

---

## 8. Summary for Cursor

1. Read **docs/BLUEPRINT.md** and **docs/SCHEMA.sql** when starting or continuing work.
2. Implement one phase at a time per **BUILD-PLAN.md** Section 28.
3. Before coding a phase, list files to create/update, assumptions, risks, and validation steps.
4. After each phase, report: what was completed, what remains, any schema mismatch, any bug risk, and test steps to verify.
