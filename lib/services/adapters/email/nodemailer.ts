import nodemailer from "nodemailer";
import type { EmailProvider, SendEmailParams, SendEmailResult } from "@/lib/services/providers/email";

/**
 * Nodemailer email adapter.
 * Works with any SMTP server — configured here for Gmail.
 *
 * Required env vars:
 *   GMAIL_USER          — your Gmail address (e.g. yourname@gmail.com)
 *   GMAIL_APP_PASSWORD  — Gmail App Password (NOT your regular Gmail password)
 *   DEFAULT_FROM_EMAIL  — defaults to GMAIL_USER if not set
 *
 * To generate a Gmail App Password:
 *   1. Enable 2-Step Verification on your Google account
 *   2. Go to Google Account → Security → App Passwords
 *   3. Create one for "Mail" and paste it here
 */
export class NodemailerGmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter;
  private defaultFrom: string;

  constructor() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set.");
    }

    this.defaultFrom = process.env.DEFAULT_FROM_EMAIL
      ? `Elemental <${process.env.DEFAULT_FROM_EMAIL}>`
      : `Elemental <${user}>`;

    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // TLS
      auth: { user, pass },
    });
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const info = await this.transporter.sendMail({
      from: params.from ?? this.defaultFrom,
      to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });

    return { id: info.messageId ?? "sent" };
  }
}
