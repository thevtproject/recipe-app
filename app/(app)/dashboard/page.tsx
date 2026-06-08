import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { ChefHat, Calendar, BookHeart, Sparkles, Utensils, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getMonday, addDays, timeAgo } from '@/lib/dates';

const CATEGORY_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  BABY: 'Baby',
};

const CATEGORY_COLORS: Record<string, string> = {
  BREAKFAST: 'bg-amber-100 text-amber-800',
  LUNCH: 'bg-green-100 text-green-800',
  DINNER: 'bg-blue-100 text-blue-800',
  BABY: 'bg-pink-100 text-pink-800',
};

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

const MEAL_COLORS: Record<string, string> = {
  BREAKFAST: 'bg-amber-100 text-amber-800',
  LUNCH: 'bg-green-100 text-green-800',
  DINNER: 'bg-blue-100 text-blue-800',
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const userName = session?.user?.name ?? 'Chef';

  // Guard — dashboard requires an authenticated, approved user
  if (!userId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome
        </h1>
        <p className="text-muted-foreground">Please sign in to see your kitchen.</p>
      </div>
    );
  }

  // Compute "this week" window (Monday 00:00 → next Monday 00:00, local time)
  const weekStart = getMonday(new Date());
  const weekEnd = addDays(weekStart, 7);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Scope for household-aware queries
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { householdId: true },
  });
  const householdUserIds = me?.householdId
    ? (
        await prisma.user.findMany({
          where: { householdId: me.householdId },
          select: { id: true },
        })
      ).map((u) => u.id)
    : [userId];

  // Stats
  const [totalRecipes, myFavorites, cooksThisMonth, plannedThisWeek] =
    await Promise.all([
      prisma.recipe.count(),
      prisma.favorite.count({ where: { userId } }),
      prisma.cookedHistory.count({
        where: { userId, cookedAt: { gte: monthStart } },
      }),
      prisma.mealPlan.count({
        where: {
          OR: [{ userId }, { householdId: me?.householdId ?? undefined }],
          date: { gte: weekStart, lt: weekEnd },
        },
      }),
    ]);

  // This week's plan (grouped by date+mealType)
  const weekPlans = await prisma.mealPlan.findMany({
    where: {
      OR: [{ userId }, { householdId: me?.householdId ?? undefined }],
      date: { gte: weekStart, lt: weekEnd },
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    include: {
      recipe: { select: { id: true, title: true, photoUrl: true } },
    },
  });

  // Group: { 'YYYY-MM-DD': { BREAKFAST: [recipe], LUNCH: [...], DINNER: [...] } }
  const planByDay: Record<
    string,
    Record<string, Array<{ id: string; title: string; photoUrl: string | null }>>
  > = {};
  for (const p of weekPlans) {
    const dayKey = formatDateKey(p.date);
    if (!planByDay[dayKey]) planByDay[dayKey] = {};
    const slot = (planByDay[dayKey][p.mealType] ??= []);
    slot.push(p.recipe);
  }

  // Cook Again: favorite recipes not cooked in 14+ days (or never)
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: {
      recipe: {
        select: {
          id: true,
          title: true,
          photoUrl: true,
          categories: true,
          lastCookedAt: true,
          ratingAvg: true,
        },
      },
    },
  });
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000);
  const cookAgain = favorites
    .map((f) => f.recipe)
    .filter((r) => !r.lastCookedAt || r.lastCookedAt < fourteenDaysAgo)
    .sort((a, b) => {
      // Never-cooked first, then oldest
      if (!a.lastCookedAt && !b.lastCookedAt) return 0;
      if (!a.lastCookedAt) return -1;
      if (!b.lastCookedAt) return 1;
      return a.lastCookedAt.getTime() - b.lastCookedAt.getTime();
    })
    .slice(0, 6);

  // Streak data — all cooks for current user (personal streak, not household)
  const allCooks = await prisma.cookedHistory.findMany({
    where: { userId },
    select: { cookedAt: true },
    orderBy: { cookedAt: 'desc' },
  });

  // Streak helpers
  function toDateKey(d: Date): string {
    return d.toISOString().split('T')[0];
  }
  function daysBetween(a: string, b: string): number {
    const da = new Date(a + 'T00:00:00Z');
    const db = new Date(b + 'T00:00:00Z');
    return Math.round(Math.abs(da.getTime() - db.getTime()) / 86_400_000);
  }

  const todayKey = toDateKey(new Date());
  const yesterdayKey = toDateKey(new Date(Date.now() - 86_400_000));
  const daySet = new Set<string>(allCooks.map((r) => toDateKey(r.cookedAt)));
  const days = Array.from(daySet).sort((a, b) => (a > b ? -1 : 1));
  const todayCookCount = allCooks.filter((r) => toDateKey(r.cookedAt) === todayKey).length;

  let currentStreak = 0;
  if (days.length > 0) {
    const anchor = days[0];
    if (anchor === todayKey || anchor === yesterdayKey) {
      let expected = anchor;
      for (const day of days) {
        if (day === expected) {
          currentStreak++;
          const prev = new Date(expected + 'T00:00:00Z');
          prev.setUTCDate(prev.getUTCDate() - 1);
          expected = toDateKey(prev);
        } else break;
      }
    }
  }

  let longestStreak = days.length > 0 ? 1 : 0;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1], days[i]) === 1) {
      run++;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  // Recent cooks (last 5 by current user or household)
  const recentCooks = await prisma.cookedHistory.findMany({
    where: { userId: { in: householdUserIds } },
    orderBy: { cookedAt: 'desc' },
    take: 5,
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      recipe: { select: { id: true, title: true, photoUrl: true } },
    },
  });

  const hasAnyContent =
    totalRecipes > 0 || myFavorites > 0 || recentCooks.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back, {userName}
        </h1>
        <p className="text-muted-foreground mt-1">
          What are we cooking this week?
        </p>
      </div>

      {/* Empty state — fresh household, no recipes at all */}
      {!hasAnyContent && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Sparkles className="mx-auto text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Your kitchen is empty. Add your first recipe to get started —
              you can snap a photo, rate it, and log when you cook it.
            </p>
            <Link
              href="/recipes/new"
              className={cn(buttonVariants({ variant: 'default' }), 'mt-2')}
            >
              Add your first recipe
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Recipes"
          value={totalRecipes}
          icon={<BookHeart size={16} />}
        />
        <StatCard
          label="Favorites"
          value={myFavorites}
          icon={<ChefHat size={16} />}
        />
        <StatCard
          label="Cooks this month"
          value={cooksThisMonth}
          icon={<Utensils size={16} />}
        />
        <StatCard
          label="Planned this week"
          value={plannedThisWeek}
          icon={<Calendar size={16} />}
        />
      </div>

      {/* Cook Streak */}
      {allCooks.length > 0 && (
        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
          <CardContent className="py-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl" role="img" aria-label="fire">🔥</span>
                <div>
                  <p className="font-semibold text-foreground">
                    {currentStreak >= 2
                      ? `${currentStreak}-day cooking streak!`
                      : currentStreak === 1
                        ? 'Cooked today!'
                        : 'Start a streak today'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentStreak >= 1 && todayCookCount > 0
                      ? `${todayCookCount} recipe${todayCookCount > 1 ? 's' : ''} cooked today`
                      : currentStreak >= 1
                        ? 'Keep it going — cook something today!'
                        : `${allCooks.length} total cook${allCooks.length > 1 ? 's' : ''} logged`}
                  </p>
                </div>
              </div>
              {longestStreak >= 2 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Best streak</p>
                  <p className="text-lg font-bold text-amber-700">{longestStreak} days</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* This Week's Plan */}
      {weekPlans.length > 0 && (
        <Section
          title="This Week's Plan"
          link={{ href: '/planner', label: 'Open planner' }}
        >
          <div className="space-y-3">
            {Object.entries(planByDay).map(([dayKey, meals]) => {
              const dayDate = parseDateKey(dayKey);
              return (
                <div
                  key={dayKey}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {dayDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((mt) => {
                      const items = meals[mt] ?? [];
                      if (items.length === 0) return null;
                      return (
                        <div
                          key={mt}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span
                            className={cn(
                              'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5',
                              MEAL_COLORS[mt]
                            )}
                          >
                            {MEAL_LABELS[mt]}
                          </span>
                          <div className="flex-1 min-w-0">
                            {items.map((r) => (
                              <Link
                                key={r.id}
                                href={`/recipes/${r.id}`}
                                className="text-foreground hover:underline block truncate"
                              >
                                {r.title}
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Cook Again */}
      {cookAgain.length > 0 && (
        <Section
          title="Cook Again"
          subtitle="Favorites you haven't made in a while"
          link={{ href: '/favorites', label: 'See all favorites' }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {cookAgain.map((r) => (
              <Link
                key={r.id}
                href={`/recipes/${r.id}`}
                className="block group"
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {r.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.photoUrl}
                        alt={r.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl select-none">
                        🍽
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-1">
                    {r.categories[0] && (
                      <span
                        className={cn(
                          'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          CATEGORY_COLORS[r.categories[0]]
                        )}
                      >
                        {CATEGORY_LABELS[r.categories[0]]}
                      </span>
                    )}
                    <h3 className="font-medium text-sm leading-snug line-clamp-1 group-hover:underline">
                      {r.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {r.lastCookedAt
                        ? `Last cooked ${timeAgo(r.lastCookedAt)}`
                        : 'Never cooked yet'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Recent Cooks */}
      {recentCooks.length > 0 && (
        <Section
          title="Recent Cooks"
          link={{ href: '/history', label: 'See full history' }}
        >
          <ul className="space-y-2">
            {recentCooks.map((c) => {
              const initials = (c.user.name ?? '?')
                .split(/\s+/)
                .filter(Boolean)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card"
                >
                  <Avatar size="sm">
                    {c.user.avatarUrl ? (
                      <AvatarImage src={c.user.avatarUrl} alt={c.user.name} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <Link
                        href={`/recipes/${c.recipe.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {c.recipe.title}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cooked by {c.user.name} · {timeAgo(c.cookedAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  subtitle,
  link,
  children,
}: {
  title: string;
  subtitle?: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {link && (
          <Link
            href={link.href}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'gap-1 text-xs'
            )}
          >
            {link.label}
            <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
