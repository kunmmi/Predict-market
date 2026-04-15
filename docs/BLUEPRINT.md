# Crypto Prediction Market MVP Blueprint

## 1. Product Summary

This product is a crypto-focused prediction market platform inspired by the market interaction style of Polymarket, but initially built as a solo-founder MVP with a much smaller and safer scope.

The first version should not attempt to be a full exchange, a full derivatives venue, or a multi-chain custody platform. It should instead focus on validating the core business flow:

1. a promoter registers and gets a promo code  
2. a user signs up with that promo code  
3. the user tops up a wallet balance  
4. the user enters prediction markets and places trades  
5. the platform records fees and promoter commissions  
6. the admin monitors users, markets, deposits, trades, and commissions  

The purpose of the MVP is to validate whether users will:

- join through promoter referrals  
- fund a platform wallet  
- participate in crypto prediction markets  
- generate trackable fee activity  
- create a commission stream for promoters  

---

## 2. MVP Goal

The goal of version 1 is to launch a functional, demoable, internally consistent platform that proves the core loop works.

The MVP is successful if it can do the following reliably:

- create and manage users  
- create and manage promoters  
- assign and validate promo codes  
- track referred users  
- maintain user wallet balances  
- support top-up requests for supported assets  
- display active prediction markets  
- allow a user to buy or sell positions in a market  
- update a portfolio view  
- calculate platform fees  
- allocate promoter commission on eligible referred activity  
- provide admin visibility into all core activity  

This version should prioritize product validation, not full financial infrastructure.

---

## 3. Product Principles

The build should follow these principles:

### 3.1 Keep the first version narrow

Only build what is necessary to validate the main product loop.

### 3.2 Simulate complexity before automating it

Use simulated or manually approved deposit flows before introducing full blockchain deposit automation.

### 3.3 Manual admin operations are acceptable in V1

Anything that can be handled manually without breaking user trust may stay manual in the first release.

### 3.4 Design for later expansion

Even though the MVP is lean, the schema and architecture should make it easy to later add:

- real deposit detection  
- real settlement logic  
- real payout automation  
- deeper market mechanics  
- advanced referral payout models  

---

## 4. Target Users

### 4.1 End users

These are users who join the platform, top up a balance, and take positions in crypto prediction markets.

### 4.2 Promoters

These are marketers, affiliates, or community operators who help bring users onto the platform using unique promo codes and who earn a share of eligible platform commission.

### 4.3 Admin

This is the platform operator who manages markets, monitors transactions, reviews deposits, handles referral tracking, and oversees commissions.

---

## 5. MVP Scope

### 5.1 In scope

The following features are part of the MVP.

**Authentication and user system**

- user registration  
- user login  
- promoter registration  
- promoter login  
- role support for user, promoter, and admin  
- profile records for each role  

**Referral and promoter system**

- unique promo code generation  
- promo code validation on signup  
- referred user linkage  
- promoter dashboard with referral stats  
- promoter earnings tracking  

**Wallet system**

- internal wallet balance per user  
- wallet transaction ledger  
- top-up request flow  
- support for BTC, USDT, USDC, BNB, and SOL as selectable funding assets  
- pending, approved, rejected deposit states  
- admin ability to review and confirm deposits  

**Prediction market system**

- market creation by admin  
- market categories  
- market title, description, close time, settle time, and status  
- yes/no outcome structure  
- market detail page  
- buy/sell interaction  
- position tracking  
- trade history  
- basic market price display  

**Portfolio system**

- open positions  
- settled positions  
- wallet balance summary  
- transaction history  

**Fee and commission system**

- platform fee on eligible trades  
- promoter commission percentage based on referred user activity  
- promoter commission ledger  
- admin commission reporting  

**Admin system**

- dashboard overview  
- user management  
- promoter management  
- deposit review  
- market management  
- trade monitoring  
- commission monitoring  

### 5.2 Out of scope for version 1

The following should not be built in the first version unless absolutely necessary:

- real-time central limit order book engine  
- advanced market making system  
- on-chain settlement infrastructure  
- automated blockchain confirmation engine across all supported assets  
- automated withdrawals  
- full custody infrastructure  
- advanced anti-fraud or surveillance tooling  
- dispute resolution workflows  
- multi-language support  
- mobile app  
- complex fee tiers  
- promoter withdrawals automation  
- fiat onboarding  
- complex charting beyond basic market display  

---

## 6. Recommended Solo Builder Stack

