"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface FavoriteHeartProps {
  recipeId: string;
  initialIsFavorite: boolean;
  onToggle?: (isFavorite: boolean) => void;
}

export function FavoriteHeart({
  recipeId,
  initialIsFavorite,
  onToggle,
}: FavoriteHeartProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    // Don't follow the card's Link wrapper
    e.preventDefault();
    e.stopPropagation();

    if (status !== "authenticated" || !session?.user) {
      router.push("/login");
      return;
    }

    // Optimistic toggle
    const previousState = isFavorite;
    const nextState = !previousState;
    setIsFavorite(nextState);
    onToggle?.(nextState);
    setError(null);

    try {
      if (!previousState) {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId }),
        });
        if (!res.ok) throw new Error("Failed to favorite");
      } else {
        const res = await fetch(`/api/favorites/${recipeId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to unfavorite");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setIsFavorite(previousState);
      onToggle?.(previousState);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
      title={error ?? undefined}
      className={cn(
        "absolute top-2 right-2 z-20 rounded-full p-1.5 transition-colors",
        "bg-background/80 backdrop-blur-sm hover:bg-background",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isFavorite
          ? "text-rose-500"
          : "text-muted-foreground hover:text-rose-500"
      )}
    >
      <Heart
        size={16}
        className={cn("transition-colors", isFavorite && "fill-rose-500")}
      />
    </button>
  );
}
