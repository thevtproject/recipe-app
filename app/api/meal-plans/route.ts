import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  recipeId: z.string().min(1),
});

// GET /api/meal-plans?from=YYYY-MM-DD&until=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const until = searchParams.get('until');

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.gte = new Date(from);
  if (until) dateFilter.lte = new Date(until);

  const plans = await prisma.mealPlan.findMany({
    where: {
      userId: session.user.id!,
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
    },
    include: {
      recipe: {
        select: { id: true, title: true, category: true, photoUrl: true },
      },
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  });

  return NextResponse.json({ data: plans, error: null });
}

// POST /api/meal-plans
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { date, mealType, recipeId } = parsed.data;

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) return NextResponse.json({ data: null, error: 'Recipe not found' }, { status: 404 });

  const plan = await prisma.mealPlan.upsert({
    where: {
      userId_date_mealType: {
        userId: session.user.id!,
        date: new Date(date),
        mealType,
      },
    },
    update: { recipeId },
    create: {
      userId: session.user.id!,
      date: new Date(date),
      mealType,
      recipeId,
    },
    include: {
      recipe: { select: { id: true, title: true, category: true, photoUrl: true } },
    },
  });

  return NextResponse.json({ data: plan, error: null }, { status: 201 });
}
