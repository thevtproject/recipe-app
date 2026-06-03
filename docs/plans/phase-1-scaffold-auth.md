# Phase 1 — Scaffold + Auth Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement task-by-task.

**Goal:** Next.js 14 App Router project with PostgreSQL/Prisma, Auth.js v5 credentials provider, isApproved gate, and admin approval UI.

**Architecture:** Next.js App Router + TypeScript strict. Auth.js v5 with custom credentials provider that checks isApproved flag. Prisma for DB. Tailwind + shadcn/ui with Japandi tokens.

**Tech Stack:** Next.js 14, TypeScript strict, Prisma, Auth.js v5 (beta), Tailwind CSS, shadcn/ui, PostgreSQL, bcryptjs, Docker Compose

---

## Task 1: Initialize Next.js project

**Objective:** Create Next.js 14 App Router project with TypeScript strict and Tailwind.

**Files:**
- Create: `/home/andryan/recipe-app/` (project root — scaffold into existing dir)

**Steps:**

1. Run from `/home/andryan/recipe-app/`:
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --yes
```

2. Verify: `package.json` exists with next 14.x, `app/` dir created.

3. Install core deps:
```bash
npm install @auth/prisma-adapter@^1 next-auth@beta @prisma/client@^5 bcryptjs
npm install -D prisma@^5 @types/bcryptjs
```

4. Install shadcn/ui:
```bash
npx shadcn@latest init --yes
```
When prompted, select: Default style, Neutral base color, yes to CSS variables.

5. Install shadcn components:
```bash
npx shadcn@latest add button card dialog dropdown-menu avatar badge tabs sheet
```

6. Verify build: `npx tsc --noEmit` — 0 errors.

**Commit:**
```bash
git init
git add -A
git commit -m "feat: init Next.js 14 App Router project"
```

---

## Task 2: Configure Tailwind with Japandi tokens

**Objective:** Apply Japandi palette to tailwind.config.ts and globals.css.

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

**Step 1: Update tailwind.config.ts**

Replace the colors section:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

**Step 2: Update app/globals.css** with Japandi CSS variables:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Japandi — warm beige, muted neutrals */
    --background: 34 25% 94%;        /* #F5F0EB warm beige */
    --foreground: 20 9% 15%;         /* #292524 stone-800 */
    --card: 0 0% 100%;               /* #FFFFFF white surface */
    --card-foreground: 20 9% 15%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 9% 15%;
    --primary: 33 27% 54%;           /* #A8956A warm sand */
    --primary-foreground: 0 0% 100%;
    --secondary: 30 14% 43%;         /* #78695A muted brown */
    --secondary-foreground: 0 0% 100%;
    --muted: 32 18% 90%;             /* #EDE8E3 alt beige */
    --muted-foreground: 25 9% 45%;   /* #78716C stone-500 */
    --accent: 32 18% 90%;
    --accent-foreground: 20 9% 15%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 33 17% 82%;            /* #D6CEC4 warm border */
    --input: 33 17% 82%;
    --ring: 33 27% 54%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 20 9% 11%;         /* stone-900 */
    --foreground: 33 25% 90%;
    --card: 20 9% 14%;
    --card-foreground: 33 25% 90%;
    --popover: 20 9% 14%;
    --popover-foreground: 33 25% 90%;
    --primary: 33 27% 54%;
    --primary-foreground: 0 0% 100%;
    --secondary: 20 9% 22%;
    --secondary-foreground: 33 25% 90%;
    --muted: 20 9% 20%;
    --muted-foreground: 25 9% 55%;
    --accent: 20 9% 20%;
    --accent-foreground: 33 25% 90%;
    --destructive: 0 62% 50%;
    --destructive-foreground: 0 0% 100%;
    --border: 20 9% 22%;
    --input: 20 9% 22%;
    --ring: 33 27% 54%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

**Step 3:** `npx tsc --noEmit` — 0 errors.

**Commit:**
```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: apply Japandi design tokens to Tailwind"
```

---

## Task 3: Prisma schema + initial migration

**Objective:** Define User, Recipe, MealPlan models. Run initial migration.

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env` (do not commit)

**Step 1: Create .env** (not committed):
```
DATABASE_URL="postgresql://recipe_user:recipe_pass@localhost:5432/recipe_db"
NEXTAUTH_SECRET="replace-with-strong-secret-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
UPLOAD_DIR="/home/andryan/recipe-app/public/uploads"
```

