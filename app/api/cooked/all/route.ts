import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  recipeId: z.string().min(1).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  q: z.string().min(1).max(100).optional(),
});

// GET /api/cooked/all — central cooking history
// Returns all cooks across all recipes, scoped to the current user
// or all members of the user's household (if any). Newest first.
//
// Query params:
//   limit     — max rows (default 100, max 500)
//   recipeId  — only cooks of this recipe
//   from      — YYYY-MM-DD (local); only cooks on/after this date
//   to        — YYYY-MM-DD (local); only cooks on/before this date
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { limit, recipeId, from, to, q } = parsed.data;

  // Scope: if user is in a household, include all household members' cooks.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { householdId: true },
  });
  const scopeUserIds = user?.householdId
    ? (
        await prisma.user.findMany({
          where: { householdId: user.householdId },
          select: { id: true },
        })
      ).map((u) => u.id)
    : [session.user.id];

  // Build the date range. Treat YYYY-MM-DD as a LOCAL day boundary so a user
  // in UTC+7 saying "from=2026-06-01" gets the full local day, not the UTC slice.
  // `from` → start of that local day; `to` → start of the NEXT local day (exclusive).
  const cookedAt: { gte?: Date; lt?: Date } = {};
  if (from) {
    const [y, m, d] = from.split('-').map(Number);
    cookedAt.gte = new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  if (to) {
    const [y, m, d] = to.split('-').map(Number);
    cookedAt.lt = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  }

  const cooks = await prisma.cookedHistory.findMany({
    where: {
      userId: { in: scopeUserIds },
      ...(recipeId ? { recipeId } : {}),
      ...(cookedAt.gte || cookedAt.lt ? { cookedAt } : {}),
      ...(q
        ? {
            recipe: {
              title: { contains: q, mode: 'insensitive' as const },
            },
          }
        : {}),
    },
    orderBy: { cookedAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      recipe: {
        select: {
          id: true,
          title: true,
          photoUrl: true,
          categories: true,
        },
      },
    },
  });

  const data = cooks.map((c) => ({
    id: c.id,
    cookedAt: c.cookedAt.toISOString(),
    user: {
      id: c.user.id,
      name: c.user.name,
      avatarUrl: c.user.avatarUrl,
    },
    recipe: {
      id: c.recipe.id,
      title: c.recipe.title,
      photoUrl: c.recipe.photoUrl,
      categories: c.recipe.categories,
    },
  }));

  return NextResponse.json({ data, scope: user?.householdId ? 'HOUSEHOLD' : 'ME' });
}
