# CLAUDE.md — Claude Code Context

Mirrors AGENTS.md with Claude Code CLI-specific notes. Read AGENTS.md first for full context.

## Quick Orient
- Project: private family recipe webapp
- Stack: Next.js 14 App Router + TypeScript + PostgreSQL + Prisma + Auth.js v5 + Tailwind + shadcn/ui
- Root: /home/andryan/recipe-app/
- Current phase: see progress.md

## Claude Code Conventions
- Always read the target file before editing
- Run `npx tsc --noEmit` after any TypeScript change — fix all errors before committing
- Run `npm test` after any logic change — tests must pass
- Never use `// TODO` or placeholder comments in final code — complete implementations only
- Do not introduce new npm packages without checking package.json first and flagging the addition

## Auth Rules (critical)
- isApproved=true must be checked at BOTH session creation and per-route middleware
- Admin routes: role=ADMIN check in addition to isApproved
- Passwords: bcrypt saltRounds=12, never log, never return in API responses
- Session secret: read from process.env.NEXTAUTH_SECRET only

## File Upload Rules
- Accept: image/jpeg, image/png, image/webp only — validate MIME server-side
- Max: 5MB
- Store: /uploads/<uuid>.<ext> (UPLOAD_DIR env var)
- Never trust client-provided MIME type

## After Any Feature
1. Update docs/api-contracts.md if routes changed
2. Update docs/architecture.md if schema changed
3. Add entry to CHANGELOG.md
4. Update progress.md status

## Full Context
See AGENTS.md for complete stack, schema, auth flow, directory structure, conventions, and build phases.
