// Migrate recipes.ingredients from the legacy free-form string shape
// {amount: "1 1/2 cups", name: "flour"}
// to the new structured shape
// {amount: 1.5, unit: "cup", name: "flour", note: null}.
//
// Idempotent: if a row is already in the new shape, it's left alone.
// Dry-run by default: pass --apply to write changes.
//
// Usage (inside the running app container):
//   npx tsx scripts/migrate-ingredients.ts          # dry run
//   npx tsx scripts/migrate-ingredients.ts --apply  # apply

import { PrismaClient } from '@prisma/client';
import { parseLegacyAmount, type Ingredient } from '../types/ingredient';

const db = new PrismaClient();

// Detect whether an ingredient is already in the new structured shape.
function isStructured(ing: unknown): ing is Ingredient {
  if (!ing || typeof ing !== 'object') return false;
  const o = ing as Record<string, unknown>;
  return (
    'amount' in o &&
    (typeof o.amount === 'number' || o.amount === null) &&
    'unit' in o &&
    typeof o.unit === 'string' &&
    'name' in o &&
    typeof o.name === 'string'
  );
}

// Convert a legacy ingredient record to the new shape.
function migrateOne(ing: Record<string, unknown>): Ingredient {
  const legacyAmount = typeof ing.amount === 'string' ? ing.amount : '';
  const name = typeof ing.name === 'string' ? ing.name : '';
  // Some older rows may have used {quantity, name} — be lenient.
  const rawAmount =
    legacyAmount ||
    (typeof ing.quantity === 'string' || typeof ing.quantity === 'number'
      ? String(ing.quantity)
      : '');
  const { amount, unit, note } = parseLegacyAmount(rawAmount, name);
  return { amount, unit, name: name.trim(), note };
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (!apply) {
    console.log('=== DRY RUN — pass --apply to write changes ===\n');
  } else {
    console.log('=== APPLYING MIGRATION ===\n');
  }

  const recipes = await db.recipe.findMany({
    select: { id: true, title: true, ingredients: true },
  });
  console.log(`Found ${recipes.length} recipes\n`);

  let migratedRecipes = 0;
  let migratedIngredients = 0;
  let alreadyStructured = 0;
  const preview: Array<{ title: string; before: unknown[]; after: Ingredient[] }> = [];

  for (const r of recipes) {
    const ings = r.ingredients as unknown[];
    if (!Array.isArray(ings) || ings.length === 0) continue;

    let needsMigration = false;
    const after: Ingredient[] = [];
    for (const ing of ings) {
      if (isStructured(ing)) {
        after.push(ing);
        alreadyStructured++;
        continue;
      }
      needsMigration = true;
      const obj = (ing ?? {}) as Record<string, unknown>;
      const migrated = migrateOne(obj);
      after.push(migrated);
      migratedIngredients++;
    }

    if (needsMigration) {
      migratedRecipes++;
      preview.push({ title: r.title, before: ings, after });
    }
  }

  console.log(
    `Summary: ${migratedRecipes} recipes to migrate, ${migratedIngredients} ingredients, ${alreadyStructured} already structured\n`,
  );

  if (preview.length > 0) {
    console.log('--- First 3 recipe previews ---');
    for (const p of preview.slice(0, 3)) {
      console.log(`\n📖 ${p.title}`);
      for (let i = 0; i < p.before.length; i++) {
        console.log(`  before: ${JSON.stringify(p.before[i])}`);
        console.log(`  after:  ${JSON.stringify(p.after[i])}`);
      }
    }
  }

  if (apply) {
    for (const r of recipes) {
      const ings = r.ingredients as unknown[];
      if (!Array.isArray(ings) || ings.length === 0) continue;
      const after: Ingredient[] = [];
      for (const ing of ings) {
        if (isStructured(ing)) {
          after.push(ing);
        } else {
          const obj = (ing ?? {}) as Record<string, unknown>;
          after.push(migrateOne(obj));
        }
      }
      await db.recipe.update({
        where: { id: r.id },
        data: { ingredients: after as unknown as object },
      });
    }
    console.log('\n✅ Migration applied');
  } else {
    console.log('\n(re-run with --apply to write changes)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
