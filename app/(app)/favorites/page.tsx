"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type FavoriteRecipe = {
  id: string;
  title: string;
  description: string | null;
  categories: ("BREAKFAST" | "LUNCH" | "DINNER" | "BABY")[];
  photoUrl: string | null;
  createdAt: string;
};

type Favorite = {
  id: string;
  recipeId: string;
  createdAt: string;
  recipe: FavoriteRecipe;
};

const CATEGORY_LABELS: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  BABY: "Baby",
};

const BADGE_COLORS: Record<string, string> = {
  BREAKFAST: "bg-amber-100 text-amber-800",
  LUNCH: "bg-green-100 text-green-800",
  DINNER: "bg-blue-100 text-blue-800",
  BABY: "bg-pink-100 text-pink-800",
};

function FavoriteSkeleton() {
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

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/favorites");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error ?? "Failed to load favorites.");
          setFavorites([]);
          return;
        }
        setFavorites(json.data ?? []);
      } catch {
        if (!cancelled) {
          setError("Failed to load favorites.");
          setFavorites([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Favorites</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {favorites.length > 0
            ? `${favorites.length} saved recipe${
                favorites.length !== 1 ? "s" : ""
              }`
            : "Recipes you've hearted"}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <FavoriteSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-destructive">{error}</p>
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            No favorites yet. Browse recipes and tap the heart to save them
            here.
          </p>
          <Link
            href="/recipes"
            className="inline-block mt-4 text-sm font-medium text-primary hover:underline"
          >
            Browse recipes →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((fav) => {
            const recipe = fav.recipe;
            return (
              <Link
                key={fav.id}
                href={`/recipes/${recipe.id}`}
                className="block h-full"
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer h-full relative">
                  {/* Filled heart in the corner — marks this as a favorite */}
                  <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm rounded-full p-1.5">
                    <Heart
                      size={16}
                      className="fill-rose-500 text-rose-500"
                      aria-label="Favorited"
                    />
                  </div>

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
                    {recipe.categories[0] && (
                      <span
                        className={cn(
                          "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                          BADGE_COLORS[recipe.categories[0]]
                        )}
                      >
                        {CATEGORY_LABELS[recipe.categories[0]]}
                      </span>
                    )}

                    <h2 className="font-semibold text-sm leading-snug line-clamp-1">
                      {recipe.title}
                    </h2>

                    {recipe.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {recipe.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
