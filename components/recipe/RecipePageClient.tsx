'use client';

import { useState } from 'react';
import { RecipeImportDialog } from '@/components/recipe/RecipeImportDialog';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import type { Ingredient } from '@/types/ingredient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = { order: number; instruction: string; durationSec?: number | null };
type MealCategory = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY';

type DefaultValues = {
  title?: string;
  description?: string;
  notes?: string | null;
  servings?: number | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  categories?: MealCategory[];
  photoUrl?: string | null;
  steps?: Step[];
  ingredients?: Ingredient[];
};

type ImportedData = {
  title: string;
  description?: string | null;
  ingredients: { amount: number | null; unit: string; name: string; note?: string | null }[];
  steps: { instruction: string; durationSec?: number | null }[];
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  servings?: number | null;
  photoUrl?: string | null;
  sourceUrl?: string | null;
};

type RecipePageClientProps = {
  defaultValues?: DefaultValues;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipePageClient({ defaultValues: initialDefaults }: RecipePageClientProps) {
  const [defaultValues, setDefaultValues] = useState<DefaultValues | undefined>(
    initialDefaults,
  );

  function handleImport(data: ImportedData) {
    setDefaultValues((prev) => ({
      ...prev,
      title: data.title,
      description: data.description ?? prev?.description ?? '',
      servings: data.servings ?? prev?.servings ?? null,
      prepTimeMin: data.prepTimeMin ?? prev?.prepTimeMin ?? null,
      cookTimeMin: data.cookTimeMin ?? prev?.cookTimeMin ?? null,
      photoUrl: data.photoUrl ?? prev?.photoUrl ?? null,
      steps: data.steps.map((s, i) => ({
        order: i + 1,
        instruction: s.instruction,
        durationSec: s.durationSec ?? null,
      })),
      ingredients: data.ingredients.map((i) => ({
        amount: i.amount,
        unit: i.unit ?? '',
        name: i.name ?? '',
        note: i.note ?? null,
      })),
    }));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-end">
        <RecipeImportDialog onImport={handleImport} />
      </div>
      <RecipeForm mode="create" defaultValues={defaultValues} />
    </div>
  );
}
