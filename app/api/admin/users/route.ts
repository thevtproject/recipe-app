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
  const actingAdminId = (session.user as any).id as string;

  // Self-protection: an admin cannot approve/reject themselves via this
  // endpoint. They can change their own role via a dedicated flow (none
  // exists yet — would require additional design).
  if (userId === actingAdminId) {
    return NextResponse.json(
      { data: null, error: "Admins cannot approve or reject their own account" },
      { status: 400 }
    );
  }

  // Verify the target user exists. Without this we'd accept arbitrary ids
  // and get a Prisma P2025 error leaking the model.
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isApproved: true },
  });
  if (!target) {
    return NextResponse.json({ data: null, error: "User not found" }, { status: 404 });
  }

  if (action === "reject") {
    // Hard delete on reject. Reject = "we don't want this account at all".
    // Their data (recipes, ratings, meal-plans) is cascaded.
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ data: { deleted: true }, error: null });
  }

  // action === "approve"
  // Don't allow demoting a fellow admin to a non-admin via approval. They
  // would already be approved, so this is a no-op in the common case.
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isApproved: true },
    select: { id: true, email: true, name: true, isApproved: true },
  });

  return NextResponse.json({ data: user, error: null });
}
