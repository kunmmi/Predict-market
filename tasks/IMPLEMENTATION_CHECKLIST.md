# Implementation Checklist

Source of truth: **BUILD-PLAN.md** and **docs/BLUEPRINT.md**.

Check off items as they are completed. Work in the order of BUILD-PLAN Section 28.

---

## Phase 1: Foundation and project bootstrap

- [x] Project folder structure (docs/, tasks/, .cursor/)
- [x] docs/BLUEPRINT.md and docs/SCHEMA.sql in place
- [x] docs/CURSOR_RULES.md created
- [x] tasks/IMPLEMENTATION_CHECKLIST.md and PHASE_TRACKER.md
- [x] README.md
- [x] Next.js app (TypeScript, App Router)
- [x] Linting and formatting configured
- [x] Base dependencies (Tailwind, shadcn, Supabase, Zod, react-hook-form, etc.)
- [x] Tailwind and design system
- [x] Base project structure (app route groups, components/, lib/, types/)

---

## Phase 2: Supabase and auth setup

- [x] .env.local.example and lib/config.ts
- [ ] Supabase project connected; docs/SCHEMA.sql run
- [x] Auth integration (email/password, redirect URLs)
- [x] Profile and wallet creation triggers verified
- [ ] Admin user setup process documented

---

## Phase 3: Types, validation, and shared services

- [x] Domain model map (blueprint → modules, schema → services) — see `types/` + `lib/validations/`
- [x] TypeScript types from schema (profile, promoter, referral, wallet, deposit, market, trade, position, commission)
- [x] Zod validation schemas (signup, login, promoter reg, deposit, market, trade, settlement, commission)

---

## Phase 4: Layouts and route protection

- [x] Auth utilities (server/client Supabase, get-current-user, require-user, require-admin, require-promoter)
- [x] Auth pages (signup, login, logout, redirects)
- [x] Role-aware route protection
- [ ] Profile bootstrap checks
- [x] Layouts (public, auth, dashboard, admin)
- [ ] Reusable UI primitives (stat cards, tables, empty/loading/error states)

---

## Phase 5: User dashboard and profile

- [x] User dashboard (balance, open positions, recent deposits/trades, promoter indicator)
- [x] Profile/settings page

---

## Phase 6: Promoter registration and promoter dashboard

- [x] Promoter onboarding flow
- [x] Promoter registration page (form, promo code generation)
- [x] Promoter dashboard (stats, referral metrics, commission metrics, promo code display)
- [x] Promoter referral list page
- [x] Promoter commission history page

---

## Phase 7: Referral capture in signup

- [x] Promo code field in signup flow
- [x] Referral validation utility
- [x] Referral linkage and referral row creation
- [x] Edge case tests (invalid code, inactive promoter, duplicate)

---

## Phase 8: Wallet page and ledger history

- [x] Wallet page (summary, balance, status, link to top-up)
- [x] Wallet transaction history (ledger entries, type/direction badges)
- [x] Wallet helpers (fetcher, formatter)

---

## Phase 9: Deposit request flow

- [x] Top-up page (asset choice, amount, tx hash placeholder, instructions)
- [x] Deposit submission backend (validate, insert, pending status)
- [x] Deposit history page/section

---

## Phase 10: Admin deposit review

- [x] Admin deposits table and filters
- [x] Approve/reject UI (modal, notes, amount override)
- [x] Backend (approve_deposit, reject_deposit, admin log)
- [x] Deposit testing (approve → wallet credited; reject → unchanged)

---

## Phase 11: Market listing and detail pages

- [ ] Market entity service (list, single, filtered by status)
- [ ] Market listing page (cards/table, filter, sort)
- [ ] Market detail page (question, description, rules, status, times, yes/no price, trade form)

---

## Phase 12: Admin market creation and editing

- [ ] Admin market creation page (all market fields)
- [ ] Admin market edit page
- [ ] Admin market settlement flow (outcome, notes, settlement function, admin log)

---

## Phase 13: Market prices display

- [ ] MVP pricing source decided (static / admin-set / table-driven)
- [ ] Market price display logic (latest price, fallback, format)
- [ ] Admin market price management (add/update prices, yes+no sum = 1)

---

## Phase 14: Trade flow

- [ ] Trade form UI (side, amount, price, units preview, fee preview, balance check)
- [ ] Trade backend (validate market, balance, amount; place_trade or server transaction; fee; position; commission)
- [ ] Trade history page/section
- [ ] place_trade fee double-debit fix if needed
- [ ] Trade testing (funded, insufficient, inactive market, referral commission)

---

## Phase 15: Portfolio page

- [ ] Portfolio page (open positions, settled positions, pnl, related markets)
- [ ] Portfolio summaries (totals, wallet, empty/loading states)

---

## Phase 16: Commission tracking

- [ ] Commission service (fetch by promoter, totals, per-trade)
- [ ] Admin commissions page (list, filter by status/promoter/user)
- [ ] Optional commission state management (mark approved/paid, admin log)

---

## Phase 17: Admin dashboard and management pages

- [ ] Admin route protection
- [ ] Admin dashboard (summary metrics from v_admin_dashboard_summary)
- [ ] Admin user management page
- [ ] Admin promoter management page
- [ ] Admin referrals page
- [ ] Admin trades page
- [ ] Admin wallet ledger page
- [ ] Admin logs page

---

## Phase 18: QA pass and bug fixes

- [ ] Manual QA checklist (signup, promoter, deposit, market, trade, settle, commission)
- [ ] tasks/TEST_CASES.md, BUG_LOG.md, KNOWN_LIMITATIONS.md
- [ ] Edge cases and validation hardened

---

## Phase 19: Seed/demo data

- [ ] Seed script (admin, sample promoter, users, markets, prices, deposits, trades)
- [ ] Demo scenario (promoter + referred users, funded wallets, commissions)

---

## Phase 20: Deployment prep

- [ ] Vercel env and production build
- [ ] Auth redirect URLs for production
- [ ] Production safety checks (admin exists, routes protected)
- [ ] Launch-ready MVP checklist (functional, UI, data reconciliation)