| Layer | Choice |
|-------|--------|
| **Frontend** | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend** | Next.js Route Handlers or server actions for lean MVP; optional modular service layer inside the app |
| **Database and auth** | Supabase PostgreSQL, Supabase Auth, Supabase Storage if file proof uploads are needed later |
| **Hosting** | Vercel |
| **Charts** | TradingView Lightweight Charts for market visualization if needed |
| **Realtime** | optional Supabase Realtime for live updates in later phase |
| **Internal utilities** | Zod for validation, Prisma or direct Supabase queries depending on preference, React Hook Form for forms |

This stack reduces operational overhead and is suitable for a solo founder.

---

## 7. Core Business Flow

The main user flow should work like this:

1. promoter signs up  
2. promoter receives a unique promo code  
3. promoter shares that code  
4. new user signs up using the code  
5. user receives an account and wallet  
6. user goes to top-up page  
7. user selects BTC, USDT, USDC, BNB, or SOL  
8. user submits a top-up request  
9. admin reviews and confirms deposit in V1  
10. wallet balance is credited  
11. user browses active markets  
12. user buys a yes or no position  
13. trade is recorded  
14. platform fee is recorded  
15. promoter commission is calculated if the user was referred  
16. user sees portfolio update  
17. promoter sees commission update  
18. admin sees all activity in dashboard  

This flow is the heart of the MVP.

---

## 8. Functional Requirements

### 8.1 Authentication

The system must allow:

- standard user signup and login  
- promoter signup and login  
- admin login  
- unique role assignment  
- session protection for private routes  

**Rules**

- each account must have one primary role  
- promoter accounts should also have a linked promoter profile  
- users signing up with a valid promo code should be linked permanently to that promoter unless changed manually by admin  

### 8.2 Promoter and referral system

**Promoter registration**

A promoter should be able to register and receive:

- promoter profile  
- unique promo code  
- promoter dashboard  

**Referral capture**

When a user signs up:

- the system should accept an optional promo code  
- if valid, it should link the user to the promoter  
- the referral relationship should be stored in the database  

**Promoter dashboard should show**

- total referred users  
- active referred users  
- total generated commission  
- pending commission  
- paid commission  
- commission history  

**Rules**

- promo codes must be unique  
- referral linkage must be stored at signup time  
- commission should only be earned on eligible fee-generating activity  

### 8.3 Wallet system

Each user should have an internal wallet account.

**Wallet features**

- current balance  
- available balance  
- reserved balance if needed later  
- transaction history  

**Top-up flow**

The top-up page should allow the user to:

- choose a supported asset  
- see deposit instructions or deposit address details later  
- submit a top-up request  
- view status of each request  

**Supported assets in V1 UI**

- BTC  
- USDT  
- USDC  
- BNB  
- SOL  

**Deposit states**

- pending  
- approved  
- rejected  
- cancelled  

**V1 deposit approach**

For the first version, the simplest path is either:

- simulated deposit credits for testing, or  
- admin-confirmed deposit requests  

**Rules**

- wallet balances must always reconcile with wallet transactions  
- every balance update must create a ledger entry  
- approved deposits increase balance  
- rejected deposits do not increase balance  

### 8.4 Market system

The admin should create prediction markets manually.

**Market fields**

- market title  
- slug  
- description  
- category  
- asset reference  
- market question  
- close time  
- settle time  
- status  
- resolution outcome  
- resolution notes  

**Market statuses**

- draft  
- active  
- closed  
- settled  
- cancelled  

**Market page content**

- title  
- market question  
- market description  
- close time  
- current implied pricing or simplified odds  
- yes and no action buttons  
- trade form  
- market rules text  

**V1 market structure**

Use simple yes/no markets only.

Examples:

- Will BTC close above 100,000 by a stated date?  
- Will ETH trade above 5,000 by a stated date?  
- Will SOL remain above a stated threshold by a stated date?  

### 8.5 Trading system

The first version should support a simplified buy/sell model.

**V1 approach recommendation**

Use a simplified internal market model rather than a full order book. This can be:

- fixed probability pricing updated manually or by simple logic, or  
- a simplified buy position model where users buy yes or no exposure at the displayed market price  

**Required trade fields**

- user  
- market  
- outcome side: yes or no  
- amount staked  
- price at entry  
- fee amount  
- resulting position quantity  
- status  
- created timestamp  

**Rules**

