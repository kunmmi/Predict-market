import { Resend } from "resend";
import type { EmailProvider, SendEmailParams, SendEmailResult } from "@/lib/services/providers/email";

/**
 * Resend email adapter.
 *
 * Required env vars:
 *   RESEND_API_KEY      — from https://resend.com/api-keys
 *   DEFAULT_FROM_EMAIL  — verified sender address (e.g. noreply@yourdomain.com)
 *                         Until you have a verified domain, use: onboarding@resend.dev
 *                         Note: onboarding@resend.dev can only deliver to your own Resend account email.
 *                         Add a real domain at https://resend.com/domains when ready for production.
 */
export class ResendProvider implements EmailProvider {
  private client: Resend;
  private defaultFrom: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY must be set.");

    this.client = new Resend(apiKey);
    this.defaultFrom = process.env.DEFAULT_FROM_EMAIL
      ? `Elemental <${process.env.DEFAULT_FROM_EMAIL}>`
      : "Elemental <onboarding@resend.dev>";
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { data, error } = await this.client.emails.send({
      from: params.from ?? this.defaultFrom,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });

    if (error) throw new Error(error.message);
    return { id: data?.id ?? "sent" };
  }
}
