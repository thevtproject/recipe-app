'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Bell, Pause, Play, RotateCcw, Timer as TimerIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// === Shape & context ===

type TimerEntry = {
  id: string;
  label: string;
  totalSec: number;
  remainingSec: number;
  status: 'running' | 'paused' | 'done';
  startedAt: number; // ms epoch — used to recover after tab sleep
};

type TimerContextValue = {
  timers: TimerEntry[];
  start: (label: string, durationSec: number) => string;
  pause: (id: string) => void;
  resume: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    // Defensive: outside provider, return a no-op so step rows can still mount
    // without crashing if a server-component sneaks through.
    return {
      timers: [],
      start: () => '',
      pause: () => {},
      resume: () => {},
      reset: () => {},
      remove: () => {},
    };
  }
  return ctx;
}

// === Provider ===

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<TimerEntry[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track which ids we've already announced so we don't fire twice on rapid ticks.
  const announcedRef = useRef<Set<string>>(new Set());

  const tick = useCallback(() => {
    setTimers((prev) => {
      const now = Date.now();
      const next = prev.map((t) => {
        if (t.status !== 'running') return t;
        const elapsed = Math.floor((now - t.startedAt) / 1000);
        const remaining = Math.max(0, t.totalSec - elapsed);
        if (remaining === 0) {
          if (!announcedRef.current.has(t.id)) {
            announcedRef.current.add(t.id);
            announce(t.label);
          }
          return { ...t, remainingSec: 0, status: 'done' as const };
        }
        return { ...t, remainingSec: remaining };
      });
      // Stop the interval if nothing is running anymore.
      const anyRunning = next.some((t) => t.status === 'running');
      if (!anyRunning && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return next;
    });
  }, []);

  // Start a single tick loop only when something is running.
  useEffect(() => {
    const anyRunning = timers.some((t) => t.status === 'running');
    if (anyRunning && !tickRef.current) {
      // Tick immediately so the UI updates, then every second.
      tick();
      tickRef.current = setInterval(tick, 1000);
    }
    if (!anyRunning && tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      // Cleanup on unmount
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [timers.some((t) => t.status === 'running'), tick]);

  const start = useCallback((label: string, durationSec: number) => {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return '';
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setTimers((prev) => [
      ...prev,
      {
        id,
        label: label || 'Timer',
        totalSec: Math.floor(durationSec),
        remainingSec: Math.floor(durationSec),
        status: 'running',
        startedAt: Date.now(),
      },
    ]);
    // Ask for notification permission lazily; ignore if denied.
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
    return id;
  }, []);

  const pause = useCallback((id: string) => {
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.status !== 'running') return t;
        // Freeze remainingSec as the new totalSec + startedAt offset.
        return {
          ...t,
          status: 'paused',
          totalSec: t.remainingSec,
          startedAt: Date.now(),
        };
      })
    );
  }, []);

  const resume = useCallback((id: string) => {
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.status !== 'paused') return t;
        return {
          ...t,
          status: 'running',
          startedAt: Date.now(),
        };
      })
    );
  }, []);

  const reset = useCallback((id: string) => {
    announcedRef.current.delete(id);
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        // Reset to the original totalSec if known, otherwise just rewind to 0.
        const total = t.totalSec; // we already store it
        return {
          ...t,
          remainingSec: total,
          status: 'running',
          startedAt: Date.now(),
        };
      })
    );
  }, []);

  const remove = useCallback((id: string) => {
    announcedRef.current.delete(id);
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<TimerContextValue>(
    () => ({ timers, start, pause, resume, reset, remove }),
    [timers, start, pause, resume, reset, remove]
  );

  return (
    <TimerContext.Provider value={value}>
      {children}
      <TimerDock />
    </TimerContext.Provider>
  );
}

// === Floating dock ===

function TimerDock() {
  const { timers } = useTimer();
  if (timers.length === 0) return null;
  return (
    <div
      // Mobile-friendly: sticks above the bottom nav (h-16 on mobile).
      // Narrower on mobile so it doesn't overlap navigation controls.
      className="fixed bottom-20 md:bottom-4 right-3 md:right-4 z-50 flex flex-col gap-2 w-72 sm:w-80 md:w-[22rem]"
      aria-live="polite"
    >
      {timers.map((t) => (
        <TimerCard key={t.id} timer={t} />
      ))}
    </div>
  );
}

function TimerCard({ timer }: { timer: TimerEntry }) {
  const { pause, resume, reset, remove } = useTimer();
  const isDone = timer.status === 'done';
  const mm = Math.floor(timer.remainingSec / 60);
  const ss = timer.remainingSec % 60;
  const display = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  const progress = timer.totalSec > 0
    ? Math.min(100, Math.round(((timer.totalSec - timer.remainingSec) / timer.totalSec) * 100))
    : 0;

  return (
    <div
      className={`rounded-lg border bg-card shadow-md p-3 space-y-2 ${
        isDone ? 'border-primary animate-pulse' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isDone ? (
            <Bell size={14} className="text-primary flex-shrink-0" />
          ) : (
            <TimerIcon size={14} className="text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{timer.label}</span>
        </div>
        <button
          type="button"
          onClick={() => remove(timer.id)}
          aria-label="Dismiss timer"
          className="text-muted-foreground hover:text-foreground p-0.5"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className={`tabular-nums text-2xl font-semibold ${isDone ? 'text-primary' : ''}`}>
          {display}
        </div>
        <div className="flex items-center gap-1">
          {isDone ? (
            <Button size="sm" variant="outline" onClick={() => reset(timer.id)}>
              <RotateCcw size={12} className="mr-1" /> Restart
            </Button>
          ) : timer.status === 'running' ? (
            <Button size="sm" variant="outline" onClick={() => pause(timer.id)} aria-label="Pause">
              <Pause size={12} />
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => resume(timer.id)} aria-label="Resume">
              <Play size={12} />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => reset(timer.id)} aria-label="Reset">
            <RotateCcw size={12} />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${isDone ? 'bg-primary' : 'bg-primary/70'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// === Notification + sound ===

function announce(label: string) {
  if (typeof window === 'undefined') return;
  // Audio chime — synthesize via WebAudio so we don't need a shipped .mp3.
  try {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const beep = (atMs: number, freq: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = freq;
        o.type = 'sine';
        g.gain.setValueAtTime(0.0001, ctx.currentTime + atMs / 1000);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + atMs / 1000 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atMs / 1000 + 0.45);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + atMs / 1000);
        o.stop(ctx.currentTime + atMs / 1000 + 0.5);
      };
      beep(0, 880);
      beep(280, 660);
      beep(560, 880);
      // Close the context after the last beep to free resources.
      setTimeout(() => ctx.close().catch(() => {}), 1500);
    }
  } catch {
    // Audio is non-critical; never block the UI.
  }
  // Browser notification — best effort.
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⏰ Timer done', {
        body: label,
        silent: false,
      });
    }
  } catch {
    // Notification API can throw in some browsers iframes; ignore.
  }
  // Tab title flash — last-resort fallback.
  try {
    const orig = document.title;
    document.title = `⏰ ${label} — done`;
    setTimeout(() => {
      document.title = orig;
    }, 8000);
  } catch {
    // ignore
  }
}
