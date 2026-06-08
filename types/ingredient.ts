// Shared ingredient shape used by the API, form, display, shopping list, and print view.
//
// amount: numeric quantity. null means "to taste", "a pinch", "some" — never scales.
// unit:   canonical lowercase unit, or "" when there is no unit (e.g. "3 eggs").
//         Use canonicalUnit() to normalize user input on save.
// name:   the ingredient itself, e.g. "flour", "chicken thigh".
// note:   optional trailing modifier, e.g. "minced", "(14 oz can)".
//         Not exposed in the form for v1 but preserved on save so existing data
//         doesn't lose detail during the migration.

export type Ingredient = {
  amount: number | null;
  unit: string;
  name: string;
  note?: string | null;
};

// Common units shown in the form's <datalist> for the unit field.
export const COMMON_UNITS: readonly string[] = [
  '',
  'g',
  'kg',
  'mg',
  'ml',
  'l',
  'tsp',
  'tbsp',
  'cup',
  'oz',
  'lb',
  'piece',
  'clove',
  'slice',
  'can',
  'pkg',
  'bunch',
  'pinch',
  'dash',
];

// Set of known cooking units. canonicalUnit() returns "" for anything outside
// this set so we never mistake an ingredient name (salt, eggs, flour) for a unit.
const KNOWN_UNITS = new Set([
  'g', 'kg', 'mg', 'oz', 'lb',
  'ml', 'l',
  'tsp', 'tbsp', 'cup',
  'clove', 'piece', 'slice', 'can', 'pkg', 'bunch', 'pinch', 'dash',
]);

// Map of free-form aliases to canonical lowercase units. Looked up both as-is
// and with a trailing 's' stripped, so "tbsp" and "tablespoons" both resolve.
const UNIT_ALIASES: Record<string, string> = {
  // volume
  tsp: 'tsp',
  t: 'tsp',
  tsps: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tbs: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cup: 'cup',
  c: 'cup',
  // mass
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  mg: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  // volume metric
  ml: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  litre: 'l',
  litres: 'l',
  liter: 'l',
  liters: 'l',
  // countable
  clove: 'clove',
  cloves: 'clove',
  piece: 'piece',
  pieces: 'piece',
  slice: 'slice',
  slices: 'slice',
  can: 'can',
  cans: 'can',
  pkg: 'pkg',
  pkgs: 'pkg',
  package: 'pkg',
  packages: 'pkg',
  bunch: 'bunch',
  bunches: 'bunch',
  pinch: 'pinch',
  pinches: 'pinch',
  dash: 'dash',
  dashes: 'dash',
};

export function canonicalUnit(raw: string): string {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return '';
  if (UNIT_ALIASES[s]) {
    const canon = UNIT_ALIASES[s];
    return KNOWN_UNITS.has(canon) ? canon : '';
  }
  // try with trailing 's' stripped
  const singular = s.endsWith('s') ? s.slice(0, -1) : s;
  if (UNIT_ALIASES[singular]) {
    const canon = UNIT_ALIASES[singular];
    return KNOWN_UNITS.has(canon) ? canon : '';
  }
  // unknown word — not a unit
  return '';
}

// Pretty-print a number with cooking fractions. 1.5 → "1½", 0.25 → "¼", 2 → "2".
// Indexed by eighths (0..7) instead of a string key, so toFixed-rounding can
// never mismatch the lookup. Index 0 means "no fraction".
const FRACTION_GLYPHS: readonly string[] = ['', '⅛', '¼', '⅓', '⅜', '½', '⅝', '⅔', '¾', '⅞'];
// Separate table for 0.667 (⅔) since 0.667 is not 5/8 rounded, it's the 6/9 mark.
// Math: sixths-rounded gives 0,2,3,5,7,8,9 (with 4/6 = 0.667 → 5 eighths? no).
// We need exact decimals: 0.125, 0.25, 0.333, 0.375, 0.5, 0.625, 0.667, 0.75, 0.875
// Mapped to indices: 1, 2, 3, 4, 5, 6, 7, 8, 9
function fractionGlyphFor(frac: number): string | null {
  if (Math.abs(frac - 0.125) < 0.01) return '⅛';
  if (Math.abs(frac - 0.25) < 0.01) return '¼';
  if (Math.abs(frac - 1 / 3) < 0.01) return '⅓';
  if (Math.abs(frac - 0.375) < 0.01) return '⅜';
  if (Math.abs(frac - 0.5) < 0.01) return '½';
  if (Math.abs(frac - 0.625) < 0.01) return '⅝';
  if (Math.abs(frac - 2 / 3) < 0.01) return '⅔';
  if (Math.abs(frac - 0.75) < 0.01) return '¾';
  if (Math.abs(frac - 0.875) < 0.01) return '⅞';
  return null;
}

