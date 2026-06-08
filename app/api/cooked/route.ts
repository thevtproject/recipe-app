import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  recipeId: z.string().min(1),
  cookedAt: z.string().datetime().optional(), // ISO, defaults to now
});

// POST /api/cooked — log that the current user cooked a recipe
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
  const { recipeId, cookedAt } = parsed.data;
  const cookedAtDate = cookedAt ? new Date(cookedAt) : new Date();

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });

  // Use a transaction so the denormalized lastCookedAt stays in sync
  const [row] = await prisma.$transaction([
    prisma.cookedHistory.create({
      data: {
        userId: session.user.id,
        recipeId,
        cookedAt: cookedAtDate,
      },
    }),
    prisma.recipe.update({
      where: { id: recipeId },
      data: { lastCookedAt: cookedAtDate },
    }),
  ]);

  return NextResponse.json({ data: row });
}

// GET /api/cooked?recipeId= — return count + most recent for current user
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const recipeId = req.nextUrl.searchParams.get('recipeId');
  if (!recipeId) return NextResponse.json({ error: 'recipeId required' }, { status: 400 });

  const [count, latest, recipe] = await Promise.all([
    prisma.cookedHistory.count({ where: { userId: session.user.id, recipeId } }),
    prisma.cookedHistory.findFirst({
      where: { userId: session.user.id, recipeId },
      orderBy: { cookedAt: 'desc' },
    }),
    prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { lastCookedAt: true },
    }),
  ]);

  return NextResponse.json({
    data: { myCount: count, myLastCookedAt: latest?.cookedAt ?? null, recipeLastCookedAt: recipe?.lastCookedAt ?? null },
  });
}
