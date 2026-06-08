"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Calendar, Settings, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/recipes", label: "Recipe Book", icon: BookOpen },
  { href: "/planner", label: "Weekly Planner", icon: Calendar },
  { href: "/shopping-list", label: "Shopping List", icon: ShoppingCart },
];

const adminItem = { href: "/admin/users", label: "Admin Panel", icon: Settings };

interface SidebarNavProps {
  isAdmin?: boolean;
}

export function SidebarNav({ isAdmin }: SidebarNavProps) {
  const pathname = usePathname();
  const items = isAdmin ? [...navItems, adminItem] : navItems;

  return (
    <nav className="flex flex-col gap-1 p-4">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            pathname === href || pathname?.startsWith(href + "/")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
