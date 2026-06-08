import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';

const joinSchema = z.object({
  inviteCode: z.string().trim().min(4).max(20),
});

// POST /api/households/join — join an existing household via invite code
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.householdId) {
    return NextResponse.json({ error: 'You are already in a household. Leave first.' }, { status: 400 });
  }

  // Rate limit: 10 invite-code attempts per IP per 15 minutes.
  const ip = getClientIp(req);
  const rl = rateLimit('householdJoin', ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });
  }

  const code = parsed.data.inviteCode.toUpperCase();
  const household = await prisma.household.findUnique({ where: { inviteCode: code } });
  if (!household) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
  }

  await prisma.household.update({
    where: { id: household.id },
    data: { members: { connect: { id: session.user.id } } },
  });

  return NextResponse.json({ data: { id: household.id, name: household.name, inviteCode: household.inviteCode } });
}
