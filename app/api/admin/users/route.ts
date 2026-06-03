import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Auth guard helper
async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return null;
  }
  return session;
}

// GET /api/admin/users?status=pending|approved|all
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const where =
    status === "pending"
      ? { isApproved: false }
      : status === "approved"
      ? { isApproved: true }
      : {};

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, role: true, isApproved: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: users, error: null });
}

const patchSchema = z.object({
  userId: z.string(),
  action: z.enum(["approve", "reject"]),
});

// PATCH /api/admin/users — approve or reject a user
export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, action } = parsed.data;

  if (action === "reject") {
    // Delete the user entirely on reject
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isApproved: true },
    select: { id: true, email: true, name: true, isApproved: true },
  });

  return NextResponse.json({ data: user, error: null });
}
