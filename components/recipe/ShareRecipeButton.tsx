'use client';

import { useState } from 'react';
import { Copy, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ShareRecipeButtonProps = {
  recipeId: string;
  recipeTitle: string;
};

export function ShareRecipeButton({ recipeId, recipeTitle }: ShareRecipeButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setError(null);
    const path = `/recipes/${recipeId}`;
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    const text = `Recipe: ${recipeTitle}\n${url}\n\nLogin required to view.`;

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: recipeTitle, text, url });
        return;
      } catch {
        // User cancelled or share failed; fall back to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed');
    }
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={handleShare} className="gap-1">
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {copied ? 'Copied' : 'Share'}
      </Button>
      {error && (
        <p className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
