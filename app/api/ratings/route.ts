import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  recipeId: z.string().min(1),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
});

async function recomputeRating(recipeId: string) {
  const agg = await prisma.rating.aggregate({
    where: { recipeId },
    _avg: { stars: true },
    _count: { _all: true },
  });
  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      ratingAvg: agg._avg.stars ?? null,
      ratingCount: agg._count._all,
    },
  });
}

// POST /api/ratings — upsert current user's rating
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const { recipeId, stars, comment } = parsed.data;

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });

  const rating = await prisma.rating.upsert({
    where: { userId_recipeId: { userId: session.user.id, recipeId } },
    update: { stars, comment: comment ?? null },
    create: { userId: session.user.id, recipeId, stars, comment: comment ?? null },
  });

  await recomputeRating(recipeId);

  return NextResponse.json({ data: rating });
}

// DELETE /api/ratings?recipeId= — remove current user's rating
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const recipeId = req.nextUrl.searchParams.get('recipeId');
  if (!recipeId) return NextResponse.json({ error: 'recipeId required' }, { status: 400 });

  const deleted = await prisma.rating.deleteMany({
    where: { userId: session.user.id, recipeId },
  });
  if (deleted.count > 0) await recomputeRating(recipeId);
  return NextResponse.json({ data: { deleted: deleted.count } });
}

// GET /api/ratings?recipeId= — list all ratings for a recipe (with author name)
export async function GET(req: NextRequest) {
  const recipeId = req.nextUrl.searchParams.get('recipeId');
  if (!recipeId) return NextResponse.json({ error: 'recipeId required' }, { status: 400 });

  const ratings = await prisma.rating.findMany({
    where: { recipeId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  const session = await auth();
  const myRating = session?.user?.id
    ? ratings.find((r) => r.userId === session.user.id) ?? null
    : null;

  return NextResponse.json({
    data: { ratings, myRatingId: myRating?.id ?? null },
  });
}
