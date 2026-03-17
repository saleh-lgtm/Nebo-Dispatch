# PRIMER.md — Nebo Dispatch Session Snapshot

## Current State

Production dispatch platform for Nebo Rides (Dallas, Austin, San Antonio).
Staff-only tool for dispatchers, admins, and accounting.

**Stack:** Next.js 16.1.6 + React 19 + Prisma 7 + Supabase PostgreSQL
**Deployment:** Vercel — deployed and operational

**Working Features:**
- Auth: NextAuth.js, 4 roles, JWT with tokenVersion for force-logout, 12h session expiry
- Dashboard with one-click confirmation widget, shift clock, quotes, scheduling
- SMS via Twilio, Fleet management, TBR Global scraping via n8n
- Confirmations: one-click confirm, smart sort, countdown timer, auto-refresh, accountability scoring
- Manifest ingestion via Cloudflare email worker
- Accounting flags, billing review, company announcements
- Data-driven sidebar navigation with role-based groups and badge counts
- Shared UI component library: ToggleGroup, TabBar (14/14 rolled out), PillSelector
- Admin user management with force-logout capability
- Dispatcher accountability: score on User model, -1 per missed confirmation, notifications
- 46 server action files (25 hardened), 72 Prisma models, 27 enums

## Recent Sessions (last 3)

- **2026-03-17 ~Late Night:** Server action hardening — hardened accountingActions, adminRequestActions, affiliateActions, clockActions, scheduleTemplateActions. Added 14 Zod schemas. Updated all callers. 25/45 files now hardened.
- **2026-03-17 ~Night:** Fixed dashboard confirmation widget — scoped query to 24h/limit 10, replaced modal with one-click CSS Modules widget, added accountabilityScore to User + point deductions + MISSED_CONFIRMATION notifications on expiry.
- **2026-03-17 ~Evening:** Added force-logout via tokenVersion + 12h session expiry. Fixed 4 production bugs: pre-existing sessions without tokenVersion, empty session crash, unprotected JWT DB query, non-function exports in "use server" files.

## In Progress

**Shared UI Component Rollout:**
- TabBar: fully rolled out (14/14 complete)
- ToggleGroup: adopted in 2 of 5 instances
- PillSelector: adopted in 1 of 3 instances

**ConfirmationsClient.tsx Split (Phase 2):**
- 3 sub-components to extract: AnalyticsTab, DispatchersTab, AccountabilityTab

**Server Action Hardening:**
- 25 of 46 server action files hardened — remaining 21 need review

## Known Issues

1. SMS real-time not working until Supabase replication enabled
2. Route Pricing ~158K rows — always paginate, no SELECT *
3. ShiftReportForm.tsx ~100KB — edit subcomponents in src/components/shift-report/
4. SMSLog has no isRead field — badge uses inbound count from last 24h
5. Dispatcher /confirmations page doesn't exist (nav item added)
6. Next.js 16 build has intermittent manifest file errors during finalization (TypeScript passes clean)

## Next Session

1. **Continue server action hardening** — 21 remaining files
2. **Roll out ToggleGroup** — 3 remaining instances + PillSelector 2 remaining
3. **ConfirmationsClient phase 2** — extract AnalyticsTab, DispatchersTab, AccountabilityTab
4. **Audit all "use server" files** — verify no remaining non-function exports
5. Create dispatcher /confirmations page
6. Complete Twilio production setup per TODO-TWILIO-SETUP.md
7. Investigate Next.js 16 build manifest errors

## Key Decisions

- CSS Modules only — no Tailwind. Modals MUST use CSS Modules with explicit `position: fixed`
- Server actions for CRUD — API routes only for webhooks/external
- **"use server" files can ONLY export async functions** — constants/objects go in separate files
- `npm run db:push` — no migrations
- Client components use *Client.tsx suffix
- All server actions return `{ success: boolean, data?: T, error?: string }`
- Force-logout: set JWT `exp: 0` so `getServerSession()` returns null
- JWT tokenVersion checked every 5 min with try/catch (fail-open on DB errors)
- Session maxAge: 12 hours
- Dashboard confirmation widget: one-click (no modal), notes field removed for speed
- accountabilityScore on User model, floors at 0, MissedConfirmationAccountability is source of truth
- Shared UI: ToggleGroup, TabBar (pill/underline tabs), PillSelector (chip filters)
- SESSION-LOG.md is append-only (newest at top), PRIMER.md summarizes last 3