- a user cannot trade on inactive or closed markets  
- a user cannot trade more than available wallet balance  
- each trade must create transaction and position updates  
- platform fee must be calculated and stored  

### 8.6 Portfolio system

The user portfolio page should display:

- wallet balance  
- open positions  
- closed positions  
- settled winnings or losses  
- recent trades  
- transaction history  

**Open positions should show**

- market title  
- side  
- entry price  
- amount  
- current status  
- potential outcome summary  

### 8.7 Fee and promoter commission system

**Platform fee**

Each eligible trade should generate a platform fee.

**Promoter commission**

If a user was referred by a promoter, a percentage of the platform fee should be allocated to that promoter.

**Example logic**

- user places a trade  
- platform fee is calculated  
- if user has a linked promoter, promoter earns a percentage of that fee  
- promoter commission record is created  

**Suggested commission states**

- pending  
- approved  
- paid  
- cancelled  

**Rules**

- commission should be traceable to the originating trade  
- commission should be traceable to promoter and referred user  
- paid commissions should remain in ledger history  

### 8.8 Admin system

The admin dashboard should provide visibility into all core entities.

**Admin capabilities**

- view all users  
- view all promoters  
- view all referrals  
- review all deposits  
- approve or reject deposits  
- create and manage markets  
- settle markets  
- view trades  
- view wallet transaction ledger  
- view commission ledger  
- mark commissions as paid if needed later  

**Admin summary metrics**

- total users  
- total promoters  
- total deposits  
- total approved deposits  
- total active markets  
- total trade volume  
- total platform fees  
- total promoter commissions  

---

## 9. Non-Functional Requirements

The MVP should also meet the following standards:

**Security**

- authentication-protected dashboards  
- role-based route protection  
- input validation on all forms and API routes  
- database row restrictions where appropriate  

**Reliability**

- wallet updates must be ledger-based  
- market status must be consistent  
- trades must not process if funds are insufficient  

**Performance**

- pages should load quickly  
- market list and portfolio should be optimized for normal MVP traffic  

**Auditability**

- all balance changes must be traceable  
- all commission entries must be traceable  
- all deposit approvals must be attributable to an admin user  

---

## 10. Page List

**Public pages**

- landing page  
- login page  
- signup page  
- promoter signup page  

**User pages**

- dashboard  
- wallet page  
- top-up page  
- markets page  
- market detail page  
- portfolio page  
- transactions page  
- profile/settings page  

**Promoter pages**

- promoter dashboard  
- referral list page  
- commission history page  
- promoter profile page  

**Admin pages**

- admin dashboard  
- users management page  
- promoters management page  
- referrals page  
- deposits management page  
- markets management page  
- market create/edit page  
- trades page  
- commissions page  
- wallet ledger page  

---

## 11. Data Model

Below is the recommended database structure.

### 11.1 users

Stores core account data.

**Fields:** id, auth_user_id, email, full_name, role, referred_by_promoter_id (nullable), created_at, updated_at  

### 11.2 promoters

Stores promoter profile data.

**Fields:** id, user_id, display_name, promo_code, status, commission_rate, total_commission_generated (cached optional), created_at, updated_at  

### 11.3 referrals

Stores referral relationships.

**Fields:** id, promoter_id, referred_user_id, promo_code_used, created_at  

### 11.4 wallets

Stores wallet summary.

**Fields:** id, user_id, balance_usd_or_internal_unit, available_balance, reserved_balance, status, created_at, updated_at  

### 11.5 wallet_transactions

Stores every wallet ledger event.

**Fields:** id, wallet_id, user_id, transaction_type, reference_type, reference_id, asset_symbol, amount, direction, status, description, created_at  

Transaction types may include: deposit, trade_debit, trade_credit, settlement_credit, fee_debit, adjustment  

### 11.6 deposits

Stores top-up requests.

**Fields:** id, user_id, asset_symbol, network_name (nullable), amount_expected (nullable), tx_hash (nullable), deposit_address (nullable), status, admin_reviewed_by (nullable), admin_notes (nullable), created_at, updated_at  

### 11.7 markets

Stores prediction markets.

**Fields:** id, title, slug, description, category, asset_symbol, question_text, close_at, settle_at, status, resolution_outcome (nullable), resolution_notes (nullable), created_by, created_at, updated_at  

### 11.8 market_prices

Optional table for price history.

**Fields:** id, market_id, yes_price, no_price, source, created_at  

### 11.9 trades

Stores user trade executions.

**Fields:** id, user_id, market_id, side, amount, price, fee_amount, position_units, status, created_at  

