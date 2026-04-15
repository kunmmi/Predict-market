# Future China Rollout Plan

**Last updated:** 2026-04-09  
**Status:** Global-first build in progress (Phase 7 of 20). CN version not started.

---

## What Is Already Prepared

The following groundwork is in place so the CN version can be built incrementally without a rewrite:

| Prepared | File | What it does |
|----------|------|-------------|
| Region type system | `lib/config/regions.ts` | Defines `global` / `cn` types and per-region feature flags |
| Runtime config | `lib/config/runtime.ts` | Reads `APP_REGION` env var; exposes typed runtime settings |
| Analytics interface | `lib/services/providers/analytics.ts` | Swap PostHog ↔ Baidu without touching business logic |
| Payment interface | `lib/services/providers/payment.ts` | Swap Stripe ↔ Alipay/WeChat Pay when Phase 9 lands |
| Email interface | `lib/services/providers/email.ts` | Swap Resend ↔ Alibaba Mail when notifications land |
| Storage interface | `lib/services/providers/storage.ts` | Swap S3/R2 ↔ Alibaba OSS when uploads land |
| Provider registry | `lib/services/registry.ts` | Single file to wire CN adapters — clearly marked with comments |
| No-op analytics | `lib/services/adapters/analytics/noop.ts` | Safe fallback while analytics is not integrated |
| Env template | `.env.example` | Documents both GLOBAL and CN_FUTURE env vars with comments |
| Audit doc | `docs/china-readiness-audit.md` | Full audit of blocking patterns; risk register |
| Architecture doc | `docs/architecture-regionalization.md` | How to add new providers and CN variants |
| Deployment doc | `docs/deployment-regions.md` | Env var examples for both deployment targets |

No CN-specific code is active. Setting `APP_REGION=cn` today falls through to the same no-op / global implementations.

---

## What Still Needs to Be Done for a CN Version

### Compliance & Legal (before any code)

| Item | Notes |
|------|-------|
| ICP license (`ICP备案`) | Required to operate a website on servers hosted in China. Apply through your hosting provider (Alibaba, Tencent, etc.). Takes 2–4 weeks. |
| Data localization review | Financial data for CN users must stay on domestic servers. No cross-border data transfer for PII without legal review. |
| Payment license (if needed) | Accepting CNY payments may require a Payment Business License (`支付业务许可证`) or a partnership with a licensed payment institution. |
| Real-name verification | CN financial regulations may require KYC / real-name verification (`实名认证`) for users. |

### Infrastructure

| Item | Action |
|------|--------|
| Domestic server | Provision VPC on Alibaba Cloud ECS or Tencent Cloud CVM |
| Self-hosted Supabase | Deploy Supabase on domestic infra (Docker + PostgreSQL), or use a compatible managed PostgreSQL |
| Apply schema | Run `docs/SCHEMA.sql` on the CN database instance |
| Domestic CDN | Alibaba Cloud CDN or Tencent Cloud CDN in front of the app and storage |

### Provider Adapters to Implement

Each adapter is one file in `lib/services/adapters/<category>/`. The interface is already defined.

| Provider | File to create | Interface |
|----------|---------------|-----------|
| Baidu Analytics | `adapters/analytics/baidu.ts` | `AnalyticsProvider` |
| Alipay | `adapters/payment/alipay.ts` | `PaymentProvider` |
| WeChat Pay | `adapters/payment/wechatpay.ts` | `PaymentProvider` |
| Alibaba Cloud Direct Mail | `adapters/email/alimail.ts` | `EmailProvider` |
| Alibaba Cloud OSS | `adapters/storage/aliyun-oss.ts` | `StorageProvider` |

After implementing each adapter: uncomment the relevant factory function in `lib/services/registry.ts` and flip the feature flag in `lib/config/regions.ts`.

### Frontend Considerations

