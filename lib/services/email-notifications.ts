/**
 * Email notification service.
 * All transactional emails sent by the platform go through here.
 * Notifications are non-blocking — failures are logged but never crash the caller.
 */

import { providers } from "./registry";

const USERNAME_EMAIL_DOMAIN = "elemental.local";

/** Returns true if the email is a virtual username account (no real inbox) */
function isVirtualEmail(email: string): boolean {
  return email.endsWith(`@${USERNAME_EMAIL_DOMAIN}`);
}

// ---------------------------------------------------------------------------
// Deposit approved
// ---------------------------------------------------------------------------

export async function sendDepositApprovedEmail(params: {
  toEmail: string;
  toName: string | null;
  amount: number;
  assetSymbol: string;
}) {
  if (isVirtualEmail(params.toEmail)) return; // username-only account — no real inbox

  const name = params.toName ?? "there";
  await providers.email.sendEmail({
    to: params.toEmail,
    subject: `Your deposit of ${params.amount} ${params.assetSymbol} has been approved`,
    html: `
      <p>Hi ${name},</p>
      <p>Great news! Your deposit of <strong>${params.amount} ${params.assetSymbol}</strong> has been reviewed and approved.</p>
      <p>Your wallet has been credited. You can now browse markets and start trading.</p>
      <br/>
      <p>— The Elemental Team</p>
    `,
    text: `Hi ${name},\n\nYour deposit of ${params.amount} ${params.assetSymbol} has been approved and your wallet has been credited.\n\n— The Elemental Team`,
  }).catch((err) => console.error("[email] deposit approved:", err));
}

// ---------------------------------------------------------------------------
// Deposit rejected
// ---------------------------------------------------------------------------

export async function sendDepositRejectedEmail(params: {
  toEmail: string;
  toName: string | null;
  amount: number | null;
  assetSymbol: string;
  notes: string | null;
}) {
  if (isVirtualEmail(params.toEmail)) return;

  const name = params.toName ?? "there";
  const amountText = params.amount ? `${params.amount} ${params.assetSymbol}` : params.assetSymbol;
  const reasonText = params.notes ? `<p><strong>Reason:</strong> ${params.notes}</p>` : "";

  await providers.email.sendEmail({
    to: params.toEmail,
    subject: `Your deposit could not be approved`,
    html: `
      <p>Hi ${name},</p>
      <p>Unfortunately, your deposit of <strong>${amountText}</strong> could not be approved at this time.</p>
      ${reasonText}
      <p>If you believe this is a mistake, please contact our support team.</p>
      <br/>
      <p>— The Elemental Team</p>
    `,
    text: `Hi ${name},\n\nYour deposit of ${amountText} could not be approved.${params.notes ? `\nReason: ${params.notes}` : ""}\n\nPlease contact support if you need help.\n\n— The Elemental Team`,
  }).catch((err) => console.error("[email] deposit rejected:", err));
}

// ---------------------------------------------------------------------------
// Market settled
// ---------------------------------------------------------------------------

export async function sendMarketSettledEmails(params: {
  users: Array<{ email: string; name: string | null }>;
  marketTitle: string;
  outcome: string;
}) {
  const outcomeText = params.outcome === "yes" ? "YES" : params.outcome === "no" ? "NO" : "Cancelled";

  for (const user of params.users) {
    if (isVirtualEmail(user.email)) continue;

    const name = user.name ?? "there";
    providers.email.sendEmail({
      to: user.email,
      subject: `Market settled: ${params.marketTitle}`,
      html: `
        <p>Hi ${name},</p>
        <p>The market <strong>${params.marketTitle}</strong> has been settled.</p>
        <p>Outcome: <strong>${outcomeText}</strong></p>
        <p>If you had a winning position, your wallet has already been credited. Check your portfolio for details.</p>
        <br/>
        <p>— The Elemental Team</p>
      `,
      text: `Hi ${name},\n\nThe market "${params.marketTitle}" has been settled with outcome: ${outcomeText}.\n\nCheck your portfolio for payout details.\n\n— The Elemental Team`,
    }).catch((err) => console.error("[email] market settled for", user.email, err));
  }
}

// ---------------------------------------------------------------------------
// Commission earned (promoter notification)
// ---------------------------------------------------------------------------

export async function sendCommissionEarnedEmail(params: {
  toEmail: string;
  toName: string | null;
  commissionAmount: number;
  tradeAmount: number;
}) {
  if (isVirtualEmail(params.toEmail)) return;

  const name = params.toName ?? "there";
  await providers.email.sendEmail({
    to: params.toEmail,
    subject: `You earned a commission of $${params.commissionAmount.toFixed(2)}`,
    html: `
      <p>Hi ${name},</p>
      <p>One of your referred users just placed a trade and you've earned a commission.</p>
      <p>Commission earned: <strong>$${params.commissionAmount.toFixed(2)}</strong></p>
      <p>Log in to your promoter dashboard to track your earnings.</p>
      <br/>
      <p>— The Elemental Team</p>
    `,
    text: `Hi ${name},\n\nYou earned a commission of $${params.commissionAmount.toFixed(2)} from a referred user's trade.\n\nLog in to your promoter dashboard to track your earnings.\n\n— The Elemental Team`,
  }).catch((err) => console.error("[email] commission earned:", err));
}
