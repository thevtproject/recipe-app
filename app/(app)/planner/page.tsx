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
