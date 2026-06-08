import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Ingredient } from '@/types/ingredient';

type Category = 'produce' | 'dairy' | 'meat' | 'pantry' | 'spices' | 'other';

type AggregatedItem = {
  name: string;
  amount: string | null; // formatted display string, e.g. "400 g"
  unit: string | null;   // normalized unit, e.g. "g" (or null for unsummable items)
  recipeIds: string[];
};

// Keyword-based category heuristic. The list intentionally errs on the side of
// covering common Western + Asian pantry ingredients; the agent of last resort
// is "other".
const CATEGORY_KEYWORDS: Record<Exclude<Category, 'other'>, string[]> = {
  produce: [
    'lettuce', 'tomato', 'onion', 'garlic', 'ginger', 'chili', 'chillie',
    'chilies', 'chile', 'herb', 'basil', 'cilantro', 'coriander', 'parsley',
    'mint', 'vegetable', 'fruit', 'apple', 'banana', 'lemon', 'lime', 'orange',
    'potato', 'carrot', 'pepper', 'bell pepper', 'cucumber', 'spinach',
    'kale', 'mushroom', 'mushrooms', 'broccoli', 'cauliflower', 'cabbage',
    'celery', 'corn', 'pea', 'zucchini', 'eggplant', 'aubergine', 'pumpkin',
    'scallion', 'scallions', 'green onion', 'shallot', 'leek', 'arugula',
    'avocado', 'berry', 'berries', 'strawberry', 'blueberry', 'grape',
  ],
  dairy: [
    'milk', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'egg', 'eggs',
    'sour cream', 'parmesan', 'mozzarella', 'feta', 'ricotta', 'cheddar',
  ],
  meat: [
    'chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'turkey', 'lamb',
    'bacon', 'ham', 'sausage', 'tofu', 'prawn', 'prawns', 'tuna', 'cod',
    'duck', 'veal', 'anchovy', 'anchovies',
  ],
  pantry: [
    'rice', 'pasta', 'noodle', 'noodles', 'flour', 'sugar', 'oil', 'vinegar',
    'soy sauce', 'salt', 'bread', 'tortilla', 'oat', 'oats', 'honey', 'stock',
    'broth', 'wine', 'ketchup', 'mustard', 'mayonnaise', 'tomato sauce',
    'tomato paste', 'coconut milk', 'beans', 'lentil', 'lentils', 'chickpea',
    'chickpeas', 'peanut', 'peanut butter', 'sesame', 'maple syrup', 'olives',
    'pickle', 'cornstarch', 'corn starch', 'baking powder', 'baking soda',
    'yeast', 'sauce', 'tahini', 'miso',
  ],
  spices: [
    'pepper', 'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'star anise',
    'clove', 'cloves', 'nutmeg', 'turmeric', 'cardamom', 'coriander seed',
    'cayenne', 'chili powder', 'curry powder', 'bay leaf', 'bay leaves',
    'vanilla', 'vanilla extract', 'salt', 'black pepper', 'white pepper',
  ],
};

function categorize(name: string): Category {
  const n = name.toLowerCase().trim();
  // Spices win over pantry for "salt" / "pepper" — they get bucketed as spices
  // when amounts are typically pinches. The user can still see them grouped
  // with spices, which is the conventional aisle grouping.
  for (const kw of CATEGORY_KEYWORDS.spices) {
    if (n.includes(kw)) return 'spices';
  }
  for (const cat of ['produce', 'dairy', 'meat', 'pantry'] as const) {
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (n.includes(kw)) return cat;
    }
  }
  return 'other';
}

// --- Amount / unit helpers (structured data: amount is number|null, unit is canonical) ---

const UNIT_CONVERSIONS: Record<string, number> = {
  // all expressed in a base unit
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  tbsp: 1,
  tsp: 1, // 3 tsp = 1 tbsp, but we keep them separate to avoid surprises
  cup: 1,
  oz: 1,
  lb: 1,
  clove: 1,
  piece: 1,
  pinch: 1,
  dash: 1,
  can: 1,
  pkg: 1,
};

