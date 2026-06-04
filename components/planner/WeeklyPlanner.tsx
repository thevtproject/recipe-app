'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecipePicker } from './RecipePicker';
import { cn } from '@/lib/utils';

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';

type MealPlan = {
  id: string;
  date: string;
  mealType: MealType;
  recipeId: string;
  recipe: { id: string; title: string; category: string; photoUrl: string | null };
};

const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};
const MEAL_COLORS: Record<MealType, string> = {
  BREAKFAST: 'bg-amber-50 border-amber-200',
  LUNCH: 'bg-green-50 border-green-200',
  DINNER: 'bg-blue-50 border-blue-200',
};
const MEAL_LABEL_COLORS: Record<MealType, string> = {
  BREAKFAST: 'text-amber-700',
  LUNCH: 'text-green-700',
  DINNER: 'text-blue-700',
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmt(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatWeekRange(mon: Date): string {
  const sun = addDays(mon, 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${mon.toLocaleDateString('en-US', opts)} – ${sun.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeeklyPlanner() {
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMealType, setPickerMealType] = useState<MealType | null>(null);
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const fetchPlans = useCallback(async (mon: Date) => {
    const from = fmt(mon);
    const until = fmt(addDays(mon, 6));
    const res = await fetch(`/api/meal-plans?from=${from}&until=${until}`);
    const json = await res.json() as { data: MealPlan[] };
    setPlans(json.data ?? []);
  }, []);

  useEffect(() => {
    fetchPlans(monday);
  }, [monday, fetchPlans]);

  function getPlan(date: Date, mealType: MealType): MealPlan | undefined {
    const d = fmt(date);
    return plans.find((p) => p.date.split('T')[0] === d && p.mealType === mealType);
  }

  function openPicker(date: Date, mealType: MealType) {
    setPickerDate(fmt(date));
    setPickerMealType(mealType);
    setPickerOpen(true);
  }

  async function handlePickRecipe(recipeId: string) {
    if (!pickerDate || !pickerMealType) return;
    setPickerOpen(false);
    const res = await fetch('/api/meal-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: pickerDate, mealType: pickerMealType, recipeId }),
    });
    const json = await res.json() as { data: MealPlan };
    if (json.data) {
      setPlans((prev) => {
        const filtered = prev.filter(
          (p) => !(p.date.split('T')[0] === pickerDate && p.mealType === pickerMealType)
        );
        return [...filtered, json.data];
      });
    }
  }

  async function handleRemove(planId: string) {
    await fetch(`/api/meal-plans/${planId}`, { method: 'DELETE' });
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }

  const todayStr = fmt(new Date());

  return (
    <>
      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" size="icon-sm" onClick={() => setMonday((m) => addDays(m, -7))}>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => setMonday((m) => addDays(m, 7))}>
          <ChevronRight size={16} />
        </Button>
        <span className="text-sm font-medium">{formatWeekRange(monday)}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonday(getMonday(new Date()))}
          className="ml-auto"
        >
          Today
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Day headers */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
            <div />
            {weekDays.map((day, i) => {
              const isToday = fmt(day) === todayStr;
              return (
                <div key={i} className="text-center">
                  <p className="text-xs text-muted-foreground">{DAY_NAMES[i]}</p>
                  <p className={cn(
                    'text-sm font-medium w-7 h-7 rounded-full mx-auto flex items-center justify-center',
                    isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  )}>
                    {day.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Meal rows */}
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
              {/* Row label */}
              <div className="flex items-center justify-end pr-2">
                <span className={cn('text-xs font-medium', MEAL_LABEL_COLORS[mealType])}>
                  {MEAL_LABELS[mealType]}
                </span>
              </div>

              {/* Day cells */}
              {weekDays.map((day, i) => {
                const plan = getPlan(day, mealType);
                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-md border min-h-[64px] flex items-center justify-center p-1',
                      MEAL_COLORS[mealType]
                    )}
                  >
                    {plan ? (
                      <div className="w-full flex items-start gap-1.5 p-1">
                        <Link
                          href={`/recipes/${plan.recipe.id}`}
                          className="flex items-start gap-1.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                        >
                          {plan.recipe.photoUrl && (
                            <img
                              src={plan.recipe.photoUrl}
                              alt=""
                              className="w-8 h-8 rounded object-cover flex-shrink-0 mt-0.5"
                            />
                          )}
                          <p className="text-xs font-medium leading-snug flex-1 line-clamp-2">
                            {plan.recipe.title}
                          </p>
                        </Link>
                        <button
                          onClick={() => handleRemove(plan.id)}
                          className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors mt-0.5"
                          aria-label="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openPicker(day, mealType)}
                        className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/50 rounded-md transition-colors"
                        aria-label={`Add ${MEAL_LABELS[mealType]}`}
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <RecipePicker
        open={pickerOpen}
        mealType={pickerMealType}
        onSelect={handlePickRecipe}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