| Item | Notes |
|------|-------|
| System font stack | Already using system fonts via Tailwind. No action needed. |
| No external scripts | Already clean. Maintain this discipline when adding CN analytics. |
| Analytics script loading | Baidu Analytics requires a `<script>` tag. Load it conditionally based on `runtime.region === 'cn'` in `app/layout.tsx`. |
| WeChat OAuth (if social login added) | Load WeChat JS SDK only when `runtime.region === 'cn'`. |
| Localization | If the CN version needs Simplified Chinese UI, add i18n support (e.g., `next-intl`). |

---

## Recommended Rollout Phases

### Phase 1 — Global-First (current)

**Goal:** Ship and validate the product with global users.

- Complete MVP phases 1–20 as planned
- All providers are no-op or global (Stripe, PostHog, Resend, etc.)
- Deploy to Vercel + Supabase cloud
- No CN-specific work needed

**Exit criteria:** Product is live, users are trading, business model is validated.

---

### Phase 2 — Audit & Provider Hardening

**Goal:** Ensure no new global-only dependencies were introduced during MVP build, and wire up the first real providers.

- Re-run audit against the completed codebase (especially Phase 9–16 additions)
- Implement analytics (PostHog for global — avoid Google Analytics)
- Implement email notifications (Resend for global)
- Implement payment processing behind `PaymentProvider` interface
- Implement file storage behind `StorageProvider` interface
- Ensure every new provider goes through the registry

**Exit criteria:** All providers use the abstraction layer. No hardcoded foreign CDN URLs introduced.

---

### Phase 3 — CN-Specific Frontend & Domain

**Goal:** CN-ready frontend that can run on domestic infra.

- Obtain ICP license and domestic domain
- Implement CN provider adapters (Baidu Analytics, Alibaba Mail)
- Add CN analytics script loading to `app/layout.tsx` conditionally
- Test the app with `APP_REGION=cn` and CN env vars pointing to stub/test providers
- Verify all pages load with no blocked external requests

**Exit criteria:** App runs fully offline from external services under `APP_REGION=cn`. No browser requests to non-domestic hosts.

---

### Phase 4 — CN Infrastructure & Payment

**Goal:** Full CN deployment with domestic infra and payment processing.

- Provision domestic server and self-host Supabase
- Implement Alipay / WeChat Pay adapters
- Configure CN CDN (`NEXT_PUBLIC_ASSET_BASE_URL`)
- Deploy CN instance with `APP_REGION=cn` env
- End-to-end smoke test from within Mainland China network
- Set up monitoring and alerting on domestic infra

**Exit criteria:** CN users can sign up, deposit via Alipay/WeChat Pay, trade on markets, and withdraw — fully within domestic infrastructure.

---

## Services That May Need Replacement (Summary)

| Service | Current (Global) | CN Alternative | Risk if not replaced |
|---------|-----------------|----------------|---------------------|
| Supabase infra | AWS US/EU | Self-hosted on Alibaba/Tencent | High latency; potential blocking |
| Analytics | None (planned: PostHog) | Baidu Analytics / Umeng | Blocked in CN; no tracking |
| Payment | None (planned: Stripe) | Alipay / WeChat Pay | Stripe unusable by CN end-users |
| Email | None (planned: Resend) | Alibaba Cloud Direct Mail | Poor deliverability to CN inboxes |
| Storage/CDN | None (planned: Vercel/S3) | Alibaba OSS + CDN | Slow load times; potential blocking |
| Auth emails | Supabase default SMTP | Reconfigure to domestic SMTP | Auth emails undeliverable to CN |
| Social login (if added) | Google / GitHub | WeChat OAuth | Google/GitHub OAuth blocked |
| Maps (if added) | Google Maps | Baidu Maps / Amap | Google Maps blocked |

---

## Key Principle

> Build the global version correctly. Wire every external service through an interface. The CN version then becomes a deployment config + a set of adapter implementations — not a rewrite.
