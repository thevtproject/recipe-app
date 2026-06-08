import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { checkPasswordStrength, SALT_ROUNDS } from '@/lib/password';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(200),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must differ from current password',
    path: ['newPassword'],
  });

// POST /api/profile/password — change the current user's password
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }

  // Rate limit per user — 20 attempts per hour.
  const rl = rateLimit('passwordChange', userId);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // Enforce strength on the new password (the schema already rejected
  // `newPassword === currentPassword`).
  const pw = checkPasswordStrength(newPassword);
  if (!pw.ok) {
    return NextResponse.json({ success: false, error: pw.reason }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user) {
    // Session refers to a missing user — treat as auth failure
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const currentValid = await bcrypt.compare(currentPassword, user.password);
  if (!currentValid) {
    return NextResponse.json(
      { success: false, error: 'Current password is incorrect' },
      { status: 403 }
    );
  }

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  return NextResponse.json({ success: true, error: null });
}
