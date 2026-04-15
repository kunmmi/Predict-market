# China Readiness Audit

**Project:** Crypto Prediction Market MVP  
**Audited:** 2026-04-09  
**Auditor:** Architecture review  
**Overall verdict:** No blocking issues in current code. Architecture is clean. Gaps exist in future phases and infrastructure selection.

---

## Summary

The codebase was audited against known China-blocking patterns: Google services, CDN dependencies, hardcoded foreign domains, US-only payment processors, and browser-side third-party scripts. **No blocking issues were found in the current source code.** All external communication flows through Supabase, which is configurable via environment variables.

However, several future phases (payment processing, analytics, email, file uploads) will introduce new external dependencies. Each one needs a CN-safe option selected before building the feature, not after. This document records current findings and marks those future risk points.

---

## Audit Findings

### Section 1 — Fonts & CSS

| # | File | Finding | Severity |
|---|------|---------|----------|
| 1 | `app/layout.tsx` | No Google Fonts import. Font is system default via Tailwind. | **None** |
| 2 | `app/globals.css` | Tailwind directives only. No `@import` from external CDN. | **None** |
| 3 | `tailwind.config.ts` | No `fontFamily` referencing external fonts. | **None** |

**Verdict:** Clean. Tailwind generates CSS locally at build time. No runtime font requests.

---

### Section 2 — Scripts & Analytics

| # | File | Finding | Severity |
|---|------|---------|----------|
| 4 | `app/layout.tsx` | No `<script>` tags. No analytics scripts injected. | **None** |
| 5 | `package.json` | No Google Analytics, Segment, Hotjar, or similar packages. | **None** |

**Verdict:** Clean today. When analytics is added in a future phase, use PostHog (accessible from CN) or a CN-native provider (Baidu Analytics, Umeng). Do **not** use `gtag.js` or Google Analytics — both are blocked.

---

### Section 3 — Maps & Embeds

| # | File | Finding | Severity |
|---|------|---------|----------|
| 6 | All source files | No Google Maps, Mapbox, Leaflet, or YouTube embeds found. | **None** |

**Verdict:** Not applicable to this product (financial platform, no mapping needed).

---

### Section 4 — Authentication & OAuth

| # | File | Finding | Severity |
|---|------|---------|----------|
| 7 | `app/api/auth/signup/route.ts` | Email/password only. No Google OAuth, GitHub OAuth, or social login. | **None** |
| 8 | `app/api/auth/login/route.ts` | Email/password only. | **None** |
| 9 | `lib/supabase/*.ts` | Supabase Auth configured via env vars. Instance URL is configurable. | **None** |

**Verdict:** Clean. Email/password auth works globally. If social login is added later, use WeChat login for CN (not Google or GitHub — both restricted).

---

### Section 5 — Payment Processing

| # | File | Finding | Severity |
|---|------|---------|----------|
| 10 | All source files | No payment processor integrated. Deposits are manual admin approval. | **None (now)** |
| 11 | Future Phase 9 | Payment processor will be added. | **HIGH (future risk)** |

**Verdict:** Not a problem today. **Critical risk point in Phase 9.** Stripe is not available to end-users in Mainland China. If the product will serve CN users, Alipay or WeChat Pay must be implemented using the payment provider abstraction (`lib/services/providers/payment.ts`).

---

### Section 6 — External CDNs & Assets

| # | File | Finding | Severity |
|---|------|---------|----------|
| 12 | `next.config.mjs` | No `images.domains` configured. No remote image sources. | **None** |
| 13 | All source files | No `unpkg.com`, `cdnjs.cloudflare.com`, `jsDelivr`, or similar CDN imports. | **None** |
| 14 | `package.json` | All packages are build-time dependencies. Nothing loaded from CDN at runtime. | **None** |

**Verdict:** Clean. All assets are bundled at build time by Next.js.

---

### Section 7 — Environment & Domain Configuration

| # | File | Finding | Severity |
|---|------|---------|----------|
| 15 | `lib/config.ts` | All external URLs from env vars. No hardcoded domains. | **None** |
| 16 | `.env.local.example` | Only Supabase URL and keys. No hardcoded foreign domains. | **None** |

