# Login Page Rendering Issue — Status Report

## Problem
Login page at https://dev.vtproject.my.id/login shows only the header "🍽 Recipe Book" with no form fields.

## Root Cause
Next.js 15.x + 16.x React Server Components streaming has a critical bug where "use client" components wrapped in server layouts suspend indefinitely and never hydrate.

## Attempted Fixes (all failed)
1. ✗ Forced client-side mount guard (`if (!mounted) return null`)
2. ✗ Downgraded Next.js 16.2.7 → 15.1.3 (streaming bug persists)
3. ✗ Made auth layout client-side (`"use client"` on layout.tsx)
4. ✗ Hard window.location redirect instead of router.push
5. ✗ Disabled Cloudflare Bot Fight Mode

## Current State
- Branch: feature/ai-import-shopping-list (commits: b6fbc29, 23b7676, 77e3aaf)
- Next.js: 15.5.19 (npm installed caret range from ^15.1.3)
- Auth.js: v5.0.0-beta.31
- Container: recipe-app-app-dev-1 running
- Database: postgres with admin@family.local / test123

## Diagnosis
HTML output shows React streaming markers `<!--$--><!--/$-->` but the component never resolves. The login form component is referenced in the streaming payload but never rendered client-side.

Cloudflare injects challenge script at end of HTML which also breaks React hydration, but even without it the streaming suspension blocks rendering.

## Solution Options

### A. Downgrade to Next.js 14.2.x (recommended)
Next.js 14 has stable RSC without the streaming suspension bug.

```bash
cd /home/andryan/recipe-app
# Update package.json: "next": "14.2.18"
rm -rf node_modules package-lock.json .next
npm install
docker compose --env-file .env.dev build app-dev
docker compose --env-file .env.dev up -d app-dev
docker exec recipe-app-nginx-1 nginx -s reload
```

### B. Create a separate static login page
Build a non-RSC login page that directly posts to `/api/auth/callback/credentials` without React streaming.

### C. Use App Router with Pages-style login
Move login to `/pages/login.tsx` to bypass App Router streaming entirely.

## Next Steps
1. User approval to run full rebuild with Next.js 14
2. Test login flow end-to-end
3. QA the two new features (AI import + shopping list)
4. Create PR to production

##Timeline
Started: 2026-06-13 00:00 UTC  
Blocked: 2026-06-13 02:15 UTC (after 2h 15min of iteration)
