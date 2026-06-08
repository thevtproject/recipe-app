import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { RecipeForm } from '@/components/recipe/RecipeForm';

type Step = { order: number; instruction: string };
type MealCategory = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY';
import type { Ingredient } from '@/types/ingredient';


export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { from } = await searchParams;

  let defaultValues:
    | {
        title?: string;
        description?: string;
        notes?: string | null;
        prepTimeMin?: number | null;
        cookTimeMin?: number | null;
        categories?: MealCategory[];
        photoUrl?: string | null;
        steps?: Step[];
        ingredients?: Ingredient[];
      }
    | undefined;

  if (from) {
    const source = await prisma.recipe.findUnique({ where: { id: from } });
    if (source) {
      defaultValues = {
        title: `Copy of ${source.title}`,
        description: source.description ?? undefined,
        notes: source.notes ?? null,
        prepTimeMin: source.prepTimeMin ?? null,
        cookTimeMin: source.cookTimeMin ?? null,
        categories: source.categories as MealCategory[],
        photoUrl: null, // don't copy photo — let user upload their own
        steps: (source.steps as unknown as Step[]) ?? [],
        ingredients: (source.ingredients as unknown as Ingredient[]) ?? [],
      };
    }
  }

  return <RecipeForm mode="create" defaultValues={defaultValues} />;
}
