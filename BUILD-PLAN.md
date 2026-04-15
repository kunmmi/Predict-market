# Cursor Step-by-Step Build Plan

## 0. Core rule for Cursor before anything else

Tell Cursor these two files are the source of truth:

- docs/BLUEPRINT.md
- docs/SCHEMA.sql

And give it this rule:

- do not invent features outside the blueprint
- do not change database structure unless explicitly told
- do not skip validation
- do not generate placeholder logic where real logic is already defined in the schema
- implement in small reviewed steps
- after each step, explain what was added, what files were changed, and what is left

---

## 1. Project preparation

### 1.1 Create project folder

**Tasks:**

- create project root
- create docs folder
- add the blueprint file
- add the schema file
- add a tasks folder for implementation tracking
- add a README.md

**Subtasks:**

- save blueprint as docs/BLUEPRINT.md
- save schema as docs/SCHEMA.sql
- create tasks/IMPLEMENTATION_CHECKLIST.md
- create tasks/PHASE_TRACKER.md

### 1.2 Define build rules in repo

**Tasks:**

- create an instruction file for Cursor
- define coding standards
- define architecture rules

**Subtasks:**

- create docs/CURSOR_RULES.md
- state stack choices
- state naming conventions
- state file organization rules
- state validation rules
- state security rules
- state "no feature drift" rule

**Suggested file list:**

- docs/BLUEPRINT.md
- docs/SCHEMA.sql
- docs/CURSOR_RULES.md

---

## 2. Bootstrap the application

### 2.1 Initialize app

**Tasks:**

- create a Next.js app with TypeScript and App Router
- configure linting
- configure formatting
- configure absolute imports

**Subtasks:**

