import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']).optional(),
  photoUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    instruction: z.string().min(1),
  })).optional(),
  ingredients: z.array(z.object({
    amount: z.string().min(1),
    name: z.string().min(1),
  })).optional(),
});

async function getRecipeOrFail(id: string) {
  return prisma.recipe.findUnique({ where: { id } });
}

function canModify(recipe: { authorId: string }, session: { user: { id?: string | null; role?: string | null } }) {
  return recipe.authorId === session.user.id || session.user.role === 'ADMIN';
}

// GET /api/recipes/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const recipe = await getRecipeOrFail(id);
  if (!recipe) return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: recipe, error: null });
}

// PATCH /api/recipes/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const recipe = await getRecipeOrFail(id);
  if (!recipe) return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
  if (!canModify(recipe, session)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.recipe.update({
    where: { id },
    data: {
      ...parsed.data,
      photoUrl: parsed.data.photoUrl === '' ? null : parsed.data.photoUrl,
    },
  });

  return NextResponse.json({ data: updated, error: null });
}

// DELETE /api/recipes/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const recipe = await getRecipeOrFail(id);
  if (!recipe) return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
  if (!canModify(recipe, session)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

  await prisma.recipe.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true }, error: null });
}