const MIXABLE_UNITS = new Set(['tbsp', 'tsp', 'cup', 'pinch', 'dash', 'piece', 'clove', 'can', 'pkg']);

type ParsedAmount = { value: number; unit: string | null; display: string };

// Pull a numeric amount + canonical unit out of a structured ingredient.
// Returns null for "to taste" / "a pinch" (amount is null). The display
// string is what we show in the shopping list when we can't combine units.
function readAmount(ing: Ingredient): ParsedAmount | null {
  if (ing.amount == null) return null;
  const unit = ing.unit ? ing.unit : null;
  const display = unit
    ? `${ing.amount} ${unit}`
    : String(ing.amount);
  return { value: ing.amount, unit, display };
}

// Pretty-print a numeric total. Integers print without decimals; fractions
// print to at most 2 decimals. Always include the unit if known.
function formatAmount(value: number, unit: string | null): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 100) / 100;
  const str = rounded === Math.trunc(rounded) ? String(Math.trunc(rounded)) : String(rounded);
  return unit ? `${str} ${unit}` : str;
}

// --- Date helpers (server-side defaults for "current week") ---

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

// Local date as YYYY-MM-DD. NOT toISOString (off by 1 in non-UTC timezones).
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// GET /api/shopping-list?from=YYYY-MM-DD&until=YYYY-MM-DD&scope=me|family
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const householdId = (session.user as { householdId?: string | null }).householdId ?? null;
  if (!userId) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get('scope') ?? 'ME').toUpperCase();

  const today = new Date();
  const defaultMon = getMonday(today);
  const defaultFrom = fmtDate(defaultMon);
  const defaultUntil = fmtDate(addDays(defaultMon, 6));

  const fromParam = searchParams.get('from') ?? defaultFrom;
  const untilParam = searchParams.get('until') ?? defaultUntil;

  // Validate YYYY-MM-DD
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(fromParam) || !dateRe.test(untilParam)) {
    return NextResponse.json({ data: null, error: 'from/until must be YYYY-MM-DD' }, { status: 400 });
  }

  // Build the meal-plan filter based on scope
  let where: Record<string, unknown>;
  if (scope === 'FAMILY') {
    if (!householdId) {
      return NextResponse.json({ data: null, error: 'Not in a household' }, { status: 400 });
    }
    where = { householdId };
  } else if (scope === 'ME') {
    where = { userId };
  } else {
    return NextResponse.json({ data: null, error: 'scope must be "ME" or "FAMILY"' }, { status: 400 });
  }

  const fromDate = new Date(fromParam);
  const untilDate = new Date(untilParam);
  fromDate.setHours(0, 0, 0, 0);
  untilDate.setHours(0, 0, 0, 0);

  const plans = await prisma.mealPlan.findMany({
    where: {
      ...where,
      date: { gte: fromDate, lte: untilDate },
    },
    include: {
      recipe: { select: { id: true, ingredients: true } },
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  });

  // Aggregate ingredients
  // key = lower(name) for matching
  // value = { name (display), unitKey (normalized), totals: Map<unit, sum> }
  type Acc = {
    name: string;
    totals: Map<string, number>; // unit -> sum
    display: Map<string, string>; // unit -> display string for non-numeric entries
    recipeIds: Set<string>;
  };
  const acc = new Map<string, Acc>();

  for (const plan of plans) {
    const recipeId = plan.recipe.id;
    const ings = (plan.recipe.ingredients ?? []) as unknown as Ingredient[];
    if (!Array.isArray(ings)) continue;

    for (const ing of ings) {
      if (!ing || typeof ing.name !== 'string') continue;
      const trimmedName = ing.name.trim();
      if (!trimmedName) continue;
      const key = trimmedName.toLowerCase();

      let entry = acc.get(key);
      if (!entry) {
        entry = { name: trimmedName, totals: new Map(), display: new Map(), recipeIds: new Set() };
        acc.set(key, entry);
      }
      entry.recipeIds.add(recipeId);

      const parsed = readAmount(ing);
      if (parsed) {
        const unitKey = parsed.unit ?? '__none__';
        if (parsed.unit && !MIXABLE_UNITS.has(parsed.unit) && UNIT_CONVERSIONS[parsed.unit] !== undefined) {
          // mass / volume units (g, kg, ml, l, oz, lb) — convert to base then accumulate
          const baseValue = parsed.value * UNIT_CONVERSIONS[parsed.unit];
          entry.totals.set(unitKey, (entry.totals.get(unitKey) ?? 0) + baseValue);
        } else if (MIXABLE_UNITS.has(parsed.unit ?? '')) {
          // countable / measure units — sum within the same unit
          entry.totals.set(unitKey, (entry.totals.get(unitKey) ?? 0) + parsed.value);
        } else if (!parsed.unit) {
          // pure number, e.g. "3 eggs" without unit
          entry.totals.set(unitKey, (entry.totals.get(unitKey) ?? 0) + parsed.value);
        } else {
          // unknown unit, no other entries yet — record raw display
          if (!entry.display.has(unitKey)) entry.display.set(unitKey, parsed.display);
        }
      } else {
        // free-form amount like "to taste", "a handful"
        const unitKey = '__text__';
        // For "a pinch" with unit="pinch", readAmount returns the unit so it
        // is summed above. Otherwise amount is null and we have nothing to sum.
        const display = ing.unit ? ing.unit : '—';
        if (!entry.display.has(unitKey)) entry.display.set(unitKey, display);
      }
    }
  }

  // Convert accumulator to display items, then bucket by category
  const categories: Record<Category, AggregatedItem[]> = {
    produce: [], dairy: [], meat: [], pantry: [], spices: [], other: [],
  };
  let totalItems = 0;

  for (const entry of Array.from(acc.values())) {
    let amount: string | null = null;
    let unit: string | null = null;

    if (entry.totals.size > 0) {
      // Pick the unit with the largest total for the display
      let bestUnit = '';
      let bestTotal = -Infinity;
      for (const [u, v] of Array.from(entry.totals)) {
        if (v > bestTotal) { bestTotal = v; bestUnit = u; }
      }
      if (bestUnit && bestUnit !== '__none__') {
        // Convert back from base unit if it's a mass/volume unit
        const base = UNIT_CONVERSIONS[bestUnit];
        if (base && base !== 1) {
          // use a friendly unit: if value >= 1000g show kg, etc.
          if (bestUnit === 'g' && bestTotal >= 1000) {
            amount = formatAmount(bestTotal / 1000, 'kg');
            unit = 'kg';
          } else if (bestUnit === 'ml' && bestTotal >= 1000) {
            amount = formatAmount(bestTotal / 1000, 'l');
            unit = 'l';
          } else {
            amount = formatAmount(bestTotal, bestUnit);
            unit = bestUnit;
          }
        } else {
          amount = formatAmount(bestTotal, bestUnit);
          unit = bestUnit;
        }
      } else {
        // no unit
        amount = formatAmount(bestTotal, null);
        unit = null;
      }
    } else if (entry.display.size > 0) {
      // non-numeric: show first recorded display text
      const displayValues = Array.from(entry.display.values()) as string[];
      amount = displayValues[0] ?? null;
      unit = null;
    }

    const item: AggregatedItem = {
      name: entry.name,
      amount,
      unit,
      recipeIds: Array.from(entry.recipeIds),
    };
    const cat = categorize(entry.name);
    categories[cat].push(item);
    totalItems += 1;
  }

  // Sort each category alphabetically
  for (const cat of Object.keys(categories) as Category[]) {
    categories[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  const totalRecipes = new Set(plans.map((p) => p.recipe.id)).size;

  return NextResponse.json({
    data: {
      categories,
      totalRecipes,
      totalItems,
      from: fromParam,
      until: untilParam,
      scope,
    },
    error: null,
  });
}
