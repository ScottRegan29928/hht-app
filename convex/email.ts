import { action } from "./_generated/server";
import { v } from "convex/values";

const FROM_EMAIL = "Hilton Head Timeshares <noreply@lead-works.com>";
const PORTAL_URL = "https://hht.leadworksstaging.com/owner";

export const sendWelcomeEmail = action({
  args: {
    to: v.string(),
    firstName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const name = args.firstName || "there";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a5276; font-size: 24px; margin-bottom: 4px;">Hilton Head Timeshares</h1>
    <p style="color: #666; font-size: 14px; margin-top: 0;">Owner Portal</p>
  </div>
  
  <p style="font-size: 16px;">Hello ${name},</p>
  
  <p>You have been registered as a property owner on the Hilton Head Timeshares portal. You can now access your Owner Dashboard to view your properties, submit sale requests, and manage inquiries.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${PORTAL_URL}" style="display: inline-block; padding: 14px 32px; background: #1a5276; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Access Owner Portal</a>
  </div>
  
  <p><strong>To get started:</strong></p>
  <ol style="line-height: 1.8;">
    <li>Visit <a href="${PORTAL_URL}" style="color: #1a5276;">${PORTAL_URL}</a></li>
    <li>Click <strong>"Sign Up"</strong></li>
    <li>Register with this email address: <strong>${args.to}</strong></li>
    <li>Choose a password</li>
  </ol>
  
  <p>Once registered, your owner profile will be automatically linked and you'll have immediate access to your properties and weeks.</p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  
  <p style="font-size: 13px; color: #999;">
    If you have any questions, please contact us.<br/>
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
        to: [args.to],
        subject: "Welcome to Hilton Head Timeshares - Owner Portal",
        html,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Resend API error (${resp.status}): ${body}`);
    }

    const result = await resp.json();
    return { success: true, emailId: result.id };
  },
});

export const sendPasswordResetEmail = action({
  args: {
    to: v.string(),
    firstName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const name = args.firstName || "there";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #1a5276; font-size: 24px; margin-bottom: 4px;">Hilton Head Timeshares</h1>
    <p style="color: #666; font-size: 14px; margin-top: 0;">Owner Portal</p>
  </div>
  
  <p style="font-size: 16px;">Hello ${name},</p>
  
  <p>Your password has been reset by an administrator. To regain access to your Owner Dashboard, please create a new account:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${PORTAL_URL}" style="display: inline-block; padding: 14px 32px; background: #1a5276; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Access Owner Portal</a>
  </div>
  
  <ol style="line-height: 1.8;">
    <li>Visit <a href="${PORTAL_URL}" style="color: #1a5276;">${PORTAL_URL}</a></li>
    <li>Click <strong>"Sign Up"</strong></li>
    <li>Register with this email address: <strong>${args.to}</strong></li>
    <li>Choose a new password</li>
  </ol>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  
  <p style="font-size: 13px; color: #999;">
    If you did not expect this email, please contact us.<br/>
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
        to: [args.to],
        subject: "Password Reset - Hilton Head Timeshares Owner Portal",
        html,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Resend API error (${resp.status}): ${body}`);
    }

    const result = await resp.json();
    return { success: true, emailId: result.id };
  },
});
