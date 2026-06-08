import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { PrintView } from '@/components/planner/PrintView';
import type { Ingredient } from '@/types/ingredient';

const MEAL_LABELS = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
} as const;

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

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function PrintPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; until?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const sp = await searchParams;
  const from = sp.from ?? fmt(getMonday(new Date()));
  const until = sp.until ?? fmt(addDays(getMonday(new Date()), 6));

  const plans = await prisma.mealPlan.findMany({
    where: {
      userId: session.user.id,
      date: { gte: new Date(from + 'T00:00:00Z'), lte: new Date(until + 'T23:59:59Z') },
    },
    include: {
      recipe: {
        select: {
          title: true,
          categories: true,
          ingredients: true,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }, { id: 'asc' }],
  });

  // Group by day
  const byDay: Record<string, typeof plans> = {};
  for (const p of plans) {
    const key = fmt(p.date);
    (byDay[key] ??= []).push(p);
  }

  // Build a 7-day window from `from`
  const start = new Date(from + 'T00:00:00Z');
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const weekRange = `${start.toLocaleDateString('en-US', opts)} – ${addDays(start, 6).toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;

  return (
    <PrintView
      weekRange={weekRange}
      days={days.map((d, i) => ({
        name: dayNames[i],
        dateStr: fmt(d),
        dateLabel: d.toLocaleDateString('en-US', opts),
        plans: (byDay[fmt(d)] ?? []).map((p) => ({
          mealType: p.mealType as 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY',
          recipeTitle: p.recipe.title,
          ingredients: Array.isArray(p.recipe.ingredients)
            ? (p.recipe.ingredients as unknown as Ingredient[])
            : [],
        })),
      }))}
    />
  );
}
