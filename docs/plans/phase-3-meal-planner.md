# Phase 3 — Meal Planner Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement task-by-task.

**Goal:** Weekly meal planner — FullCalendar weekly view, per-user meal slots (BREAKFAST/LUNCH/DINNER per day), recipe picker modal, CRUD API.

**Architecture:** MealPlan model already in DB (userId, date, mealType, recipeId, @@unique on [userId,date,mealType]). API routes handle the per-user CRUD. FullCalendar renders the week, custom event content renders recipe cards in each slot. Recipe picker is a Dialog that searches the user's recipe library.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, FullCalendar 6 (@fullcalendar/react + @fullcalendar/daygrid + @fullcalendar/timegrid + @fullcalendar/interaction), Prisma 5, shadcn/ui Dialog, zod.

**Stack notes:**
- Button uses `@base-ui/react/button` — NO asChild. Use `Link` + `buttonVariants` for link-buttons.
- CSS vars are oklch-based shadcn v5 tokens.
- `params` in App Router route handlers type as `Promise<{id:string}>` and await them.
- All API responses: `{ data, error }` shape.

---

## Task 1: Install FullCalendar

**Objective:** Install FullCalendar packages.

**Files:** package.json (modified by npm)

**Steps:**

1. Run from `/home/andryan/recipe-app/`:
```bash
npm install @fullcalendar/react@^6 @fullcalendar/daygrid@^6 @fullcalendar/timegrid@^6 @fullcalendar/interaction@^6 @fullcalendar/core@^6
```

2. Verify packages in node_modules:
```bash
ls node_modules/@fullcalendar/react
```

3. Run `npx tsc --noEmit` — should still be 0 errors.

4. Commit:
```bash
git add package.json package-lock.json
git commit -m "feat: install FullCalendar v6"
```

---

## Task 2: MealPlan API routes

**Objective:** CRUD API for meal plan slots — GET week, POST/PATCH/DELETE slot.

**Files:**
- Create: `app/api/meal-plans/route.ts`
- Create: `app/api/meal-plans/[id]/route.ts`

### File 1: `app/api/meal-plans/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER']),
  recipeId: z.string().min(1),
});

// GET /api/meal-plans?from=YYYY-MM-DD&until=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const until = searchParams.get('until');

  const where: Record<string, unknown> = { userId: session.user.id };
  if (from) where.date = { ...(where.date as object ?? {}), gte: new Date(from) };
  if (until) where.date = { ...(where.date as object ?? {}), lte: new Date(until) };

  const plans = await prisma.mealPlan.findMany({
    where,
    include: {
      recipe: {
        select: { id: true, title: true, category: true, photoUrl: true },
      },
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  });

  return NextResponse.json({ data: plans, error: null });
}

// POST /api/meal-plans — create or replace slot
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { date, mealType, recipeId } = parsed.data;

  // Verify recipe exists
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true } });
  if (!recipe) return NextResponse.json({ data: null, error: 'Recipe not found' }, { status: 404 });

  // Upsert: one slot per user+date+mealType
  const plan = await prisma.mealPlan.upsert({
    where: {
      userId_date_mealType: {
        userId: session.user.id!,
        date: new Date(date),
        mealType,
      },
    },
    update: { recipeId },
    create: {
      userId: session.user.id!,
      date: new Date(date),
      mealType,
      recipeId,
    },
    include: {
      recipe: { select: { id: true, title: true, category: true, photoUrl: true } },
    },
  });

  return NextResponse.json({ data: plan, error: null }, { status: 201 });
}
```

### File 2: `app/api/meal-plans/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/meal-plans/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const plan = await prisma.mealPlan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
  if (plan.userId !== session.user.id) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

  await prisma.mealPlan.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true }, error: null });
}
```

**Steps:**

1. Create both files.
2. `npx tsc --noEmit` — fix any errors.
3. Commit: `git commit -m "feat: meal plan API (GET/POST /api/meal-plans, DELETE /api/meal-plans/[id])"`

---

## Task 3: RecipePicker component

**Objective:** Dialog that lists the user's recipes (searchable), user picks one → calls onSelect(recipeId).

**Files:**
- Create: `components/planner/RecipePicker.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

type Recipe = {
  id: string;
  title: string;
  category: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  photoUrl: string | null;
  author: { name: string };
};

const CATEGORY_COLORS: Record<string, string> = {
  BREAKFAST: 'bg-amber-100 text-amber-800',
  LUNCH: 'bg-green-100 text-green-800',
  DINNER: 'bg-blue-100 text-blue-800',
};

interface RecipePickerProps {
  open: boolean;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | null;
  onSelect: (recipeId: string) => void;
  onClose: () => void;
}

