"use client";

import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { User, Users, Settings, LogOut, ChevronDown, Heart, History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  isAdmin?: boolean;
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name && name.trim()) || (email && email.split("@")[0]) || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu({ isAdmin }: UserMenuProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const user = session?.user;

  const navigate = (href: string) => () => {
    router.push(href);
  };

  const imageUrl = (user as any)?.image as string | undefined;
  const initials = getInitials(user?.name, user?.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-full p-1 pr-2 transition-colors",
          "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "data-[popup-open]:bg-accent"
        )}
        aria-label="Open user menu"
      >
        <Avatar size="default" className="ring-1 ring-border">
          {imageUrl ? <AvatarImage src={imageUrl} alt={user?.name ?? "User"} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
            {user?.name ?? "Account"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {isAdmin ? "Admin" : "Member"}
          </span>
        </span>
        <ChevronDown size={14} className="hidden sm:block text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <div className="px-2.5 py-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground truncate">
              {user?.name ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {user?.email ?? ""}
            </span>
          </div>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={navigate("/profile")} className="cursor-pointer">
          <User />
          <span>Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={navigate("/household")} className="cursor-pointer">
          <Users />
          <span>Household</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={navigate("/favorites")} className="cursor-pointer">
          <Heart />
          <span>Favorited Recipes</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={navigate("/history")} className="cursor-pointer">
          <History />
          <span>Cooking History</span>
        </DropdownMenuItem>

        {isAdmin ? (
          <DropdownMenuItem onClick={navigate("/admin/users")} className="cursor-pointer">
            <Settings />
            <span>Admin Panel</span>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="cursor-pointer"
        >
          <LogOut />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
