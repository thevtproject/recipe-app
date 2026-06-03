# Design System — Warm Kitchen / Editorial

## Aesthetic
Warm, editorial, food-forward. Clean but not sterile.

## Color Tokens — Japandi (LOCKED)

Warm beige, muted neutrals, minimal. Stone palette.

```css
--color-bg:        #F5F0EB  /* warm beige */
--color-bg-alt:    #EDE8E3  /* slightly deeper beige for cards */
--color-bg-dark:   #1C1917  /* stone-900 */
--color-surface:   #FFFFFF  /* card surface (light mode) */
--color-accent:    #A8956A  /* warm sand / light caramel */
--color-accent-2:  #78695A  /* muted brown-gray */
--color-text:      #292524  /* stone-800 */
--color-text-muted:#78716C  /* stone-500 */
--color-border:    #D6CEC4  /* warm gray border */
```

Tailwind mapping:
- bg: `stone-50` / custom `#F5F0EB`
- accent: `stone-400` (#A8B5A0 → override to `#A8956A`)
- text: `stone-800`, muted: `stone-500`
- dark bg: `stone-900`, surface: `stone-800`

## Dark Mode
- Strategy: class-based (`dark:` prefix via Tailwind)
- Toggle: user preference stored in localStorage + system default via `prefers-color-scheme`

## shadcn/ui Components (install in Phase 1)
- Card — recipe cards, planner slots
- Dialog — recipe picker modal, add recipe form
- Button — all CTAs
- DropdownMenu — category filter, user menu
- Avatar — user profile
- Badge — meal type labels (BREAKFAST / LUNCH / DINNER)
- Tabs — recipe category filter
- Sheet — mobile sidebar

## Layout: SidebarLayout
```
Desktop:                    Mobile (bottom nav):
┌──────┬────────────────┐   ┌────────────────────┐
│      │                │   │                    │
│ Side │   Main         │   │   Main Content     │
│ bar  │   Content      │   │                    │
│      │                │   ├────────────────────┤
└──────┴────────────────┘   │ 🏠 📖 📅 👤       │
                             └────────────────────┘
```

Sidebar links:
- Dashboard (/)
- Recipe Book (/recipes)
- Weekly Planner (/planner)
- Admin Panel (/admin) — visible only if role=ADMIN
- User profile + Logout

## Typography
- Font: system-ui or Geist (Next.js default)
- Recipe titles: larger, serif optional for editorial feel
- Body: clean sans-serif, readable line-height (1.6)

## Recipe Card
- Food photo (aspect-ratio: 4/3, object-cover)
- Category badge (BREAKFAST/LUNCH/DINNER)
- Title, short description
- Hover: subtle lift (shadow + translate-y)
