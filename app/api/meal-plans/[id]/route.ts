import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Authz rule for a meal plan:
 * - Owner of the plan (userId matches)
 * - Member of the household that owns the plan (householdId matches session.householdId)
 * - Admin role
 */
function canModify(plan: { userId: string | null; householdId: string | null }, session: { user: { id: string; role: string; householdId: string | null } }) {
  if (session.user.role === "ADMIN") return true;
  if (plan.userId && plan.userId === session.user.id) return true;
  if (plan.householdId && plan.householdId === session.user.householdId) return true;
  return false;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const plan = await prisma.mealPlan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });
  if (!canModify(plan, session as any)) return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });

  await prisma.mealPlan.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true }, error: null });
}
