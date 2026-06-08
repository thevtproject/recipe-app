import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processRecipeImage, PROCESSED_IMAGE_EXT } from '@/lib/images';
import { sanitizeText } from '@/lib/sanitize';
import { z } from 'zod';

const RECIPE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

// Magic-byte MIME detection — never trust Content-Type
function detectImageMime(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp';
  return null;
}

const createSchema = z.object({
  title: z.string().min(1).max(200).transform(sanitizeText),
  description: z.string().max(1000).transform(sanitizeText).optional(),
  notes: z.string().max(2000).transform(sanitizeText).optional(),
  servings: z.number().int().min(1).max(99).optional(),
  prepTimeMin: z.number().int().min(0).max(10000).optional(),
  cookTimeMin: z.number().int().min(0).max(10000).optional(),
  categories: z.array(z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'BABY'])).min(1),
  photoUrl: z.string().optional().or(z.literal('')),
  steps: z.array(z.object({
    order: z.number().int().min(1),
    instruction: z.string().min(1).transform(sanitizeText),
    durationSec: z.number().int().min(1).max(86400).nullable().optional(),
  })).default([]),
  ingredients: z.array(z.object({
    amount: z.number().min(0).nullable(),
    unit: z.string().max(50).default(''),
    name: z.string().min(1).max(200).transform(sanitizeText),
    note: z.string().max(200).transform(sanitizeText).nullable().optional(),
  })).default([]),
});

// GET /api/recipes?category=BREAKFAST,LUNCH   (OR semantics: matches any selected)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryParam = searchParams.get('category');
  const validCats = ['BREAKFAST', 'LUNCH', 'DINNER', 'BABY'] as const;
  type Cat = typeof validCats[number];
  const selectedCats: Cat[] = (categoryParam?.split(',') ?? [])
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is Cat => (validCats as readonly string[]).includes(s));

  // OR semantics: recipe matches if it has ANY of the selected categories
  const where = selectedCats.length > 0
    ? { categories: { hasSome: selectedCats } }
    : {};

  const recipes = await prisma.recipe.findMany({
    where,
    select: {
      id: true, title: true, description: true, categories: true,
      photoUrl: true, authorId: true, createdAt: true,
      ratingAvg: true, ratingCount: true, lastCookedAt: true,
      author: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: recipes, error: null });
}

// POST /api/recipes
//
// Accepts either:
//   - application/json: existing schema. `photoUrl` is a string the client already uploaded.
//   - multipart/form-data: fields `title`, `description`, `categories` (JSON string),
//     `steps` (JSON string), `ingredients` (JSON string), optional `file` (image).
//     When `file` is present, it is re-encoded to WebP and the resulting URL
//     becomes `photoUrl`.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  let body: unknown;

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid form data' }, { status: 400 });
    }

    // Re-assemble a JSON-shaped body from form fields. Complex fields are
    // expected to be JSON strings (matches the client pattern used by the
    // standalone /api/uploads-style flow).
    const file = formData.get('file');
    const title = formData.get('title');
    const description = formData.get('description');
    const categoriesRaw = formData.get('categories');
    const stepsRaw = formData.get('steps');
    const ingredientsRaw = formData.get('ingredients');
    const photoUrlRaw = formData.get('photoUrl');
    const notesRaw = formData.get('notes');
    const prepTimeMinRaw = formData.get('prepTimeMin');
    const cookTimeMinRaw = formData.get('cookTimeMin');

    body = {
      title: typeof title === 'string' ? title : '',
      description: typeof description === 'string' && description !== '' ? description : undefined,
      notes: typeof notesRaw === 'string' && notesRaw !== '' ? notesRaw : undefined,
      prepTimeMin: typeof prepTimeMinRaw === 'string' && prepTimeMinRaw !== '' ? parseInt(prepTimeMinRaw, 10) : undefined,
      cookTimeMin: typeof cookTimeMinRaw === 'string' && cookTimeMinRaw !== '' ? parseInt(cookTimeMinRaw, 10) : undefined,
      categories: typeof categoriesRaw === 'string' ? safeJsonParse(categoriesRaw, []) : [],
      steps: typeof stepsRaw === 'string' ? safeJsonParse(stepsRaw, []) : [],
      ingredients: typeof ingredientsRaw === 'string' ? safeJsonParse(ingredientsRaw, []) : [],
    };

    // If a file is present, validate, process, and write it. The resulting
    // URL overrides any client-supplied photoUrl.
    if (file && file instanceof Blob) {
      if (file.size <= 0) {
        return NextResponse.json({ data: null, error: 'File is empty' }, { status: 400 });
      }
      if (file.size > RECIPE_MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { data: null, error: 'File exceeds 5MB limit' },
          { status: 413 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      const detected = detectImageMime(buf);
      if (!detected) {
        return NextResponse.json(
          { data: null, error: 'Only JPEG, PNG, WebP allowed' },
          { status: 415 }
        );
      }

      let processed: Buffer;
      try {
        processed = await processRecipeImage(buf);
      } catch (err) {
        console.error('[recipes] sharp processing failed', err);
        return NextResponse.json(
          { data: null, error: 'Failed to process image' },
          { status: 422 }
        );
      }

      const filename = `${crypto.randomUUID()}.${PROCESSED_IMAGE_EXT}`;
      const baseUploadDir =
        process.env.UPLOAD_DIR ?? join(process.cwd(), 'public', 'uploads');
      const recipeDir = join(baseUploadDir, 'recipes');
      await mkdir(recipeDir, { recursive: true });
      await writeFile(join(recipeDir, filename), processed);

      (body as Record<string, unknown>).photoUrl = `/uploads/recipes/${filename}`;
    } else if (typeof photoUrlRaw === 'string' && photoUrlRaw !== '') {
      (body as Record<string, unknown>).photoUrl = photoUrlRaw;
    }
  } else {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, description, notes, servings, prepTimeMin, cookTimeMin, categories, photoUrl, steps, ingredients } = parsed.data;

  const recipe = await prisma.recipe.create({
    data: {
      title,
      description,
      notes,
      servings: servings ?? 4,
      prepTimeMin,
      cookTimeMin,
      categories,
      photoUrl: photoUrl || null,
      steps,
      ingredients,
      authorId: session.user.id!,
    },
  });

  return NextResponse.json({ data: recipe, error: null }, { status: 201 });
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
