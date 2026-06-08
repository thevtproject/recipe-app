'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Minus, Plus, RotateCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type Ingredient,
  formatAmount,
  pluralizeUnit,
} from '@/types/ingredient';

// Format the leading "amount + unit" portion of an ingredient.
// Returns { text, isScaled } — isScaled is true when the numeric amount was
// multiplied by the factor (i.e. the result differs from the original).
function formatAmountUnit(
  ing: Ingredient,
  factor: number,
): { text: string; isScaled: boolean } {
  if (ing.amount == null) {
    // No numeric amount (e.g. "to taste", "a pinch"). Nothing scales.
    return { text: ing.unit, isScaled: false };
  }
  const original = formatAmount(ing.amount);
  const scaled = formatAmount(ing.amount * factor);
  if (ing.unit) {
    return {
      text: `${scaled} ${pluralizeUnit(ing.unit, ing.amount * factor)}`,
      isScaled: scaled !== original,
    };
  }
  return { text: scaled, isScaled: scaled !== original };
}

interface Props {
  ingredients: Ingredient[];
  originalServings: number;
}

export function RecipeIngredients({ ingredients, originalServings }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlServings = parseInt(searchParams?.get('servings') ?? '', 10);
  const [servings, setServings] = useState<number>(
    Number.isFinite(urlServings) && urlServings > 0 ? urlServings : originalServings
  );

  // Keep URL in sync so the link is shareable
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams?.entries() ?? []));
    if (servings === originalServings) {
      params.delete('servings');
    } else {
      params.set('servings', String(servings));
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [servings, originalServings, router, searchParams]);

  const factor = useMemo(() => servings / originalServings, [servings, originalServings]);

  const isModified = servings !== originalServings;
  const decrease = () => setServings((s) => Math.max(1, s - 1));
  const increase = () => setServings((s) => Math.min(99, s + 1));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-medium">Ingredients</h2>
        <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1 border border-border">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={decrease}
            disabled={servings <= 1}
            aria-label="Decrease servings"
          >
            <Minus size={14} />
          </Button>
          <div className="flex items-center gap-1 px-2 min-w-[5.5rem] justify-center">
            <Users size={14} className="text-muted-foreground" />
            <span className="text-sm font-medium tabular-nums">{servings}</span>
            <span className="text-xs text-muted-foreground">
              {servings === 1 ? 'serving' : 'servings'}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={increase}
            disabled={servings >= 99}
            aria-label="Increase servings"
          >
            <Plus size={14} />
          </Button>
          {isModified && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 ml-1 text-xs gap-1"
              onClick={() => setServings(originalServings)}
              title={`Reset to original ${originalServings}`}
            >
              <RotateCcw size={12} />
              Reset
            </Button>
          )}
        </div>
      </div>
      {isModified && (
        <p className="text-xs text-muted-foreground">
          Scaled {factor.toFixed(2).replace(/\.00$/, '')}× from the original {originalServings} servings.
        </p>
      )}
      <ul className="space-y-2">
        {ingredients.map((ing, i) => {
          const { text: amountText, isScaled } = formatAmountUnit(ing, factor);
          // When amount is null and unit is also empty (rare), still show the name.
          const showAmount = amountText.length > 0;
          return (
            <li
              key={i}
              className="flex items-baseline gap-3 py-2 border-b border-border last:border-0"
            >
              <span
                className={`text-sm w-28 flex-shrink-0 ${
                  isScaled ? 'font-semibold text-primary' : 'font-medium text-primary/80'
                }`}
              >
                {showAmount ? amountText : <span className="text-muted-foreground">—</span>}
              </span>
              <span className="text-sm">
                {ing.name}
                {ing.note && (
                  <span className="text-muted-foreground"> ({ing.note})</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
