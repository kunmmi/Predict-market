# Codex Handoff — PredictMarket

## What this app is
A short-duration binary prediction market platform. Users predict whether BTC (or other crypto) will go UP or DOWN over a fixed window (5 or 15 minutes). Built with Next.js 14, Supabase (Postgres + RLS), Tailwind, deployed on Vercel. Live at **https://www.predictmarket.live**.

---

## Tech stack
- **Framework**: Next.js 14 App Router (TypeScript)
- **Database**: Supabase (Postgres + RLS + RPCs)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS + shadcn/ui
- **Price feed**: Binance WebSocket (klines) + REST API
- **Payments**: BSC (BNB Smart Chain) deposits, detected via Moralis webhook
- **Deployment**: Vercel (Hobby plan — no sub-daily crons)
- **Crons**: cron-job.org (3 jobs running)

---

## Key files to understand

### Pricing / probability
- `lib/short-duration-predictions.ts` — Black-Scholes binary option pricing (`computeBinaryYesPrice`). This is the core of how YES/NO prices are computed from live Binance price vs opening price + time remaining.
- `lib/config/trading-constants.ts` — **Single source of truth for house economics**:
  - `OVERROUND = 0.06` (6% spread on every buy — YES+NO prices sum to 1.06)
  - `BUY_FEE_RATE = 0.025` (2.5% fee on top of stake)
  - `SELL_FEE_RATE = 0.02` (2% deducted from sell proceeds)

### Market lifecycle
- `lib/services/short-duration-settlement.ts` — Round rollover logic. When a round expires: settles the old round, creates the next one, fetches the new opening price from Binance, seeds house market-maker orders. **Key function**: `settleShortDurationMarketById`.
- `lib/services/market-maker.ts` — Seeds 6 house limit orders (3 YES + 3 NO) at staggered price offsets around current price. Uses `SYSTEM_ADMIN_PROFILE_ID` wallet. **Constants**: `STAKE_PER_LEVEL = 8`, `LEVEL_OFFSETS = [0.07, 0.12, 0.17]`.

### Market page (main user-facing feature)
- `app/(dashboard)/markets/[slug]/page.tsx` — Server component. Handles settlement + redirect on load.
- `app/(dashboard)/markets/[slug]/trade-area.tsx` — Client wrapper that coordinates TradeForm + MarketPositionPanel via `refreshTick`.
- `app/(dashboard)/markets/[slug]/trade-form.tsx` — Buy/limit order form with live Binance price, countdown timer.
- `app/(dashboard)/markets/[slug]/market-position-panel.tsx` — Live holdings card: shows user's open position, current value, unrealized P&L, inline sell form. Polls every 5s.
- `app/(dashboard)/markets/[slug]/order-book-panel.tsx` — Aggregated limit order depth. Only renders when ≥3 open orders exist.
- `app/(dashboard)/markets/[slug]/round-closed-banner.tsx` — Appears when round expires. Polls for result, shows "You won $X" / "You lost $X", has 5s auto-redirect countdown to next round.

### APIs
- `POST /api/trades` — Place a market order
- `POST /api/trades/sell` — Sell open position at live Black-Scholes price (2% sell fee)
- `GET/POST /api/limit-orders` — List or place limit orders
- `DELETE /api/limit-orders/[id]` — Cancel limit order
- `GET /api/markets/[id]/order-book` — Public aggregated order book depth
- `GET /api/markets/[id]/my-position` — Authenticated user's open position for a market
- `GET /api/markets/[id]/my-result` — Result after settlement (won/lost/pending)
- `POST /api/admin/markets/[id]/seed-orders` — Admin: manually seed house market-maker orders
- `POST /api/cron/settle-short-markets` — Cron: settle expired rounds + create next round + seed orders
- `POST /api/cron/match-limit-orders` — Cron: fill limit orders when price hits target
- `GET /api/cron/sweep-deposits` — Cron: sweep BSC deposits via Moralis

