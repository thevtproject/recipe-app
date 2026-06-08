import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/households/me — return current user's household + members
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      household: {
        include: {
          members: {
            select: { id: true, name: true, email: true, role: true, avatarUrl: true },
            orderBy: { name: 'asc' },
          },
        },
      },
    },
  });

  if (!user?.household) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      id: user.household.id,
      name: user.household.name,
      inviteCode: user.household.inviteCode,
      createdAt: user.household.createdAt,
      members: user.household.members,
    },
  });
}
