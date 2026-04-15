# Deployment Guide — Elemental MVP

Deployment target: **Vercel** + **Supabase** (global region).

---

## 1. Environment Variables

Set the following in Vercel project settings (or `.env.local` for local dev):

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key — server-only, never expose publicly |
| `NEXT_PUBLIC_APP_URL` | Recommended | Full URL of the deployment (e.g. `https://yourapp.com`) |
| `ADMIN_EMAIL` | Recommended | Email to use for admin account and seed script |
| `APP_REGION` | Optional | `global` (default) or `cn` — region feature flag |

---

## 2. Supabase Setup

1. Run `docs/SCHEMA.sql` in the Supabase SQL editor to create all tables, views, functions, triggers, and RLS policies.
2. Confirm these objects exist:
   - Tables: `profiles`, `wallets`, `wallet_transactions`, `promoters`, `referrals`, `deposits`, `markets`, `market_prices`, `positions`, `trades`, `commissions`, `admin_logs`
   - Views: `v_admin_dashboard_summary`, `v_promoter_dashboard`
   - RPC functions: `place_trade`, `approve_deposit`, `reject_deposit`, `settle_market`
   - Triggers: `on_auth_user_created`, `trg_create_wallet_for_profile`, `trg_create_referral_for_profile`

---

## 3. First Admin User

1. Sign up at `/signup` with your admin email.
2. In Supabase SQL editor, run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
   ```
3. Visit `/admin` — you should see the admin dashboard.

---

## 4. Seed Sample Data (optional)

Run the seed script to create 3 sample markets (BTC, ETH, SOL) with initial prices set at 0.50/0.50, and a sample promoter with code `LAUNCH25`:

```bash
npm run seed
```

The script is idempotent — safe to run multiple times.

---

## 5. Pre-Deploy Checks

```bash
npm install
npx tsc --noEmit       # TypeScript check — must pass with 0 errors
npm run lint           # ESLint check
npm run build          # Production build
```

---

## 6. Post-Deploy Smoke Tests

- **Auth**: signup, login, logout, session persists across refresh
- **Markets**: `/markets` lists active markets; individual market pages load
- **Trading**: place a YES/NO trade, check wallet balance decrements, portfolio updates
- **Wallet**: `/wallet` shows balance and transaction history; `/wallet/deposit` allows submitting a deposit
- **Admin – Deposits**: `/admin/deposits` shows pending deposits; approve/reject works
- **Admin – Markets**: `/admin/markets` lists markets; edit form and price update work; settlement works
- **Admin – Commissions**: `/admin/commissions` renders (may be empty since fee is 0 in MVP)
- **Admin – Users / Promoters / Referrals / Trades**: all table pages load
- **Promoter**: sign up with a promo code, verify referral is linked

---

## 7. Known MVP Limitations

- **Fee double-debit bug**: The `place_trade` RPC has a known issue where passing `p_fee_amount > 0` debits the fee twice. The API passes `p_fee_amount: 0` to avoid this. Fees are shown in the UI but not deducted at the DB level. Commission tracking is therefore disabled at the RPC level.
- **No email notifications**: `emailNotificationsEnabled` is `false` in region config. All email features are stubs.
- **No KYC flow**: KYC status is stored but no verification workflow is implemented.
- **No order book / matching engine**: Trades execute at whatever price is set by the admin in `market_prices`.
- **CN region**: All CN provider adapters are stubs. Set `APP_REGION=global` in production.

---

## 8. Region Notes

The app supports a `APP_REGION` flag for future China deployment:

- `APP_REGION=global` (default): Uses global providers. All feature flags reflect current MVP state.
- `APP_REGION=cn`: Activates CN feature flags in `lib/config/regions.ts`, but CN adapters are not yet implemented — all fall back to no-ops. Do **not** deploy with `APP_REGION=cn` until CN provider adapters are built.

See `docs/architecture-regionalization.md` for the full provider abstraction design.
