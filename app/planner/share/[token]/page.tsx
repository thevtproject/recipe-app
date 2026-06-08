import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

type MealPlan = {
  date: Date;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY';
  recipe: { title: string; categories: string[] };
};

const MEAL_LABELS = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  BABY: 'Baby',
} as const;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const share = await prisma.planShare.findUnique({ where: { token } });
  if (!share || !share.expiresAt || share.expiresAt < new Date()) {
    notFound();
  }

  // refId = "<scopeId>|<from>|<until>"
  const parts = share.refId.split('|');
  if (parts.length !== 3) notFound();
  const [scopeId, from, until] = parts;
  const weekStart = new Date(from + 'T00:00:00Z');
  const weekEnd = new Date(until + 'T23:59:59Z');

  const where = share.scope === 'FAMILY'
    ? { householdId: scopeId, date: { gte: weekStart, lte: weekEnd } }
    : { userId: scopeId, date: { gte: weekStart, lte: weekEnd } };

  const plans = (await prisma.mealPlan.findMany({
    where,
    include: { recipe: { select: { title: true, categories: true } } },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }, { id: 'asc' }],
  })) as unknown as MealPlan[];

  const monday = new Date(weekStart);
  monday.setUTCHours(0, 0, 0, 0);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const plansByDayMeal: Record<string, MealPlan[]> = {};
  for (const p of plans) {
    const key = `${fmt(p.date)}|${p.mealType}`;
    (plansByDayMeal[key] ??= []).push(p);
  }

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const weekRange = `${monday.toLocaleDateString('en-US', opts)} – ${addDays(monday, 6).toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Weekly Meal Plan</h1>
          <p className="text-muted-foreground text-sm">
            {weekRange} · {share.scope === 'FAMILY' ? 'Family plan' : 'Personal plan'}
          </p>
          <p className="text-xs text-muted-foreground/60">
            Read-only shared view · expires {share.expiresAt.toLocaleDateString('en-US')}
          </p>
        </div>

        <div className="space-y-4">
          {weekDays.map((day, i) => {
            const dateStr = fmt(day);
            // Only show the Baby row if at least one day in the week has a
            // Baby plan. Keeps shared views clean for users who don't use it.
            const usedMealTypes: Array<keyof typeof MEAL_LABELS> = plans.some(
              (p) => p.mealType === 'BABY'
            )
              ? (['BREAKFAST', 'LUNCH', 'DINNER', 'BABY'] as const)
              : (['BREAKFAST', 'LUNCH', 'DINNER'] as const);
            return (
              <div key={dateStr} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <h2 className="font-medium text-sm">
                  {DAY_NAMES[i]} · {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </h2>
                {usedMealTypes.map((mealType) => {
                  const slot = plansByDayMeal[`${dateStr}|${mealType}`] ?? [];
                  return (
                    <div key={mealType} className="text-sm">
                      <span className="text-muted-foreground font-medium w-20 inline-block">
                        {MEAL_LABELS[mealType]}:
                      </span>
                      {slot.length === 0 ? (
                        <span className="text-muted-foreground/50 italic"> —</span>
                      ) : (
                        <span>{slot.map((p) => p.recipe.title).join(', ')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="text-center pt-4">
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Powered by family recipe app
          </a>
        </div>
      </div>
    </div>
  );
}
