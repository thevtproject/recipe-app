import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'node:crypto';
import { rateLimit } from '@/lib/rate-limit';

const createSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.enum(['ME', 'FAMILY']).default('ME'),
  ttlDays: z.number().int().min(1).max(365).default(30),
});

// POST /api/meal-plans/share — create a shareable link for a week of plans
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit per user — 5 share links per hour. Avoids link spam if
  // the account is compromised.
  const rl = rateLimit('shareCreate', session.user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many share links. Try again in ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });
  }
  const { from, until, scope, ttlDays } = parsed.data;

  // FAMILY scope requires a household; pick which ID to share as
  let refId: string;
  if (scope === 'FAMILY') {
    if (!session.user.householdId) {
      return NextResponse.json({ error: 'No household — use ME scope.' }, { status: 400 });
    }
    refId = session.user.householdId;
  } else {
    refId = session.user.id;
  }

  const token = randomBytes(16).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  // Store the week range inside refId as "<refId>|<from>|<until>" so the share
  // page can reconstruct the window without extra columns. (refId has a wide
  // text type — safe for a 60-char string.)
  const refIdPacked = `${refId}|${from}|${until}`;

  const share = await prisma.planShare.create({
    data: {
      token,
      scope,
      refId: refIdPacked,
      createdBy: session.user.id,
      expiresAt,
    },
  });

  return NextResponse.json({
    data: {
      token: share.token,
      url: `/planner/share/${share.token}`,
      expiresAt: (share.expiresAt ?? new Date()).toISOString(),
    },
  });
}
