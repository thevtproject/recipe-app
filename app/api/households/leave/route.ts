import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/households/leave — disconnect current user from their household
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!session.user.householdId) {
    return NextResponse.json({ error: 'You are not in a household' }, { status: 400 });
  }

  const householdId = session.user.householdId;
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: { _count: { select: { members: true } } },
  });

  if (!household) {
    return NextResponse.json({ error: 'Household not found' }, { status: 404 });
  }

  // If leaving would leave zero members, delete the household
  if (household._count.members <= 1) {
    await prisma.household.delete({ where: { id: householdId } });
  } else {
    await prisma.household.update({
      where: { id: householdId },
      data: { members: { disconnect: { id: session.user.id } } },
    });
  }

  // If user was the owner of any plans for this household, those plans remain
  // (they were attached to the household, not the user).

  return NextResponse.json({ data: { ok: true } });
}
