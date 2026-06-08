"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface FavoriteButtonProps {
  recipeId: string;
  initialIsFavorite: boolean;
}

export function FavoriteButton({ recipeId, initialIsFavorite }: FavoriteButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (status !== "authenticated" || !session?.user) {
      router.push("/login");
      return;
    }

    // Optimistic toggle
    const previousState = isFavorite;
    setIsFavorite(!previousState);
    setError(null);

    try {
      if (!previousState) {
        // Favorite it
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId }),
        });
        if (!res.ok) throw new Error("Failed to favorite");
      } else {
        // Unfavorite it
        const res = await fetch(`/api/favorites/${recipeId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to unfavorite");
      }
      // Refresh server data so the initial state stays in sync
      startTransition(() => router.refresh());
    } catch (err) {
      // Revert on error
      setIsFavorite(previousState);
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
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
    >
      <Heart
        size={16}
        className={cn(
          "transition-colors",
          isFavorite
            ? "fill-red-500 text-red-500"
            : "text-muted-foreground"
        )}
      />
      {isFavorite ? "Favorited" : "Favorite"}
    </button>
  );
}
