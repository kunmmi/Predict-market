# Deployment Guide — Elemental

Deployment target: **Vercel** + **Supabase**

---

## 1. Environment Variables

Set all of the following in Vercel project settings → Environment Variables (and in `.env.local` for local dev).

### Core (required — app will not start without these)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — server-only, never expose publicly |

### Crypto deposit addresses (required for deposits to work)

| Variable | Description |
|---|---|
| `DEPOSIT_ADDRESS_BTC` | Platform Bitcoin deposit address |
| `DEPOSIT_ADDRESS_ETH` | Platform Ethereum (ERC-20) deposit address |
| `DEPOSIT_ADDRESS_BSC` | Platform BNB Smart Chain (BEP-20) deposit address |
| `DEPOSIT_ADDRESS_SOL` | Platform Solana deposit address |

### Webhooks (required for automation)

| Variable | Description |
|---|---|
| `TATUM_WEBHOOK_SECRET` | Secret to verify incoming Tatum webhook payloads |

### Email notifications (required for transactional emails)

| Variable | Description |
|---|---|
| `EMAIL_PROVIDER` | `resend` or `gmail` |
| `RESEND_API_KEY` | API key from resend.com (if using Resend) |
| `GMAIL_USER` | Gmail address (if using Gmail SMTP) |
| `GMAIL_APP_PASSWORD` | Gmail app password (if using Gmail SMTP) |
| `DEFAULT_FROM_EMAIL` | Sender address shown on outgoing emails |

### Optional

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Full URL of the deployment (e.g. `https://predict-market-xi.vercel.app`) |
| `APP_REGION` | `global` (default) or `cn` — region feature flag |
| `SYSTEM_ADMIN_PROFILE_ID` | Profile ID of the system admin user for internal operations |
| `NEXT_PUBLIC_ANALYTICS_PROVIDER` | Analytics provider identifier |
| `NEXT_PUBLIC_ANALYTICS_ID` | Analytics tracking ID |

---

## 2. Supabase Setup

1. Run **Section A** of `docs/SCHEMA.md` in the Supabase SQL editor.
2. Run **Section B** of `docs/SCHEMA.md` to add Chinese-language columns to the `markets` table.
3. Confirm these objects exist:
   - **Tables**: `profiles`, `wallets`, `wallet_transactions`, `promoters`, `referrals`, `deposits`, `markets`, `market_prices`, `positions`, `trades`, `commissions`, `admin_logs`
   - **Views**: `v_admin_dashboard_summary`, `v_promoter_dashboard`, `v_wallet_summary`
   - **RPC functions**: `place_trade`, `approve_deposit`, `reject_deposit`, `settle_market`, `credit_wallet`, `debit_wallet`, `create_promoter`
   - **Triggers**: `on_auth_user_created`, `trg_create_wallet_for_profile`, `trg_create_referral_for_profile`

---

## 3. First Admin User

1. Sign up at `/signup` with your admin email.
2. In Supabase SQL editor, run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
   ```
3. Visit `/admin` — you should see the admin dashboard.

---

## 4. Pre-Deploy Checks

```bash
npm install
npx tsc --noEmit       # TypeScript — must pass with 0 errors
npm run lint           # ESLint
npm run build          # Production build
```

---

## 5. Post-Deploy Smoke Tests

- **Auth**: signup, login, logout, password reset, username signup
- **Language**: switch EN ↔ 中文 — full UI should flip including market titles
- **Markets**: `/markets` lists active markets with YES/NO prices and probability bars
- **Trading**: place a YES/NO trade → wallet balance decrements → portfolio updates → price moves
- **Dynamic pricing**: place two YES trades back-to-back — confirm YES price increases after each
- **Wallet**: `/wallet` shows balance and transaction history
- **Deposit**: submit a deposit request → admin approves → balance credited
- **Withdrawal**: submit withdrawal → processed via Tatum → balance debited
- **Settlement**: admin settles a market → winning users receive payout in wallet
- **Admin – Markets**: edit, set price manually, settle market all work
- **Admin – Deposits/Withdrawals**: approve and reject flows work
- **Admin – Users/Promoters/Trades/Commissions**: all table pages load
- **Promoter**: sign up with promo code → referral linked → commission generated on trade
- **Rate limiting**: confirm 429 response after rapid repeated requests to `/api/trades`

---

## 6. Key Features & Architecture

### Dynamic Pricing (AMM)
Prices update automatically after every trade using a Constant Product Market Maker formula:
```
yes_price = (L + yes_volume) / (2L + yes_volume + no_volume)
```
Where `L = $500` virtual liquidity per side. More YES buying → YES price rises. More NO buying → YES price falls.
Source: `lib/services/dynamic-pricing.ts`

### Rate Limiting
All sensitive endpoints are rate-limited per user or IP:

| Endpoint | Limit |
|---|---|
| `POST /api/trades` | 10 / min per user |
| `POST /api/deposits` | 5 / min per user |
| `POST /api/deposits/verify` | 5 / min per user |
| `POST /api/withdrawals` | 3 / min per user |
| `POST /api/auth/login` | 5 / min per IP |
| `POST /api/auth/signup` | 3 / min per IP |

Source: `lib/rate-limit.ts`

### Internationalisation (i18n)
Full English / Chinese (中文) support. Language stored in a `lang` cookie.
- UI strings: `lib/i18n/translations.ts`
- Status/side labels: `lib/i18n/labels.ts`
- Market content (titles, descriptions, rules): stored in `_zh` columns in the `markets` table

### Market Settlement
Admin manually settles markets via the edit page (`/admin/markets/[id]/edit`).
Calls the `settle_market` Supabase RPC which credits winning positions at $1/unit and marks the market as settled.
Email notifications sent to all users with open positions.

### Deposit Security
- Double-spend protection: tx hash checked against all existing approved deposits before crediting
- Hash theft protection: tx hash ownership verified against the submitting user's account

---

## 7. Current Limitations

- **No KYC flow**: KYC status field exists in the DB but no verification workflow is implemented
- **No order book**: Trades execute at the AMM price — no limit orders or peer-to-peer matching
- **Rate limiting is in-process**: Uses module-level Map per serverless instance — not globally consistent across Vercel instances. Sufficient for MVP but consider Upstash Redis for production scale
- **CN region**: All CN provider adapters are stubs. Keep `APP_REGION=global` until CN providers are built
