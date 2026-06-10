'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Copy,
  Check,
  Users,
  Plus,
  LogOut,
  UserPlus,
  KeyRound,
  Camera,
  Share2,
  CalendarDays,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode } from '@/components/ui/qr-code';
import { QrScannerView } from '@/components/ui/qr-scanner';
import { cn } from '@/lib/utils';

type Member = { id: string; name: string; email: string; role: string; avatarUrl: string | null };
type Household = {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  members: Member[];
} | null;

type JoinMode = 'code' | 'scan';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://<your-domain>';

export default function HouseholdPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>}>
      <HouseholdInner />
    </Suspense>
  );
}

function HouseholdInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update } = useSession();
  const [household, setHousehold] = useState<Household>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'create' | 'join'>('view');
  const [joinMode, setJoinMode] = useState<JoinMode>('code');

  // Create form
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill from QR deep-link: /household?code=ABC12345
  useEffect(() => {
    const fromUrl = searchParams.get('code')?.toUpperCase();
    if (fromUrl) {
      setInviteCode(fromUrl);
      setMode('join');
      setJoinMode('code');
    }
  }, [searchParams]);

  useEffect(() => {
    fetch('/api/households/me')
      .then((r) => r.json())
      .then((json: { data: Household }) => setHousehold(json.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to create');
      // Force re-fetch to pick up new session
      // IMPORTANT: must pass a non-empty data arg — see app/(app)/profile/page.tsx
      // for the Auth.js v5 GET-vs-POST trigger="update" gotcha. update() with no
      // arg sends a GET which doesn't fire the jwt callback's DB read.
      await update({ householdId: json?.data?.id ?? null }); // refresh JWT so householdId flows through to other pages
      router.refresh();
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/households/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Failed to join');
      // Pass data arg so client sends POST (Auth.js v5 trigger="update" only fires on POST).
      await update({ householdId: json?.data?.id ?? null }); // refresh JWT
      router.refresh();
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeave() {
    if (!household) return;
    if (!confirm(`Leave "${household.name}"? Members will need a new code to rejoin.`)) return;
    setSubmitting(true);
    try {
      await fetch('/api/households/leave', { method: 'POST' });
      // Pass data arg so client sends POST (Auth.js v5 trigger="update" only fires on POST).
      await update({ householdId: null }); // refresh JWT
      router.refresh();
      window.location.reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    if (!household) return;
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      setError('Copy failed');
    }
  }

  async function shareInvite() {
    if (!household) return;
    const url = `${APP_URL}/household?code=${encodeURIComponent(household.inviteCode)}`;
    const text = `Join my Recipe Book household "${household.name}". Code: ${household.inviteCode}\n${url}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'Recipe Book invite', text, url });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      setError('Copy failed');
    }
  }

  // QR handler: extract the code from either a raw code or a deep-link URL
  function handleScanned(text: string) {
    let code = text.trim();
    try {
      const u = new URL(text);
      const fromParam = u.searchParams.get('code');
      if (fromParam) code = fromParam;
    } catch {
      // not a URL — treat as raw code
    }
    code = code.toUpperCase();
    setInviteCode(code);
    setJoinMode('code');
    setError(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (household) {
    const inviteUrl = `${APP_URL}/household?code=${encodeURIComponent(household.inviteCode)}`;
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Household</h1>
          <p className="text-muted-foreground text-sm">Share recipes and plan meals together.</p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-5">
          <div>
            <h2 className="text-lg font-medium">{household.name}</h2>
            <p className="text-xs text-muted-foreground">
              Created {new Date(household.createdAt).toLocaleDateString('en-US')}
            </p>
          </div>

          {/* QR + code side by side on md+, stacked on mobile */}
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            <QrCode
              value={inviteUrl}
              size={160}
              caption="Scan to join"
            />
            <div className="flex-1 w-full space-y-2">
              <Label>Invite code</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-base tracking-widest text-center">
                  {household.inviteCode}
                </code>
                <Button variant="outline" size="sm" onClick={copyCode} className="gap-1 shrink-0">
                  {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                  {codeCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={shareInvite}
                className="w-full gap-1.5"
              >
                <Share2 size={14} />
                Share invite
              </Button>
              <p className="text-xs text-muted-foreground">
                Share the code or the QR — both work. Anyone with the code can join.
              </p>
            </div>
          </div>
        </div>

        {/* Family shortcuts */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/planner"
            className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays size={16} className="text-primary" />
              Plan family meals
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Switch to Family week in the planner to coordinate meals together.
            </p>
          </Link>
          <Link
            href="/shopping-list?scope=FAMILY"
            className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShoppingCart size={16} className="text-primary" />
              Family shopping list
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate groceries from everyone’s planned family meals.
            </p>
          </Link>
        </div>

        {/* Members */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h2 className="text-base font-medium flex items-center gap-2">
            <Users size={16} />
            Members ({household.members.length})
          </h2>
          <ul className="space-y-2">
            {household.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 text-sm py-1.5">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {m.name?.[0]?.toUpperCase() ?? m.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.name || m.email}</div>
                  {m.name && <div className="text-xs text-muted-foreground truncate">{m.email}</div>}
                </div>
                {m.role === 'ADMIN' && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                    Admin
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <Button
          variant="outline"
          onClick={handleLeave}
          disabled={submitting}
          className="gap-1.5 text-destructive"
        >
          <LogOut size={14} />
          Leave household
        </Button>
      </div>
    );
  }

  // No household: show create/join
  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Household</h1>
        <p className="text-muted-foreground text-sm">
          Create a household to share meal plans with family — or join one with an invite code or QR.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMode('create'); setError(null); }}
          className={cn(
            'flex-1 py-2 text-sm rounded-md border transition-colors',
            mode === 'create' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          )}
        >
          <Plus size={14} className="inline mr-1" />
          Create
        </button>
        <button
          type="button"
          onClick={() => { setMode('join'); setError(null); }}
          className={cn(
            'flex-1 py-2 text-sm rounded-md border transition-colors',
            mode === 'join' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
          )}
        >
          <UserPlus size={14} className="inline mr-1" />
          Join
        </button>
      </div>

      {mode === 'create' && (
        <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-5 space-y-3">
          <Label>Household name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Chen Family"
            maxLength={60}
            required
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting || !name.trim()} className="w-full">
            {submitting ? 'Creating…' : 'Create household'}
          </Button>
        </form>
      )}

      {mode === 'join' && (
        <div className="space-y-3">
          {/* Sub-tabs: code entry vs camera scan */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setJoinMode('code'); setError(null); }}
              className={cn(
                'flex-1 py-2 text-sm rounded-md border transition-colors',
                joinMode === 'code' ? 'bg-accent text-accent-foreground border-accent' : 'border-border hover:bg-muted'
              )}
            >
              <KeyRound size={14} className="inline mr-1" />
              Enter code
            </button>
            <button
              type="button"
              onClick={() => { setJoinMode('scan'); setError(null); }}
              className={cn(
                'flex-1 py-2 text-sm rounded-md border transition-colors',
                joinMode === 'scan' ? 'bg-accent text-accent-foreground border-accent' : 'border-border hover:bg-muted'
              )}
            >
              <Camera size={14} className="inline mr-1" />
              Scan QR
            </button>
          </div>

          {joinMode === 'code' && (
            <form onSubmit={handleJoin} className="rounded-lg border border-border bg-card p-5 space-y-3">
              <Label className="flex items-center gap-1">
                <KeyRound size={12} />
                Invite code
              </Label>
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="8-character code"
                maxLength={20}
                required
                className="font-mono tracking-widest text-center"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting || !inviteCode.trim()} className="w-full">
                {submitting ? 'Joining…' : 'Join household'}
              </Button>
            </form>
          )}

          {joinMode === 'scan' && (
            <QrScannerView
              onResult={handleScanned}
              onClose={() => setJoinMode('code')}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn('text-xs font-medium text-muted-foreground block', className)}>{children}</label>;
}
