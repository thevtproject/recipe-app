import { Resend } from "resend";

const FROM = process.env.RESEND_FROM ?? "noreply@<your-domain>";

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const { to, name, resetUrl } = opts;

  // Lazy-initialize: RESEND_API_KEY is only available at runtime, not build time
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Recipe Book password",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; color: #292524; background: #F5F0EB; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #D6CEC4;">
    <h2 style="margin-top: 0; font-size: 20px;">🍽 Recipe Book</h2>
    <p>Hi ${name},</p>
    <p>Someone requested a password reset for your account. If that was you, click the button below:</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}"
         style="background: #A8956A; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </p>
    <p style="font-size: 13px; color: #78716C;">
      This link expires in <strong>1 hour</strong>. If you didn't request a reset, you can ignore this email — your password won't change.
    </p>
    <hr style="border: none; border-top: 1px solid #D6CEC4; margin: 24px 0;">
    <p style="font-size: 12px; color: #A8A29E; margin: 0;">
      Or copy this URL into your browser:<br>
      <span style="font-size: 11px; word-break: break-all;">${resetUrl}</span>
    </p>
  </div>
</body>
</html>`,
  });
}
