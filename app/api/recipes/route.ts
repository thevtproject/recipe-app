import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  photoUrl: z.string().url().optional().or(z.literal('')),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    instruction: z.string().min(1),
  })).default([]),
});

// GET /api/recipes?category=BREAKFAST|LUNCH|DINNER
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  const where = category && ['BREAKFAST', 'LUNCH', 'DINNER'].includes(category)
    ? { category: category as 'BREAKFAST' | 'LUNCH' | 'DINNER' }
    : {};

  const recipes = await prisma.recipe.findMany({
    where,
    select: {
      id: true, title: true, description: true, category: true,
      photoUrl: true, authorId: true, createdAt: true,
      author: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: recipes, error: null });
}

// POST /api/recipes
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, category, photoUrl, steps } = parsed.data;

  const recipe = await prisma.recipe.create({
    data: {
      title,
      description,
      category,
      photoUrl: photoUrl || null,
      steps,
      authorId: session.user.id!,
    },
  });

  return NextResponse.json({ data: recipe, error: null }, { status: 201 });
}
