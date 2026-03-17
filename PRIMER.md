# PRIMER.md — Nebo Dispatch Session Snapshot

## Current State

Production dispatch platform for Nebo Rides (Dallas, Austin, San Antonio).
Staff-only tool for dispatchers, admins, and accounting.

**Stack:** Next.js 16.1.6 + React 19 + Prisma 7 + Supabase PostgreSQL
**Deployment:** Vercel — deployed and operational

**Working Features:**
- Auth: NextAuth.js, 4 roles (SUPER_ADMIN, ADMIN, ACCOUNTING, DISPATCHER)
- Dashboard, shift clock, quotes, scheduling (timezone-free redesign complete)
- SMS via Twilio, Fleet management, TBR Global scraping via n8n
- Confirmations, manifest ingestion via Cloudflare email worker
- Accounting flags, billing review, company announcements (redesigned)
- Data-driven sidebar navigation with role-based groups and badge counts
- Shared UI component library: ToggleGroup, TabBar, PillSelector
- 45 server action files (23 hardened), 71 Prisma models, 26 enums

## Recent Sessions (last 3)

- **2026-03-17 ~Afternoon:** Rolled out ToggleGroup to MobileSchedulerClient — replaced 3 manual toggles (shift type, duration, market). Both scheduler views now use shared components.
- **2026-03-16 ~Late Night (5):** Built 3 shared UI components (ToggleGroup, TabBar, PillSelector) with CSS Modules. Converted 5 loading skeletons from Tailwind. Added Zod validation to 3 API routes.
- **2026-03-16 ~Late Night (4):** Converted RequestsClient.tsx from Tailwind to CSS Modules. Fixed push-to-la auth for browser calls.

## In Progress

**Shared UI Component Rollout:**
- ToggleGroup adopted in: CommandSchedulerClient, MobileSchedulerClient (2 of 5 toggle instances)
- TabBar adopted in: ConfirmationsClient (1 of 14 tab instances)
- PillSelector adopted in: PortalsClient (1 of 3 pill instances)
- ~21 remaining instances across ~17 files — see SESSION-LOG session 5 for full audit

**ConfirmationsClient.tsx Split (Phase 2):**
- 3 remaining sub-components to extract: AnalyticsTab, DispatchersTab, AccountabilityTab
- Parent still at ~1900 lines — target ~200 lines after phase 2

**Server Action Hardening:**
- 23 of 45 server action files hardened — remaining 22 need review

## Known Issues

1. SMS real-time not working until Supabase replication enabled
2. Route Pricing ~158K rows — always paginate, no SELECT *
3. ShiftReportForm.tsx ~100KB — edit subcomponents in src/components/shift-report/
4. TripConfirmation queries need status + dueAt index
5. SMSLog has no isRead field — badge uses inbound count from last 24h
6. Dispatcher /confirmations page doesn't exist (nav item added)

## Next Session

1. **Roll out TabBar** — 13 remaining tab navigations across the app (do 5 at a time, run /check after each batch)
2. **Roll out ToggleGroup** — 3 remaining toggle instances + PillSelector 2 remaining
3. **ConfirmationsClient phase 2** — extract AnalyticsTab, DispatchersTab, AccountabilityTab
4. Continue server action hardening — remaining 22 files
5. Create dispatcher /confirmations page
6. Complete Twilio production setup per TODO-TWILIO-SETUP.md

## Key Decisions

- CSS Modules only — no Tailwind. Modals MUST use CSS Modules with explicit `position: fixed`
- Server actions for CRUD — API routes only for webhooks/external
- `npm run db:push` — no migrations
- Client components use *Client.tsx suffix
- All server actions return `{ success: boolean, data?: T, error?: string }`
- Navigation config lives in src/config/navigation.ts (data-driven)
- Badge counts poll every 60s for ADMIN/SUPER_ADMIN
- push-to-la accepts 3 auth methods: session cookie, header secret, Basic Auth
- Scheduler display must use UTC methods since date arithmetic is UTC-based
- Component splits: sub-components use CSS Modules, format helpers take `now` as param
- Shared UI: ToggleGroup (toggle buttons), TabBar (pill/underline tabs), PillSelector (chip filters)
- ToggleGroup duration picker uses string↔number conversion (values are always strings)
- SESSION-LOG.md is append-only (newest at top), PRIMER.md summarizes last 3
