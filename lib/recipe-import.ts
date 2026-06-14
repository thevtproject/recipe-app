import type { Ingredient } from '@/types/ingredient';
import type { CheerioAPI } from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportedStep = {
  instruction: string;
  durationSec?: number | null;
  imageUrl?: string | null;
};

export type ImportedRecipe = {
  title: string;
  description: string;
  ingredients: Ingredient[];
  steps: ImportedStep[];
  prepTimeMin?: number;
  cookTimeMin?: number;
  servings?: number;
  photoUrl?: string;
};

// ---------------------------------------------------------------------------
// ISO 8601 Duration → minutes
// ---------------------------------------------------------------------------

/**
 * Parse an ISO 8601 duration string (e.g. "PT30M", "PT1H30M", "P1DT2H")
 * and return the total number of minutes. Returns null on failure.
 */
function parseIsoDuration(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const days = parseInt(m[1] ?? '0', 10);
  const hours = parseInt(m[2] ?? '0', 10);
  const minutes = parseInt(m[3] ?? '0', 10);
  const seconds = parseInt(m[4] ?? '0', 10);
  return days * 24 * 60 + hours * 60 + minutes + Math.round(seconds / 60);
}

// ---------------------------------------------------------------------------
// Servings parser
// ---------------------------------------------------------------------------

/**
 * recipeYield can be a string, number, or array of strings/numbers.
 * Extract the first number found.
 */
function parseServings(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const v = parseServings(item);
      if (v !== undefined) return v;
    }
    return undefined;
  }
  if (typeof raw === 'number') return Math.round(raw);
  const s = String(raw).trim();
  const n = s.match(/(\d+)/);
  return n ? parseInt(n[1], 10) : undefined;
}

// ---------------------------------------------------------------------------
// Image extractor
// ---------------------------------------------------------------------------

function parseImage(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'url' in item) {
        return String((item as Record<string, unknown>).url);
      }
    }
  }
  if (typeof raw === 'object' && 'url' in raw) {
    return String((raw as Record<string, unknown>).url);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Instructions / Steps parser
// ---------------------------------------------------------------------------

/**
 * Recipe instructions can come in several shapes in JSON-LD:
 * 1. An array of HowToStep objects with "text" property
 * 2. An array of ItemList with "itemListElement" array
 * 3. A simple string
 * 4. An array of strings
 * 5. HowToSection with "itemListElement" containing HowToStep objects
 */
function parseInstructions(raw: unknown): ImportedStep[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((instruction) => ({ instruction }));
  }
  if (!Array.isArray(raw)) return [];

  const steps: ImportedStep[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    // Handle HowToSection (has itemListElement containing HowToSteps)
    if (
      (obj['@type'] === 'HowToSection' || String(obj['@type'] ?? '').includes('HowToSection')) &&
      Array.isArray(obj.itemListElement)
    ) {
      for (const sub of obj.itemListElement) {
        if (sub && typeof sub === 'object') {
          const subObj = sub as Record<string, unknown>;
          const text = String(subObj.text ?? '');
          if (text.trim()) {
            steps.push({
              instruction: text.trim(),
              durationSec: parseIsoDuration(subObj.duration as string | null | undefined),
              imageUrl: parseImage(subObj.image),
            });
          }
        }
      }
      continue;
    }

    // Handle HowToStep (has text)
    const hasHowToStepType =
      (typeof obj['@type'] === 'string' && obj['@type'] === 'HowToStep') ||
      (Array.isArray(obj['@type']) && (obj['@type'] as string[]).includes('HowToStep'));

    if (hasHowToStepType) {
      const text = String(obj.text ?? '');
      if (text.trim()) {
        steps.push({
          instruction: text.trim(),
          durationSec: parseIsoDuration(obj.duration as string | null | undefined),
          imageUrl: parseImage(obj.image),
        });
      }
      continue;
    }

    // Handle ItemList (has itemListElement)
    if (obj['@type'] === 'ItemList' && Array.isArray(obj.itemListElement)) {
      for (const element of obj.itemListElement) {
        if (element && typeof element === 'object') {
          const elObj = element as Record<string, unknown>;
          // Element could be a HowToStep itself or a simple string/positional item
          const text = String(elObj.text ?? elObj.name ?? '');
          if (text.trim()) {
            steps.push({
              instruction: text.trim(),
              durationSec: parseIsoDuration(elObj.duration as string | null | undefined),
              imageUrl: parseImage(elObj.image),
            });
          }
        }
      }
      continue;
    }

    // Handle plain string items in the array (simple instruction list)
    if (typeof item === 'string' && item.trim()) {
      steps.push({ instruction: item.trim() });
      continue;
    }

    // Handle objects with a "text" property but no specific type annotation
    const text = String(obj.text ?? obj.name ?? '');
    if (text.trim()) {
      steps.push({
        instruction: text.trim(),
        durationSec: parseIsoDuration(obj.duration as string | null | undefined),
        imageUrl: parseImage(obj.image),
      });
    }
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Ingredients parser
// ---------------------------------------------------------------------------

/**
 * recipeIngredient is an array of strings or structured objects.
 * Try to parse each into our Ingredient type.
 */
function parseIngredients(raw: unknown): Ingredient[] {
  if (!raw || !Array.isArray(raw)) return [];

  return raw
    .map((item: unknown): Ingredient | null => {
      if (typeof item === 'string') {
        // Free-form string like "2 cups flour" — best-effort parse
        return parseIngredientString(item);
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        // JSON-LD structured ingredient format
        const name = String(obj.name ?? '');
        if (!name.trim()) return null;

        const amount = parseAmount(obj.amount);
        const unit = String(obj.unit ?? '').trim().toLowerCase();

        return {
          amount: amount ?? null,
          unit: unit || '',
          name: name.trim(),
          note: obj.note ? String(obj.note).trim() : null,
        };
      }
      return null;
    })
    .filter((ing): ing is Ingredient => ing !== null);
}

/**
 * Best-effort free-form ingredient string parser.
 * Handles patterns like "2 cups flour", "1 1/2 tsp salt", "Salt to taste".
 */
function parseIngredientString(raw: string): Ingredient | null {
  const s = raw.trim();
  if (!s) return null;

  // Try to match "amount unit rest" pattern
  const m = s.match(/^([\d\s./½¼¾⅓⅔⅛⅜⅝⅞]+)\s+([a-zA-Z]+)\s+(.+)$/);
  if (m) {
    const amount = parseAmount(m[1]);
    const unit = m[2].trim().toLowerCase();
    const name = m[3].trim();
    return { amount: amount ?? null, unit, name, note: null };
  }

  // Try "amount rest" (no unit)
  const m2 = s.match(/^([\d\s./½¼¾⅓⅔⅛⅜⅝⅞]+)\s+(.+)$/);
  if (m2) {
    const amount = parseAmount(m2[1]);
    const name = m2[2].trim();
    return { amount: amount ?? null, unit: '', name, note: null };
  }

  // No leading number — just name (e.g. "Salt to taste")
  return { amount: null, unit: '', name: s, note: null };
}

/**
 * Parse a numeric amount from a string, including unicode fractions.
 */
function parseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  if (!s) return null;

  const UNICODE_FRACTIONS: Record<string, number> = {
    '¼': 0.25, '½': 0.5, '¾': 0.75,
    '⅓': 1 / 3, '⅔': 2 / 3,
    '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  };
  if (UNICODE_FRACTIONS[s] !== undefined) return UNICODE_FRACTIONS[s];

  // Mixed fraction: "1 1/2"
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const n = parseInt(mixedMatch[2], 10);
    const d = parseInt(mixedMatch[3], 10);
    if (d > 0) return parseInt(mixedMatch[1], 10) + n / d;
  }

  // Simple fraction: "1/2"
  const fracMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const n = parseInt(fracMatch[1], 10);
    const d = parseInt(fracMatch[2], 10);
    if (d > 0) return n / d;
  }

  // Decimal
  const num = Number(s.replace(',', '.'));
  if (Number.isFinite(num) && num >= 0) return num;

  return null;
}

