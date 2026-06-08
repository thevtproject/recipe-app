'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Printer,
  Share2,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecipePicker } from './RecipePicker';
import { cn } from '@/lib/utils';

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY';

type MealPlan = {
  id: string;
  date: string;
  mealType: MealType;
  recipeId: string;
  recipe: { id: string; title: string; categories: string[]; photoUrl: string | null };
};

const BASE_MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  BABY: 'Baby',
};
const MEAL_COLORS: Record<MealType, string> = {
  BREAKFAST: 'bg-amber-50 border-amber-200',
  LUNCH: 'bg-green-50 border-green-200',
  DINNER: 'bg-blue-50 border-blue-200',
  BABY: 'bg-pink-50 border-pink-200',
};
const MEAL_LABEL_COLORS: Record<MealType, string> = {
  BREAKFAST: 'text-amber-700',
  LUNCH: 'text-green-700',
  DINNER: 'text-blue-700',
  BABY: 'text-pink-700',
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
  // Local YYYY-MM-DD. NOT toISOString() (off by 1 in non-UTC timezones).
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [scope, setScope] = useState<'ME' | 'FAMILY'>('ME');
  const [hasHousehold, setHasHousehold] = useState(false);
  // Baby planner is opt-in per user. The session carries the flag, and the
  // /api/meal-plans POST endpoint gates BABY slot creation on it as well.
  const [hasBabyPlanner, setHasBabyPlanner] = useState(false);

  useEffect(() => {
    fetch('/api/households/me')
      .then((r) => r.json())
      .then((json: { data: { id: string } | null }) => {
        if (json.data) {
          setHasHousehold(true);
        }
      })
      .catch(() => {});

    // Pull hasBabyPlanner from the session JWT.
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((json: { user?: { hasBabyPlanner?: boolean } }) => {
        setHasBabyPlanner(!!json?.user?.hasBabyPlanner);
      })
      .catch(() => {});
  }, []);

  // The visible meal types — base 3 always, BABY appended only when the user
  // has opted in. The grid re-flows (min-width bumps up by ~80px) when the
  // baby column appears.
  const visibleMealTypes: MealType[] = hasBabyPlanner
    ? [...BASE_MEAL_TYPES, 'BABY']
    : BASE_MEAL_TYPES;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const fetchPlans = useCallback(async (mon: Date) => {
    const from = fmt(mon);
    const until = fmt(addDays(mon, 6));
    const res = await fetch(`/api/meal-plans?from=${from}&until=${until}&scope=${scope}`);
    const json = await res.json() as { data: MealPlan[] };
    setPlans(json.data ?? []);
  }, [scope]);

  useEffect(() => {
    fetchPlans(monday);
  }, [monday, fetchPlans]);

  function getPlansForSlot(date: Date, mealType: MealType): MealPlan[] {
    const d = fmt(date);
    return plans.filter(
      (p) => p.date.split('T')[0] === d && p.mealType === mealType
    );
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
      body: JSON.stringify({ date: pickerDate, mealType: pickerMealType, recipeId, scope }),
    });
    const json = (await res.json()) as { data: MealPlan | null; error?: string };
    if (json.data) {
      setPlans((prev) => [...prev, json.data as MealPlan]);
    } else if (json.error) {
      // Surface the gate error (e.g. baby planner turned off mid-session)
      alert(json.error);
    }
  }

  async function handleRemove(planId: string) {
    await fetch(`/api/meal-plans/${planId}`, { method: 'DELETE' });
    setPlans((prev) => prev.filter((p) => p.id !== planId));
  }

  const from = fmt(monday);
  const until = fmt(addDays(monday, 6));

  async function handleShare() {
    setSharingLoading(true);
    setShareError(null);
    try {
      const res = await fetch('/api/meal-plans/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, until, scope: 'ME', ttlDays: 30 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to create share link');
      setShareUrl(`${window.location.origin}${json.data.url}`);
      setShareCopied(false);
    } catch (err: unknown) {
      setShareError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharingLoading(false);
    }
  }

  function handlePrint() {
    window.open(`/planner/print?from=${from}&until=${until}`, '_blank');
  }

  function handleWhatsApp() {
    // Build a plain-text summary of the week. BABY only appears if the user has
    // opted in (so the share text never accidentally reveals the slot).
    const lines: string[] = [`*${formatWeekRange(monday)}*`];
    const mealLabels: Record<MealType, string> = {
      BREAKFAST: 'B',
      LUNCH: 'L',
      DINNER: 'D',
      BABY: 'Baby',
    };
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i);
      const dateStr = fmt(day);
      const dayPlans = plans.filter((p) => p.date.split('T')[0] === dateStr);
      if (dayPlans.length === 0) continue;
      lines.push(`\n${DAY_NAMES[i]} ${day.getDate()}/${day.getMonth() + 1}`);
      visibleMealTypes.forEach((mt) => {
        const slot = dayPlans.filter((p) => p.mealType === mt);
        if (slot.length === 0) return;
        lines.push(`  ${mealLabels[mt]}: ${slot.map((p) => p.recipe.title).join(' + ')}`);
      });
    }
    if (lines.length === 1) {
      lines.push('\n_(no meals planned this week)_');
    }
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareError('Copy failed — long-press to copy manually.');
    }
  }

  const todayStr = fmt(new Date());

  return (
    <>
      {/* Scope toggle (only if user is in a household) */}
      {hasHousehold && (
        <div className="inline-flex rounded-md border border-border bg-card mb-3 overflow-hidden">
          <button
            type="button"
            onClick={() => setScope('ME')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              scope === 'ME' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            My week
          </button>
          <button
            type="button"
            onClick={() => setScope('FAMILY')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors border-l border-border',
              scope === 'FAMILY' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            Family week
          </button>
        </div>
      )}

      {/* Week navigation + actions */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button variant="outline" size="icon-sm" onClick={() => setMonday((m) => addDays(m, -7))}>
          <ChevronLeft size={16} />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => setMonday((m) => addDays(m, 7))}>
          <ChevronRight size={16} />
        </Button>
        <span className="text-sm font-medium ml-1">{formatWeekRange(monday)}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonday(getMonday(new Date()))}
        >
          Today
        </Button>

        <div className="ml-auto flex items-center gap-1">
          {shareUrl ? (
            <div className="flex items-center gap-1">
              <input
                readOnly
                value={shareUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="hidden md:block w-64 px-2 py-1 text-xs rounded border border-border bg-muted/50"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={copyShareUrl}
                className="gap-1"
                title="Copy share URL"
              >
                {shareCopied ? <Check size={14} /> : <Copy size={14} />}
                {shareCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              disabled={sharingLoading}
              className="gap-1"
            >
              <Share2 size={14} />
              {sharingLoading ? '…' : 'Share'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleWhatsApp} className="gap-1" title="Send to WhatsApp">
            <MessageCircle size={14} />
            <span className="hidden sm:inline">WhatsApp</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1" title="Print or save as PDF">
            <Printer size={14} />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

      {shareError && (
        <p className="text-xs text-destructive mb-2">{shareError}</p>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className={hasBabyPlanner ? 'min-w-[680px]' : 'min-w-[600px]'}>
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
          {visibleMealTypes.map((mealType) => (
            <div key={mealType} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
              {/* Row label */}
              <div className="flex items-center justify-end pr-2">
                <span className={cn('text-xs font-medium', MEAL_LABEL_COLORS[mealType])}>
                  {MEAL_LABELS[mealType]}
                </span>
              </div>

              {/* Day cells */}
              {weekDays.map((day, i) => {
                const slotPlans = getPlansForSlot(day, mealType);
                return (
                  <div
                    key={i}
                    className={cn(
                      'rounded-md border min-h-[64px] p-1 space-y-1',
                      MEAL_COLORS[mealType]
                    )}
                  >
                    {slotPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="w-full flex items-start gap-1.5 p-1 bg-white/60 rounded"
                      >
                        <Link
                          href={`/recipes/${plan.recipe.id}`}
                          className="flex items-start gap-1.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                        >
                          {plan.recipe.photoUrl && (
                            <img
                              src={plan.recipe.photoUrl}
                              alt=""
                              className="w-7 h-7 rounded object-cover flex-shrink-0 mt-0.5"
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
                    ))}
                    <button
                      onClick={() => openPicker(day, mealType)}
                      className="w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/50 rounded transition-colors py-0.5"
                      aria-label={`Add ${MEAL_LABELS[mealType]}`}
                    >
                      <Plus size={14} />
                    </button>
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
