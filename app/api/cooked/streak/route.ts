import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function toDateKey(d: Date): string {
  // YYYY-MM-DD in UTC
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  // a and b are YYYY-MM-DD strings. Returns |a - b| in days.
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round(Math.abs(da.getTime() - db.getTime()) / 86_400_000);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.cookedHistory.findMany({
    where: { userId: session.user.id },
    select: { cookedAt: true },
    orderBy: { cookedAt: 'desc' },
  });

  const totalCooks = rows.length;
  const lastCookedAt = rows[0]?.cookedAt?.toISOString() ?? null;

  if (totalCooks === 0) {
    return NextResponse.json({
      data: { currentStreak: 0, longestStreak: 0, totalCooks: 0, lastCookedAt: null, todayCookCount: 0 },
      error: null,
    });
  }

  // Deduplicate to unique day keys, sorted descending
  const daySet = new Set<string>(rows.map((r) => toDateKey(r.cookedAt)));
  const days = Array.from(daySet).sort((a, b) => (a > b ? -1 : 1)); // descending

  const todayKey = toDateKey(new Date());
  const yesterdayKey = toDateKey(new Date(Date.now() - 86_400_000));
  const todayCookCount = rows.filter((r) => toDateKey(r.cookedAt) === todayKey).length;

  // Current streak — start from today or yesterday
  let currentStreak = 0;
  const anchor = days[0]; // most recent day with a cook
  if (anchor === todayKey || anchor === yesterdayKey) {
    // Count consecutive days going back from anchor
    let expected = anchor;
    for (const day of days) {
      if (day === expected) {
        currentStreak++;
        // next expected = one day earlier
        const prev = new Date(expected + 'T00:00:00Z');
        prev.setUTCDate(prev.getUTCDate() - 1);
        expected = toDateKey(prev);
      } else {
        break;
      }
    }
  }

  // Longest streak — scan all days (sorted descending)
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1], days[i]) === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return NextResponse.json({
    data: {
      currentStreak,
      longestStreak: Math.max(longest, currentStreak),
      totalCooks,
      lastCookedAt,
      todayCookCount,
    },
    error: null,
  });
}