**Verdict:** Clean. This is the correct pattern. Continue using env vars for all external service URLs.

---

### Section 8 — Supabase (Backend & Auth)

| # | File | Finding | Severity |
|---|------|---------|----------|
| 17 | All Supabase client files | Supabase URL is from `NEXT_PUBLIC_SUPABASE_URL`. Fully configurable. | **None (code)** |
| 18 | Infrastructure (not in code) | Default Supabase instances are hosted on AWS (US-East, EU-West). | **MEDIUM (infra)** |

**Verdict:** Code is clean. However, the default `https://xxx.supabase.co` instances are on AWS infrastructure outside China. This will have latency for CN users and may be blocked by ISPs depending on the routing.

**Recommended fix:** For the CN version, self-host Supabase on Alibaba Cloud or Tencent Cloud infrastructure within China, or use a compatible PostgreSQL backend. The code requires no changes — only the `NEXT_PUBLIC_SUPABASE_URL` env var changes.

---

### Section 9 — Email (Future)

| # | File | Finding | Severity |
|---|------|---------|----------|
| 19 | All source files | No email provider integrated yet. Auth emails handled by Supabase. | **None (now)** |
| 20 | Future email phase | Email notifications will need a provider. | **MEDIUM (future risk)** |

**Verdict:** Not a problem today. When adding transactional email, use the `EmailProvider` interface (`lib/services/providers/email.ts`). For CN: use Alibaba Cloud Direct Mail or Tencent Cloud SES. SendGrid and Mailgun have significant delivery issues in China.

---

### Section 10 — File Storage (Future)

| # | File | Finding | Severity |
|---|------|---------|----------|
| 21 | All source files | No file storage integrated yet. | **None (now)** |
| 22 | Future upload phase | KYC docs, market images, avatars may need storage. | **LOW (future risk)** |

**Verdict:** Not a problem today. When adding storage, use the `StorageProvider` interface (`lib/services/providers/storage.ts`). For CN: prefer Alibaba Cloud OSS or Tencent COS over S3/R2 for performance.

---

## Risk Register

| Risk | Severity | When | Mitigation |
|------|----------|------|-----------|
| Payment processor locked to Stripe | HIGH | Phase 9 | Use `PaymentProvider` interface; implement Alipay/WeChat Pay adapter for CN |
| Analytics locked to Google Analytics | HIGH | When analytics added | Use PostHog (global) + Baidu/Umeng (CN); never use `gtag.js` |
| Supabase on AWS infra | MEDIUM | CN deployment | Self-host Supabase on Alibaba/Tencent infra for CN |
| Email delivery failures in CN | MEDIUM | When email added | Use Alibaba Cloud Direct Mail for CN via `EmailProvider` interface |
| Social login locked to Google/GitHub | MEDIUM | If social login added | Use WeChat login for CN; keep as optional, not required |
| Asset CDN inaccessible in CN | LOW | When CDN added | Use `NEXT_PUBLIC_ASSET_BASE_URL` to point to domestic CDN for CN |
| Font loading from Google Fonts | LOW | If fonts added | Self-host fonts or use system fonts (current state is already safe) |

---

## What Was Fixed

The following architecture changes were made during this audit to prevent future lock-in:

1. **`lib/config/regions.ts`** — Region types and per-region feature flags
2. **`lib/config/runtime.ts`** — Runtime region detection; typed provider selection
3. **`lib/services/providers/analytics.ts`** — Analytics interface (swap global ↔ CN without logic change)
4. **`lib/services/providers/payment.ts`** — Payment interface (Stripe ↔ Alipay/WeChat Pay)
5. **`lib/services/providers/email.ts`** — Email interface (Resend ↔ Alibaba Mail)
6. **`lib/services/providers/storage.ts`** — Storage interface (S3/R2 ↔ OSS/COS)
7. **`lib/services/registry.ts`** — Centralized provider instantiation with CN swap points
8. **`.env.example`** — Full regional env template with CN alternatives documented