### 11.10 positions

Stores aggregated user market exposure.

**Fields:** id, user_id, market_id, yes_units, no_units, avg_yes_price (nullable), avg_no_price (nullable), status, created_at, updated_at  

### 11.11 commissions

Stores promoter commission records.

**Fields:** id, promoter_id, referred_user_id, trade_id, fee_amount_source, commission_rate, commission_amount, status, created_at, updated_at  

### 11.12 admin_logs

Stores admin actions.

**Fields:** id, admin_user_id, action_type, target_type, target_id, notes, created_at  

---

## 12. Relationships

- one user may have one wallet  
- one user may optionally be linked to one promoter through referral  
- one promoter belongs to one user account  
- one promoter may refer many users  
- one user may have many deposits  
- one user may have many trades  
- one user may have many wallet transactions  
- one market may have many trades  
- one market may have many positions  
- one trade may generate one commission record if the user is referred  

---

## 13. API and Backend Modules

Even if this is built inside a Next.js app, it should be organized like a modular backend.

| Module | Responsibilities |
|--------|------------------|
| **Auth** | signup, login, session validation, role loading |
| **User** | user profile retrieval, dashboard summary, user settings |
| **Promoter** | promoter registration, promo code generation, promoter dashboard metrics, referral list retrieval, commission history retrieval |
| **Referral** | validate promo code, link referred user on signup, retrieve referral stats |
| **Wallet** | wallet creation, wallet balance retrieval, wallet transaction history, ledger creation logic |
| **Deposit** | create deposit request, fetch deposit history, admin approve or reject deposit, update wallet on approval |
| **Market** | create market, edit market, fetch active markets, fetch market detail, close market, settle market |
| **Trade** | validate funds, place trade, debit wallet, record fee, update position, trigger commission logic |
| **Commission** | calculate promoter commission, create commission record, retrieve promoter earnings, admin review commission ledger |
| **Admin** | dashboard stats, user moderation, promoter monitoring, deposit review, market management, commission management, admin logs |

---

## 14. Suggested API Route List

**Auth**

- POST /api/auth/signup  
- POST /api/auth/login  
- POST /api/auth/logout  
- GET /api/auth/me  

**Promoter**

- POST /api/promoters/register  
- GET /api/promoters/me  
- GET /api/promoters/referrals  
- GET /api/promoters/commissions  

**Referral**

- GET /api/referrals/validate-code  

**Wallet**

- GET /api/wallet  
- GET /api/wallet/transactions  

**Deposits**

- POST /api/deposits  
- GET /api/deposits/my  
- PATCH /api/admin/deposits/:id/approve  
- PATCH /api/admin/deposits/:id/reject  

**Markets**

- GET /api/markets  
- GET /api/markets/:id  
- POST /api/admin/markets  
- PATCH /api/admin/markets/:id  
- PATCH /api/admin/markets/:id/close  
- PATCH /api/admin/markets/:id/settle  

**Trades**

- POST /api/trades  
- GET /api/trades/my  

**Portfolio**

- GET /api/portfolio  

**Admin**

- GET /api/admin/dashboard  
- GET /api/admin/users  
- GET /api/admin/promoters  
- GET /api/admin/referrals  
- GET /api/admin/deposits  
- GET /api/admin/trades  
- GET /api/admin/commissions  
- GET /api/admin/wallet-transactions  

---

## 15. User Stories

**User stories for end users**

- As a user, I want to sign up so I can access the platform.  
- As a user, I want to enter a promo code during signup so I can be linked to a promoter.  
- As a user, I want to view my wallet so I can see my available balance.  
- As a user, I want to submit a top-up request so I can fund my account.  
- As a user, I want to browse markets so I can choose which one to join.  
- As a user, I want to place a trade on a yes or no outcome so I can participate in a market.  
- As a user, I want to see my portfolio so I can track my activity.  

**User stories for promoters**

- As a promoter, I want a unique promo code so I can refer users.  
- As a promoter, I want to see how many users signed up through me so I can track my results.  
- As a promoter, I want to see how much commission I generated so I can monitor earnings.  

**User stories for admin**

- As an admin, I want to approve deposits so I can control wallet funding in the MVP.  
- As an admin, I want to create and manage markets so I can run the platform.  
- As an admin, I want to review trades and commissions so I can monitor business activity.  

---

## 16. Edge Cases and Validation Rules

The following cases must be handled:

