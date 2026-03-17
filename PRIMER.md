# PRIMER.md — Nebo Dispatch Session Snapshot

## Current State

Production dispatch platform for Nebo Rides (Dallas, Austin, San Antonio).
Staff-only tool for dispatchers, admins, and accounting.

**Stack:** Next.js 16.1.6 + React 19 + Prisma 7 + Supabase PostgreSQL
**Deployment:** Vercel — deployed and operational

**Working Features:**
- Auth: NextAuth.js, 4 roles, JWT with tokenVersion for force-logout, 12h session expiry
- Dashboard, shift clock, quotes, scheduling (timezone-free redesign complete)
- SMS via Twilio, Fleet management, TBR Global scraping via n8n
- Confirmations (Phase 1: one-click confirm, smart sort, countdown timer, auto-refresh)
- Manifest ingestion via Cloudflare email worker
- Accounting flags, billing review, company announcements (redesigned)
- Data-driven sidebar navigation with role-based groups and badge counts
- Shared UI component library: ToggleGroup, TabBar (14/14 rolled out), PillSelector
- Admin user management with force-logout capability
- 46 server action files (23 hardened), 71 Prisma models, 26 enums

## Recent Sessions (last 3)

- **2026-03-17 ~Evening:** Added force-logout via tokenVersion + 12h session expiry. Fixed 4 production bugs: pre-existing sessions without tokenVersion, empty session crash, unprotected JWT DB query, and non-function exports in "use server" files.
- **2026-03-17 ~Afternoon:** Rolled out ToggleGroup to MobileSchedulerClient — replaced 3 manual toggles. Both scheduler views now use shared components.
- **2026-03-16 ~Late Night (5):** Built 3 shared UI components (ToggleGroup, TabBar, PillSelector). Converted 5 loading skeletons from Tailwind. Added Zod validation to 3 API routes.

## In Progress

**Shared UI Component Rollout:**
- TabBar: fully rolled out (14/14 complete)
- ToggleGroup: adopted in 2 of 5 instances
- PillSelector: adopted in 1 of 3 instances

**ConfirmationsClient.tsx Split (Phase 2):**
- 3 sub-components to extract: AnalyticsTab, DispatchersTab, AccountabilityTab

**Server Action Hardening:**
- 23 of 46 server action files hardened — remaining 23 need review

## Known Issues

1. SMS real-time not working until Supabase replication enabled
2. Route Pricing ~158K rows — always paginate, no SELECT *
3. ShiftReportForm.tsx ~100KB — edit subcomponents in src/components/shift-report/
4. TripConfirmation queries need status + dueAt index
5. SMSLog has no isRead field — badge uses inbound count from last 24h
6. Dispatcher /confirmations page doesn't exist (nav item added)

## Next Session

1. **Audit all "use server" files** — verify no remaining non-function exports (grep for `export const|let|enum` in *Actions.ts files)
2. **Roll out ToggleGroup** — 3 remaining instances + PillSelector 2 remaining
3. **ConfirmationsClient phase 2** — extract AnalyticsTab, DispatchersTab, AccountabilityTab
4. Continue server action hardening — remaining 23 files
5. Create dispatcher /confirmations page
6. Complete Twilio production setup per TODO-TWILIO-SETUP.md

## Key Decisions

- CSS Modules only — no Tailwind. Modals MUST use CSS Modules with explicit `position: fixed`
- Server actions for CRUD — API routes only for webhooks/external
- **"use server" files can ONLY export async functions** — constants/objects go in separate files
- `npm run db:push` — no migrations
- Client components use *Client.tsx suffix
- All server actions return `{ success: boolean, data?: T, error?: string }`
- Force-logout: set JWT `exp: 0` so `getServerSession()` returns null — never return empty sessions
- JWT tokenVersion checked every 5 min with try/catch (fail-open on DB errors)
- Pre-existing JWTs without tokenVersion default to 0 (matches DB default)
- Session maxAge: 12 hours — prevents multi-day stale sessions
- Shared UI: ToggleGroup (toggle buttons), TabBar (pill/underline tabs), PillSelector (chip filters)
- SESSION-LOG.md is append-only (newest at top), PRIMER.md summarizes last 3
