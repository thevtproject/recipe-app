import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  // BABY is allowed only when the user has hasBabyPlanner enabled.
  // The runtime check below rejects BABY for users without the flag.
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'BABY']),
  recipeId: z.string().min(1),
  scope: z.enum(['ME', 'FAMILY']).default('ME'),
});

// GET /api/meal-plans?from=...&until=...&scope=ME|FAMILY
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const until = searchParams.get('until');
  const scope = (searchParams.get('scope') ?? 'ME') as 'ME' | 'FAMILY';

  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.gte = new Date(from);
  if (until) dateFilter.lte = new Date(until);

  const where =
    scope === 'FAMILY' && session.user.householdId
      ? { householdId: session.user.householdId, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) }
      : { userId: session.user.id!, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) };

  const plans = await prisma.mealPlan.findMany({
    where,
    include: {
      recipe: { select: { id: true, title: true, categories: true, photoUrl: true } },
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }, { id: 'asc' }],
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

  const { date, mealType, recipeId, scope } = parsed.data;

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) return NextResponse.json({ data: null, error: 'Recipe not found' }, { status: 404 });

  // BABY meal slot is gated behind the user's hasBabyPlanner flag.
  // Even family-scoped plans must come from a user who opted in.
  if (mealType === 'BABY') {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id! },
      select: { hasBabyPlanner: true },
    });
    if (!me?.hasBabyPlanner) {
      return NextResponse.json(
        { data: null, error: 'Enable Baby planner in your profile to plan baby meals.' },
        { status: 403 }
      );
    }
  }

  const isFamily = scope === 'FAMILY';
  if (isFamily && !session.user.householdId) {
    return NextResponse.json({ data: null, error: 'No household — cannot create family plan' }, { status: 400 });
  }

  // The (userId, date, mealType) unique constraint was dropped, so multiple
  // recipes per slot are now allowed. Always create a new row.
  const plan = await prisma.mealPlan.create({
    data: {
      userId: isFamily ? null : session.user.id!,
      householdId: isFamily ? session.user.householdId : null,
      date: new Date(date),
      mealType,
      recipeId,
    },
    include: {
      recipe: { select: { id: true, title: true, categories: true, photoUrl: true } },
    },
  });

  return NextResponse.json({ data: plan, error: null }, { status: 201 });
}
