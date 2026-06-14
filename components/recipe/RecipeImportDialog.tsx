'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { Ingredient } from '@/types/ingredient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecipeImportData = {
  title: string;
  description?: string | null;
  ingredients: { amount: number | null; unit: string; name: string; note?: string | null }[];
  steps: { instruction: string; durationSec?: number | null }[];
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  servings?: number | null;
  photoUrl?: string | null;
  sourceUrl?: string | null;
};

type RecipeImportDialogProps = {
  onImport: (data: RecipeImportData) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecipeImportDialog({ onImport }: RecipeImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    title: string;
    description: string;
    servings?: number;
  } | null>(null);
  const [extractedData, setExtractedData] = useState<RecipeImportData | null>(
    null,
  );

  function resetState() {
    setUrl('');
    setError(null);
    setPreview(null);
    setExtractedData(null);
    setLoading(false);
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) resetState();
  }

  async function handleExtract() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);
    setExtractedData(null);

    try {
      const res = await fetch('/api/recipes/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          (json.error as string) ?? 'Failed to extract recipe from URL',
        );
      }

      const data = json.data as {
        title: string;
        description?: string;
        ingredients?: Ingredient[];
        steps?: { instruction: string; durationSec?: number | null }[];
        prepTimeMin?: number;
        cookTimeMin?: number;
        servings?: number;
        photoUrl?: string;
      };

      const importData: RecipeImportData = {
        title: data.title ?? '',
        description: data.description || null,
        ingredients: (data.ingredients ?? []).map((i) => ({
          amount: i.amount,
          unit: i.unit ?? '',
          name: i.name ?? '',
          note: i.note ?? null,
        })),
        steps: (data.steps ?? []).map((s) => ({
          instruction: s.instruction ?? '',
          durationSec: s.durationSec ?? null,
        })),
        prepTimeMin: data.prepTimeMin ?? null,
        cookTimeMin: data.cookTimeMin ?? null,
        servings: data.servings ?? null,
        photoUrl: data.photoUrl ?? null,
        sourceUrl: trimmed,
      };

      setExtractedData(importData);
      setPreview({
        title: importData.title,
        description: importData.description ?? '',
        servings: importData.servings ?? undefined,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to extract recipe from URL',
      );
    } finally {
      setLoading(false);
    }
  }

  function handleImport() {
    if (extractedData) {
      onImport(extractedData);
      setIsOpen(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Link size={14} className="mr-1" />
            Import from URL
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Recipe from URL</DialogTitle>
          <DialogDescription>
            Paste a URL from a supported recipe website to extract its contents.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL input + Extract button */}
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/recipe/..."
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExtract();
              }}
              className="flex-1"
            />
            <Button
              onClick={handleExtract}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="mr-1 animate-spin" />
                  Extracting…
                </>
              ) : (
                'Extract'
              )}
            </Button>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success preview */}
          {preview && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                <CheckCircle size={16} className="text-green-600" />
                Recipe extracted successfully
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-stone-800">
                  {preview.title}
                </p>
                {preview.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {preview.description}
                  </p>
                )}
                {preview.servings != null && (
                  <p className="text-xs text-muted-foreground">
                    {preview.servings} serving
                    {preview.servings !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          {extractedData && (
            <Button onClick={handleImport}>
              <CheckCircle size={14} className="mr-1" />
              Import Recipe
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