export function formatAmount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  // snap to nearest 1/8 for clean display
  const eighths = Math.round(n * 8) / 8;
  const snapped = Math.abs(eighths - n) < 0.01 ? eighths : Math.round(n * 100) / 100;
  const whole = Math.floor(snapped);
  const frac = snapped - whole;
  if (frac < 0.01) return String(whole);
  const glyph = fractionGlyphFor(frac) ?? (Math.round(frac * 100) / 100).toString();
  if (whole === 0) return glyph;
  return `${whole}${glyph}`;
}

// Render the unit with optional-plural notation. We don't track amount
// here — callers pass the unit and we just append "(s)" if it's a countable
// word. For pure mass/volume units (g, ml, kg, l, …) the caller can pass
// them through with an empty result and we won't add "(s)".
//
// To keep this simple: if `unit` is empty, return empty. Otherwise return
// the unit followed by "(s)". This is the convention older cookbooks use
// ("1 cup(s) of flour") and removes the need to track singular vs plural.
export function pluralizeUnit(unit: string, _amount?: number | null): string {
  if (!unit) return '';
  return `${unit}(s)`;
}

// Format a structured ingredient into a human-readable string. Used by the
// detail page, shopping list, and print view. Scaled ingredients pre-compute
// the new amount before calling this.
export function formatIngredient(ing: Ingredient): string {
  const parts: string[] = [];
  if (ing.amount != null) {
    parts.push(formatAmount(ing.amount));
    if (ing.unit) parts.push(pluralizeUnit(ing.unit, ing.amount));
  } else if (ing.unit) {
    // amount is null but unit is set (e.g. "pinch salt")
    parts.push(ing.unit);
  }
  if (ing.name) parts.push(ing.name);
  if (ing.note) parts.push(`(${ing.note})`);
  return parts.join(' ').trim();
}

// Return a scaled copy. amount=null lines are returned as-is ("to taste" etc.).
export function scaleIngredient(ing: Ingredient, factor: number): Ingredient {
  if (ing.amount == null) return ing;
  return { ...ing, amount: ing.amount * factor };
}

