'use client';

import { useState, useTransition } from 'react';
import { Check, ChefHat, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  recipeId: string;
  /** The most recent date this user cooked this recipe, or null if never. */
  myLastCookedAt: string | null;
}

export function CookedButton({ recipeId, myLastCookedAt }: Props) {
  const [isPending, startTransition] = useTransition();
  const [lastCooked, setLastCooked] = useState(myLastCookedAt);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/cooked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error ?? 'Failed to log cook.');
        return;
      }
      const json = await res.json();
      setLastCooked(json?.data?.cookedAt ?? new Date().toISOString());
    });
  };

  const cookedRecently = !!(lastCooked && Date.now() - new Date(lastCooked).getTime() < 60_000);
  const cookedToday = !!(lastCooked && new Date(lastCooked).toDateString() === new Date().toDateString());

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={isPending || cookedRecently}
        className={cn(
          'gap-1.5',
          cookedToday && 'bg-emerald-50 border-emerald-200 text-emerald-800'
        )}
        title={cookedToday ? 'Already cooked today' : 'Log that you cooked this recipe'}
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : cookedToday ? (
          <Check size={14} />
        ) : (
          <ChefHat size={14} />
        )}
        {cookedToday ? 'Cooked today' : 'I cooked this'}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
