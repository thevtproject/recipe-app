'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowLeft, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Ingredient } from '@/types/ingredient';
import { COMMON_UNITS } from '@/types/ingredient';

type Step = { order: number; instruction: string; durationSec?: number | null };
// Form-local shape: amount is a raw string from the input, parsed on submit.
type IngredientForm = {
  amount: string;
  unit: string;
  name: string;
  note: string;
};
type MealCategory = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BABY';
const ALL_CATEGORIES: MealCategory[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'BABY'];

type RecipeFormProps = {
  mode: 'create' | 'edit';
  recipeId?: string;
  defaultValues?: {
    title?: string;
    description?: string;
    notes?: string | null;
    servings?: number | null;
    prepTimeMin?: number | null;
    cookTimeMin?: number | null;
    categories?: MealCategory[];
    photoUrl?: string | null;
    steps?: Step[];
    ingredients?: Ingredient[];
  };
};

export function RecipeForm({ mode, recipeId, defaultValues }: RecipeFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultValues?.title ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [notes, setNotes] = useState(defaultValues?.notes ?? '');
  const [servings, setServings] = useState<string>(
    defaultValues?.servings != null ? String(defaultValues.servings) : '4'
  );
  const [prepTimeMin, setPrepTimeMin] = useState<string>(
    defaultValues?.prepTimeMin != null ? String(defaultValues.prepTimeMin) : ''
  );
  const [cookTimeMin, setCookTimeMin] = useState<string>(
    defaultValues?.cookTimeMin != null ? String(defaultValues.cookTimeMin) : ''
  );
  const [categories, setCategories] = useState<MealCategory[]>(
    defaultValues?.categories?.length ? defaultValues.categories : ['DINNER']
  );
  const [photoUrl, setPhotoUrl] = useState(defaultValues?.photoUrl ?? '');
  const [steps, setSteps] = useState<Step[]>(
    defaultValues?.steps?.length
      ? [...defaultValues.steps].sort((a, b) => a.order - b.order)
      : [{ order: 1, instruction: '' }]
  );
  const [ingredients, setIngredients] = useState<IngredientForm[]>(
    (defaultValues?.ingredients ?? []).map((i) => ({
      amount: i.amount == null ? '' : String(i.amount),
      unit: i.unit ?? '',
      name: i.name ?? '',
      note: i.note ?? '',
    })),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function addStep() {
    setSteps((prev) => [...prev, { order: prev.length + 1, instruction: '', durationSec: null }]);
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

  function updateStepDuration(index: number, minutesStr: string) {
    // Empty string → null. Positive integer minutes → seconds. Otherwise null.
    const trimmed = minutesStr.trim();
    let durationSec: number | null = null;
    if (trimmed) {
      const n = parseInt(trimmed, 10);
      if (Number.isFinite(n) && n > 0) durationSec = n * 60;
    }
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, durationSec } : s))
    );
  }

  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      { amount: '', unit: '', name: '', note: '' },
    ]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function updateIngredient(
    index: number,
    field: keyof IngredientForm,
    value: string,
  ) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
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
    if (categories.length === 0) { setError('Pick at least one category'); return; }
    const filledSteps = steps.filter((s) => s.instruction.trim());
    if (filledSteps.length === 0) { setError('Add at least one step'); return; }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        servings: servings !== '' ? Math.max(1, Math.min(99, parseInt(servings, 10) || 4)) : 4,
        prepTimeMin: prepTimeMin !== '' ? parseInt(prepTimeMin, 10) : undefined,
        cookTimeMin: cookTimeMin !== '' ? parseInt(cookTimeMin, 10) : undefined,
        categories,
        photoUrl: photoUrl || undefined,
        steps: filledSteps.map((s, i) => ({
          order: i + 1,
          instruction: s.instruction.trim(),
          durationSec: s.durationSec ?? null,
        })),
        ingredients: ingredients
          .filter((i) => i.name.trim())
          .map<Ingredient>((i) => {
            const trimmed = i.amount.trim();
            let amount: number | null;
            if (trimmed === '') {
              amount = null;
            } else {
              const n = Number(trimmed.replace(',', '.'));
              amount = Number.isFinite(n) && n >= 0 ? n : null;
            }
            return {
              amount,
              unit: i.unit.trim(),
              name: i.name.trim(),
              note: i.note.trim() || null,
            };
          }),
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

        {/* Servings + Prep + Cook time */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              type="number"
              min={1}
              max={99}
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="4"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prepTime">Prep time (min)</Label>
            <Input
              id="prepTime"
              type="number"
              min={0}
              max={10000}
              value={prepTimeMin}
              onChange={(e) => setPrepTimeMin(e.target.value)}
              placeholder="e.g. 15"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cookTime">Cook time (min)</Label>
            <Input
              id="cookTime"
              type="number"
              min={0}
              max={10000}
              value={cookTimeMin}
              onChange={(e) => setCookTimeMin(e.target.value)}
              placeholder="e.g. 30"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-2">
          <Label>Categories *</Label>
          <div className="flex gap-2 flex-wrap">
            {ALL_CATEGORIES.map((c) => {
              const selected = categories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategories((prev) =>
                      selected ? prev.filter((x) => x !== c) : [...prev, c]
                    );
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:bg-muted'
                  )}
                  aria-pressed={selected}
                >
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Pick all that apply — e.g. a stir-fry is both lunch and dinner.
          </p>
        </div>

        {/* Ingredients */}
        <div className="space-y-3">
          <Label>Ingredients</Label>
          <p className="text-xs text-muted-foreground -mt-2">
            Amount is optional — leave blank for &quot;to taste&quot; / &quot;a pinch&quot;. Use commas for decimals (1,5 = 1.5).
          </p>
          {ingredients.map((ing, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex gap-2 items-center">
                <Input
                  value={ing.amount}
                  onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                  placeholder="200"
                  inputMode="decimal"
                  className="w-20 flex-shrink-0"
                  aria-label={`Amount for ingredient ${index + 1}`}
                />
                <Input
                  value={ing.unit}
                  onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                  placeholder="g"
                  list={`unit-options-${index}`}
                  className="w-24 flex-shrink-0"
                  aria-label={`Unit for ingredient ${index + 1}`}
                />
                <datalist id={`unit-options-${index}`}>
                  {COMMON_UNITS.filter((u) => u !== '').map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                <Input
                  value={ing.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                  placeholder="flour"
                  className="flex-1 min-w-0"
                  aria-label={`Ingredient name ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeIngredient(index)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  aria-label={`Remove ingredient ${index + 1}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              {ing.note && (
                <p className="text-xs text-muted-foreground pl-1">
                  note: {ing.note}
                </p>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <Plus size={14} className="mr-1" /> Add ingredient
          </Button>
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
              <div className="relative w-24 flex-shrink-0">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1440}
                  value={step.durationSec ? Math.round(step.durationSec / 60) : ''}
                  onChange={(e) => updateStepDuration(index, e.target.value)}
                  placeholder="min"
                  className="pr-7 text-center"
                />
                <Timer size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
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

        {/* Chef's notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Chef's notes</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tips, substitutions, or anything worth noting…"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
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
