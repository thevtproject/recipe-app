import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/shopping-list/items/[id] — delete a manual item owned by the current user
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify the item exists and belongs to the current user
  const item = await prisma.shoppingListItem.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!item) {
    return NextResponse.json({ data: null, error: 'Item not found' }, { status: 404 });
  }

  if (item.userId !== userId) {
    return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
  }

  await prisma.shoppingListItem.delete({ where: { id } });

  return NextResponse.json({ data: { deleted: true }, error: null });
}
