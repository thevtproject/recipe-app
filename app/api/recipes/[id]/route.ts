import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const updateSchema = z.object({
  title: z.string().min(1).max(200).transform(sanitizeText).optional(),
  description: z.string().max(1000).transform(sanitizeText).optional(),
  notes: z.string().max(2000).transform(sanitizeText).optional(),
  categories: z.array(z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'BABY'])).min(1).optional(),
  servings: z.number().int().min(1).max(99).optional(),
  prepTimeMin: z.number().int().min(0).max(10000).optional(),
  cookTimeMin: z.number().int().min(0).max(10000).optional(),
  photoUrl: z.union([z.string(), z.literal(''), z.null()]).optional(),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    instruction: z.string().min(1).transform(sanitizeText),
    durationSec: z.number().int().min(1).max(86400).nullable().optional(),
  })).optional(),
  ingredients: z.array(z.object({
    amount: z.number().min(0).nullable(),
    unit: z.string().max(50).default(''),
    name: z.string().min(1).max(200).transform(sanitizeText),
    note: z.string().max(200).transform(sanitizeText).nullable().optional(),
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
