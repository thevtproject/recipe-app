import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const toggleSchema = z.object({
  itemKey: z.string().min(1, 'itemKey is required'),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD'),
  checked: z.boolean(),
  scope: z.enum(['ME', 'FAMILY']),
});

// POST /api/shopping-list/check — toggle a check state for an item
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

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { itemKey, weekStart, checked, scope } = parsed.data;
  const householdId =
    scope === 'FAMILY' ? (session.user as { householdId?: string | null }).householdId ?? null : null;

  if (scope === 'FAMILY' && !householdId) {
    return NextResponse.json(
      { data: null, error: 'Not in a household — cannot use FAMILY scope' },
      { status: 400 },
    );
  }

  const weekStartDate = new Date(weekStart);

  let record: { itemKey: string; checked: boolean };

  if (scope === 'FAMILY' && householdId) {
    // FAMILY scope — compound unique upsert works because householdId is a real string
    record = await prisma.shoppingListCheck.upsert({
      where: {
        householdId_weekStart_itemKey: {
          householdId,
          weekStart: weekStartDate,
          itemKey,
        },
      },
      create: {
        householdId,
        weekStart: weekStartDate,
        itemKey,
        checked,
        checkedBy: userId,
      },
      update: {
        checked,
        checkedBy: userId,
      },
      select: { itemKey: true, checked: true },
    });
  } else {
    // ME scope — householdId is null. Prisma's compound unique input requires
    // householdId: string, so we use findFirst + create/update instead.
    const existing = await prisma.shoppingListCheck.findFirst({
      where: { householdId: null, weekStart: weekStartDate, itemKey },
      select: { id: true },
    });

    if (existing) {
      record = await prisma.shoppingListCheck.update({
        where: { id: existing.id },
        data: { checked, checkedBy: userId },
        select: { itemKey: true, checked: true },
      });
    } else {
      record = await prisma.shoppingListCheck.create({
        data: {
          householdId: null,
          weekStart: weekStartDate,
          itemKey,
          checked,
          checkedBy: userId,
        },
        select: { itemKey: true, checked: true },
      });
    }
  }

  return NextResponse.json({
    data: { itemKey: record.itemKey, checked: record.checked },
    error: null,
  });
}

// GET /api/shopping-list/check?weekStart=YYYY-MM-DD&scope=ME|FAMILY
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

  let checks: { itemKey: string; checked: boolean; checkedBy: string }[];

  if (scopeParam === 'FAMILY') {
    const householdId = (session.user as { householdId?: string | null }).householdId ?? null;
    if (!householdId) {
      return NextResponse.json(
        { data: null, error: 'Not in a household — cannot use FAMILY scope' },
        { status: 400 },
      );
    }
    checks = await prisma.shoppingListCheck.findMany({
      where: { householdId, weekStart: weekStartDate },
      select: { itemKey: true, checked: true, checkedBy: true },
    });
  } else {
    // ME scope — return only checks toggled by the current user
    checks = await prisma.shoppingListCheck.findMany({
      where: { checkedBy: userId, weekStart: weekStartDate },
      select: { itemKey: true, checked: true, checkedBy: true },
    });
  }

  return NextResponse.json({ data: { checks }, error: null });
}
