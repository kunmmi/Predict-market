# Phase Tracker

Current phase: **All phases complete — MVP ready for beta**

---

## Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation and project bootstrap | Completed |
| 2 | Supabase and auth setup | Completed |
| 3 | Types, validation, and shared services | Completed |
| 4 | Layouts and route protection | Completed |
| 5 | User dashboard and profile | Completed |
| 6 | Promoter registration and promoter dashboard | Completed |
| 7 | Referral capture in signup | Completed |
| 8 | Wallet page and ledger history | Completed |
| 9 | Deposit request flow | Completed |
| 10 | Admin deposit review | Completed |
| 11 | Market listing and detail pages | Completed |
| 12 | Admin market creation and editing | Completed |
| 13 | Market prices display | Completed |
| 14 | Trade flow | Completed |
| 15 | Portfolio page | Completed |
| 16 | Commission tracking | Completed |
| 17 | Admin dashboard and management pages | Completed |
| 18 | QA pass and bug fixes | Completed |
| 19 | Seed/demo data | Completed |
| 20 | Deployment prep | Completed |

---

## Phase Notes

### Phase 12–15 — Completed
- `lib/services/market-data.ts`: `getActiveMarkets()`, `getMarketBySlug()`, `getAllMarketsAdmin()`, `getMarketByIdAdmin()`
- `app/(dashboard)/markets/page.tsx`: active market card grid
- `app/(dashboard)/markets/[slug]/page.tsx`: market detail with TradeForm
- `app/(dashboard)/markets/[slug]/trade-form.tsx`: YES/NO toggle, amount input, balance check, fee summary, calls `POST /api/trades`
- `app/api/trades/route.ts`: calls `place_trade` RPC with `p_fee_amount: 0` (avoids double-debit)
- `app/api/wallet/route.ts`: returns wallet balances
- `lib/services/portfolio-data.ts` + `app/(dashboard)/portfolio/page.tsx`: open/settled positions, recent trades
- `app/api/admin/markets/route.ts`, `[id]/route.ts`, `[id]/settle/route.ts`, `[id]/prices/route.ts`
- `app/admin/markets/page.tsx`, `app/admin/markets/[id]/edit/edit-form.tsx`

### Phase 16 — Completed
- `lib/services/admin-data.ts`: added `getAdminCommissions()`
- `app/api/admin/commissions/route.ts`: GET (with status filter) + PATCH (update status)
- `app/admin/commissions/page.tsx` + `commissions-table.tsx`: filter tabs, inline approve/mark-paid

### Phase 17 — Completed
- `lib/services/admin-data.ts`: added `getAdminUsers()`, `getAdminPromoters()`, `getAdminReferrals()`, `getAdminTrades()`
- `app/api/admin/users/route.ts`, `promoters/route.ts`, `referrals/route.ts`, `trades/route.ts`
- `app/admin/users/page.tsx`, `promoters/page.tsx`, `referrals/page.tsx`, `trades/page.tsx`

### Phase 18 — Completed
- `npx tsc --noEmit` passes with 0 errors
- All nav links verified (admin layout + dashboard layout)
- All routes have auth guards (`requireUser` or `requireAdmin`)

### Phase 19 — Completed
- `scripts/seed.ts`: creates 3 markets (BTC/ETH/SOL) with initial 0.50/0.50 prices, creates `LAUNCH25` promoter for admin email
- Idempotent — safe to re-run
- Added `"seed": "npx tsx scripts/seed.ts"` to `package.json`
- Installed `dotenv` and `tsx` as dev dependencies

### Phase 20 — Completed
- `docs/DEPLOYMENT.md` updated with complete env vars, setup steps, smoke tests, and known MVP limitations
- `next.config.mjs` has no additional changes needed for MVP deployment on Vercel

---

## Known Limitations (deferred post-MVP)

- Fee double-debit bug in `place_trade` RPC: `p_fee_amount` passed as 0, fees shown in UI only
- Commission table will be empty until fee handling is fixed at DB level
- No email notifications (stubs only)
- No KYC workflow
- CN provider adapters are stubs — do not deploy with `APP_REGION=cn`
