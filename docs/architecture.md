# Architecture

## Stack Decisions
| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | Next.js 14 App Router + TypeScript | Monorepo — frontend + API in one repo, LLM-friendly |
| Database | PostgreSQL | Production-grade, Prisma support |
| ORM | Prisma | Type-safe queries, migrations, Prisma Studio |
| Auth | Auth.js v5 credentials | Local DB auth, isApproved extension point |
| UI | Tailwind + shadcn/ui | Utility classes in component — no context switching between .css files |
| Calendar | FullCalendar | Mature, React-compatible, week view built-in |
| Upload | Local filesystem | Simple local-first; migrate to S3/R2 when going public |
| Deploy | Docker Compose + Nginx | Portable — local now, VPS later with same config |
| TLS | Certbot DNS-01 | No need to expose port 80/443 on home router during local phase |

## Prisma Schema

```prisma
model User {
  id         String    @id @default(cuid())
  email      String    @unique
  password   String    // bcrypt hash, saltRounds=12
  name       String
  role       Role      @default(USER)
  isApproved Boolean   @default(false)
  createdAt  DateTime  @default(now())
  recipes    Recipe[]
  mealPlans  MealPlan[]
}

model Recipe {
  id          String    @id @default(cuid())
  title       String
  description String?
  category    Category
  photoUrl    String?
  steps       Json      // array of { order: number, instruction: string }
  authorId    String
  author      User      @relation(fields: [authorId], references: [id])
  createdAt   DateTime  @default(now())
  mealPlans   MealPlan[]
}

model MealPlan {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  date      DateTime
  mealType  MealType
  recipeId  String?
  recipe    Recipe?   @relation(fields: [recipeId], references: [id])
  note      String?   // free-text if no recipe selected
  @@unique([userId, date, mealType])
}

enum Role     { USER ADMIN }
enum Category { BREAKFAST LUNCH DINNER }
enum MealType { BREAKFAST LUNCH DINNER }
```

## Auth Flow
1. POST /api/auth/register → create User (isApproved=false)
2. Admin GET /api/admin/users?status=pending → list unapproved
3. Admin PATCH /api/admin/users/[id]/approve → isApproved=true
4. POST /api/auth/signin → Auth.js credentials → check password + isApproved
5. middleware.ts → all /(app)/* routes require session + isApproved=true
6. /admin/* routes require session + role=ADMIN

## Migration Path (local → public VPS)
1. Spin up VPS (DigitalOcean/Hetzner/etc)
2. `git clone` repo
3. Copy .env with prod values
4. `docker compose up -d`
5. Point domain DNS A record to VPS IP
6. Certbot DNS-01 cert already exists — just update NEXTAUTH_URL
