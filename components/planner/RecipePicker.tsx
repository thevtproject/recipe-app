'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type Recipe = {
  id: string;
  title: string;
  category: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  photoUrl: string | null;
  author: { name: string };
};

const CATEGORY_COLORS: Record<string, string> = {
  BREAKFAST: 'bg-amber-100 text-amber-800',
  LUNCH: 'bg-green-100 text-green-800',
  DINNER: 'bg-blue-100 text-blue-800',
};

interface RecipePickerProps {
  open: boolean;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | null;
  onSelect: (recipeId: string) => void;
  onClose: () => void;
}

export function RecipePicker({ open, mealType, onSelect, onClose }: RecipePickerProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const url = mealType ? `/api/recipes?category=${mealType}` : '/api/recipes';
    fetch(url)
      .then((r) => r.json())
      .then((json) => setRecipes(json.data ?? []))
      .finally(() => setLoading(false));
  }, [open, mealType]);

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Pick a recipe
            {mealType && (
              <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[mealType]}`}>
                {mealType.charAt(0) + mealType.slice(1).toLowerCase()}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recipes found.</p>
          ) : (
            filtered.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => onSelect(recipe.id)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
              >
                <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                  {recipe.photoUrl ? (
                    <img src={recipe.photoUrl} alt={recipe.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-lg">🍽</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{recipe.title}</p>
                  <p className="text-xs text-muted-foreground">{recipe.author.name}</p>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[recipe.category]}`}>
                  {recipe.category.charAt(0) + recipe.category.slice(1).toLowerCase()}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
