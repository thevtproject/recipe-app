import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft, Pencil, Star, ChefHat, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/dates';
import { FavoriteButton } from '@/components/recipe/FavoriteButton';
import { RecipeIngredients } from '@/components/recipe/RecipeIngredients';
import { RecipeSteps } from '@/components/recipe/RecipeSteps';
import { RatingWidget } from '@/components/recipe/RatingWidget';
import { CookedButton } from '@/components/recipe/CookedButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type Step = { order: number; instruction: string; durationSec?: number | null };
import type { Ingredient } from '@/types/ingredient';

const CATEGORY_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  BABY: 'Baby',
};

const BADGE_COLORS: Record<string, string> = {
  BREAKFAST: 'bg-amber-100 text-amber-800',
  LUNCH: 'bg-green-100 text-green-800',
  DINNER: 'bg-blue-100 text-blue-800',
  BABY: 'bg-pink-100 text-pink-800',
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

  // Normalize steps: DB may store as either {order, instruction, durationSec}[],
  // legacy {order, instruction}[], or plain string[].
  const rawSteps = (recipe.steps ?? []) as unknown[];
  const steps: Step[] = rawSteps
    .map((s, i) => {
      if (typeof s === 'string') return { order: i + 1, instruction: s, durationSec: null };
      if (s && typeof s === 'object' && 'instruction' in (s as object)) {
        const o = s as Partial<Step>;
        return {
          order: typeof o.order === 'number' ? o.order : i + 1,
          instruction: String(o.instruction ?? ''),
          durationSec: typeof o.durationSec === 'number' ? o.durationSec : null,
        };
      }
      return { order: i + 1, instruction: '', durationSec: null };
    })
    .filter((s) => s.instruction.trim().length > 0);

  // Normalize ingredients to the structured shape. The DB now stores the new
  // shape, but tolerate legacy rows and any odd entries.
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
        // legacy free-form string — try a quick numeric parse
        const n = Number(amountRaw.replace(',', '.'));
        if (Number.isFinite(n)) amount = n;
      }
      const unit = typeof o.unit === 'string' ? o.unit : '';
      const note =
        typeof o.note === 'string' && o.note.length > 0 ? o.note : null;
      return { amount, unit, name, note };
    })
    .filter((x): x is Ingredient => x !== null);
  const canEdit =
    session?.user?.id === recipe.authorId ||
    (session?.user as any)?.role === 'ADMIN';

  const favoriteRow = session?.user?.id
    ? await prisma.favorite.findUnique({
        where: {
          userId_recipeId: {
            userId: session.user.id,
            recipeId: recipe.id,
          },
        },
        select: { id: true },
      })
    : null;
  const isFavorite = !!favoriteRow;

  // Ratings
  const ratings = await prisma.rating.findMany({
    where: { recipeId: recipe.id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  const myRating = session?.user?.id
    ? ratings.find((r) => r.userId === session.user.id) ?? null
    : null;
  const ratingRows = ratings.map((r) => ({
    id: r.id,
    stars: r.stars,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    user: { id: r.user.id, name: r.user.name, avatarUrl: r.user.avatarUrl },
  }));

  // Cooked history (current user only)
  const myLastCooked = session?.user?.id
    ? await prisma.cookedHistory.findFirst({
        where: { userId: session.user.id, recipeId: recipe.id },
        orderBy: { cookedAt: 'desc' },
        select: { cookedAt: true },
      })
    : null;

  // All cooks of this recipe (for the "Cook History" section)
  const [totalCooks, recentCooks] = await Promise.all([
    prisma.cookedHistory.count({ where: { recipeId: recipe.id } }),
    prisma.cookedHistory.findMany({
      where: { recipeId: recipe.id },
      orderBy: { cookedAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
  ]);

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
        <div className="flex items-center gap-2">
          <FavoriteButton recipeId={recipe.id} initialIsFavorite={isFavorite} />
          <CookedButton
            recipeId={recipe.id}
            myLastCookedAt={myLastCooked?.cookedAt.toISOString() ?? null}
          />
          <Link
            href={`/recipes/new?from=${recipe.id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1')}
          >
            <Copy size={14} />
            Duplicate
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
        {recipe.categories[0] && (
          <span
            className={cn(
              'inline-block text-xs font-medium px-2 py-0.5 rounded-full',
              BADGE_COLORS[recipe.categories[0]]
            )}
          >
            {CATEGORY_LABELS[recipe.categories[0]]}
          </span>
        )}
        <h1 className="text-3xl font-semibold">{recipe.title}</h1>
        {recipe.description && (
          <p className="text-muted-foreground">{recipe.description}</p>
        )}
        {(recipe.prepTimeMin != null || recipe.cookTimeMin != null) && (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {recipe.prepTimeMin != null && (
              <span>⏱ Prep: {recipe.prepTimeMin} min</span>
            )}
            {recipe.cookTimeMin != null && (
              <span>🍳 Cook: {recipe.cookTimeMin} min</span>
            )}
            {recipe.prepTimeMin != null && recipe.cookTimeMin != null && (
              <span className="font-medium text-foreground">
                Total: {recipe.prepTimeMin + recipe.cookTimeMin} min
              </span>
            )}
          </div>
        )}
        {recipe.ratingCount > 0 && recipe.ratingAvg !== null && (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={16}
                  className={cn(
                    recipe.ratingAvg! >= n
                      ? 'fill-amber-400 text-amber-400'
                      : recipe.ratingAvg! >= n - 0.5
                        ? 'fill-amber-400/50 text-amber-400'
                        : 'text-muted-foreground/30'
                  )}
                />
              ))}
            </div>
            <span className="font-medium">{recipe.ratingAvg.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({recipe.ratingCount} review{recipe.ratingCount === 1 ? '' : 's'})
            </span>
          </div>
        )}
      </div>
      {/* Start Cooking */}
      {steps.length > 0 && (
        <Link
          href={`/recipes/${recipe.id}/cook`}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-[#A8956A] text-white font-medium text-sm hover:bg-[#9B875C] transition-colors"
        >
          <ChefHat size={18} />
          Start Cooking
        </Link>
      )}
      {/* Ingredients */}
      {ingredients.length > 0 && (
        <RecipeIngredients
          ingredients={ingredients}
          originalServings={recipe.servings}
        />
      )}
      {/* Steps */}
      <RecipeSteps steps={steps} />
      {/* Chef's notes */}
      {recipe.notes && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Chef's Notes</h2>
          <p className="text-sm whitespace-pre-line">{recipe.notes}</p>
        </div>
      )}
      {/* Ratings */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Ratings & reviews</h2>
        <RatingWidget
          recipeId={recipe.id}
          myStars={myRating?.stars ?? null}
          myComment={myRating?.comment ?? null}
          ratings={ratingRows}
        />
      </div>
      {/* Cook History */}
      {totalCooks > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ChefHat size={16} />
                Cook History
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Cooked {totalCooks} time{totalCooks === 1 ? '' : 's'}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {recentCooks.map((cook) => {
                const initials = (cook.user.name ?? '?')
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li
                    key={cook.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <Avatar size="sm">
                      {cook.user.avatarUrl ? (
                        <AvatarImage
                          src={cook.user.avatarUrl}
                          alt={cook.user.name}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">
                      {cook.user.name}
                    </span>
                    <span className="text-muted-foreground">
                      · {timeAgo(cook.cookedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {totalCooks > recentCooks.length && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                Showing the {recentCooks.length} most recent of {totalCooks} cooks.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