- use latest stable Next.js
- enable TypeScript
- enable App Router
- enable ESLint
- configure tsconfig.json paths
- add @/* alias

### 2.2 Install base dependencies

**Tasks:**

- install UI dependencies
- install Supabase dependencies
- install validation dependencies
- install utility dependencies

**Subtasks:**

- install Tailwind CSS
- install shadcn/ui
- install @supabase/supabase-js
- install @supabase/ssr
- install zod
- install react-hook-form
- install @hookform/resolvers
- install clsx
- install class-variance-authority
- install lucide-react
- install date-fns

### 2.3 Configure Tailwind and design system

**Tasks:**

- configure Tailwind
- initialize shadcn/ui
- set up global theme tokens

**Subtasks:**

- create app/globals.css
- configure theme variables
- add base typography styles
- add layout spacing conventions
- define card, table, form, and badge usage patterns

### 2.4 Create base project structure

**Tasks:**

- create all main folders
- separate app routes, components, lib, types, and services

**Suggested structure:**

```
app/
  (public)/
  (auth)/
  (dashboard)/
  admin/
  api/
components/
  ui/
  layout/
  auth/
  markets/
  wallet/
  promoter/
  portfolio/
  admin/
lib/
  supabase/
  auth/
  validations/
  services/
  helpers/
  constants/
types/
docs/
tasks/
```

**Subtasks:**

- create route groups
- create reusable layout components
- create shared utility functions
- create type files for each domain

---

## 3. Environment and configuration

### 3.1 Create environment variable structure

**Tasks:**

- create local env template
- document each env variable
- separate client-safe and server-only variables

**Subtasks:**

- create .env.local.example
- add Supabase URL
- add Supabase anon key
- add service role key placeholder
- add app URL
- add admin email placeholder

### 3.2 Create config files

**Tasks:**

- create centralized config access
- validate config on app startup

**Subtasks:**

- create lib/config.ts
- parse env values safely
- throw meaningful errors when required env vars are missing

---

## 4. Supabase setup

### 4.1 Connect project to Supabase

**Tasks:**

- create Supabase project
- run schema
- verify tables and functions
- verify views and triggers

**Subtasks:**

- open SQL editor
- paste docs/SCHEMA.sql
- run schema
- fix any SQL errors
- confirm all tables exist
- confirm all views exist
- confirm all functions exist

### 4.2 Set up auth integration

**Tasks:**

- configure email auth
- configure redirect URLs
- confirm session flow

**Subtasks:**

- enable email/password auth
- set site URL
- set redirect URL for local development
- test signup
- test login
- test logout

### 4.3 Verify schema side effects

**Tasks:**

- confirm profile creation trigger works
- confirm wallet creation trigger works

**Subtasks:**

- create test user
- check profiles
- check wallets
- confirm one wallet per profile
- confirm email populated correctly

### 4.4 Create admin user setup process

**Tasks:**

- define how admin role will be assigned
- document manual initial admin creation

**Subtasks:**

- create first account manually
- update profile role to admin
- verify admin-only routes later use this role

---

## 5. Architecture pass before feature work

### 5.1 Generate domain model map

**Tasks:**

- map blueprint concepts to actual modules
- map schema tables to app services

**Subtasks:**

- users -> auth/profile module
- promoters -> promoter module
- referrals -> referral module
- wallets -> wallet module
- deposits -> deposit module
- markets -> market module
- trades -> trade module
- positions -> portfolio module
- commissions -> commission module
- admin_logs -> admin module

### 5.2 Create types from schema

**Tasks:**

- create TypeScript domain types
- create DTO types
- create form schemas

**Subtasks:**

- types/profile.ts
- types/promoter.ts
- types/referral.ts
- types/wallet.ts
- types/deposit.ts
- types/market.ts
- types/trade.ts
- types/position.ts
- types/commission.ts

### 5.3 Create validation schemas

**Tasks:**

- create Zod schemas for all forms and API inputs

**Subtasks:**

- signup schema
- login schema
- promoter registration schema
- deposit request schema
- market create schema
- market update schema
- trade placement schema
- market settlement schema
- commission status update schema

---

## 6. Authentication module

### 6.1 Build auth utilities

**Tasks:**

- create server Supabase client
- create browser Supabase client
- create auth session helpers

**Subtasks:**

- lib/supabase/server.ts
- lib/supabase/client.ts
- lib/auth/get-current-user.ts
- lib/auth/require-user.ts
- lib/auth/require-admin.ts
- lib/auth/require-promoter.ts

### 6.2 Build auth pages

**Tasks:**

- create signup page
- create login page
- create logout action
- create auth redirect handling

**Subtasks:**

- basic form UI
- client-side validation
- server action or API route
- error messaging
- success redirect

### 6.3 Role-aware route protection

**Tasks:**

- prevent unauthenticated access
- prevent non-admin access to admin routes
- prevent non-promoter access to promoter routes

**Subtasks:**

- create middleware or route-level guards
- redirect unauthorized users
- handle no-session state gracefully

### 6.4 Profile bootstrap checks

**Tasks:**

- after login, load profile
- ensure profile exists
- handle missing profile edge case

**Subtasks:**

- fetch profile by auth_user_id
- show fallback error page if missing
- document repair action if trigger failed

---

## 7. Global app shell

### 7.1 Create layouts

**Tasks:**

- public layout
- auth layout
- dashboard layout
- admin layout

**Subtasks:**

- top navigation
- sidebar navigation
- mobile nav
- page container
- section header
- breadcrumbs

### 7.2 Create reusable UI primitives

**Tasks:**

- stat cards
- data tables
- empty states
- loading states
- error states
- modal/dialog wrappers

**Subtasks:**

- table wrapper
- filter bar
- pagination placeholder
- status badge component
- currency/number formatting helpers

---

## 8. Profile and user dashboard module

### 8.1 Build current user dashboard

**Tasks:**

- create user dashboard landing page
- show summary cards

**Subtasks:**

- current wallet balance
- number of open positions
- recent deposits
- recent trades
- linked promoter indicator if applicable

### 8.2 Build profile/settings page

**Tasks:**

- display profile details
- allow limited editable profile fields

**Subtasks:**

- full name
- email display
- role display
- referral info display
- account status display

---

## 9. Promoter module

### 9.1 Define promoter onboarding flow

**Tasks:**

- decide whether promoter is separate signup or role upgrade
- follow blueprint rules

**Subtasks:**

- use dedicated promoter registration page
- create promoter profile using schema function if desired
- assign role correctly

### 9.2 Build promoter registration page

**Tasks:**

- form for promoter registration
- collect display name
- create promoter record
- generate promo code

**Subtasks:**

- validate current user is eligible
- call backend function
- handle duplicate promoter prevention
- show generated promo code on success

### 9.3 Build promoter dashboard

**Tasks:**

- show promoter stats
- show referral metrics
- show commission metrics

**Subtasks:**

- total referred users
- active referred users
- pending commissions
- approved commissions
- paid commissions
- promo code display and copy action

### 9.4 Build promoter referral list page

**Tasks:**

- list referred users
- show signup date
- show activity indicators

**Subtasks:**

- query referrals
- join profile info where allowed
- show empty state

### 9.5 Build promoter commission history page

**Tasks:**

- list commissions
- group by status
- show originating trade reference

**Subtasks:**

- pending
- approved
- paid
- total summary card

---

## 10. Referral system module

### 10.1 Capture promo code in signup flow

**Tasks:**

- add optional promo code field to signup
- validate code before account creation or immediately after
- link user to promoter

**Subtasks:**

- promo code input UI
- validation service
- lookup promoter by code
- set referred_by_promoter_id
- ensure referral row is created correctly

### 10.2 Build referral validation utility

**Tasks:**

- reusable code validation helper
- return promoter metadata if valid

**Subtasks:**

- accept promo code
- normalize input
- fetch promoter
- confirm active status
- return helpful error message if invalid

### 10.3 Test referral edge cases

**Tasks:**

- invalid code
- inactive promoter
- missing code
- duplicate referral attempts

**Subtasks:**

- verify no broken insert occurs
- verify referred user can only have one referral link

---

## 11. Wallet module

### 11.1 Build wallet page

**Tasks:**

- show wallet summary
- show available balance
- show reserved balance
- show total balance

**Subtasks:**

- fetch wallet by profile
- display summary cards
- show status badge
- add navigation to top-up page

### 11.2 Build wallet transaction history

**Tasks:**

- list ledger entries
- support transaction type badges
- support direction badges

**Subtasks:**

- deposit credits
- trade debits
- fee debits
- settlement credits
- adjustments

### 11.3 Build wallet helpers in code

**Tasks:**

- create server-side wallet fetcher
- create wallet summary formatter

**Subtasks:**

- balance formatting
- asset display convention
- transaction description mapping

---

## 12. Deposit module

### 12.1 Build top-up page

**Tasks:**

- create deposit request form
- let user choose supported asset
- optionally add amount expected
- optionally add tx hash placeholder

**Subtasks:**

- supported asset dropdown
- network field
- amount input
- transaction hash field
- submit button
- instructions section

### 12.2 Build deposit submission backend

**Tasks:**

- validate input
- insert deposit row
- return success response

**Subtasks:**

- verify current user
- map profile id
- create record in deposits
- set status pending

### 12.3 Build deposit history page or section

**Tasks:**

- list all deposit requests for current user
- show status and timestamps

**Subtasks:**

- pending
- approved
- rejected
- cancelled
- admin notes if present

### 12.4 Admin deposit review UI

**Tasks:**

- admin deposits table
- filters by status
- approve and reject actions

**Subtasks:**

- pending deposits first
- modal for approval
- optional amount received override
- admin notes input
- rejection notes input

### 12.5 Admin deposit review backend

**Tasks:**

- call schema functions
- log action
- refresh data

**Subtasks:**

- use approve_deposit
- use reject_deposit
- catch already-processed state
- show success/error messages

### 12.6 Deposit testing

**Tasks:**

- create pending deposit
- approve deposit
- confirm wallet credited
- reject deposit
- confirm wallet unchanged

**Subtasks:**

- check deposit row
- check wallet row
- check wallet transaction row
- check admin log row

---

## 13. Market module

### 13.1 Build market entity service

**Tasks:**

- fetch public market list
- fetch single market
- fetch status-filtered markets

**Subtasks:**

- active markets
- closed markets
- settled markets
- draft markets for admin

### 13.2 Build market listing page

**Tasks:**

- display market cards or table
- support filtering
- support sorting

**Subtasks:**

- by asset
- by status
- by close date
- by newest

### 13.3 Build market detail page

**Tasks:**

- show full market question
- show description
- show rules
- show status
- show close and settle times
- show yes/no price display

**Subtasks:**

- current displayed price
- outcome buttons
- trade form section
- recent activity placeholder

### 13.4 Build admin market creation page

**Tasks:**

- create market form
- validate form
- insert market row

**Subtasks:**

- title
- slug
- description
- category
- asset symbol
- question text
- rules text
- close time
- settle time
- initial status

### 13.5 Build admin market edit page

**Tasks:**

- edit market metadata before settlement
- protect fields depending on state

**Subtasks:**

- update description
- update rules
- update close/settle time if still allowed
- change status draft -> active
- close market manually if needed

### 13.6 Build admin market settlement flow

**Tasks:**

- settle market by outcome
- capture notes
- update positions and trades
- log admin action

**Subtasks:**

- choose yes/no/cancelled
- add resolution notes
- confirm settlement action
- execute settlement function
- refresh related views

---

## 14. Market pricing module

### 14.1 Decide MVP pricing source

**Tasks:**

- decide how yes/no prices are displayed in V1
- keep it simple

**Subtasks:**

- static seeded price
- manually updated admin-set price
- internal table-driven price history

### 14.2 Build market price display logic

**Tasks:**

- fetch latest price record
- calculate complementary price if needed
- show yes/no probabilities

**Subtasks:**

- read latest market_prices
- default gracefully if no price exists
- format percentages

### 14.3 Admin market price management

**Tasks:**

- allow admin to add/update current displayed prices

**Subtasks:**

- admin action form
- validate yes/no sums to 1
- create price history row

---

## 15. Trade module

### 15.1 Build trade form UI

**Tasks:**

- select side yes/no
- enter amount
- show current price
- estimate units
- show fee preview
- confirm submission

**Subtasks:**

- amount input validation
- price display
- unit calculation preview
- wallet balance display
- insufficient balance warning

### 15.2 Build trade backend

**Tasks:**

- validate market
- validate balance
- validate trade amount
- place trade

**Subtasks:**

- check market is active
- check market not closed
- calculate fee
- call trade function or implement server-side transaction safely
- return updated balances and position summary

### 15.3 Build trade history page/section

**Tasks:**

- show user trades
- filter by market and status

**Subtasks:**

- executed
- settled
- cancelled
- date sorting

### 15.4 Fix schema logic issue before using place_trade

**Tasks:**

- update place_trade() so fee is not double-debited
- verify wallet math

**Subtasks:**

- remove combined amount+fee debit
- debit trade amount once
- debit fee separately once
- retest trade flow

### 15.5 Trade testing

**Tasks:**

- funded wallet trade succeeds
- insufficient wallet trade fails
- inactive market trade fails
- referral-linked user trade creates commission

**Subtasks:**

- inspect trade row
- inspect wallet transaction rows
- inspect position row
- inspect commission row

---

## 16. Portfolio module

### 16.1 Build portfolio page

**Tasks:**

- show open positions
- show settled positions
- show pnl values from schema
- show related markets

**Subtasks:**

- market title
- side exposure
- units
- average entry price
- position status
- pnl amount

### 16.2 Add portfolio summaries

**Tasks:**

- total open positions
- total settled positions
- wallet summary
- recent market outcomes

**Subtasks:**

- grouped cards
- empty states
- loading states

---

## 17. Commission module

### 17.1 Build commission service layer

**Tasks:**

- fetch promoter commissions
- fetch commission totals
- fetch per-trade commission records

**Subtasks:**

- status grouping
- date ordering
- totals aggregation

### 17.2 Build admin commissions page

**Tasks:**

- list all commissions
- filter by status
- filter by promoter
- filter by referred user

**Subtasks:**

- pending list
- approved list
- paid list
- detail drawer or modal

### 17.3 Optional commission state management

**Tasks:**

- allow admin to mark approved
- allow admin to mark paid

**Subtasks:**

- status transition validation
- timestamp updates
- admin log record

---

## 18. Admin module

### 18.1 Build admin route protection

**Tasks:**

- only admins can access /admin
- all admin APIs must check role

**Subtasks:**

- profile role lookup
- redirect unauthorized access
- protect server actions and route handlers

### 18.2 Build admin dashboard

**Tasks:**

- use dashboard summary view
- show key business metrics

**Subtasks:**

- total profiles
- total promoters
- total referrals
- total deposits
- approved deposits
- active markets
- total trades
- trade volume
- platform fees
- promoter commissions

### 18.3 Build admin user management page

**Tasks:**

- list users
- show role and status
- show referral link if present

**Subtasks:**

- search by email
- filter by role
- filter by status

### 18.4 Build admin promoter management page

**Tasks:**

- list promoters
- show promo codes
- show commission rate
- show total commissions

**Subtasks:**

- search
- status badge
- profile link
- stats summary

### 18.5 Build admin referrals page

**Tasks:**

- inspect promoter-user relationships

**Subtasks:**

- promoter name
- promo code
- referred user
- created date

### 18.6 Build admin trades page

**Tasks:**

- list all trades
- inspect market activity

**Subtasks:**

- user
- market
- side
- amount
- price
- fee
- created date

### 18.7 Build admin wallet ledger page

**Tasks:**

- list all wallet transactions
- filter by type and user

**Subtasks:**

- credits
- debits
- reference links
- time filter

### 18.8 Build admin logs page

**Tasks:**

- display admin actions
- allow chronological review

**Subtasks:**

- action type
- target table
- target id
- notes
- timestamp

---

## 19. Service layer cleanup

### 19.1 Create domain services

**Tasks:**

- avoid putting all logic directly in pages or routes
- create reusable service functions

**Suggested files:**

- lib/services/profile.service.ts
- lib/services/promoter.service.ts
- lib/services/referral.service.ts
- lib/services/wallet.service.ts
- lib/services/deposit.service.ts
- lib/services/market.service.ts
- lib/services/trade.service.ts
- lib/services/portfolio.service.ts
- lib/services/commission.service.ts
- lib/services/admin.service.ts

### 19.2 Create repository/query helpers

**Tasks:**

- group raw Supabase queries by domain
- keep service functions cleaner

---

## 20. API and server action strategy

### 20.1 Decide where to use route handlers vs server actions

**Tasks:**

- use server actions for forms where appropriate
- use route handlers for reusable API endpoints

**Subtasks:**

- auth forms
- deposit forms
- admin approve/reject flows
- trade placement
- market creation

### 20.2 Standardize response format

**Tasks:**

- success response shape
- error response shape
- field validation error shape

**Subtasks:**

- success: boolean
- message: string
- data
- errors

---

## 21. Error handling and edge cases

### 21.1 Create app-wide error helpers

**Tasks:**

- normalize backend errors
- show clean frontend messages

**Subtasks:**

- auth errors
- validation errors
- unauthorized errors
- not found errors
- insufficient balance errors
- duplicate action errors

### 21.2 Handle financial edge cases

**Tasks:**

- deposit cannot be approved twice
- market cannot be settled twice
- commission cannot be generated twice
- user cannot trade without funds

**Subtasks:**

- safe retries
- idempotent patterns where possible
- confirm DB constraints support this

---

## 22. QA and test plan

### 22.1 Manual QA checklist

**Tasks:**

- convert blueprint flows into manual test cases

**Subtasks:**

- signup without promo code
- signup with promo code
- promoter registration
- deposit submit
- deposit approve
- deposit reject
- market create
- market activate
- trade place
- market settle
- promoter commission review

### 22.2 Create testing notes file

**Tasks:**

- create a persistent test log

**Subtasks:**

- tasks/TEST_CASES.md
- tasks/BUG_LOG.md
- tasks/KNOWN_LIMITATIONS.md

### 22.3 Add minimal automated testing later

**Tasks:**

- unit test validation functions
- unit test helper functions
- integration test critical flows later

---

## 23. Seed and dev data

### 23.1 Create seed script

**Tasks:**

- create admin seed
- create sample promoter
- create sample users
- create sample markets
- create sample prices

**Subtasks:**

- active market
- closed market
- settled market
- sample deposits
- sample trades if useful

### 23.2 Create demo data scenario

**Tasks:**

- promoter with referred users
- funded wallets
- commission records

This helps UI development a lot.

---

## 24. Documentation inside repo

### 24.1 Create implementation documentation

**Tasks:**

- document setup
- document env vars
- document Supabase setup
- document schema run instructions

**Subtasks:**

- README.md
- local setup steps
- Supabase setup steps
- launch commands
- troubleshooting

### 24.2 Create developer operating guide

**Tasks:**

- tell Cursor how to continue work later without losing context

**Subtasks:**

- reference blueprint
- reference schema
- reference completed phases
- reference pending phases

---

## 25. Deployment prep

### 25.1 Prepare for Vercel deployment

**Tasks:**

- configure environment variables
- verify production build
- verify auth redirect URLs

**Subtasks:**

- local build test
- production env setup
- callback URL verification

### 25.2 Production safety checks

**Tasks:**

- ensure admin email/account exists
- ensure public routes are safe
- ensure private routes are protected

**Subtasks:**

- test with normal user
- test with promoter
- test with admin
- test without login

---

## 26. Launch-ready MVP checklist

### 26.1 Functional

**Tasks:**

- auth works
- promoter flow works
- referral linkage works
- deposits work
- wallet ledger works
- markets show
- trades execute
- positions update
- commissions record
- admin oversight works

### 26.2 UI

**Tasks:**

- no broken pages
- no raw errors
- loading states exist
- empty states exist
- forms show validation

### 26.3 Data

**Tasks:**

- wallet balances reconcile
- deposits map to wallet credits
- trades map to wallet debits
- commissions map to trades
- settlements map to payouts

---

## 27. Best way to use this with Cursor

Use Cursor in phases, not one giant prompt.

For each phase, do this:

### 27.1 Give Cursor context

Tell Cursor to read:

- docs/BLUEPRINT.md
- docs/SCHEMA.sql
- docs/CURSOR_RULES.md

### 27.2 Give one phase only

Example:

- "Implement Phase 1 foundation only."
- "Do not touch later modules."
- "List files you will create before generating code."

### 27.3 Force review before code

Ask Cursor to first return:

- files to create
- files to update
- assumptions
- risks
- validation steps

Then let it generate code.

### 27.4 Make Cursor self-check every phase

After each phase, tell Cursor to provide:

- what was completed
- what remains
- any schema mismatch found
- any bug risk found
- test steps to verify it

---

## 28. Recommended phase order for Cursor execution

Follow this exact order:

1. Foundation and project bootstrap
2. Supabase and auth setup
3. Types, validation, and shared services
4. Layouts and route protection
5. User dashboard and profile
6. Promoter registration and promoter dashboard
7. Referral capture in signup
8. Wallet page and ledger history
9. Deposit request flow
10. Admin deposit review
11. Market listing and detail pages
12. Admin market creation and editing
13. Market prices display
14. Trade flow
15. Portfolio page
16. Commission tracking
17. Admin dashboard and management pages
18. QA pass and bug fixes
19. Seed/demo data
20. Deployment prep

---

## 29. Very important Cursor constraints

Tell Cursor all of this explicitly:

- do not rewrite the schema unless necessary
- do not use mock data where real DB queries are already possible
- do not skip role protection
- do not put financial logic only on the client
- do not calculate wallet truth from UI state
- do not bypass ledger entries
- do not invent tables that are not in the schema unless approved
- flag any mismatch between blueprint and schema before coding
- code must be modular and production-structured, even if MVP