export function RecipePicker({ open, mealType, onSelect, onClose }: RecipePickerProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const url = mealType ? `/api/recipes?category=${mealType}` : '/api/recipes';
    fetch(url)
      .then((r) => r.json())
      .then((json) => setRecipes(json.data ?? []))
      .finally(() => setLoading(false));
  }, [open, mealType]);

  const filtered = recipes.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Pick a recipe
            {mealType && (
              <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[mealType]}`}>
                {mealType.charAt(0) + mealType.slice(1).toLowerCase()}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 mt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recipes found.</p>
          ) : (
            filtered.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => onSelect(recipe.id)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
              >
                <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                  {recipe.photoUrl ? (
                    <img src={recipe.photoUrl} alt={recipe.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-lg">🍽</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{recipe.title}</p>
                  <p className="text-xs text-muted-foreground">{recipe.author.name}</p>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[recipe.category]}`}>
                  {recipe.category.charAt(0) + recipe.category.slice(1).toLowerCase()}
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Steps:**

1. Check `components/ui/dialog.tsx` exists (shadcn Dialog was installed in Phase 1). If missing: `npx shadcn@latest add dialog`
2. Create the file.
3. `npx tsc --noEmit` — fix errors.
4. Commit: `git commit -m "feat: RecipePicker dialog component"`

---

## Task 4: Weekly Planner page

**Objective:** FullCalendar weekly view with meal slots. Click empty slot → RecipePicker → assigns recipe. Click filled slot → remove button.

**Files:**
- Create: `app/(app)/planner/page.tsx`
- Create: `components/planner/WeeklyPlanner.tsx` (client component — FullCalendar must be client-side)

**Important FullCalendar setup notes:**
- FullCalendar v6 with React must be a `'use client'` component
- Import: `import FullCalendar from '@fullcalendar/react'`
- Plugins: `dayGridPlugin`, `timeGridPlugin`, `interactionPlugin`
- Use `timeGridWeek` view to show the week with time rows
- Meal slots are at fixed times: BREAKFAST=08:00, LUNCH=12:00, DINNER=18:00
- Each MealPlan becomes a FullCalendar event: `{ id, title, start: 'YYYY-MM-DDTHH:MM:00', extendedProps: { mealType, recipe, planId } }`
- `dateClick` callback: extract date + determine mealType from hour → open RecipePicker
- Custom `eventContent` renders recipe title + photo thumbnail + remove button

### File 1: `components/planner/WeeklyPlanner.tsx`

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DateClickArg, EventContentArg } from '@fullcalendar/core';
import { RecipePicker } from './RecipePicker';
import { Trash2 } from 'lucide-react';

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';

type MealPlan = {
  id: string;
  date: string;
  mealType: MealType;
  recipeId: string;
  recipe: { id: string; title: string; category: string; photoUrl: string | null };
};

const MEAL_HOURS: Record<MealType, number> = {
  BREAKFAST: 8,
  LUNCH: 12,
  DINNER: 18,
};

const MEAL_COLORS: Record<MealType, string> = {
  BREAKFAST: '#FEF3C7',
  LUNCH: '#DCFCE7',
  DINNER: '#DBEAFE',
};

const MEAL_TEXT_COLORS: Record<MealType, string> = {
  BREAKFAST: '#92400E',
  LUNCH: '#166534',
  DINNER: '#1E40AF',
};

function hourToMealType(hour: number): MealType {
  if (hour < 10) return 'BREAKFAST';
  if (hour < 15) return 'LUNCH';
  return 'DINNER';
}

function planToEvent(plan: MealPlan): EventInput {
  const date = plan.date.split('T')[0];
  const hour = MEAL_HOURS[plan.mealType];
  return {
    id: plan.id,
    title: plan.recipe.title,
    start: `${date}T${String(hour).padStart(2, '0')}:00:00`,
    end: `${date}T${String(hour + 1).padStart(2, '0')}:00:00`,
    backgroundColor: MEAL_COLORS[plan.mealType],
    textColor: MEAL_TEXT_COLORS[plan.mealType],
    borderColor: 'transparent',
    extendedProps: {
      mealType: plan.mealType,
      recipe: plan.recipe,
      planId: plan.id,
    },
  };
}

