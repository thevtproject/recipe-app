'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  ChefHat,
  List,
  X,
  CheckCircle2,
  Timer as TimerIcon,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTimer } from '@/components/timer/TimerProvider';
import type { Ingredient } from '@/types/ingredient';
import { formatAmount, pluralizeUnit } from '@/types/ingredient';
import type { RecipeStep } from '@/components/recipe/RecipeSteps';

interface CookModeProps {
  recipeId: string;
  title: string;
  steps: RecipeStep[];
  ingredients: Ingredient[];
  totalMinutes: number;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function CookMode({
  recipeId,
  title,
  steps,
  ingredients,
  totalMinutes,
}: CookModeProps) {
  const { start, pause, remove, timers } = useTimer();
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [cookStarted, setCookStarted] = useState(false);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track started timers by step order so we don't re-spawn on re-renders.
  const startedTimersRef = useRef<Set<number>>(new Set());
  // Track timer IDs per step so we can clean up when navigating away.
  const timerIdsRef = useRef<Map<number, string>>(new Map());

  const sortedSteps = useMemo(
    () => steps.slice().sort((a, b) => a.order - b.order),
    [steps],
  );
  const maxStep = sortedSteps.length;

  const step = sortedSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === maxStep - 1;
  const allDone = completedSteps.size === maxStep && maxStep > 0;

  // Start cooking timer on first interaction
  const ensureStarted = useCallback(() => {
    if (!cookStarted) {
      setCookStarted(true);
      elapsedRef.current = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    }
  }, [cookStarted]);

  // Auto-start the current step's timer when the step changes.
  // Also clean up any previous step's timer so the dock doesn't accumulate.
  useEffect(() => {
    if (!step || !step.durationSec) return;
    if (startedTimersRef.current.has(step.order)) return;
    startedTimersRef.current.add(step.order);
    const id = start(`Step ${step.order}`, step.durationSec);
    if (id) timerIdsRef.current.set(step.order, id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // When currentStep changes, remove any timer from a previous step that is
  // no longer visible — keeps the dock from piling up timer cards.
  useEffect(() => {
    for (const [stepOrder, tid] of timerIdsRef.current.entries()) {
      if (stepOrder !== step?.order && tid) {
        remove(tid);
        timerIdsRef.current.delete(stepOrder);
      }
    }
  }, [currentStep, remove, step?.order]);

  // Cleanup elapsed timer on unmount
  useEffect(() => {
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  const goNext = useCallback(() => {
    if (step) setCompletedSteps((prev) => new Set(prev).add(step.order));
    if (!isLast) {
      setCurrentStep((s) => s + 1);
    }
  }, [isLast, step]);

  const goPrev = useCallback(() => {
    if (!isFirst) setCurrentStep((s) => s - 1);
  }, [isFirst]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        window.location.href = `/recipes/${recipeId}`;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, recipeId]);

  // If all steps done, show completion screen
  if (allDone) {
    const elapsedMin = Math.floor(elapsedSec / 60);
    const elapsedH = Math.floor(elapsedMin / 60);
    const elapsedRem = elapsedMin % 60;
    const elapsedStr = elapsedH > 0 ? `${elapsedH}h ${elapsedRem}m` : `${elapsedRem}m`;

    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F5F0EB] to-[#EDE6DC] flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
            <CheckCircle2 size={48} className="text-primary" />
          </div>
          <h1 className="text-3xl font-semibold">All done! 🎉</h1>
          <p className="text-muted-foreground text-lg">
            You cooked <span className="font-medium text-foreground">{title}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Completed in {elapsedStr}
            {totalMinutes > 0 && (
              <> (estimated {totalMinutes}m)</>
            )}
          </p>
          <div className="flex items-center justify-center gap-3 pt-4">
            <Link
              href={`/recipes/${recipeId}`}
              className={cn(buttonVariants({ variant: 'outline' }))}
            >Back to recipe</Link>
            <Link href="/dashboard" className={cn(buttonVariants())}>
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check timer status for current step
  const stepTimer = step?.durationSec
    ? timers.find(
        (t) =>
          t.label === `Step ${step.order}` && t.totalSec === step.durationSec,
      )
    : null;
  const timerDisplay = stepTimer
    ? `${String(Math.floor(stepTimer.remainingSec / 60)).padStart(2, '0')}:${String(stepTimer.remainingSec % 60).padStart(2, '0')}`
    : null;
  const timerProgress =
    stepTimer && stepTimer.totalSec > 0
      ? Math.round(
          ((stepTimer.totalSec - stepTimer.remainingSec) / stepTimer.totalSec) *
            100,
        )
      : 0;
  const isTimerDone = stepTimer?.status === 'done';

  // Elapsed cooking time
  const cookMin = Math.floor(elapsedSec / 60);
  const cookSec = elapsedSec % 60;
  const cookTimeStr = cookMin > 0
    ? `${cookMin}m ${cookSec}s`
    : `${cookSec}s`;

  if (!step) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No steps found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0EB] flex flex-col">
      {/* Top bar — recipe info + controls */}
      <header className="sticky top-0 z-10 bg-[#F5F0EB]/95 backdrop-blur-sm border-b border-[#D6CEC4] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <ChefHat size={18} className="text-[#A8956A] flex-shrink-0" />
            <h1 className="text-sm font-medium truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Cooking timer */}
            <span className="text-xs text-muted-foreground tabular-nums bg-white/60 px-2 py-1 rounded-full border border-[#D6CEC4]">
              ⏱ {cookTimeStr}
            </span>
            {/* Ingredients toggle */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowIngredients(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <List size={14} />
              Ingredients
            </Button>
            {/* Exit */}
            <Link
              href={`/recipes/${recipeId}`}
              aria-label="Exit cooking mode"
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-[#D6CEC4]">
        <div
          className="h-full bg-[#A8956A] transition-all duration-300"
          style={{ width: `${((currentStep + 1) / maxStep) * 100}%` }}
        />
      </div>

      {/* Step counter */}
      <div className="text-center pt-6 pb-2">
        <span className="text-xs font-medium text-[#A8956A] bg-white/60 px-3 py-1 rounded-full border border-[#D6CEC4]">
          Step {step.order} of {maxStep}
        </span>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col px-4 pb-4">
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
          {/* Step instruction — large, readable */}
          <div
            className="flex-1 flex items-center justify-center py-8 cursor-pointer"
            onClick={() => ensureStarted()}
          >
            <p className="text-2xl md:text-3xl leading-relaxed text-center max-w-lg font-medium text-stone-800">
              {step.instruction}
            </p>
          </div>

          {/* Timer section */}
          {step.durationSec && (
            <div className="text-center space-y-3 py-4 mb-4">
              {isTimerDone ? (
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary/10 border border-primary/30">
                  <CheckCircle2 size={20} className="text-primary" />
                  <span className="text-primary font-medium">Timer done!</span>
                </div>
              ) : timerDisplay ? (
                <>
                  {/* Timer countdown */}
                  <div
                    className={`
                      text-6xl md:text-7xl font-semibold tabular-nums tracking-tight
                      ${timerProgress > 75 ? 'text-red-500' : 'text-stone-800'}
                    `}
                  >
                    {timerDisplay}
                  </div>
                  {/* Progress ring bar */}
                  <div className="max-w-xs mx-auto h-2 bg-[#D6CEC4] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        timerProgress > 75 ? 'bg-red-400' : 'bg-[#A8956A]'
                      }`}
                      style={{ width: `${timerProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(step.durationSec)}
                  </p>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    ensureStarted();
                    start(`Step ${step.order}`, step.durationSec!);
                  }}
                  className="gap-2"
                >
                  <TimerIcon size={16} />
                  Start {formatDuration(step.durationSec)} timer
                </Button>
              )}
            </div>
          )}

          {/* Navigation */}
          {/* Navigation — padded so the fixed TimerDock (bottom-20 ~80px) 
              doesn't hide the buttons */}
          <div className="flex items-center justify-between gap-4 py-4 border-t border-[#D6CEC4] pb-24 md:pb-16 bg-[#F5F0EB]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                ensureStarted();
                goPrev();
              }}
              disabled={isFirst}
              className="gap-1.5"
            >
              <ChevronLeft size={16} /> Previous
            </Button>

            <span className="text-xs text-muted-foreground">
              {completedSteps.size}/{maxStep} done
            </span>

            <Button
              type="button"
              onClick={() => {
                ensureStarted();
                goNext();
              }}
              className="gap-1.5"
            >
              {isLast ? 'Finish' : 'Next'}
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </main>

      {/* Ingredients drawer */}
      {showIngredients && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowIngredients(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[#F5F0EB] border-l border-[#D6CEC4] shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#F5F0EB]/95 backdrop-blur-sm border-b border-[#D6CEC4] px-4 py-3 flex items-center justify-between">
              <h2 className="font-medium text-sm">Ingredients</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowIngredients(false)}
              >
                <X size={16} />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex items-baseline gap-3 py-2 border-b border-[#D6CEC4]/60 last:border-0">
                  {ing.amount != null ? (
                    <span className="text-sm font-medium text-[#A8956A] w-20 flex-shrink-0">
                      {formatAmount(ing.amount)}
                      {ing.unit ? ` ${pluralizeUnit(ing.unit, ing.amount)}` : ''}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground w-20 flex-shrink-0">—</span>
                  )}
                  <span className="text-sm">{ing.name}</span>
                  {ing.note && (
                    <span className="text-xs text-muted-foreground">({ing.note})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
