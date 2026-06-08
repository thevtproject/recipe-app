'use client';

import { useState, useTransition } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface RatingRow {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
}

interface Props {
  recipeId: string;
  myStars: number | null;
  myComment: string | null;
  ratings: RatingRow[];
}

export function RatingWidget({ recipeId, myStars, myComment, ratings }: Props) {
  const [stars, setStars] = useState<number>(myStars ?? 0);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [comment, setComment] = useState<string>(myComment ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stars < 1) {
      setError('Pick a star rating first.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, stars, comment: comment.trim() || null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json?.error ?? 'Failed to save rating.');
        return;
      }
      // Reload to pick up new ratings list + denormalized avg
      window.location.reload();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const res = await fetch(`/api/ratings?recipeId=${encodeURIComponent(recipeId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError('Failed to remove rating.');
        return;
      }
      setStars(0);
      setComment('');
      window.location.reload();
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3 p-4 rounded-lg bg-card border border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">Your rating:</span>
          <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverStars(0)}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hoverStars || stars) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  onMouseEnter={() => setHoverStars(n)}
                  onClick={() => setStars(n)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    size={24}
                    className={cn(
                      'transition-colors',
                      active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'
                    )}
                  />
                </button>
              );
            })}
          </div>
          {myStars !== null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={isPending}
              className="text-xs text-muted-foreground ml-auto"
            >
              Remove my rating
            </Button>
          )}
        </div>
        <Textarea
          placeholder="Optional comment (max 500 chars)…"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          maxLength={500}
          rows={2}
          className="resize-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{comment.length}/500</span>
          <Button type="submit" size="sm" disabled={isPending || stars < 1}>
            {isPending && <Loader2 className="mr-1 animate-spin" size={14} />}
            {myStars !== null ? 'Update rating' : 'Submit rating'}
          </Button>
        </div>
      </form>

      {ratings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {ratings.length} review{ratings.length === 1 ? '' : 's'}
          </h3>
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className="p-3 rounded-lg bg-card/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{r.user.name}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={12}
                        className={cn(
                          r.stars >= n ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {r.comment && <p className="text-sm leading-relaxed">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
