'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FavoriteHeart } from '@/components/recipe/FavoriteHeart';
import { cn } from '@/lib/utils';

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  categories: ('BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY')[];
  photoUrl: string | null;
  authorId: string;
  createdAt: string;
  author: { name: string };
  ratingAvg: number | null;
  ratingCount: number;
  lastCookedAt: string | null;
};

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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diffMs < day) return 'today';
  const days = Math.floor(diffMs / day);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function RecipeSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-muted" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-16 bg-muted rounded" />
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
      </div>
    </div>
  );
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedCats, setSelectedCats] = useState<Set<'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY'>>(
    new Set()
  );

  // Fetch recipes (filtered)
  useEffect(() => {
    setLoading(true);
    const cats = selectedCats.size === 0 ? '' : Array.from(selectedCats).join(',');
    const url = cats ? `/api/recipes?category=${cats}` : '/api/recipes';
    fetch(url)
      .then((r) => r.json())
      .then((json: { data?: Recipe[] }) => setRecipes(json.data ?? []))
      .finally(() => setLoading(false));
  }, [selectedCats]);

  // Fetch the current user's favorites (one-time + on focus)
  useEffect(() => {
    let cancelled = false;
    const loadFavorites = () => {
      fetch('/api/favorites')
        .then((r) => r.json())
        .then((json: { data?: { recipeId: string }[] }) => {
          if (cancelled) return;
          setFavoriteIds(new Set((json.data ?? []).map((f) => f.recipeId)));
        })
        .catch(() => {
          // Not logged in or error — leave the set empty
        });
    };
    loadFavorites();
    window.addEventListener('focus', loadFavorites);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadFavorites);
    };
  }, []);

  const handleFavoriteToggle = (recipeId: string, isFavorite: boolean) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFavorite) next.add(recipeId);
      else next.delete(recipeId);
      return next;
    });
  };

  const toggleCat = (c: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY') => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recipe Book</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/recipes/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
        >
          <Plus size={16} />
          Add Recipe
        </Link>
      </div>

      {/* Category filter (multi-select) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Filter:</span>
        {(['BREAKFAST', 'LUNCH', 'DINNER', 'BABY'] as const).map((c) => {
          const active = selectedCats.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggleCat(c)}
              aria-pressed={active}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          );
        })}
        {selectedCats.size > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCats(new Set())}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <RecipeSkeleton key={i} />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No recipes yet.</p>
          <Link
            href="/recipes/new"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            Add your first recipe
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="block h-full">
              <Card className="relative overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
                {/* Heart toggle (top-right, stops propagation) */}
                <FavoriteHeart
                  recipeId={recipe.id}
                  initialIsFavorite={favoriteIds.has(recipe.id)}
                  onToggle={(isFav) => handleFavoriteToggle(recipe.id, isFav)}
                />

                {/* Food photo */}
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  {recipe.photoUrl ? (
                    <img
                      src={recipe.photoUrl}
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl select-none">
                      🍽
                    </div>
                  )}
                </div>

                <CardContent className="p-4 space-y-1.5">
                  {/* Category badge */}
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

                  {/* Title */}
                  <h2 className="font-semibold text-sm leading-snug line-clamp-1">
                    {recipe.title}
                  </h2>

                  {/* Description */}
                  {recipe.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {recipe.description}
                    </p>
                  )}

                  {/* Rating + last cooked */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
                    {recipe.ratingCount > 0 && recipe.ratingAvg !== null && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="text-amber-500">★</span>
                        <span className="font-medium text-foreground">
                          {recipe.ratingAvg.toFixed(1)}
                        </span>
                        <span>({recipe.ratingCount})</span>
                      </span>
                    )}
                    {recipe.lastCookedAt && (
                      <span className="inline-flex items-center gap-0.5">
                        <span aria-hidden>🍳</span>
                        <span>Last: {timeAgo(recipe.lastCookedAt)}</span>
                      </span>
                    )}
                    {!recipe.lastCookedAt && recipe.ratingCount === 0 && (
                      <span className="italic">Haven&apos;t tried yet</span>
                    )}
                  </div>

                  {/* Author */}
                  <p className="text-xs text-muted-foreground">by {recipe.author.name}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
