'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventContentArg, DatesSetArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
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

interface EventContentProps {
  info: EventContentArg;
  onRemove: (planId: string) => void;
}

function EventContent({ info, onRemove }: EventContentProps) {
  const { recipe, planId } = info.event.extendedProps as {
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
        aria-label="Remove meal"
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

  const fetchPlans = useCallback(async (from: string, until: string) => {
    const res = await fetch(`/api/meal-plans?from=${from}&until=${until}`);
    const json = await res.json() as { data: MealPlan[] };
    const fetched = json.data ?? [];
    setPlans(fetched);
    setEvents(fetched.map(planToEvent));
  }, []);

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
    const json = await res.json() as { data: MealPlan };
    if (json.data) {
      setPlans((prev) => [...prev, json.data]);
      setEvents((prev) => [...prev, planToEvent(json.data)]);
    }
  }

  async function handleRemove(planId: string) {
    await fetch(`/api/meal-plans/${planId}`, { method: 'DELETE' });
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    setEvents((prev) => prev.filter((e) => e.id !== planId));
  }

  function handleDatesSet(info: DatesSetArg) {
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
