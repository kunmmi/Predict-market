# Architecture: Regionalization

**Status:** Global-first implemented. CN path prepared, not yet active.  
**Last updated:** 2026-04-09

---

## Overview

The app is structured so the global version ships today and a China-optimized version can be activated later with minimal code changes — primarily environment variables and CN-specific provider adapters.

The key principle: **business logic never references a provider directly.** It always goes through an interface. The registry selects the implementation based on region.

---

## Directory Layout

```
lib/
├── config/
│   ├── regions.ts          # Region types, constants, per-region feature flags
│   └── runtime.ts          # Reads APP_REGION env var; exports typed runtime object
│
├── config.ts               # Existing Supabase / app env config (unchanged)
│
└── services/
    ├── registry.ts         # Factory — selects provider implementation per region
    │
    ├── providers/          # Interfaces (what a provider must do)
    │   ├── analytics.ts
    │   ├── payment.ts
    │   ├── email.ts
    │   ├── storage.ts
    │   └── index.ts        # Barrel export
    │
    └── adapters/           # Implementations (how a specific provider does it)
        └── analytics/
            └── noop.ts     # No-op (current active implementation)
            # posthog.ts    # Add when analytics is enabled (global)
            # baidu.ts      # Add when CN analytics is needed
        # payment/
        #   stripe.ts       # Add at Phase 9 (global)
        #   alipay.ts       # Add for CN
        # email/
        #   resend.ts       # Add when notifications land (global)
        #   alimail.ts      # Add for CN
        # storage/
        #   vercel-blob.ts  # Add when uploads land (global)
        #   aliyun-oss.ts   # Add for CN
```

---

## Region Selection

The active region is determined by a single environment variable:

```bash
APP_REGION=global   # default — use this for all current deployments
APP_REGION=cn       # future — activate for CN deployment
```

Code path: `.env` → `lib/config/runtime.ts` → `resolveRegion()` → `runtime.region`

```typescript
import { runtime } from '@/lib/config/runtime';

if (runtime.region === 'cn') {
  // CN-specific logic
}
```

---

## Feature Flags

Each region has a set of boolean feature flags defined in `lib/config/regions.ts`:

```typescript
export const REGION_FEATURES: Record<Region, RegionFeatures> = {
  global: {
    analyticsEnabled: false,        // flip to true when PostHog is wired up
    paymentProviderEnabled: false,  // flip to true at Phase 9
    emailNotificationsEnabled: false,
    ...
  },
  cn: {
    // mirrors global until CN providers are implemented
  },
};
```

A feature flag being `false` means "not yet integrated" — the registry falls back to a no-op. This prevents null-reference errors before a provider is implemented.

---

## Adding a New Provider

### Step 1 — Define the interface (if it doesn't exist)

```typescript
// lib/services/providers/maps.ts
export interface MapsProvider {
  geocode(address: string): Promise<{ lat: number; lng: number }>;
}
```

### Step 2 — Implement a global adapter

```typescript
// lib/services/adapters/maps/google-maps.ts
import type { MapsProvider } from '../../providers/maps';

export class GoogleMapsProvider implements MapsProvider {
  async geocode(address: string) { ... }
}
```

### Step 3 — Implement a CN adapter (when needed)

```typescript
// lib/services/adapters/maps/baidu-maps.ts
import type { MapsProvider } from '../../providers/maps';

export class BaiduMapsProvider implements MapsProvider {
  async geocode(address: string) { ... }
}
```

### Step 4 — Register in the registry

```typescript
// lib/services/registry.ts
function createMapsProvider(): MapsProvider {
  if (runtime.region === 'cn') return new BaiduMapsProvider(process.env.BAIDU_MAPS_KEY!);
  return new GoogleMapsProvider(process.env.GOOGLE_MAPS_KEY!);
}

export const providers = {
  analytics: createAnalyticsProvider(),
  maps: createMapsProvider(),  // added
};
```

### Step 5 — Update env and feature flag

Add keys to `.env.example` and flip the feature flag in `regions.ts`.

---

## Using Providers in Application Code

Import from the registry — never instantiate a provider directly in business logic:

```typescript
// Good — business logic is provider-agnostic
import { providers } from '@/lib/services/registry';
providers.analytics.trackEvent('trade_placed', { marketId, amount });

// Bad — hard-codes PostHog, breaks CN
import { PostHog } from 'posthog-js';
posthog.capture('trade_placed', { marketId, amount });
```

---

## Asset URLs

For assets that will differ by region (images, fonts, uploads), use the `assetBaseUrl` from runtime config:

```typescript
import { runtime } from '@/lib/config/runtime';

function assetUrl(path: string): string {
  return runtime.assetBaseUrl ? `${runtime.assetBaseUrl}/${path}` : `/${path}`;
}
```

Set `NEXT_PUBLIC_ASSET_BASE_URL` to your CN CDN URL in the CN deployment env.

---

## What Does NOT Change Per Region

- Database schema (Supabase)
- Business logic (services, validations, types)
- React components and UI
- Authentication flow (email/password)
- API route handlers
- Middleware

All of these are region-neutral and require no changes for CN support.

---

## What DOES Change Per Region

| Concern | Global | CN |
|---------|--------|-----|
| Analytics | PostHog / Mixpanel | Baidu Analytics / Umeng |
| Payment | Stripe | Alipay / WeChat Pay |
| Email | Resend / SendGrid | Alibaba Cloud Direct Mail |
| Storage/CDN | Vercel Blob / S3 / R2 | Alibaba OSS / Tencent COS |
| Backend infra | Supabase on AWS | Self-hosted Supabase on Alibaba/Tencent |
| Domain | yourdomain.com | ICP-licensed .cn domain or domestic subdomain |
| Social login (if added) | Google / GitHub | WeChat |
| Maps (if added) | Google Maps | Baidu Maps / Amap |

---

## Constraints & Decisions

**Why not a monorepo split?**  
The app doesn't need two separate codebases. A single codebase with env-based provider selection is simpler to maintain for an MVP and early-growth stage. Only split if the CN and global experiences diverge significantly in UI/features.

**Why not Next.js middleware-based routing?**  
Geo-routing at the middleware level (redirect CN IPs to a different domain) is an option, but adds complexity and is unreliable with VPN users. Simpler: run two independent deployments, each with their own `.env` pointing to their own providers.

**Why interfaces instead of dynamic imports?**  
Tree-shaking and clarity. TypeScript interfaces add zero runtime cost. Dynamic imports would complicate bundling. The registry file is small and easy to read.
