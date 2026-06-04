import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = { order: number; instruction: string };
type Ingredient = { amount: string; name: string };

const CATEGORY_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

const BADGE_COLORS: Record<string, string> = {
  BREAKFAST: 'bg-amber-100 text-amber-800',
  LUNCH: 'bg-green-100 text-green-800',
  DINNER: 'bg-blue-100 text-blue-800',
};

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const recipe = await prisma.recipe.findUnique({ where: { id } });

  if (!recipe) notFound();

  const steps = (recipe.steps as Step[]) ?? [];
  const ingredients = (recipe.ingredients as Ingredient[]) ?? [];
  const canEdit =
    session?.user?.id === recipe.authorId ||
    (session?.user as any)?.role === 'ADMIN';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back + actions bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/recipes"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}
        >
          <ArrowLeft size={16} />
          Recipes
        </Link>
        {canEdit && (
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
          >
            <Pencil size={14} />
            Edit
          </Link>
        )}
      </div>

      {/* Photo */}
      {recipe.photoUrl && (
        <div className="aspect-[16/9] rounded-lg overflow-hidden bg-muted">
          <img
            src={recipe.photoUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div className="space-y-2">
        <span
          className={cn(
            'inline-block text-xs font-medium px-2 py-0.5 rounded-full',
            BADGE_COLORS[recipe.category]
          )}
        >
          {CATEGORY_LABELS[recipe.category]}
        </span>
        <h1 className="text-3xl font-semibold">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-muted-foreground">{recipe.description}</p>
        )}
      </div>

      {/* Ingredients */}
      {ingredients.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Ingredients</h2>
          <ul className="space-y-2">
            {ingredients.map((ing, i) => (
              <li key={i} className="flex items-baseline gap-3 py-2 border-b border-border last:border-0">
                <span className="text-sm font-medium text-primary w-24 flex-shrink-0">{ing.amount}</span>
                <span className="text-sm">{ing.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Instructions</h2>
          <ol className="space-y-3">
            {steps
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <li
                  key={step.order}
                  className="flex gap-4 p-4 rounded-lg bg-card border border-border"
                >
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
                    {step.order}
                  </span>
                  <p className="text-sm leading-relaxed pt-0.5">{step.instruction}</p>
                </li>
              ))}
          </ol>
        </div>
      )}
    </div>
  );
}
