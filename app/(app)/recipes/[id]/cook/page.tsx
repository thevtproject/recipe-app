import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import { CookMode } from '@/components/cooking/CookMode';
import type { Ingredient } from '@/types/ingredient';
import type { RecipeStep } from '@/components/recipe/RecipeSteps';

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) notFound();

  // Normalize steps (same logic as recipe detail page)
  const rawSteps = (recipe.steps ?? []) as unknown[];
  const steps: RecipeStep[] = rawSteps
    .map((s, i) => {
      if (typeof s === 'string')
        return { order: i + 1, instruction: s, durationSec: null };
      if (s && typeof s === 'object' && 'instruction' in (s as object)) {
        const o = s as Partial<RecipeStep>;
        return {
          order: typeof o.order === 'number' ? o.order : i + 1,
          instruction: String(o.instruction ?? ''),
          durationSec:
            typeof o.durationSec === 'number' ? o.durationSec : null,
        };
      }
      return { order: i + 1, instruction: '', durationSec: null };
    })
    .filter((s) => s.instruction.trim().length > 0);

  // Normalize ingredients
  const rawIngs = (recipe.ingredients ?? []) as unknown[];
  const ingredients: Ingredient[] = rawIngs
    .map((ing): Ingredient | null => {
      if (!ing || typeof ing !== 'object') return null;
      const o = ing as Record<string, unknown>;
      const name = String(o.name ?? '').trim();
      if (!name) return null;
      const amountRaw = o.amount;
      let amount: number | null = null;
      if (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) {
        amount = amountRaw;
      } else if (typeof amountRaw === 'string' && amountRaw.trim() !== '') {
        const n = Number(amountRaw.replace(',', '.'));
        if (Number.isFinite(n)) amount = n;
      }
      return {
        amount,
        unit: String(o.unit ?? '').trim(),
        name,
        note: o.note ? String(o.note) : null,
      };
    })
    .filter((i): i is Ingredient => i !== null);

  const totalMinutes =
    ((recipe.prepTimeMin ?? 0) as number) + ((recipe.cookTimeMin ?? 0) as number);

  return (
    <CookMode
      recipeId={recipe.id}
      title={recipe.title}
      steps={steps}
      ingredients={ingredients}
      totalMinutes={totalMinutes}
    />
  );
}
