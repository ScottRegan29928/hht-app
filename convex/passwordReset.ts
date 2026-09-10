import { Email } from "@convex-dev/auth/providers/Email";

/**
 * Password-reset codes, emailed via Resend.
 *
 * Wired into the Password provider's `reset` slot in convex/auth.ts, which
 * gives both the admin portal and the owner portals a self-service reset:
 *   signIn("password", { email, flow: "reset" })
 *   signIn("password", { email, code, newPassword, flow: "reset-verification" })
 *
 * There is intentionally no admin-side "set this user's password" tool: the
 * code goes to the mailbox, so nobody (including Viktor) handles a plaintext
 * password on someone else's behalf.
 */
const FROM_EMAIL = "Hilton Head Timeshares <noreply@lead-works.com>";

export const ResendPasswordReset = Email({
  id: "resend-password-reset",
  // Codes are short-lived; a stale one just means requesting another.
  maxAge: 60 * 20, // 20 minutes
  async generateVerificationToken() {
    // Web Crypto rather than Math.random, and rejection-sampled so the digits
    // stay uniform. (No `oslo` in this project and no room to add deps.)
    const digits: string[] = [];
    while (digits.length < 8) {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      for (const b of buf) {
        if (b < 250 && digits.length < 8) digits.push(String(b % 10));
      }
    }
    return digits.join("");
  },
  async sendVerificationRequest({ identifier: email, token, expires }) {
    // `process` is available in the Convex runtime; typed loosely because
    // this project has no @types/node and cannot add dependencies.
    const apiKey = (globalThis as any).process?.env?.RESEND_API_KEY as
      | string
      | undefined;
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const minutes = Math.max(
      1,
      Math.round((expires.getTime() - Date.now()) / 60000)
    );

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #333;">
  <p style="font-size: 16px; margin-top: 0;">Hello,</p>

  <p>Use this code to reset the password for <strong>${email}</strong>:</p>

  <p style="font-size: 34px; font-weight: 700; letter-spacing: 6px; color: #0c4a5e; margin: 28px 0; text-align: center;">${token}</p>

  <p>The code expires in ${minutes} minutes and can be used once. Enter it on the sign-in page along with your new password.</p>

  <p>If you did not request a password reset, you can ignore this email &mdash; your password has not changed.</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />

  <p style="font-size: 13px; color: #999;">
    Hilton Head Timeshares &middot; Hilton Head Island, SC
  </p>
</body>
</html>`.trim();

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        // Code deliberately NOT in the subject: subjects show up in phone
        // notifications, mail previews and sending logs.
        subject: "Your password reset code",
        html,
        text: `Use this code to reset the password for ${email}: ${token}\n\nThe code expires in ${minutes} minutes.\n\nIf you did not request a password reset, ignore this email.`,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Resend error: ${await resp.text()}`);
    }
  },
});
