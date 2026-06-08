import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  recipeId: z.string().min(1),
});

// GET /api/favorites — list current user's favorited recipes
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id! },
    select: {
      id: true,
      recipeId: true,
      createdAt: true,
      recipe: {
        select: {
          id: true,
          title: true,
          description: true,
          categories: true,
          photoUrl: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: favorites, error: null });
}

// POST /api/favorites — add a favorite (idempotent: no error if already favorited)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { recipeId } = parsed.data;
  const userId = session.user.id!;

  // Verify the recipe exists — prevents favoriting dangling ids.
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) return NextResponse.json({ data: null, error: 'Recipe not found' }, { status: 404 });

  // upsert is idempotent: re-favoriting the same recipe is a no-op, not an error.
  await prisma.favorite.upsert({
    where: { userId_recipeId: { userId, recipeId } },
    create: { userId, recipeId },
    update: {},
  });

  return NextResponse.json({ data: { success: true }, error: null }, { status: 200 });
}
