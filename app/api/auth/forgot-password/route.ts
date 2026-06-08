import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

const schema = z.object({
  email: z.string().email(),
});

// POST /api/auth/forgot-password
// Always returns 200 — never reveals whether the email exists (account enumeration mitigation).
export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per IP per 15 minutes
  const ip = getClientIp(req);
  const rl = rateLimit("forgotPassword", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { data: null, error: `Too many requests. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Same 200 response to avoid leaking info
    return NextResponse.json({ data: { sent: true }, error: null });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isApproved: true },
  });

  // Always return the same response — don't reveal user existence
  if (!user || !user.isApproved) {
    return NextResponse.json({ data: { sent: true }, error: null });
  }

  // Generate a secure random token (32 bytes = 256 bits)
  const rawToken = crypto.randomBytes(32).toString("hex");
  // Store a SHA-256 hash of the token in the DB — the raw token travels in email only
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: expires,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://recipes.vtproject.my.id";
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });
  } catch (err) {
    console.error("[forgot-password] email send failed:", err);
    // Clear the token so the user can retry
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: null, passwordResetExpires: null },
    });
    return NextResponse.json(
      { data: null, error: "Failed to send email. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { sent: true }, error: null });
}
