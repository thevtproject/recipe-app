import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'node:crypto';

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

// POST /api/households — create a new household; the current user becomes its first member
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If user is already in a household, reject
  if (session.user.householdId) {
    return NextResponse.json({ error: 'You are already in a household. Leave first.' }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten() }, { status: 400 });
  }

  // Generate a unique invite code (8 chars, base32)
  const generateCode = () => randomBytes(5).toString('base64url').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);

  let inviteCode = generateCode();
  for (let i = 0; i < 5; i++) {
    const existing = await prisma.household.findUnique({ where: { inviteCode } });
    if (!existing) break;
    inviteCode = generateCode();
  }

  const household = await prisma.household.create({
    data: {
      name: parsed.data.name,
      inviteCode,
      members: { connect: { id: session.user.id } },
    },
  });

  return NextResponse.json({ data: household });
}
