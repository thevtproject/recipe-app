import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") return null;
  return session;
}

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

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  recipeId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  q: z.string().min(1).max(100).optional(),
});

// GET /api/admin/ratings — list ALL ratings across the system (admin only)
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
  const { limit, recipeId, userId, q } = parsed.data;

  const ratings = await prisma.rating.findMany({
    where: {
      ...(recipeId ? { recipeId } : {}),
      ...(userId ? { userId } : {}),
      ...(q
        ? {
            OR: [
              { comment: { contains: q, mode: "insensitive" as const } },
              { recipe: { title: { contains: q, mode: "insensitive" as const } } },
              { user: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      recipe: { select: { id: true, title: true, photoUrl: true, categories: true } },
    },
  });

  return NextResponse.json({ data: ratings, error: null });
}

const deleteSchema = z.object({ id: z.string().min(1) });

// DELETE /api/admin/ratings — delete a rating by id, recompute recipe aggregate
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

  // Look up first so we know the recipeId for the recompute (Prisma
  // delete() returns the count, not the row).
  const target = await prisma.rating.findUnique({
    where: { id },
    select: { id: true, recipeId: true },
  });
  if (!target) {
    return NextResponse.json({ data: null, error: "Rating not found" }, { status: 404 });
  }

  await prisma.rating.delete({ where: { id } });
  await recomputeRating(target.recipeId);

  return NextResponse.json({ data: { deleted: true, id }, error: null });
}
