import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { extractRecipeFromUrl } from '@/lib/recipe-import';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

const importUrlSchema = z.object({
  url: z
    .string()
    .min(1, 'URL is required')
    .url('Must be a valid URL')
    .refine(
      (u) => u.startsWith('http://') || u.startsWith('https://'),
      'Only http and https URLs are supported',
    ),
});

// POST /api/recipes/import-url
//
// Accepts { url: string }, fetches the page, extracts structured recipe data,
// and returns it. The client (RecipeForm) can then populate form fields from
// the returned data.
export async function POST(req: NextRequest) {
  // 1. Authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Rate limiting — per-IP
  const ip = getClientIp(req);
  const ipCheck = rateLimit('upload', `import:${ip}`);
  if (!ipCheck.ok) {
    return NextResponse.json(
      {
        data: null,
        error: `Too many import requests. Try again in ${ipCheck.retryAfterSec}s.`,
      },
      { status: 429 },
    );
  }

  // 3. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = importUrlSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid input';
    return NextResponse.json({ data: null, error: firstError }, { status: 400 });
  }

  const { url } = parsed.data;

  // 4. Extract recipe data
  try {
    const extracted = await extractRecipeFromUrl(url);

    // If no ingredients or steps were found, that's still valid data —
    // the page may not be a recipe, but we return what we got.
    return NextResponse.json({ data: extracted, error: null });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to extract recipe from URL';
    // Provide a more specific status for known error types
    let status = 422;
    if (
      message.includes('Invalid URL') ||
      message.includes('Only http and https')
    ) {
      status = 400;
    } else if (message.includes('timed out')) {
      status = 504;
    } else if (message.includes('Failed to fetch') || message.includes('HTTP ')) {
      status = 502;
    }

    return NextResponse.json({ data: null, error: message }, { status });
  }
}
