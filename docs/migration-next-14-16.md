# Next.js 14 → 16 Migration Plan

**Status:** Planned (not started)
**Target:** `next@16.2.7` + `react@19.2.7`
**Tracking:** Issue / PR to be created

---

## Why

13 known CVEs on 14.2.35 (cache poisoning, SSRF, DoS, XSS). 16.2.7 patches all.
Full audit: `SECURITY_AUDIT_2026-06-07.md` item H-1.

## Compatibility Check

| Dep | Current | Change? | Notes |
|-----|---------|---------|-------|
| next | 14.2.35 | ✅ → 16.2.7 | Major version jump |
| eslint-config-next | 14.2.35 | ✅ → 16.2.7 | Tied to Next version |
| react | ^18 | ✅ → ^19 | Required by Next 16 |
| react-dom | ^18 | ✅ → ^19 | Required by Next 16 |
| @types/react | ^18 | ✅ → ^19 | Match React version |
| @types/react-dom | ^18 | ✅ → ^19 | Match React version |
| next-auth | 5.0.0-beta.31 | ❌ No | Already supports next ^14-^16 + react ^18-^19 |
| @base-ui/react | ^1.5.0 | ❌ No | Supports react ^17-^19 |
| @fullcalendar/react | ~6.1.20 | ❌ No | Supports react ^16-^19 |
| lucide-react | ~0.479 | ❌ No | Supports react ^16-^19 |
| tailwindcss | ^3.4.1 | Optional | Can stay on v3, upgrade separately |
| Node (Docker) | 20-alpine | ❌ No | Node 20 sufficient for Next 16 |

## Migration Steps

### Step 1 — Bump dependencies

```diff
- "next": "14.2.35"
+ "next": "16.2.7"
- "eslint-config-next": "14.2.35"
+ "eslint-config-next": "16.2.7"
- "react": "^18"
+ "react": "^19.0.0"
- "react-dom": "^18"
+ "react-dom": "^19.0.0"
- "@types/react": "^18"
+ "@types/react": "^19.0.0"
- "@types/react-dom": "^18"
+ "@types/react-dom": "^19.0.0"
```

Then:
```bash
npm ci
npx @next/codemod@latest upgrade .
```

### Step 2 — Fix React 19 changes

- Check for deprecated lifecycle patterns
- `ref` as prop (React 19 makes `forwardRef` optional)
- `children` prop type changes
- Form `action` prop on `<form>` (new in React 19)

### Step 3 — Fix Next.js 16 changes

Verify it builds. Known already-compatible:
- `params: Promise<...>` pattern — already done ✅
- `searchParams: Promise<...>` — already done ✅
- No `cookies()`/`headers()` sync usage ✅
- `images.unoptimized: true` (disables Image Optimizer) ✅
- Middleware edge runtime (`auth.config.ts` has no Node deps) ✅

### Step 4 — Build & smoke test

```bash
npx tsc --noEmit
npm run build
docker compose build app
```

Test: login, recipes CRUD, cook mode, planner, household, admin panel.

## Risk items

| Risk | Mitigation |
|------|------------|
| next-auth v5 beta on Next 16 | peerDeps already allow it; test auth first |
| React 19 form/ref changes | Smoke test all forms (add recipe, edit, login, register) |
| Build time (~3-5 min) | Acceptable, dedicate one session |

## Rollback plan

```bash
git checkout package.json package-lock.json
docker compose build app
docker stop recipe-app-app-1 && docker rm recipe-app-app-1 && docker compose up -d app
```

## Effort

~1 hour if clean, ~half day if React 19 issues surface.
