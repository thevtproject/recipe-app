// Date helpers shared between client and server.
//
// IMPORTANT: never use `d.toISOString().split('T')[0]` for "today's date".
// `toISOString()` returns UTC, so users east of UTC see "yesterday"
// (e.g. in Asia it's still the previous UTC day until ~7am local).
// Use the local components instead.

/** Local YYYY-MM-DD (no UTC conversion). */
export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday (start of week) for a given date, in local time. */
export function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Add `n` days to a date (returns a new Date). */
export function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

/**
 * Human-friendly "X days ago" helper.
 *
 *   - "Today"          for the same local calendar day
 *   - "Yesterday"      for the previous local calendar day
 *   - "3 days ago"     for 2-6 days ago
 *   - "Jun 5, 2026"    for 7+ days ago (absolute date with year)
 *
 * Uses local time so a user in UTC+7 seeing "Today" at 9am matches
 * the local calendar day, not the UTC day.
 */
export function timeAgo(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const now = new Date();
  const startOfLocalDay = (dt: Date) =>
    new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const dayMs = 86_400_000;
  const diffDays = Math.round((startOfLocalDay(now) - startOfLocalDay(d)) / dayMs);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
