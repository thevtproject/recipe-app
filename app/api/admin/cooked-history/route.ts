import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") return null;
  return session;
}

// Recompute recipe.lastCookedAt to the most recent cook across all users,
// but only if the row we just deleted WAS the latest. Otherwise leave it.
async function recomputeLastCooked(recipeId: string, deletedCookedAt: Date) {
  const current = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { lastCookedAt: true },
  });
  // Only re-derive if the deleted cook was the most recent one we were
  // tracking. Otherwise the denormalized value still points to a row
  // that exists and is unaffected.
  if (!current?.lastCookedAt) return;
  if (current.lastCookedAt.getTime() > deletedCookedAt.getTime()) return;

  const latest = await prisma.cookedHistory.findFirst({
    where: { recipeId },
    orderBy: { cookedAt: "desc" },
    select: { cookedAt: true },
  });
  await prisma.recipe.update({
    where: { id: recipeId },
    data: { lastCookedAt: latest?.cookedAt ?? null },
  });
}

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  recipeId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  q: z.string().min(1).max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
});

// GET /api/admin/cooked-history — list ALL cooking history across users
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
  const parsed = listSchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid query", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { limit, recipeId, userId, q, from, to } = parsed.data;

  // Local-day boundary: 'from' is start of that local day, 'to' is start of
  // the NEXT local day (exclusive). Matches /api/cooked/all semantics.
  const cookedAt: { gte?: Date; lt?: Date } = {};
  if (from) {
    const [y, m, d] = from.split("-").map(Number);
    cookedAt.gte = new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  if (to) {
    const [y, m, d] = to.split("-").map(Number);
    cookedAt.lt = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  }

  const cooks = await prisma.cookedHistory.findMany({
    where: {
      ...(recipeId ? { recipeId } : {}),
      ...(userId ? { userId } : {}),
      ...(cookedAt.gte || cookedAt.lt ? { cookedAt } : {}),
      ...(q
        ? {
            OR: [
              { recipe: { title: { contains: q, mode: "insensitive" as const } } },
              { user: { name: { contains: q, mode: "insensitive" as const } } },
              { user: { email: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { cookedAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      recipe: {
        select: { id: true, title: true, photoUrl: true, categories: true },
      },
    },
  });

  return NextResponse.json({ data: cooks, error: null });
}

const deleteSchema = z.object({ id: z.string().min(1) });

// DELETE /api/admin/cooked-history — delete a cook entry by id,
// recompute recipe.lastCookedAt if the deleted cook was the most recent
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id } = parsed.data;

  const target = await prisma.cookedHistory.findUnique({
    where: { id },
    select: { id: true, recipeId: true, cookedAt: true },
  });
  if (!target) {
    return NextResponse.json(
      { data: null, error: "Cooked-history entry not found" },
      { status: 404 }
    );
  }

  await prisma.cookedHistory.delete({ where: { id } });
  await recomputeLastCooked(target.recipeId, target.cookedAt);

  return NextResponse.json({ data: { deleted: true, id }, error: null });
}
