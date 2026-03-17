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
- 45 server action files (23 hardened), 71 Prisma models, 26 enums

## Recent Sessions (last 3)

- **2026-03-16 ~Late Night (3):** Fixed broken edit/delete on announcements page — modals used nonexistent Tailwind classes. Full CSS Modules redesign with white cards, icon buttons, acknowledgment badges.
- **2026-03-16 ~Late Night (2):** Split ConfirmationsClient.tsx (2865→1931 lines) — extracted TripsToolbar, TripsTable, and shared utils into sub-components with CSS Modules (phase 1/2)
- **2026-03-16 ~Late Night:** Fixed scheduler grid day labels off by one — display used local `.getDate()` on UTC dates

## In Progress

**ConfirmationsClient.tsx Split (Phase 2):**
- 3 remaining sub-components to extract: AnalyticsTab, DispatchersTab, AccountabilityTab
- Parent still at 1931 lines — target ~200 lines after phase 2
- CSS for overview/dispatchers/accountability/modal tabs still in parent's `<style jsx>`

**Server Action Hardening:**
- 23 of 45 server action files hardened — remaining 22 need review

**Dispatcher Confirmations Page:**
- Nav item added pointing to /confirmations — page needs to be created

**Twilio SMS Real-time (TODO-TWILIO-SETUP.md):**
- Enable Supabase replication for SMSLog table
- Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env
- Production: remove TWILIO_SKIP_SIGNATURE_VALIDATION
- A2P 10DLC registration for US compliance

## Known Issues

1. SMS real-time not working until Supabase replication enabled
2. Route Pricing ~158K rows — always paginate, no SELECT *
3. ShiftReportForm.tsx ~100KB — edit subcomponents in src/components/shift-report/
4. TripConfirmation queries need status + dueAt index
5. SMSLog has no isRead field — badge uses inbound count from last 24h
6. Dispatcher /confirmations page doesn't exist (nav item added)
7. Some pages still use global utility classes (flex, glass-card) — check modals work

## Next Session

1. **ConfirmationsClient phase 2** — extract AnalyticsTab, DispatchersTab, AccountabilityTab sub-components
2. Continue server action hardening — remaining 22 files
3. Create dispatcher /confirmations page
4. Audit other pages for Tailwind-style modal classes that may be broken (same root cause as notes)
5. Complete Twilio production setup per TODO-TWILIO-SETUP.md

## Key Decisions

- CSS Modules only — no Tailwind. Modals MUST use CSS Modules with explicit `position: fixed`
- Server actions for CRUD — API routes only for webhooks/external
- `npm run db:push` — no migrations
- Client components use *Client.tsx suffix
- All server actions return `{ success: boolean, data?: T, error?: string }`
- Navigation config lives in src/config/navigation.ts (data-driven)
- Badge counts poll every 60s for ADMIN/SUPER_ADMIN
- ACCOUNTING role can access /admin/pricing and /admin/affiliate-audit
- Scheduler display must use UTC methods since date arithmetic is UTC-based
- Component splits: sub-components use CSS Modules, format helpers take `now` as param
- SESSION-LOG.md is append-only (newest at top), PRIMER.md summarizes last 3
- Run /session-end at end of each session
