'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ShoppingCart, Printer, X, ChevronLeft, ChevronRight, Plus, Trash2, Users } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Category = 'produce' | 'dairy' | 'meat' | 'pantry' | 'spices' | 'other';

type ShoppingItem = {
  id?: string; // for manual items
  name: string;
  category?: string; // for manual items
  amount: string | null;
  unit: string | null;
  recipeIds: string[];
};

type ShoppingData = {
  categories: Record<Category, ShoppingItem[]>;
  totalRecipes: number;
  totalItems: number;
  from: string;
  until: string;
  scope: 'ME' | 'FAMILY';
};

type CheckRecord = {
  itemKey: string;
  checked: boolean;
  checkedBy: string;
};

const CATEGORY_LABELS: Record<Category, string> = {
  produce: 'Produce',
  dairy: 'Dairy & Eggs',
  meat: 'Meat & Seafood',
  pantry: 'Pantry',
  spices: 'Spices',
  other: 'Other',
};

const CATEGORY_ORDER: Category[] = ['produce', 'dairy', 'meat', 'pantry', 'spices', 'other'];

// --- Date helpers (mirror of API) ---

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

// Local date as YYYY-MM-DD. NOT `toISOString().split('T')[0]`
// (that returns the UTC date, which can be off by a day for users
// east of UTC — e.g. in Asia it shows "yesterday" until 7am).
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(mon: Date): string {
  const sun = addDays(mon, 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${mon.toLocaleDateString('en-US', opts)} – ${sun.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

// Stable key for an item — name (lower) + unit (or empty)
function itemKey(name: string, unit: string | null): string {
  return `${name.toLowerCase()}|${unit ?? ''}`;
}

export default function ShoppingListPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Loading shopping list…</div>}>
      <ShoppingListInner />
    </Suspense>
  );
}