function EventContent({ info, onRemove }: { info: EventContentArg; onRemove: (planId: string) => void }) {
  const { recipe, planId, mealType } = info.event.extendedProps as {
    recipe: MealPlan['recipe'];
    planId: string;
    mealType: MealType;
  };

  return (
    <div className="flex items-center gap-1 px-1 py-0.5 w-full overflow-hidden">
      {recipe.photoUrl && (
        <img src={recipe.photoUrl} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
      )}
      <span className="text-xs font-medium truncate flex-1">{recipe.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(planId); }}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

export function WeeklyPlanner() {
  const calendarRef = useRef<FullCalendar>(null);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMealType, setPickerMealType] = useState<MealType | null>(null);
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  // Fetch plans for current visible week
  const fetchPlans = useCallback(async (from: string, until: string) => {
    const res = await fetch(`/api/meal-plans?from=${from}&until=${until}`);
    const json = await res.json();
    const fetched: MealPlan[] = json.data ?? [];
    setPlans(fetched);
    setEvents(fetched.map(planToEvent));
  }, []);

  // Fetch current week on mount
  useEffect(() => {
    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    fetchPlans(fmt(mon), fmt(sun));
  }, [fetchPlans]);

  function handleDateClick(arg: DateClickArg) {
    const hour = arg.date.getHours();
    const mealType = hourToMealType(hour);
    const dateStr = arg.date.toISOString().split('T')[0];

    // Don't open picker if slot already filled
    const existing = plans.find(
      (p) => p.date.split('T')[0] === dateStr && p.mealType === mealType
    );
    if (existing) return;

    setPickerDate(dateStr);
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
    const json = await res.json();
    if (json.data) {
      const newPlan: MealPlan = json.data;
      setPlans((prev) => [...prev, newPlan]);
      setEvents((prev) => [...prev, planToEvent(newPlan)]);
    }
  }

  async function handleRemove(planId: string) {
    await fetch(`/api/meal-plans/${planId}`, { method: 'DELETE' });
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    setEvents((prev) => prev.filter((e) => e.id !== planId));
  }

  // Re-fetch when navigating weeks
  function handleDatesSet(info: { startStr: string; endStr: string }) {
    const from = info.startStr.split('T')[0];
    const until = info.endStr.split('T')[0];
    fetchPlans(from, until);
  }

  return (
    <>
      <div className="fc-japandi">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          slotDuration="01:00:00"
          height="auto"
          events={events}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          eventContent={(info) => (
            <EventContent info={info} onRemove={handleRemove} />
          )}
          nowIndicator
          weekends
        />
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
```

### File 2: `app/(app)/planner/page.tsx`

```typescript
import { WeeklyPlanner } from '@/components/planner/WeeklyPlanner';

export default function PlannerPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Weekly Planner</h1>
        <p className="text-muted-foreground text-sm mt-1">Click a time slot to add a meal</p>
      </div>
      <WeeklyPlanner />
    </div>
  );
}
```

**Steps:**

1. Create both files.
2. Add FullCalendar base CSS to `app/layout.tsx` or `app/globals.css`. Add at top of globals.css:
```css
@import '@fullcalendar/core/main.css';
```
Actually for FullCalendar v6, CSS is auto-injected by the React component — no manual import needed. Skip this.

3. Add minimal FullCalendar style overrides to `app/globals.css` (after existing rules) to match Japandi theme:
```css
/* FullCalendar Japandi overrides */
.fc-japandi .fc-toolbar-title {
  font-size: 1rem;
  font-weight: 600;
}
.fc-japandi .fc-button {
  background-color: var(--primary) !important;
  border-color: var(--primary) !important;
  font-size: 0.8rem !important;
}
.fc-japandi .fc-button:hover {
  opacity: 0.85 !important;
}
.fc-japandi .fc-col-header-cell-cushion,
.fc-japandi .fc-timegrid-slot-label-cushion {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}
.fc-japandi .fc-timegrid-event {
  border-radius: 6px;
  border: none;
}
```

4. `npx tsc --noEmit` — fix errors. Common issues:
   - FullCalendar types: `EventContentArg` and `DateClickArg` must be imported from `@fullcalendar/core`
   - `session.user.id` may be `string | undefined` — use `session.user.id!` or null-check

5. Commit: `git commit -m "feat: weekly planner page with FullCalendar, RecipePicker, meal slot CRUD"`

---

## Task 5: Update docs

**Objective:** Update api-contracts.md, progress.md, CHANGELOG.md.

**Steps:**

1. Add to `docs/api-contracts.md` under a new `## Meal Plans` section:
```
## Meal Plans
- GET /api/meal-plans?from=YYYY-MM-DD&until=YYYY-MM-DD — user's plans in range (includes recipe)
- POST /api/meal-plans — upsert slot { date, mealType, recipeId } — user
- DELETE /api/meal-plans/[id] — remove slot (owner only) — user
```

2. Update `progress.md` — mark Phase 3 done, set current phase to 4.

3. Add `[0.3.0]` entry to `CHANGELOG.md`.

4. Commit: `git commit -m "docs: Phase 3 complete"`

---

> Tasks 2 and 3 can run in parallel — API routes and RecipePicker component touch different files entirely.
> Task 4 depends on Task 3 (imports RecipePicker) and Task 1 (needs FullCalendar installed).