// ---------------------------------------------------------------------------
// JSON-LD script extraction
// ---------------------------------------------------------------------------

/**
 * Find all <script type="application/ld+json"> blocks, parse them,
 * and return the first one that represents a Recipe.
 */
function findRecipeJsonLd($: CheerioAPI): Record<string, unknown> | null {
  const results: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      // The JSON-LD might be a single object or an array of objects (@graph)
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          // Check @type — can be a string or an array
          const typeVal = obj['@type'];
          if (typeof typeVal === 'string' && typeVal === 'Recipe') {
            results.push(obj);
          } else if (Array.isArray(typeVal) && (typeVal as string[]).includes('Recipe')) {
            results.push(obj);
          }
        }
      }
    } catch {
      // skip invalid JSON
    }
  });

  return results[0] ?? null;
}

// ---------------------------------------------------------------------------
// Structured extraction from JSON-LD
// ---------------------------------------------------------------------------

function extractFromJsonLd(
  jsonld: Record<string, unknown>,
  $: CheerioAPI,
): ImportedRecipe {
  const title = String(jsonld.name ?? '').trim() || getPageTitle($);
  const description = String(jsonld.description ?? '').trim();
  const photoUrl = parseImage(jsonld.image);
  const servings = parseServings(jsonld.recipeYield);
  const prepTimeMin = parseIsoDuration(jsonld.prepTime as string | null | undefined);
  const cookTimeMin = parseIsoDuration(jsonld.cookTime as string | null | undefined);
  const ingredients = parseIngredients(jsonld.recipeIngredient);
  const steps = parseInstructions(jsonld.recipeInstructions);

  return {
    title,
    description,
    ingredients,
    steps,
    prepTimeMin: prepTimeMin ?? undefined,
    cookTimeMin: cookTimeMin ?? undefined,
    servings,
    photoUrl,
  };
}

function getPageTitle($: CheerioAPI): string {
  return $('title').first().text().trim() || $('h1').first().text().trim() || '';
}

// ---------------------------------------------------------------------------
// OpenAI fallback extraction
// ---------------------------------------------------------------------------

