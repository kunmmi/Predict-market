# Deployment: Regional Configuration

**Last updated:** 2026-04-09

---

## Overview

The app supports two deployment targets:

| Target | Status | Description |
|--------|--------|-------------|
| `GLOBAL` | **Active** | Standard global deployment (Vercel + Supabase cloud) |
| `CN_FUTURE` | **Planned** | China-optimized deployment (domestic infra, CN-compliant providers) |

Each deployment is a separate instance with its own `.env` file. There is no runtime geo-routing between them — each serves its intended region independently.

---

## GLOBAL Deployment

### Environment variables

```bash
# Region
APP_REGION=global

# Supabase — use any available region (US-East, EU-West, AP-Southeast, etc.)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Analytics (optional — leave as 'none' until PostHog/Mixpanel is configured)
NEXT_PUBLIC_ANALYTICS_PROVIDER=none
# NEXT_PUBLIC_ANALYTICS_ID=phc_...

# Payment (Phase 9+)
NEXT_PUBLIC_PAYMENT_PROVIDER=none
# When Stripe is ready:
# NEXT_PUBLIC_PAYMENT_PROVIDER=stripe
# STRIPE_SECRET_KEY=sk_live_...
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# Email (when notifications are needed)
EMAIL_PROVIDER=none
# When Resend is ready:
# EMAIL_PROVIDER=resend
# RESEND_API_KEY=re_...
# DEFAULT_FROM_EMAIL=noreply@yourdomain.com

# Storage (when file uploads are needed)
STORAGE_PROVIDER=none
# When Vercel Blob is ready:
# STORAGE_PROVIDER=vercel-blob
# BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

### Hosting

- **Frontend:** Vercel (recommended) or any Node.js-compatible host
- **Database + Auth:** Supabase cloud (choose a region close to your users)
- **CDN:** Vercel Edge Network (included) or Cloudflare

### Checklist

- [ ] Supabase project created and schema applied (`docs/SCHEMA.sql`)
- [ ] Environment variables set in Vercel dashboard (or host equivalent)
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Custom domain configured and SSL active
- [ ] `SUPABASE_SERVICE_ROLE_KEY` stored as a secret (not exposed to browser)
- [ ] Initial admin account created and role set in database

---

## CN_FUTURE Deployment

> **Not yet active.** This section documents what needs to be done when the China version is built.

### Prerequisites before this deployment is possible

1. **ICP license** (`ICP备案`) — Required for any website hosted in Mainland China. Apply through your hosting provider.
2. **Domestic server** — The app and database must be hosted within China (Alibaba Cloud, Tencent Cloud, Huawei Cloud, etc.).
3. **CN-compliant providers** — Audit every provider and replace with domestic alternatives (see table below).
4. **Domain** — A `.cn` domain or a domain with an ICP license.

### Provider replacements required

| Service | Global | CN Replacement |
|---------|--------|---------------|
| Supabase backend | `*.supabase.co` (AWS) | Self-host Supabase on Alibaba/Tencent; or use compatible PgSQL |
| Analytics | PostHog / Mixpanel | Baidu Analytics (`hm.baidu.com`) or Umeng |
| Payment | Stripe | Alipay (`alipay.com`) + WeChat Pay |
| Email | Resend / SendGrid | Alibaba Cloud Direct Mail (`dm.aliyun.com`) |
| Storage/CDN | Vercel Blob / S3 / R2 | Alibaba Cloud OSS + CDN, or Tencent COS |
| Auth emails | Supabase SMTP | Reconfigure Supabase to use domestic SMTP relay |
| Social login (if added) | Google / GitHub OAuth | WeChat OAuth (`open.weixin.qq.com`) |

### Environment variables (CN)

```bash
# Region — activates CN feature flags and provider selection in registry.ts
APP_REGION=cn

# Supabase — self-hosted instance on domestic cloud
NEXT_PUBLIC_SUPABASE_URL=https://your-cn-supabase-instance.example.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL — ICP-licensed domain
NEXT_PUBLIC_APP_URL=https://yourcndomain.cn

# Asset CDN — domestic CDN endpoint
NEXT_PUBLIC_ASSET_BASE_URL=https://your-cdn.aliyuncs.com

# Analytics
NEXT_PUBLIC_ANALYTICS_PROVIDER=baidu
NEXT_PUBLIC_ANALYTICS_ID=your-baidu-site-id

# Payment
NEXT_PUBLIC_PAYMENT_PROVIDER=alipay
ALIPAY_APP_ID=your-alipay-app-id
ALIPAY_PRIVATE_KEY=your-private-key

# Email
EMAIL_PROVIDER=alimail
ALIMAIL_ACCESS_KEY_ID=your-access-key-id
ALIMAIL_ACCESS_KEY_SECRET=your-access-key-secret
ALIMAIL_ACCOUNT_NAME=noreply@yourcndomain.cn
DEFAULT_FROM_EMAIL=noreply@yourcndomain.cn

# Storage
STORAGE_PROVIDER=oss
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_ACCESS_KEY_ID=your-access-key-id
ALIYUN_OSS_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_OSS_BUCKET=your-bucket-name
```

### Hosting

- **Frontend:** Alibaba Cloud ACK / Tencent CloudBase / Vercel Enterprise (with CN edge nodes)
- **Database + Auth:** Self-hosted Supabase on Alibaba Cloud ECS, or PlanetScale CN, or managed PostgreSQL
- **CDN:** Alibaba Cloud CDN or Tencent Cloud CDN (required for ICP compliance)

### Checklist (CN)

- [ ] ICP license obtained and filed
- [ ] Domestic server/VPC provisioned
- [ ] Supabase self-hosted and accessible from domestic network
- [ ] Schema applied to CN database instance
- [ ] All CN provider adapters implemented in `lib/services/adapters/`
- [ ] `APP_REGION=cn` set in env
- [ ] CN feature flags enabled in `lib/config/regions.ts` as providers are wired up
- [ ] End-to-end smoke test from within Mainland China network
- [ ] Admin account created on CN instance

---

## Running Both Deployments in Parallel

The two deployments share the same codebase but use separate databases and provider configurations. There is **no shared state** between them — users, wallets, trades, and markets are isolated per deployment.

If you need cross-region user portability or shared data in the future, that requires a data sync strategy, which is out of scope for this MVP.

---

## Local Development

For local development, use the GLOBAL configuration:

```bash
cp .env.example .env.local
# Fill in your Supabase keys
# Leave APP_REGION=global (or omit it)
npm run dev
```

To test CN provider logic locally without a full CN infra setup, set `APP_REGION=cn` in `.env.local`. The app will load CN feature flags, but CN-specific adapters will need to be implemented to actually work. The no-op analytics fallback will activate for unimplemented providers.
