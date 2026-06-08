'use client';

import { Play, Timer as TimerIcon } from 'lucide-react';
import { useTimer } from '@/components/timer/TimerProvider';

export type RecipeStep = {
  order: number;
  instruction: string;
  durationSec?: number | null;
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function RecipeSteps({ steps }: { steps: RecipeStep[] }) {
  const { start, timers } = useTimer();

  if (steps.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Instructions</h2>
      <ol className="space-y-3">
        {steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => {
            const dur = step.durationSec ?? null;
            const isRunning = dur
              ? timers.some(
                  (t) =>
                    t.status === 'running' &&
                    t.label === `Step ${step.order}` &&
                    t.totalSec === dur
                )
              : false;

            return (
              <li
                key={step.order}
                className="flex gap-4 p-4 rounded-lg bg-card border border-border"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center">
                  {step.order}
                </span>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm leading-relaxed">{step.instruction}</p>
                  {dur ? (
                    <button
                      type="button"
                      onClick={() => start(`Step ${step.order}`, dur)}
                      disabled={isRunning}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        isRunning
                          ? 'border-primary bg-primary/10 text-primary cursor-default'
                          : 'border-border bg-background hover:bg-muted text-foreground'
                      }`}
                      aria-label={`Start ${formatDuration(dur)} timer for step ${step.order}`}
                    >
                      {isRunning ? (
                        <>
                          <TimerIcon size={12} /> Timer running…
                        </>
                      ) : (
                        <>
                          <Play size={12} /> Start {formatDuration(dur)} timer
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
      </ol>
    </div>
  );
}
