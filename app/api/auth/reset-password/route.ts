import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { SALT_ROUNDS, checkPasswordStrength } from "@/lib/password";
import crypto from "crypto";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// POST /api/auth/reset-password
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  const ip = getClientIp(req);
  const rl = rateLimit("forgotPassword", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { data: null, error: `Too many requests. Try again in ${rl.retryAfterSec} seconds.` },
      { status: 429 }
    );
  }

  // Check password strength
  const pwCheck = checkPasswordStrength(password);
  if (!pwCheck.ok) {
    return NextResponse.json({ data: null, error: pwCheck.reason }, { status: 400 });
  }

  // Hash the incoming raw token to compare against the stored hash
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { gt: new Date() }, // not expired
    },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { data: null, error: "Reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      passwordResetToken: null,   // consume the token
      passwordResetExpires: null,
    },
  });

  return NextResponse.json({ data: { ok: true }, error: null });
}
