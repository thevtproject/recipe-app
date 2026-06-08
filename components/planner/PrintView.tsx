'use client';

import { Printer } from 'lucide-react';
import { useEffect } from 'react';
import { formatIngredient, type Ingredient } from '@/types/ingredient';

const MEAL_LABELS = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  BABY: 'Baby',
} as const;

type MealType = keyof typeof MEAL_LABELS;

type DayPlan = {
  name: string;
  dateStr: string;
  dateLabel: string;
  plans: Array<{
    mealType: MealType;
    recipeTitle: string;
    ingredients: Ingredient[];
  }>;
};

interface Props {
  weekRange: string;
  days: DayPlan[];
}

export function PrintView({ weekRange, days }: Props) {
  // Auto-trigger print dialog once page renders
  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof window !== 'undefined') window.print();
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // Only render the meal-type rows that actually have data in the week
  // (or that are always shown). This keeps the print view clean for users
  // who don't use the Baby slot.
  const usedMealTypes: MealType[] = days.some((d) =>
    d.plans.some((p) => p.mealType === 'BABY')
  )
    ? (['BREAKFAST', 'LUNCH', 'DINNER', 'BABY'] as MealType[])
    : (['BREAKFAST', 'LUNCH', 'DINNER'] as MealType[]);

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
        @page { margin: 1.5cm; }
      `}</style>

      <div className="min-h-screen bg-white text-black p-8 print:p-0">
        <div className="no-print flex items-center justify-between mb-6 max-w-3xl mx-auto">
          <a
            href="/planner"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            ← Back to planner
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm hover:bg-muted"
          >
            <Printer size={14} />
            Print / Save as PDF
          </button>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          <header className="border-b border-stone-300 pb-3">
            <h1 className="text-2xl font-semibold">Weekly Meal Plan</h1>
            <p className="text-sm text-stone-600">{weekRange}</p>
          </header>

          {days.map((day) => (
            <section key={day.dateStr} className="break-inside-avoid">
              <h2 className="text-base font-semibold border-b border-stone-200 pb-1 mb-2">
                {day.name} · {day.dateLabel}
              </h2>

              {usedMealTypes.map((mealType) => {
                const slot = day.plans.filter((p) => p.mealType === mealType);
                return (
                  <div key={mealType} className="mb-2">
                    <div className="text-sm">
                      <span className="font-medium inline-block w-20 text-stone-700">
                        {MEAL_LABELS[mealType]}:
                      </span>
                      {slot.length === 0 ? (
                        <span className="text-stone-400">—</span>
                      ) : (
                        <span className="font-medium">{slot.map((p) => p.recipeTitle).join(' + ')}</span>
                      )}
                    </div>
                    {slot.map((p, i) => (
                      <div key={i} className="ml-20 mt-0.5 text-xs text-stone-600 leading-relaxed">
                        {p.ingredients.length > 0 && (
                          <span>{p.ingredients.map((ing) => formatIngredient(ing)).join(', ')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          ))}

          <footer className="text-xs text-stone-400 text-center pt-4 border-t border-stone-200">
            Family Recipe App · auto-generated
          </footer>
        </div>
      </div>
    </>
  );
}
