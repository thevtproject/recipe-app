'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = { order: number; instruction: string };

type RecipeFormProps = {
  mode: 'create' | 'edit';
  recipeId?: string;
  defaultValues?: {
    title?: string;
    description?: string;
    category?: 'BREAKFAST' | 'LUNCH' | 'DINNER';
    photoUrl?: string | null;
    steps?: Step[];
  };
};

export function RecipeForm({ mode, recipeId, defaultValues }: RecipeFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultValues?.title ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [category, setCategory] = useState<'BREAKFAST' | 'LUNCH' | 'DINNER'>(
    defaultValues?.category ?? 'DINNER'
  );
  const [photoUrl, setPhotoUrl] = useState(defaultValues?.photoUrl ?? '');
  const [steps, setSteps] = useState<Step[]>(
    defaultValues?.steps?.length
      ? [...defaultValues.steps].sort((a, b) => a.order - b.order)
      : [{ order: 1, instruction: '' }]
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addStep() {
    setSteps((prev) => [...prev, { order: prev.length + 1, instruction: '' }]);
  }

  function removeStep(index: number) {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i + 1 }))
    );
  }

  function updateStep(index: number, instruction: string) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, instruction } : s))
    );
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error((json.error as string) ?? 'Upload failed');
      setPhotoUrl(json.data.url as string);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('Title is required'); return; }
    const filledSteps = steps.filter((s) => s.instruction.trim());
    if (filledSteps.length === 0) { setError('Add at least one step'); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        photoUrl: photoUrl || undefined,
        steps: filledSteps.map((s, i) => ({ order: i + 1, instruction: s.instruction.trim() })),
      };

      const url = mode === 'create' ? '/api/recipes' : `/api/recipes/${recipeId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json.error as string) ?? 'Save failed');

      router.push(`/recipes/${(json.data as { id: string }).id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const backHref = mode === 'edit' && recipeId ? `/recipes/${recipeId}` : '/recipes';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href={backHref} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft size={16} className="mr-1" />
          {mode === 'edit' ? 'Back to recipe' : 'Recipes'}
        </Link>
        <h1 className="text-xl font-semibold">
          {mode === 'create' ? 'New Recipe' : 'Edit Recipe'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Spaghetti Carbonara"
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Category *</Label>
          <div className="flex gap-2">
            {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                  category === c
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Photo */}
        <div className="space-y-2">
          <Label>Photo</Label>
          {photoUrl && (
            <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-muted w-full max-w-sm">
              <img src={photoUrl} alt="Recipe photo" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotoUrl('')}
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 text-xs leading-none"
              >
                ✕
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : photoUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP · max 5MB</p>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <Label>Steps *</Label>
          {steps.map((step, index) => (
            <div key={index} className="flex gap-2 items-start">
              <span className="flex-shrink-0 w-7 h-7 mt-1.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center">
                {step.order}
              </span>
              <Input
                value={step.instruction}
                onChange={(e) => updateStep(index, e.target.value)}
                placeholder={`Step ${step.order}…`}
                className="flex-1"
              />
              {steps.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeStep(index)}
                  className="mt-0.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <Plus size={14} className="mr-1" /> Add step
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Link href={backHref} className={buttonVariants({ variant: 'outline' })}>
            Cancel
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create recipe' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