function ShoppingListInner() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? null;
  const householdId = (session?.user as { householdId?: string | null } | undefined)?.householdId ?? null;
  const canUseFamily = !!householdId;

  const queryFrom = searchParams.get('from');
  const queryUntil = searchParams.get('until');
  const queryScope = searchParams.get('scope')?.toUpperCase();
  const initialMonday = getMonday(new Date());
  const initialFrom = queryFrom && /^\d{4}-\d{2}-\d{2}$/.test(queryFrom) ? queryFrom : fmtDate(initialMonday);
  const initialUntil = queryUntil && /^\d{4}-\d{2}-\d{2}$/.test(queryUntil) ? queryUntil : fmtDate(addDays(initialMonday, 6));
  const initialScope = queryScope === 'FAMILY' ? 'FAMILY' : 'ME';

  const [monday, setMonday] = useState<Date>(() => getMonday(new Date(initialFrom)));
  const [from, setFrom] = useState<string>(initialFrom);
  const [until, setUntil] = useState<string>(initialUntil);
  const [scope, setScope] = useState<'ME' | 'FAMILY'>(initialScope);

  const [data, setData] = useState<ShoppingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persisted check state: key = "name|unit", value = { checked, checkedBy }
  const [checked, setChecked] = useState<Record<string, { checked: boolean; checkedBy: string }>>({});
  const [addItemOpen, setAddItemOpen] = useState(false);

  const storageKey = `shopping-list-checked-${from}-${until}-${scope}`;

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/shopping-list?from=${from}&until=${until}&scope=${scope}`;
      const res = await fetch(url);
      const json = (await res.json()) as { data?: ShoppingData; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Failed to load shopping list');
        setData(null);
        return;
      }
      setData(json.data ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load shopping list');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, until, scope]);

  // Fetch server checks and merge with localStorage
  const fetchChecks = useCallback(async () => {
    if (!userId) return;
    try {
      const monday = fmtDate(getMonday(new Date(from)));
      const url = `/api/shopping-list/check?weekStart=${monday}&scope=${scope}`;
      const res = await fetch(url);
      const json = (await res.json()) as { data?: { checks: CheckRecord[] }; error?: string };
      if (res.ok && json.data?.checks) {
        const serverChecks: Record<string, { checked: boolean; checkedBy: string }> = {};
        for (const c of json.data.checks) {
          serverChecks[c.itemKey] = { checked: c.checked, checkedBy: c.checkedBy };
        }
        // Merge with localStorage (server wins)
        const localRaw = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
        const localChecks = localRaw ? (JSON.parse(localRaw) as Record<string, { checked: boolean; checkedBy: string }>) : {};
        setChecked({ ...localChecks, ...serverChecks });
      }
    } catch {
      // Fallback to localStorage only
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(storageKey);
          setChecked(raw ? (JSON.parse(raw) as Record<string, { checked: boolean; checkedBy: string }>) : {});
        } catch {
          setChecked({});
        }
      }
    }
  }, [from, scope, storageKey, userId]);

  useEffect(() => {
    fetchList();
    fetchChecks();
  }, [fetchList, fetchChecks]);

  // Poll checks every 15s when in FAMILY scope
  useEffect(() => {
    if (scope !== 'FAMILY') return;
    const interval = setInterval(fetchChecks, 15000);
    return () => clearInterval(interval);
  }, [scope, fetchChecks]);

  // Persist to localStorage on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(checked));
    } catch {
      // ignore quota errors
    }
  }, [checked, storageKey]);

  // --- Date-range controls ---

  function applyMonday(m: Date) {
    setMonday(m);
    setFrom(fmtDate(m));
    setUntil(fmtDate(addDays(m, 6)));
  }

  function handleFromChange(value: string) {
    setFrom(value);
    if (value && until && value > until) {
      setUntil(value);
    }
  }

  function handleUntilChange(value: string) {
    setUntil(value);
    if (value && from && value < from) {
      setFrom(value);
    }
  }

  // --- Checkbox helpers ---

  function toggleItem(name: string, unit: string | null) {
    if (!userId) return;
    const k = itemKey(name, unit);
    const newChecked = !checked[k]?.checked;
    
    // Optimistic update
    setChecked((prev) => {
      const next = { ...prev };
      if (newChecked) {
        next[k] = { checked: true, checkedBy: userId };
      } else {
        delete next[k];
      }
      return next;
    });

    // Persist to server
    const monday = fmtDate(getMonday(new Date(from)));
    fetch('/api/shopping-list/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey: k, weekStart: monday, checked: newChecked, scope }),
    }).catch(() => {
      // Revert on error
      setChecked((prev) => {
        const next = { ...prev };
        if (!newChecked) {
          next[k] = { checked: true, checkedBy: userId };
        } else {
          delete next[k];
        }
        return next;
      });
    });
  }

  function clearChecked() {
    setChecked({});
  }

  function handlePrint() {
    if (typeof window !== 'undefined') window.print();
  }

  async function handleAddItem(newItem: { name: string; category: string; amount?: string; unit?: string }) {
    if (!userId) return;
    const monday = fmtDate(getMonday(new Date(from)));
    try {
      const res = await fetch('/api/shopping-list/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, weekStart: monday }),
      });
      const json = (await res.json()) as { data?: ShoppingItem; error?: string };
      if (res.ok && json.data) {
        // Optimistic: add to inline data
        setData((prev) => {
          if (!prev) return prev;
          const cat = json.data!.category as Category;
          return {
            ...prev,
            categories: {
              ...prev.categories,
              [cat]: [...(prev.categories[cat] ?? []), { ...json.data!, recipeIds: [] }],
            },
            totalItems: prev.totalItems + 1,
          };
        });
        setAddItemOpen(false);
      } else {
        alert(json.error ?? 'Failed to add item');
      }
    } catch {
      alert('Failed to add item');
    }
  }

  async function handleDeleteItem(id: string, cat: Category) {
    if (!confirm('Delete this item?')) return;
    try {
      const res = await fetch(`/api/shopping-list/items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            categories: {
              ...prev.categories,
              [cat]: prev.categories[cat].filter((item) => item.id !== id),
            },
            totalItems: prev.totalItems - 1,
          };
        });
      } else {
        const json = (await res.json()) as { error?: string };
        alert(json.error ?? 'Failed to delete item');
      }
    } catch {
      alert('Failed to delete item');
    }
  }

  // --- Derived counts ---

  const flatItems = useMemo(() => {
    if (!data) return [] as { cat: Category; item: ShoppingItem }[];
    const out: { cat: Category; item: ShoppingItem }[] = [];
    for (const cat of CATEGORY_ORDER) {
      for (const item of data.categories[cat] ?? []) {
        out.push({ cat, item });
      }
    }
    return out;
  }, [data]);

  const totalCount = flatItems.length;
  const checkedCount = useMemo(
    () => flatItems.filter(({ item }) => checked[itemKey(item.name, item.unit)]?.checked).length,
    [flatItems, checked],
  );
  const checkedByOthers = useMemo(() => {
    if (scope !== 'FAMILY' || !userId) return 0;
    return flatItems.filter(({ item }) => {
      const c = checked[itemKey(item.name, item.unit)];
      return c?.checked && c.checkedBy !== userId;
    }).length;
  }, [flatItems, checked, scope, userId]);

  // If user is not in a household, force scope to ME
  useEffect(() => {
    if (session?.user && !canUseFamily && scope === 'FAMILY') {
      setScope('ME');
    }
  }, [canUseFamily, scope, session?.user]);

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-semibold">Shopping List</h1>
        <p className="text-sm text-muted-foreground">
          {data?.from} to {data?.until} · {scope === 'FAMILY' ? 'Family' : 'Me'} · {totalCount} items
        </p>
      </div>

      {/* On-screen header (hidden in print) */}
      <div className="space-y-4 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ShoppingCart size={22} className="text-primary" />
              Shopping List
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {data
                ? `${data.totalRecipes} recipe${data.totalRecipes !== 1 ? 's' : ''} · ${totalCount} item${totalCount !== 1 ? 's' : ''}`
                : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearChecked} disabled={checkedCount === 0}>
              <X size={14} className="mr-1" /> Clear all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddItemOpen(true)}>
              <Plus size={14} className="mr-1" /> Add item
            </Button>
            <Button variant="default" size="sm" onClick={handlePrint} disabled={totalCount === 0}>
              <Printer size={14} className="mr-1" /> Print
            </Button>
          </div>
        </div>

        {/* Add Item Dialog */}
        <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Manual Item</DialogTitle>
            </DialogHeader>
            <AddItemForm onSubmit={handleAddItem} />
          </DialogContent>
        </Dialog>

        {/* Date range + scope controls */}
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-xs">From</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="until" className="text-xs">Until</Label>
              <Input
                id="until"
                type="date"
                value={until}
                onChange={(e) => handleUntilChange(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="ml-auto space-y-1.5">
              <Label className="text-xs">Scope</Label>
              <div className="flex rounded-lg border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setScope('ME')}
                  className={cn(
                    'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                    scope === 'ME'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Me
                </button>
                <button
                  type="button"
                  onClick={() => setScope('FAMILY')}
                  disabled={!canUseFamily}
                  className={cn(
                    'px-3 py-1 rounded-md text-sm font-medium transition-colors',
                    scope === 'FAMILY'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                    !canUseFamily && 'opacity-40 cursor-not-allowed hover:text-muted-foreground'
                  )}
                  title={canUseFamily ? 'Show family shopping list' : 'Join a household to use Family mode'}
                >
                  Family
                </button>
              </div>
            </div>
          </div>

          {/* Week shortcuts */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => applyMonday(addDays(monday, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => applyMonday(addDays(monday, 7))}
              aria-label="Next week"
            >
              <ChevronRight size={16} />
            </Button>
            <span className="text-sm font-medium text-muted-foreground">
              {formatWeekLabel(monday)}
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => applyMonday(getMonday(new Date()))}>
                This week
              </Button>
              <Button variant="ghost" size="sm" onClick={() => applyMonday(addDays(getMonday(new Date()), -7))}>
                Last week
              </Button>
              <Button variant="ghost" size="sm" onClick={() => applyMonday(addDays(getMonday(new Date()), 7))}>
                Next week
              </Button>
            </div>
          </div>
        </Card>

        {/* Progress + errors */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {totalCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {checkedCount} of {totalCount} item{totalCount !== 1 ? 's' : ''} checked
            {scope === 'FAMILY' && checkedByOthers > 0 && ` (${checkedByOthers} by others)`}
          </p>
        )}
      </div>

      {/* List */}
      <div className="mt-6 space-y-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading shopping list…</div>
        ) : !data || totalCount === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <ShoppingCart size={28} className="mx-auto mb-2 opacity-50" />
            <p>No ingredients in this range.</p>
            <p className="text-sm mt-1">Plan some meals in the Weekly Planner to build a list.</p>
          </Card>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const items = data.categories[cat] ?? [];
            if (items.length === 0) return null;
            return (
              <section key={cat} className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  {CATEGORY_LABELS[cat]}
                  <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                    ({items.length})
                  </span>
                </h2>
                <Card className="divide-y divide-border">
                  {items.map((item) => {
                    const k = itemKey(item.name, item.unit);
                    const checkState = checked[k];
                    const isChecked = checkState?.checked ?? false;
                    const checkedByOther = scope === 'FAMILY' && checkState?.checkedBy && checkState.checkedBy !== userId;
                    const isManual = item.recipeIds.length === 0;
                    return (
                      <label
                        key={item.id ?? k}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/50',
                          isChecked && 'opacity-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer accent-[#A8956A]"
                          checked={isChecked}
                          onChange={() => toggleItem(item.name, item.unit)}
                        />
                        <span
                          className={cn(
                            'flex-1 text-sm',
                            isChecked && 'line-through'
                          )}
                        >
                          {item.name}
                          {isManual && <span className="ml-2 text-xs text-muted-foreground">(manual)</span>}
                        </span>
                        {checkedByOther && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users size={12} />
                          </span>
                        )}
                        {item.amount && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {item.amount}
                          </span>
                        )}
                        {isManual && item.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteItem(item.id!, cat);
                            }}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </label>
                    );
                  })}
                </Card>
              </section>
            );
          })
        )}
      </div>
    </>
  );
}

// --- Add Item Form ---

function AddItemForm({ onSubmit }: { onSubmit: (item: { name: string; category: string; amount?: string; unit?: string }) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      category,
      amount: amount.trim() || undefined,
      unit: unit.trim() || undefined,
    });
    setName('');
    setAmount('');
    setUnit('');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="itemName">Item name *</Label>
        <Input
          id="itemName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tomatoes"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="itemAmount">Amount</Label>
          <Input
            id="itemAmount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="itemUnit">Unit</Label>
          <Input
            id="itemUnit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. g"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="itemCategory">Category</Label>
        <select
          id="itemCategory"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" className="w-full">Add Item</Button>
    </form>
  );
}
