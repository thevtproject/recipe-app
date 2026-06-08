import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/favorites/[recipeId] — heart-toggle state for the current user
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { recipeId } = await params;

  const favorite = await prisma.favorite.findUnique({
    where: { userId_recipeId: { userId: session.user.id!, recipeId } },
    select: { id: true },
  });

  return NextResponse.json({ data: { isFavorite: !!favorite }, error: null });
}

// DELETE /api/favorites/[recipeId] — remove favorite (idempotent: succeeds even if absent)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { recipeId } = await params;

  // deleteMany is idempotent — silently succeeds when the row doesn't exist.
  await prisma.favorite.deleteMany({
    where: { userId: session.user.id!, recipeId },
  });

  return NextResponse.json({ data: { success: true }, error: null });
}
