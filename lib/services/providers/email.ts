/**
 * Email (transactional) provider interface.
 *
 * Current state: No email provider integrated.
 * Auth emails (confirm signup, reset password) are handled by Supabase directly.
 *
 * When transactional email notifications are needed (deposit approved,
 * trade settled, commission earned, etc.):
 *   1. Pick a provider suitable for your region:
 *      GLOBAL → Resend, SendGrid, Postmark
 *      CN     → Alibaba Cloud Direct Mail (阿里云邮件推送), Tencent Cloud SES
 *   2. Create an adapter in lib/services/adapters/email/<provider>.ts
 *      that implements this interface.
 *   3. Register it in lib/services/registry.ts.
 *   4. Set EMAIL_PROVIDER and related env vars.
 *
 * Note: Keep Supabase Auth emails (magic links, password resets) in Supabase.
 * This interface is for product notification emails only.
 */

export interface SendEmailParams {
  /** Recipient address or array of addresses */
  to: string | string[];
  subject: string;
  /** HTML body */
  html: string;
  /** Plain-text fallback (recommended) */
  text?: string;
  /**
   * From address. Defaults to the configured DEFAULT_FROM_EMAIL env var.
   * Must be a verified sender in the chosen provider.
   */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
}

export interface SendEmailResult {
  /** Provider-assigned message ID */
  id: string;
}

export interface EmailProvider {
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
}
