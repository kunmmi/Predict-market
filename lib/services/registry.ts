/**
 * Service provider registry.
 *
 * This is the single place where concrete provider implementations are
 * selected based on runtime region and environment configuration.
 *
 * HOW TO ADD A NEW PROVIDER
 * ──────────────────────────
 * 1. Define the interface in lib/services/providers/<name>.ts
 * 2. Implement the adapter in lib/services/adapters/<name>/<impl>.ts
 * 3. Add a factory function below (createXxxProvider)
 * 4. Export it from the `providers` object
 * 5. Set the relevant env var in .env
 *
 * HOW TO ADD A CN VARIANT
 * ────────────────────────
 * Inside any createXxxProvider():
 *   if (runtime.region === 'cn') return new CnSpecificAdapter(...);
 *   return new GlobalAdapter(...);
 *
 * Current state
 * ─────────────
 * Only analytics is wired (NoopAnalytics). Payment, email, and storage
 * interfaces are defined but not yet instantiated — uncomment each block
 * as the corresponding phase is built.
 */

import { runtime } from "../config/runtime";
import type { AnalyticsProvider } from "./providers/analytics";
// import type { PaymentProvider } from './providers/payment';   // Phase 9+
// import type { EmailProvider } from './providers/email';       // When notifications land
// import type { StorageProvider } from './providers/storage';   // When uploads land

import { NoopAnalytics } from "./adapters/analytics/noop";
// CN example (implement before activating):
// import { BaiduAnalytics } from './adapters/analytics/baidu';
// Global example (implement before activating):
// import { PostHogAnalytics } from './adapters/analytics/posthog';

// ---------------------------------------------------------------------------
// Factory functions
// Each function reads runtime config and returns the right implementation.
// ---------------------------------------------------------------------------

function createAnalyticsProvider(): AnalyticsProvider {
  if (!runtime.features.analyticsEnabled) {
    return new NoopAnalytics();
  }

  // Future CN path:
  // if (runtime.region === 'cn') {
  //   return new BaiduAnalytics(runtime.analyticsId);
  // }

  // Future global path:
  // if (runtime.analyticsProvider === 'posthog') {
  //   return new PostHogAnalytics(runtime.analyticsId);
  // }

  // Fallback — feature flag is on but no provider is configured yet.
  return new NoopAnalytics();
}

// ---------------------------------------------------------------------------
// Phase 9+ — payment provider
// Uncomment and implement when manual deposit approval is replaced with
// automated payment processing.
// ---------------------------------------------------------------------------

// function createPaymentProvider(): PaymentProvider {
//   if (runtime.region === 'cn') {
//     if (runtime.paymentProvider === 'alipay') return new AlipayProvider(...);
//     if (runtime.paymentProvider === 'wechatpay') return new WechatPayProvider(...);
//   }
//   if (runtime.paymentProvider === 'stripe') return new StripeProvider(...);
//   throw new Error(`No payment provider configured for region: ${runtime.region}`);
// }

// ---------------------------------------------------------------------------
// Email provider
// Uncomment when transactional notifications are needed.
// ---------------------------------------------------------------------------

// function createEmailProvider(): EmailProvider {
//   if (runtime.region === 'cn') {
//     return new AliMailProvider(...);
//   }
//   if (runtime.emailProvider === 'resend') return new ResendProvider(...);
//   if (runtime.emailProvider === 'sendgrid') return new SendGridProvider(...);
//   return new NoopEmail();
// }

// ---------------------------------------------------------------------------
// Storage provider
// Uncomment when file uploads are needed.
// ---------------------------------------------------------------------------

// function createStorageProvider(): StorageProvider {
//   if (runtime.region === 'cn') {
//     return new AliyunOssProvider(...);
//   }
//   if (runtime.storageProvider === 'vercel-blob') return new VercelBlobProvider(...);
//   if (runtime.storageProvider === 's3') return new S3Provider(...);
//   return new NoopStorage();
// }

// ---------------------------------------------------------------------------
// Exported provider instances
// ---------------------------------------------------------------------------

export const providers = {
  analytics: createAnalyticsProvider(),
  // payment: createPaymentProvider(),   // Uncomment at Phase 9
  // email: createEmailProvider(),        // Uncomment when notifications land
  // storage: createStorageProvider(),    // Uncomment when uploads land
} as const;