async function extractWithOpenAI(
  htmlText: string,
): Promise<ImportedRecipe | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Dynamic import so the dependency is optional at build time
  let OpenAI: typeof import('openai').OpenAI;
  try {
    OpenAI = (await import('openai')).OpenAI;
  } catch {
    console.warn('[recipe-import] openai package not available, skipping AI fallback');
    return null;
  }

  const client = new OpenAI({ apiKey });

  // Trim the HTML body text to a reasonable length to avoid token blowup
  // Strip <script> and <style> blocks robustly. Loop until stable to defeat
  // nested/overlapping evasion (e.g. "<scr<script>ipt>") and allow whitespace
  // before > on closing tags (e.g. "</script >"). CodeQL js/incomplete-multi-char-sanitization
  let bodyText = htmlText;
  for (;;) {
    const next = bodyText
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '');
    if (next === bodyText) break;
    bodyText = next;
  }
  bodyText = bodyText
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15_000);

  if (!bodyText) return null;

  const systemPrompt = `You are a recipe extraction assistant. Extract structured recipe data from the provided HTML text content.

Return a JSON object with exactly this shape:
{
  "title": "Recipe Title",
  "description": "Short description",
  "ingredients": [
    { "amount": 2, "unit": "cup", "name": "flour", "note": null }
  ],
  "steps": [
    { "instruction": "Mix ingredients", "durationSec": null, "imageUrl": null }
  ],
  "prepTimeMin": 15,
  "cookTimeMin": 30,
  "servings": 4,
  "photoUrl": "https://example.com/photo.jpg"
}

Rules:
- If an ingredient has no numeric amount, set amount to null and unit to "".
- If an ingredient has a unitless amount like "3 eggs", set unit to "".
- Parse fractions and mixed numbers: "1 1/2" → 1.5, "½" → 0.5.
- For steps, instruction is required; durationSec and imageUrl can be null.
- prepTimeMin and cookTimeMin are numbers (minutes) if found, omit if unknown.
- servings is a number if found, omit if unknown.
- photoUrl is the first/main image URL if found, omit if unknown.
- If no recipe data is found in the text, return null.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: bodyText },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (!parsed || !parsed.title) return null;

    return {
      title: String(parsed.title ?? ''),
      description: String(parsed.description ?? ''),
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients.map((i: unknown) => {
            const ing = i as Record<string, unknown>;
            return {
              amount: ing.amount != null ? Number(ing.amount) : null,
              unit: String(ing.unit ?? ''),
              name: String(ing.name ?? ''),
              note: ing.note ? String(ing.note) : null,
            } as Ingredient;
          })
        : [],
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s: unknown) => {
            const st = s as Record<string, unknown>;
            return {
              instruction: String(st.instruction ?? ''),
              durationSec: st.durationSec != null ? Number(st.durationSec) : null,
              imageUrl: st.imageUrl ? String(st.imageUrl) : null,
            } as ImportedStep;
          })
        : [],
      prepTimeMin: parsed.prepTimeMin != null ? Number(parsed.prepTimeMin) : undefined,
      cookTimeMin: parsed.cookTimeMin != null ? Number(parsed.cookTimeMin) : undefined,
      servings: parsed.servings != null ? Number(parsed.servings) : undefined,
      photoUrl: parsed.photoUrl ? String(parsed.photoUrl) : undefined,
    };
  } catch (err) {
    console.error('[recipe-import] OpenAI extraction failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch a recipe URL, parse the HTML, and extract structured recipe data.
 *
 * Strategy:
 * 1. Look for JSON-LD structured data in the HTML
 * 2. If that fails and OPENAI_API_KEY is set, fall back to AI extraction
 *    from the stripped HTML body text
 *
 * Returns the extracted recipe data, or throws on fatal errors.
 */
export async function extractRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only http and https URLs are supported');
  }

  // Fetch the page with a Chrome 120 User-Agent to avoid Cloudflare blocks
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`URL does not point to an HTML page (content-type: ${contentType})`);
    }

    html = await res.text();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out after 15 seconds');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // Parse HTML with cheerio
  let cheerioMod: typeof import('cheerio');
  try {
    cheerioMod = await import('cheerio');
  } catch {
    throw new Error('cheerio package is not available');
  }

  const $ = cheerioMod.load(html);

  // Step 1: Try JSON-LD extraction
  const jsonld = findRecipeJsonLd($);
  if (jsonld) {
    return extractFromJsonLd(jsonld, $);
  }

  // Step 2: Try OpenAI fallback
  const aiResult = await extractWithOpenAI(html);
  if (aiResult) {
    return aiResult;
  }

  // Step 3: Minimal fallback — use page title and og:description
  const title = $('meta[property="og:title"]').attr('content')
    || $('meta[name="twitter:title"]').attr('content')
    || $('title').first().text().trim()
    || '';

  const description = $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || '';

  const ogImage = $('meta[property="og:image"]').attr('content') || undefined;

  if (!title) {
    throw new Error('Could not extract any recipe data from this page');
  }

  return {
    title,
    description: description || '',
    ingredients: [],
    steps: [],
    photoUrl: ogImage,
  };
}