**Step 2: Create prisma/schema.prisma**:
```prisma
// This is your Prisma schema file

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum MealCategory {
  BREAKFAST
  LUNCH
  DINNER
}

model User {
  id         String     @id @default(cuid())
  email      String     @unique
  password   String
  name       String
  role       Role       @default(USER)
  isApproved Boolean    @default(false)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  recipes    Recipe[]
  mealPlans  MealPlan[]

  @@map("users")
}

model Recipe {
  id          String       @id @default(cuid())
  title       String
  description String?
  category    MealCategory
  photoUrl    String?
  steps       Json         @default("[]")
  authorId    String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  author    User       @relation(fields: [authorId], references: [id], onDelete: Cascade)
  mealPlans MealPlan[]

  @@map("recipes")
}

model MealPlan {
  id        String       @id @default(cuid())
  userId    String
  date      DateTime     @db.Date
  mealType  MealCategory
  recipeId  String
  createdAt DateTime     @default(now())

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([userId, date, mealType])
  @@map("meal_plans")
}
```

**Step 3:** Run migration (requires PostgreSQL running):
```bash
npx prisma migrate dev --name init
npx prisma generate
```

**Step 4:** Verify: `npx prisma studio` opens, shows User/Recipe/MealPlan tables.

**Commit:**
```bash
git add prisma/schema.prisma
git commit -m "feat: add Prisma schema — User, Recipe, MealPlan"
```

Note: `.env` is gitignored — do NOT commit it.

---

## Task 4: Prisma client singleton + lib utilities

**Objective:** Create lib/prisma.ts singleton and lib/utils.ts.

**Files:**
- Create: `lib/prisma.ts`
- Create: `lib/utils.ts` (if not already created by shadcn)

**Step 1: Create lib/prisma.ts**:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 2:** Check if `lib/utils.ts` exists (shadcn creates it). If not, create:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3:** `npx tsc --noEmit` — 0 errors.

**Commit:**
```bash
git add lib/
git commit -m "feat: add Prisma singleton and lib utilities"
```

---

## Task 5: Auth.js v5 configuration

**Objective:** Configure Auth.js v5 with credentials provider + isApproved check.

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`

**Step 1: Create lib/auth.ts**:
```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) return null;

        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) return null;

        if (!user.isApproved) {
          // Throw to send specific error message back
          throw new Error("ACCOUNT_PENDING_APPROVAL");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isApproved: user.isApproved,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.isApproved = (user as any).isApproved;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).isApproved = token.isApproved;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

**Step 2: Create app/api/auth/[...nextauth]/route.ts**:
```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

**Step 3: Create middleware.ts** at project root:
```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req as any;
  const isLoggedIn = !!session;
  const isApproved = session?.user?.isApproved;
  const isAdmin = session?.user?.role === "ADMIN";

  const isAuthRoute = nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/register");
  const isAppRoute = nextUrl.pathname.startsWith("/app") ||
    nextUrl.pathname.startsWith("/recipes") ||
    nextUrl.pathname.startsWith("/planner");
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Protect app routes
  if (isAppRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Protect admin routes
  if (isAdminRoute && (!isLoggedIn || !isAdmin)) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|uploads).*)"],
};
```

**Step 4:** Extend NextAuth types. Create `types/next-auth.d.ts`:
```typescript
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      isApproved: boolean;
    } & DefaultSession["user"];
  }
}
```

**Step 5:** `npx tsc --noEmit` — 0 errors.

**Commit:**
```bash
git add lib/auth.ts app/api/auth/ middleware.ts types/
git commit -m "feat: Auth.js v5 credentials provider with isApproved gate"
```

---

## Task 6: Register API route

**Objective:** POST /api/auth/register — create user with isApproved=false.

**Files:**
- Create: `app/api/auth/register/route.ts`

**Step 1: Create route**:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { data: null, error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hashed, isApproved: false },
      select: { id: true, email: true, name: true, isApproved: true, createdAt: true },
    });

    return NextResponse.json({ data: user, error: null }, { status: 201 });
  } catch (error) {
    console.error("[register] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

Note: Install zod: `npm install zod`

**Step 2:** `npx tsc --noEmit` — 0 errors.

**Commit:**
```bash
git add app/api/auth/register/
git commit -m "feat: register API route with bcrypt and isApproved=false"
```

---

## Task 7: Login and Register pages (UI)

**Objective:** Build /login and /register pages with Japandi styling.

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/pending/page.tsx`

