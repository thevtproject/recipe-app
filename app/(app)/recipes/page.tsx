'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  category: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  photoUrl: string | null;
  authorId: string;
  createdAt: string;
  author: { name: string };
};

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
  const [category, setCategory] = useState<string>('ALL');

  useEffect(() => {
    setLoading(true);
    const url =
      category === 'ALL' ? '/api/recipes' : `/api/recipes?category=${category}`;
    fetch(url)
      .then((r) => r.json())
      .then((json: { data?: Recipe[] }) => setRecipes(json.data ?? []))
      .finally(() => setLoading(false));
  }, [category]);

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

      {/* Category filter tabs */}
      <Tabs value={category} onValueChange={setCategory}>
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="BREAKFAST">Breakfast</TabsTrigger>
          <TabsTrigger value="LUNCH">Lunch</TabsTrigger>
          <TabsTrigger value="DINNER">Dinner</TabsTrigger>
        </TabsList>
      </Tabs>

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
              <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full">
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
                  <span
                    className={cn(
                      'inline-block text-xs font-medium px-2 py-0.5 rounded-full',
                      BADGE_COLORS[recipe.category]
                    )}
                  >
                    {CATEGORY_LABELS[recipe.category]}
                  </span>

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