### Wallet / auth
- `lib/contexts/wallet-context.tsx` — React context providing wallet balance to all dashboard components. One fetch, shared everywhere.
- `lib/auth/require-user-for-api.ts` — Auth guard for API routes

---

## Environment variables (all set in Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase
- `SYSTEM_ADMIN_PROFILE_ID` — UUID of house account that places market-maker orders. Wallet funded with $100+.
- `CRON_SECRET` — Bearer token for cron job auth (`Authorization: Bearer <value>`)
- `MORALIS_API_KEY` — For deposit detection

---

## Cron jobs (on cron-job.org, every 1 minute)
1. `POST /api/cron/settle-short-markets` — Authorization: Bearer <CRON_SECRET>
2. `POST /api/cron/match-limit-orders` — Authorization: Bearer <CRON_SECRET>
3. `GET /api/cron/sweep-deposits` — Authorization: Bearer <CRON_SECRET>

---

## Database key tables
- `markets` — Each row is one round. Short-duration rounds share a base slug and roll over.
- `positions` — User holdings per market (yes_units, no_units, avg entry price)
- `trades` — Every buy/sell transaction
- `limit_orders` — Open/filled/cancelled limit orders
- `wallets` — `available_balance` + `reserved_balance` + `balance` (balance = available + reserved)
- `market_prices` — Price history per market (yes_price, no_price)

## Key DB RPCs (Supabase functions)
- `place_limit_order` — Reserves funds, inserts order
- `cancel_limit_order` — Releases reserved funds, marks cancelled
- `fill_limit_order` — Called by match cron when price hits target
- `credit_wallet` — Credits available_balance (used after sells, deposits, wins)

---

## House economics
| | Value |
|---|---|
| Buy fee | 2.5% on top of stake |
| Overround | 6% (YES+NO prices sum to 1.06) |
| Sell fee | 2% of gross proceeds |
| House edge (hold to expiry) | ~8-9% |
| House edge (sell early) | ~8-9% |
| Market-maker stake per level | $8 |
| Market-maker offsets | 7%, 12%, 17% from current price |

---

## What was just built (last session)
1. **Limit orders** — place, cancel, fill. Portfolio panel to view/cancel open orders.
2. **Order book panel** — aggregated depth on market page, gated at ≥3 orders.
3. **House market-maker** — auto-seeds 6 real orders on every round rollover.
4. **Live holdings on market page** — position card with current value, P&L, inline sell.
5. **Sell from market page** — sells at live Black-Scholes price (not stale DB price).
6. **Round result banner** — auto-redirect with 5s countdown after round closes.
7. **"If you win" → dollar value** — shows $X.XX when amount is typed (Polymarket style).
8. **Stale opening price fix** — `ensureRoundOpeningPrice` self-heals on every page load.
9. **Probability clamp** — [8%, 92%] to prevent extreme values.

---

## Next feature to build (owner's request, not yet started)

### "Dead market" landing experience
**Problem**: When a user visits the app after a round has ended (e.g. first thing in the morning), they land on a settled/stale market page. Currently the server redirects them to the latest active round, but if no round is active yet it just shows a dead page.

**Requested UX**:
- If market is settled/expired → show a "Round ended" screen (same as the round-closed banner) with the result if they participated
- Show a prominent **"Trade live market →"** button
- That button hits an endpoint to find the current active round for that asset and navigates there
- This solves BOTH the "stale first visit" AND "round transition" problems cleanly
- Remove the auto-redirect countdown (user chooses when to enter next round)

**Implementation notes**:
- Need a `GET /api/markets/active?asset=BTC` endpoint (or similar) that returns the current active market slug for a given asset
- The round-closed banner should stay visible permanently until user clicks "Trade live market"
- For settled markets, the server page should NOT redirect — instead pass `isSettled=true` to the client and let the banner handle the UX
- The `router.refresh()` in the banner should be replaced with a fetch to get the current slug, then `router.push(/markets/${slug})`

---

## Branch
All work is on `main` (merged). Working branch: `claude/pensive-torvalds-62a950` (kept for ongoing work).

## Repo
https://github.com/kunmmi/Predict-market
