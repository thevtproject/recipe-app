import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const plan = await prisma.mealPlan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
  if (plan.userId !== session.user.id) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

  await prisma.mealPlan.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true }, error: null });
}
