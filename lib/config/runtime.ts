/**
 * Runtime configuration — resolves the active region and all
 * region-specific settings from environment variables.
 *
 * Import this (server-side only) wherever you need to know the
 * current region or a region-specific setting.
 *
 * Usage:
 *   import { runtime } from '@/lib/config/runtime';
 *   if (runtime.region === 'cn') { ... }
 */

import {
  type Region,
  REGIONS,
  DEFAULT_REGION,
  REGION_FEATURES,
  type RegionFeatures,
} from "./regions";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveRegion(): Region {
  const raw = process.env.APP_REGION?.trim().toLowerCase();
  if (raw === REGIONS.CN) return REGIONS.CN;
  return DEFAULT_REGION;
}

// Resolved once at module load — stable for the lifetime of the process.
const activeRegion: Region = resolveRegion();
const activeFeatures: RegionFeatures = REGION_FEATURES[activeRegion];

// ---------------------------------------------------------------------------
// Payment provider type
// ---------------------------------------------------------------------------

export type PaymentProvider = "stripe" | "alipay" | "wechatpay" | "none";

/**
 * Valid payment providers per region.
 * Used for validation and documentation.
 *
 *   GLOBAL  → stripe
 *   CN      → alipay | wechatpay
 */
export const PAYMENT_PROVIDERS_BY_REGION: Record<Region, PaymentProvider[]> = {
  global: ["stripe", "none"],
  cn: ["alipay", "wechatpay", "none"],
};

// ---------------------------------------------------------------------------
// Email provider type
// ---------------------------------------------------------------------------

export type EmailProvider = "resend" | "sendgrid" | "nodemailer" | "alimail" | "none";

/**
 * Valid email providers per region.
 *
 *   GLOBAL  → resend | sendgrid | nodemailer
 *   CN      → alimail (Alibaba Cloud Direct Mail) | nodemailer
 */
export const EMAIL_PROVIDERS_BY_REGION: Record<Region, EmailProvider[]> = {
  global: ["resend", "sendgrid", "nodemailer", "none"],
  cn: ["alimail", "nodemailer", "none"],
};

// ---------------------------------------------------------------------------
// Analytics provider type
// ---------------------------------------------------------------------------

export type AnalyticsProvider = "posthog" | "mixpanel" | "baidu" | "umeng" | "none";

/**
 * Valid analytics providers per region.
 *
 *   GLOBAL  → posthog | mixpanel (both blocked in CN)
 *   CN      → baidu | umeng
 */
export const ANALYTICS_PROVIDERS_BY_REGION: Record<Region, AnalyticsProvider[]> = {
  global: ["posthog", "mixpanel", "none"],
  cn: ["baidu", "umeng", "none"],
};

// ---------------------------------------------------------------------------
// Storage / CDN provider type
// ---------------------------------------------------------------------------

export type StorageProvider = "vercel-blob" | "s3" | "r2" | "oss" | "cos" | "none";

/**
 * Valid storage/CDN providers per region.
 *
 *   GLOBAL  → vercel-blob | s3 (AWS) | r2 (Cloudflare)
 *   CN      → oss (Alibaba Cloud OSS) | cos (Tencent COS)
 */
export const STORAGE_PROVIDERS_BY_REGION: Record<Region, StorageProvider[]> = {
  global: ["vercel-blob", "s3", "r2", "none"],
  cn: ["oss", "cos", "none"],
};

// ---------------------------------------------------------------------------
// Exported runtime object
// ---------------------------------------------------------------------------

export const runtime = {
  /** Active deployment region. Defaults to 'global'. */
  region: activeRegion,

  /** Feature flags for the active region. */
  features: activeFeatures,

  /**
   * Base URL for user-facing assets (images, fonts, uploads).
   * Leave empty to serve from the app origin.
   * For CN: point to a domestic CDN (Alibaba Cloud CDN, Tencent CDN, etc.)
   */
  assetBaseUrl: process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "",

  /**
   * API base URL. Leave empty to use relative paths (/api/...).
   * Override when frontend and API are on separate origins or domains.
   */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",

  /**
   * Analytics provider selection.
   * Valid values depend on the active region — see ANALYTICS_PROVIDERS_BY_REGION.
   * Currently defaulting to 'none' (no analytics integrated yet).
   */
  analyticsProvider: (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "none") as AnalyticsProvider,

  /** Analytics provider ID / write key (public). */
  analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID ?? "",

  /**
   * Payment provider selection.
   * Valid values depend on the active region — see PAYMENT_PROVIDERS_BY_REGION.
   * Currently 'none' — deposits are manually approved by admin (Phase 9+).
   */
  paymentProvider: (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER ?? "none") as PaymentProvider,

  /**
   * Email provider selection (server-side only).
   * Valid values depend on the active region — see EMAIL_PROVIDERS_BY_REGION.
   * Currently 'none' — no transactional email integrated yet.
   */
  emailProvider: (process.env.EMAIL_PROVIDER ?? "none") as EmailProvider,

  /**
   * Storage/CDN provider selection (server-side only).
   * Currently 'none' — no file uploads integrated yet.
   */
  storageProvider: (process.env.STORAGE_PROVIDER ?? "none") as StorageProvider,
} as const;
