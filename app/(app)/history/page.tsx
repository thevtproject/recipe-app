'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ChefHat, Utensils, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo, formatDateLocal } from '@/lib/dates';

type CookEntry = {
  id: string;
  cookedAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  recipe: {
    id: string;
    title: string;
    photoUrl: string | null;
    categories: string[];
  };
};

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

type Scope = 'ALL' | 'ME';

type DatePreset = 'ALL' | '7D' | '30D' | '90D';

export default function HistoryPage() {
  const [entries, setEntries] = useState<CookEntry[]>([]);
  const [scope, setScope] = useState<Scope>('ALL');
  const [actualScope, setActualScope] = useState<'ME' | 'HOUSEHOLD'>('ME');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');

  // Debounce the search input
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Build query string from filters
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
    return params.toString();
  }, [from, to, debouncedQ]);

  const loadHistory = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/cooked/all?${queryString}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        setActualScope(json.scope ?? 'ME');
        return json.data as CookEntry[];
      })
      .then((data) => setEntries(data))
      .catch((e) => setError(e?.message ?? 'Failed to load history'))
      .finally(() => setLoading(false));
  }, [queryString]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Date preset handler — computes from/to from a preset
  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === 'ALL') {
      setFrom('');
      setTo('');
      return;
    }
    const days = preset === '7D' ? 7 : preset === '30D' ? 30 : 90;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    setFrom(formatDateLocal(start));
    setTo(formatDateLocal(today));
  };

  // When user manually edits from/to, switch to "custom" (ALL preset marker)
  const onFromChange = (v: string) => {
    setFrom(v);
    setDatePreset('ALL');
  };
  const onToChange = (v: string) => {
    setTo(v);
    setDatePreset('ALL');
  };

  const clearFilters = () => {
    setFrom('');
    setTo('');
    setQ('');
    setDatePreset('ALL');
  };

  const hasActiveFilters = !!(from || to || q);

  // Count cooks per recipe (from the current filtered result, for the dropdown
  // hint). We don't fetch a separate recipe list — the cooks data is the source.
  const recipeCounts = useMemo(() => {
    const m = new Map<string, { id: string; title: string; count: number }>();
    for (const c of entries) {
      const existing = m.get(c.recipe.id);
      if (existing) existing.count++;
      else m.set(c.recipe.id, { id: c.recipe.id, title: c.recipe.title, count: 1 });
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [entries]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Cooking History</h1>
        <p className="text-muted-foreground mt-1">
          {actualScope === 'HOUSEHOLD'
            ? "Everything the household has cooked, newest first."
            : 'Everything you have cooked, newest first.'}
        </p>
      </div>
      {/* Scope toggle (only meaningful when in a household) */}
      {actualScope === 'HOUSEHOLD' && (
        <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
          <button
            type="button"
            onClick={() => setScope('ALL')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              scope === 'ALL'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Household
          </button>
          <button
            type="button"
            onClick={() => setScope('ME')}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              scope === 'ME'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Mine
          </button>
        </div>
      )}
      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            Range:
          </span>
          {(
            [
              { v: '7D' as const, label: 'Last 7 days' },
              { v: '30D' as const, label: 'Last 30 days' },
              { v: '90D' as const, label: 'Last 90 days' },
              { v: 'ALL' as const, label: 'All time' },
            ]
          ).map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => applyPreset(p.v)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md border transition-colors',
                datePreset === p.v
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range + recipe search */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              From
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <label className="text-xs text-muted-foreground whitespace-nowrap">
              To
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="relative flex-1 min-w-0">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by recipe…"
              className="w-full pl-8 pr-2.5 py-1.5 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      </div>
      {loading && (
        <div className="text-sm text-muted-foreground py-12 text-center">
          Loading history…
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 py-12 text-center">{error}</div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Utensils className="mx-auto mb-3 text-muted-foreground" size={32} />
          {hasActiveFilters ? (
            <>
              <p className="text-sm text-muted-foreground">
                No cooks match your filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-block mt-3 text-sm font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No cooks logged yet. Open a recipe and tap{' '}
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <ChefHat size={12} /> I cooked this
              </span>{' '}
              to start your history.
            </p>
          )}
        </div>
      )}
      {!loading && !error && entries.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {entries.length} cook{entries.length === 1 ? '' : 's'}
            {recipeCounts.length > 0 && (
              <> · {recipeCounts.length} recipe{recipeCounts.length === 1 ? '' : 's'}</>
            )}
          </p>
          <div className="space-y-2">
            {entries.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
              >
                {/* Photo or placeholder */}
                <div className="flex-shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                  {c.recipe.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    (<img
                      src={c.recipe.photoUrl}
                      alt={c.recipe.title}
                      className="w-full h-full object-cover"
                    />)
                  ) : (
                    <Utensils size={20} className="text-muted-foreground" />
                  )}
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/recipes/${c.recipe.id}`}
                    className="font-medium text-foreground hover:underline truncate block"
                  >
                    {c.recipe.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cooked by {c.user.name} · {timeAgo(c.cookedAt)}
                  </p>
                  {c.recipe.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.recipe.categories.map((cat) => (
                        <span
                          key={cat}
                          className={cn(
                            'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            CATEGORY_COLORS[cat] ??
                              'bg-muted text-muted-foreground'
                          )}
                        >
                          {CATEGORY_LABELS[cat] ?? cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