// === Migration helper ===
// Parse the legacy free-form "amount" string into the new structured shape.
// Returns the best-effort decomposition: { amount, unit, note }.
// Note: `name` is passed in unchanged — we only split the amount string.
//
// Examples:
//   "2 cups"           → { amount: 2,     unit: "cup",  note: null }
//   "1 1/2 tsp"        → { amount: 1.5,   unit: "tsp",  note: null }
//   "200g"             → { amount: 200,   unit: "g",    note: null }
//   "salt to taste"    → { amount: null,  unit: "",     note: "to taste" }
//   "1 can (14 oz)"    → { amount: 1,     unit: "can",  note: "(14 oz)" }
//   "2-3 cloves"       → { amount: 2.5,   unit: "clove",note: "2-3" }
//   "a pinch"          → { amount: null,  unit: "pinch",note: null }
//   ""                 → { amount: null,  unit: "",     note: null }
export function parseLegacyAmount(
  raw: string,
  nameHint?: string,
): Pick<Ingredient, 'amount' | 'unit' | 'note'> {
  const text = (raw || '').trim();
  if (!text) return { amount: null, unit: '', note: null };

  // If the amount text starts with the ingredient name, strip it before parsing.
  // This handles redundant inputs like amount="salt to taste" + name="salt".
  let working = text;
  if (nameHint) {
    const n = nameHint.trim().toLowerCase();
    if (n && working.toLowerCase().startsWith(n)) {
      working = working.slice(n.length).trim();
    }
  }

  // Range: "2-3 cloves" or "2 - 3 cloves" → midpoint, preserve original in note
  const range = working.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (range) {
    const lo = parseFloat(range[1]);
    const hi = parseFloat(range[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      const rest = range[3].trim();
      const unitMatch = rest.match(/^([a-zA-Z]+)\s*(.*)$/);
      const unit = unitMatch ? canonicalUnit(unitMatch[1]) : '';
      return {
        amount: Math.round(((lo + hi) / 2) * 1000) / 1000,
        unit,
        // Preserve the original (after name-strip) in note so the user can
        // see the full intent.
        note: working,
      };
    }
  }

  // Number at start (with optional fraction form)
  const m = working.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)\s*(.*)$/,
  );
  if (m) {
    const numStr = m[1].trim().replace(',', '.');
    let value: number;
    if (numStr.includes(' ')) {
      const [w, f] = numStr.split(/\s+/);
      const [n, d] = f.split('/').map(Number);
      value = Number(w) + n / d;
    } else if (numStr.includes('/')) {
      const [n, d] = numStr.split('/').map(Number);
      value = d === 0 ? 0 : n / d;
    } else {
      value = Number(numStr);
    }
    if (!Number.isFinite(value) || value < 0) {
      return { amount: null, unit: '', note: working };
    }
    const rest = (m[2] ?? '').trim();
    // skip leading "x" multiplier marker: "2x can" → unit/after
    const restNoX = rest.match(/^x\s+(.*)$/i);
    const afterX = restNoX ? restNoX[1] : rest;
    const unitMatch = afterX.match(/^([a-zA-Z]+)\s*(.*)$/);
    let unit = '';
    let tail: string;
    if (unitMatch) {
      unit = canonicalUnit(unitMatch[1]);
      if (unit) {
        // known unit — keep it, tail is whatever follows
        tail = unitMatch[2].trim();
      } else {
        // unknown word ("eggs", "flour", ...) — it's not a unit, fold it back
        // into the tail so it lands in the note or the name (per caller)
        tail = afterX;
      }
    } else {
      tail = afterX;
    }
    // Strip the ingredient name from the tail (if present) so we don't end up
    // with "2 cloves (garlic)" when the name field is already "garlic".
    if (nameHint && tail) {
      const n = nameHint.trim();
      if (n) {
        const tailLower = tail.toLowerCase();
        if (tailLower === n.toLowerCase()) {
          tail = '';
        } else if (tailLower.startsWith(n.toLowerCase() + ' ')) {
          tail = tail.slice(n.length + 1).trim();
        }
      }
    }
    // If there's a parenthetical in the tail, that's the note
    const parenMatch = tail.match(/^(\(.*\))\s*(.*)$/);
    let note: string | null = null;
    let leftover = tail;
    if (parenMatch) {
      note = parenMatch[1];
      leftover = parenMatch[2];
    }
    // If there's still text after the unit, fold it into the note
    if (leftover) {
      note = note ? `${note} ${leftover}` : leftover;
    }
    return { amount: value, unit, note };
  }

  // No leading number — try to extract a unit from the start.
  // Strip a leading quantifier article only if the next word is a known unit.
  // e.g. "a pinch" → "pinch" (unit) ✓,  "a few sprigs" → no unit, keep whole
  // text in note so the user sees their original input.
  const articles = ['a', 'an', 'the', 'some', 'few', 'several'];
  for (const art of articles) {
    if (working.toLowerCase().startsWith(art + ' ')) {
      const candidate = working.slice(art.length + 1);
      const wordMatch = candidate.match(/^([a-zA-Z]+)/);
      if (wordMatch && canonicalUnit(wordMatch[1])) {
        working = candidate;
      }
      break;
    }
  }
  const unitMatch = working.match(/^([a-zA-Z]+)\s*(.*)$/);
  if (unitMatch) {
    const unit = canonicalUnit(unitMatch[1]);
    if (unit) {
      const tail = unitMatch[2].trim();
      return { amount: null, unit, note: tail || null };
    }
  }

  // Nothing parseable. Whole text becomes the note; the user's `name` field
  // already has the actual ingredient, so we don't need to duplicate it.
  return { amount: null, unit: '', note: working };
}
