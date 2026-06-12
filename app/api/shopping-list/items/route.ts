import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const addItemSchema = z.object({
  name: z.string().min(1, 'name is required'),
  category: z.string().optional(),
  amount: z.string().optional(),
  unit: z.string().optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
});

// POST /api/shopping-list/items — add a manual shopping list item
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, category, amount, unit, weekStart } = parsed.data;

  const item = await prisma.shoppingListItem.create({
    data: {
      userId,
      weekStart: new Date(weekStart),
      name,
      category: category ?? 'other',
      amount: amount ?? null,
      unit: unit ?? null,
      recipeId: null, // manual item
    },
    select: {
      id: true,
      name: true,
      category: true,
      amount: true,
      unit: true,
    },
  });

  return NextResponse.json({ data: item, error: null }, { status: 201 });
}

// GET /api/shopping-list/items?weekStart=YYYY-MM-DD&scope=ME|FAMILY
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get('weekStart');
  const scopeParam = (searchParams.get('scope') ?? 'ME').toUpperCase();

  if (!weekStartParam || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    return NextResponse.json(
      { data: null, error: 'weekStart is required and must be YYYY-MM-DD' },
      { status: 400 },
    );
  }
  if (scopeParam !== 'ME' && scopeParam !== 'FAMILY') {
    return NextResponse.json(
      { data: null, error: 'scope must be "ME" or "FAMILY"' },
      { status: 400 },
    );
  }

  const weekStartDate = new Date(weekStartParam);

  let items;

  if (scopeParam === 'FAMILY') {
    const householdId = (session.user as { householdId?: string | null }).householdId ?? null;
    if (!householdId) {
      return NextResponse.json(
        { data: null, error: 'Not in a household — cannot use FAMILY scope' },
        { status: 400 },
      );
    }
    items = await prisma.shoppingListItem.findMany({
      where: { householdId, weekStart: weekStartDate, recipeId: null },
      orderBy: { createdAt: 'asc' },
    });
  } else {
    items = await prisma.shoppingListItem.findMany({
      where: { userId, weekStart: weekStartDate, recipeId: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  return NextResponse.json({ data: { items }, error: null });
}
