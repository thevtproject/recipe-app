"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------- types ----------
type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type AdminRecipe = {
  id: string;
  title: string;
  photoUrl: string | null;
  categories: string[];
};

type RatingRow = {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  user: AdminUser;
  recipe: AdminRecipe;
};

type CookedRow = {
  id: string;
  cookedAt: string;
  user: AdminUser;
  recipe: AdminRecipe;
};

// ---------- main page ----------
export default function AdminActivityPage() {
  const [tab, setTab] = useState<"reviews" | "cooked">("reviews");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-muted-foreground mt-1">
          Review and cook history from all users. Deletions are permanent and
          update recipe aggregates (rating avg/count, last cooked date).
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={tab === "reviews" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("reviews")}
        >
          Reviews
        </Button>
        <Button
          variant={tab === "cooked" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("cooked")}
        >
          Cooked history
        </Button>
      </div>

      {tab === "reviews" ? <ReviewsPanel /> : <CookedPanel />}
    </div>
  );
}

// ---------- reviews panel ----------
function ReviewsPanel() {
  const [rows, setRows] = useState<RatingRow[] | null>(null);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    const url = search
      ? `/api/admin/ratings?q=${encodeURIComponent(search)}&limit=200`
      : "/api/admin/ratings?limit=200";
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error ?? "Failed to load");
      setRows([]);
    } else {
      setRows(json.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  async function handleDelete(row: RatingRow) {
    const ok = window.confirm(
      `Delete this ${row.stars}★ review by ${row.user.name} on "${row.recipe.title}"?`
    );
    if (!ok) return;
    setDeletingId(row.id);
    const res = await fetch("/api/admin/ratings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    setDeletingId(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      window.alert(`Delete failed: ${json?.error ?? res.statusText}`);
      return;
    }
    setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">All reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedQ(q);
            load(q);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by recipe, user, or comment…"
            className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
          <Button type="submit" size="sm" disabled={loading}>
            Search
          </Button>
          {appliedQ && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setQ("");
                setAppliedQ("");
                load("");
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {error && (
          <p className="text-sm text-destructive">Error: {error}</p>
        )}

        {rows === null ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {appliedQ ? `No reviews matching "${appliedQ}".` : "No reviews yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex gap-3 p-3 rounded-md border border-border"
              >
                <Avatar
                  src={r.user.avatarUrl}
                  name={r.user.name}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.user.email}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Stars value={r.stars} />
                    <span className="text-xs text-muted-foreground">on</span>
                    <Link
                      href={`/recipes/${r.recipe.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {r.recipe.title}
                    </Link>
                  </div>
                  {r.comment && (
                    <p className="text-sm mt-1.5 text-foreground/90">
                      {r.comment}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(r)}
                  disabled={deletingId === r.id}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  {deletingId === r.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- cooked-history panel ----------
function CookedPanel() {
  const [rows, setRows] = useState<CookedRow[] | null>(null);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (search: string, fromD: string, toD: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (search) params.set("q", search);
      if (fromD) params.set("from", fromD);
      if (toD) params.set("to", toD);
      const res = await fetch(`/api/admin/cooked-history?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Failed to load");
        setRows([]);
      } else {
        setRows(json.data ?? []);
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    load("", "", "");
  }, [load]);

  async function handleDelete(row: CookedRow) {
    const ok = window.confirm(
      `Delete the cook of "${row.recipe.title}" by ${row.user.name} on ${new Date(
        row.cookedAt
      ).toLocaleDateString()}?`
    );
    if (!ok) return;
    setDeletingId(row.id);
    const res = await fetch("/api/admin/cooked-history", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    setDeletingId(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      window.alert(`Delete failed: ${json?.error ?? res.statusText}`);
      return;
    }
    setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">All cook history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedQ(q);
            load(q, from, to);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by recipe or user…"
            className="flex-1 min-w-[180px] h-9 rounded-md border border-border bg-background px-3 text-sm"
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            aria-label="From date"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            aria-label="To date"
          />
          <Button type="submit" size="sm" disabled={loading}>
            Search
          </Button>
          {(appliedQ || from || to) && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setQ("");
                setFrom("");
                setTo("");
                setAppliedQ("");
                load("", "", "");
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {error && <p className="text-sm text-destructive">Error: {error}</p>}

        {rows === null ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {appliedQ || from || to
              ? "No cook entries match these filters."
              : "No cook history yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex gap-3 p-3 rounded-md border border-border"
              >
                <Avatar
                  src={r.user.avatarUrl}
                  name={r.user.name}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.user.email}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.cookedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">cooked</span>
                    <Link
                      href={`/recipes/${r.recipe.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {r.recipe.title}
                    </Link>
                    {r.recipe.categories.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {r.recipe.categories.map((c) => (
                          <Badge
                            key={c}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(r)}
                  disabled={deletingId === r.id}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  {deletingId === r.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- shared bits ----------
function Stars({ value }: { value: number }) {
  return (
    <span
      className="text-sm text-amber-600"
      aria-label={`${value} of 5 stars`}
      title={`${value} of 5 stars`}
    >
      {"★".repeat(value)}
      <span className="text-amber-600/30">{"★".repeat(5 - value)}</span>
    </span>
  );
}

function Avatar({
  src,
  name,
  size = 32,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn(
          "rounded-full object-cover border border-border flex-shrink-0",
          "self-start"
        )}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-muted text-muted-foreground flex items-center justify-center font-medium border border-border flex-shrink-0 self-start"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </div>
  );
}
