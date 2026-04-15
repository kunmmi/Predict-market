/**
 * Provider interface barrel export.
 * Import provider types from here to avoid deep paths.
 *
 * Usage:
 *   import type { AnalyticsProvider, PaymentProvider } from '@/lib/services/providers';
 */

export type { AnalyticsProvider } from "./analytics";
export type { PaymentProvider, CreatePaymentIntentParams, PaymentIntent } from "./payment";
export type { EmailProvider, SendEmailParams, SendEmailResult } from "./email";
export type { StorageProvider, UploadFileParams, StorageFile } from "./storage";