- invalid promo code at signup  
- duplicate promo code generation attempt  
- top-up request submitted without required data  
- user attempting to trade with insufficient balance  
- user attempting to trade on closed market  
- deposit approval processed twice  
- market settled twice  
- commission generated twice for same trade  
- admin trying to reject already approved deposit  
- broken wallet balance due to missing ledger update  

**Key rule:** Every financial state change must be traceable and idempotent where possible.

---

## 17. Security and Permissions

**Roles**

- user  
- promoter  
- admin  

**Access rules**

- users may only view their own wallet, deposits, trades, and portfolio  
- promoters may only view their own referrals and commissions  
- admins may view all system records  
- only admins may approve deposits and settle markets  

**Security practices**

- validate all API input  
- never trust client-side balance calculations  
- compute financial changes on the server only  
- log admin financial actions  

---

## 18. Build Plan by Phase

| Phase | Deliverables |
|-------|--------------|
| **Phase 1: Foundation** | project setup, auth setup, database schema, role model, basic UI shell |
| **Phase 2: Referral and promoter system** | promoter registration, promo code generation, referral linkage on signup, promoter dashboard basics |
| **Phase 3: Wallet and deposits** | wallet creation, wallet balance display, deposit request flow, admin deposit approval, wallet ledger system |
| **Phase 4: Markets** | admin market creation, market listing page, market detail page, active and closed market states |
| **Phase 5: Trading and portfolio** | trade execution flow, wallet debits, fee calculation, position tracking, portfolio page |
| **Phase 6: Commission engine** | promoter commission calculation, commission ledger, promoter earnings display, admin commission reporting |
| **Phase 7: Admin operations and polish** | admin dashboard, logs, validation hardening, bug fixing, deployment readiness |

---

## 19. Weekly Solo Delivery Plan

Assuming roughly 5 focused hours per day.

| Week | Focus |
|------|--------|
| **Week 1** | finalize scope; create wireframes; setup Next.js, Supabase, Tailwind, shadcn; create database schema; implement auth and roles |
| **Week 2** | implement signup/login flows; build promoter registration; build promo code logic; implement referral capture on signup |
| **Week 3** | build wallet schema and wallet page; build transaction ledger; implement top-up request flow; build deposit history page |
| **Week 4** | build admin deposit review flow; implement deposit approval and rejection; connect wallet updates to approved deposits; test wallet consistency |
| **Week 5** | build admin market creation; build market list page; build market detail page; define trade rules and validations |
| **Week 6** | implement trade placement flow; debit wallet on trade; create position updates; build portfolio page |
| **Week 7** | implement platform fee calculation; build commission engine; connect commission creation to referred trades; build promoter commission view |
| **Week 8** | build admin dashboard views; add reporting summaries; fix bugs; test edge cases; prepare deployment |

---

## 20. Minimum Launch Checklist

Before launch, confirm the following:

- [ ] signup and login work  
- [ ] promoter codes work  
- [ ] referral linkage works  
- [ ] wallet balances reconcile to ledger  
- [ ] deposits can be submitted and approved  
- [ ] markets can be created and displayed  
- [ ] trades debit balance correctly  
- [ ] portfolio updates correctly  
- [ ] fees calculate correctly  
- [ ] commissions are created correctly  
- [ ] admin can review all core entities  
- [ ] all protected routes are locked by role  

---

## 21. Post-MVP Expansion Plan

Once the MVP is stable, possible next steps are:

- real deposit address generation  
- blockchain transaction monitoring  
- automated deposit confirmation  
- withdrawals workflow  
- improved market pricing engine  
- realtime market updates  
- charting improvements  
- promoter payout automation  
- analytics dashboard  
- notifications  
- dispute and resolution workflows  

---

## 22. Recommended Immediate Next Actions

The next actions should be:

1. finalize this blueprint  
2. create wireframes for every page  
3. convert the data model into SQL tables  
4. define route-by-route backend contracts  
5. start Phase 1 implementation  

The best technical next deliverable after this blueprint is:

- SQL schema  
- page wireframe list  
- API contract document  
- folder structure  
- implementation checklist  

---

## 23. Final Recommendation

Since this is a solo build, the correct strategy is to optimize for completion and proof of concept.

**Do not build the hardest infrastructure first.**

Build the product around the core loop:

- promoter brings user  
- user funds wallet  
- user trades market  
- fee is generated  
- promoter commission is tracked  

That loop is enough to validate the business.

Everything else can come later.
