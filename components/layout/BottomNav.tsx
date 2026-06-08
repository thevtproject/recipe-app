"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Calendar, Settings, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/planner", label: "Planner", icon: Calendar },
  { href: "/shopping-list", label: "List", icon: ShoppingCart },
];

interface BottomNavProps {
  isAdmin?: boolean;
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...navItems, { href: "/admin/users", label: "Admin", icon: Settings }]
    : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors px-1",
              pathname === href || pathname?.startsWith(href + "/")
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
