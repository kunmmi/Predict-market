# Crypto Prediction Market — MVP

A referral-driven crypto prediction market platform (MVP). Promoters get promo codes; users sign up (optionally with a code), fund an in-app wallet via admin-approved deposits, and trade on yes/no crypto markets; promoters earn a share of platform fees from referred users’ activity.

## Source of truth

- **Product and scope:** [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- **Database:** [docs/SCHEMA.sql](docs/SCHEMA.sql) (PostgreSQL / Supabase)
- **Deployment checklist:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Build steps:** [BUILD-PLAN.md](BUILD-PLAN.md)
- **Cursor / dev rules:** [docs/CURSOR_RULES.md](docs/CURSOR_RULES.md)

## Stack

- **App:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js Route Handlers / server actions, optional service layer in `lib/services/`
- **Data & auth:** Supabase (PostgreSQL, Supabase Auth)
- **Hosting:** Vercel

## Getting started

1. **Install dependencies**  
   - `npm install`

2. **Supabase**  
   - Create a Supabase project at [supabase.com](https://supabase.com).  
   - In the SQL Editor, run the full contents of **docs/SCHEMA.sql** (tables, enums, functions, triggers, views, RLS).

3. **Environment**  
   - Copy `.env.local.example` to `.env.local`.  
   - Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project (Settings → API).

4. **Run**  
   - `npm run dev` — open [http://localhost:3000](http://localhost:3000)

## Scheduled market price updates

- The live market repricing endpoint is `GET /api/cron/update-market-prices`.
- It requires `Authorization: Bearer ${CRON_SECRET}`.
- If you are not using a Vercel plan that supports hourly cron, this repo includes [`.github/workflows/update-market-prices.yml`](.github/workflows/update-market-prices.yml).
- Add these GitHub Actions repository secrets:
  - `APP_URL`: your deployed app base URL, for example `https://your-app.vercel.app`
  - `CRON_SECRET`: the same secret configured in your deployment environment

## Project layout

- `app/` — Routes (public, auth, dashboard, admin) and API
- `components/` — UI and feature components
- `lib/` — Supabase, auth, validations, services, helpers
- `types/` — Domain and DTO types
- `docs/` — BLUEPRINT.md, SCHEMA.sql, CURSOR_RULES.md
- `tasks/` — IMPLEMENTATION_CHECKLIST.md, PHASE_TRACKER.md

## Implementation status

See [tasks/PHASE_TRACKER.md](tasks/PHASE_TRACKER.md) and [tasks/IMPLEMENTATION_CHECKLIST.md](tasks/IMPLEMENTATION_CHECKLIST.md). Work through BUILD-PLAN.md Phase 1 (foundation and bootstrap) first.