**Step 1: Create app/(auth)/layout.tsx** — centered auth layout:
```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-wide">
            🍽 Recipe Book
          </h1>
          <p className="text-muted-foreground text-sm mt-1">family recipes, curated</p>
        </div>
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Create app/(auth)/login/page.tsx**:
```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error === "ACCOUNT_PENDING_APPROVAL") {
      router.push("/pending");
      return;
    }

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Enter your credentials to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          No account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

Also install shadcn Input and Label:
```bash
npx shadcn@latest add input label
```

**Step 3: Create app/(auth)/register/page.tsx** — similar structure, calls `/api/auth/register`.

**Step 4: Create app/(auth)/pending/page.tsx** — shows "awaiting admin approval" message.

**Step 5:** `npx tsc --noEmit` — 0 errors.

**Commit:**
```bash
git add app/\(auth\)/
git commit -m "feat: login, register, pending approval pages"
```

---

## Task 8: SidebarLayout + root page

**Objective:** Main app layout with sidebar (desktop) / bottom nav (mobile), protected dashboard page.

**Files:**
- Create: `components/layout/SidebarLayout.tsx`
- Create: `components/layout/BottomNav.tsx`
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/page.tsx`
- Modify: `app/layout.tsx`

**Step 1: Create components/layout/SidebarLayout.tsx** — sidebar with nav links, responsive.

**Step 2: Create app/(app)/layout.tsx** — wrap with SidebarLayout, SessionProvider.

**Step 3: Create app/(app)/page.tsx** — Dashboard with "welcome" message, quick stats placeholder.

**Step 4:** `npx tsc --noEmit` — 0 errors.

**Commit:**
```bash
git add components/layout/ app/\(app\)/
git commit -m "feat: SidebarLayout, bottom nav, dashboard shell"
```

---

## Task 9: Admin user approval UI

**Objective:** Admin can list pending users and approve/reject them.

**Files:**
- Create: `app/api/admin/users/route.ts` — GET list, PATCH approve/reject
- Create: `app/(app)/admin/users/page.tsx` — approval table

**Step 1: Create app/api/admin/users/route.ts**:
```typescript
// GET /api/admin/users?status=pending|approved|all
// PATCH /api/admin/users — { userId, action: "approve" | "reject" }
// Auth: session.user.role === "ADMIN" required
```

**Step 2:** Admin users page with table of pending registrations, Approve / Reject buttons.

**Step 3:** `npx tsc --noEmit` — 0 errors.

**Commit:**
```bash
git add app/api/admin/ app/\(app\)/admin/
git commit -m "feat: admin user approval API + UI"
```

---

## Task 10: Seed admin user

**Objective:** Create prisma/seed.ts to seed initial admin user.

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add prisma.seed)

**Step 1: Create prisma/seed.ts**:
```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log("Admin already exists:", adminEmail);
    return;
  }

  const hashed = await bcrypt.hash(adminPassword, 12);
  await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashed,
      name: "Admin",
      role: "ADMIN",
      isApproved: true,
    },
  });

  console.log("Admin user seeded:", adminEmail);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: Add to package.json**:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Or use `tsx`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```
Install: `npm install -D tsx`

**Step 3:** Run seed: `npx prisma db seed`

**Commit:**
```bash
git add prisma/seed.ts package.json
git commit -m "feat: seed admin user via prisma/seed.ts"
```

---

## Phase 1 Done — Verification Checklist

- [ ] `npm run build` — 0 errors
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] Register page creates user with isApproved=false
- [ ] Login with unapproved user → redirects to /pending
- [ ] Login with approved user → enters app
- [ ] Admin can approve/reject users at /admin/users
- [ ] Middleware blocks /app routes when unauthenticated
- [ ] Middleware blocks /admin routes for non-admin users
- [ ] Dark mode toggle works (class-based)
- [ ] Japandi palette visible throughout

## Notes

- PostgreSQL must be running before migrations. Use Docker: `docker run -e POSTGRES_USER=recipe_user -e POSTGRES_PASSWORD=recipe_pass -e POSTGRES_DB=recipe_db -p 5432:5432 -d postgres:16`
- Auth.js v5 is beta — use `next-auth@beta` exactly
- Never log or return password field from any API response
- All API responses shape: `{ data, error }`
