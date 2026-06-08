import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    avatarUrl: z
      .union([z.string().min(1).max(500), z.literal(''), z.null()])
      .optional(),
    hasBabyPlanner: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.avatarUrl !== undefined ||
      data.hasBabyPlanner !== undefined,
    { message: 'At least one of `name`, `avatarUrl`, or `hasBabyPlanner` must be provided' }
  );

// PATCH /api/profile — update the current user's name, avatar, or planner prefs
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Invalid session' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Normalize avatarUrl: empty string clears the field, undefined leaves it untouched
  const data: {
    name?: string;
    avatarUrl?: string | null;
    hasBabyPlanner?: boolean;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) {
    data.avatarUrl = parsed.data.avatarUrl === '' ? null : parsed.data.avatarUrl;
  }
  if (parsed.data.hasBabyPlanner !== undefined) {
    data.hasBabyPlanner = parsed.data.hasBabyPlanner;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isApproved: true,
      avatarUrl: true,
      hasBabyPlanner: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ data: user, error: null });
}
