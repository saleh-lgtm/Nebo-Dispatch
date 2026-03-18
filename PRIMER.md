# PRIMER.md — Nebo Dispatch Session Snapshot

## Current State

Production dispatch platform for Nebo Rides (Dallas, Austin, San Antonio).
Staff-only tool for dispatchers, admins, and accounting.

**Stack:** Next.js 16.1.6 + React 19 + Prisma 7 + Supabase PostgreSQL
**Deployment:** Vercel — deployed and operational

**Working Features:**
- Auth: NextAuth.js, 4 roles, JWT with tokenVersion for force-logout, 12h session expiry
- Dashboard with confirmation widget, shift clock, quotes, scheduling, handoff note banner
- SMS via Twilio, Fleet management, TBR Global scraping via n8n
- Confirmations: one-click confirm, smart sort, countdown timer, accountability scoring
- Shift reports: auto-tracked Twilio SMS/call metrics, quote follow-up actions, billing flags → tasks
- Accounting: flags + billing reviews auto-create BillingTasks with nav badge, auto-resolve on completion
- Handoff notes: submitted with shift report, displayed on next dispatcher's dashboard (12h expiry)
- Draft system: localStorage + database dual storage, meaningful change detection, persistent dismiss
- Data-driven sidebar navigation with role-based groups and badge counts (including billing tasks)
- Shared UI component library: ToggleGroup, TabBar (14/14 rolled out), PillSelector
- **46 server action files hardened**, 74 Prisma models, 27 enums

## Recent Sessions (last 3)

- **2026-03-17 ~Afternoon:** Shift report system enhancements — fixed draft popup persistence, added handoff notes to dashboard, auto-create billing tasks from flags/reviews, auto-populate Twilio call/SMS metrics, quote follow-up actions + source badge + live count.
- **2026-03-17 ~Post-Midnight (Late):** Completed server action hardening — final 11 files hardened, all 46 files done. Updated 30 callers.
- **2026-03-17 ~Post-Midnight:** Server action hardening — 5 more files (auditActions, billingReviewActions, shiftSwapActions, timeOffActions, userManagementActions). 30/45 done.

## In Progress

**Shared UI Component Rollout:**
- TabBar: fully rolled out (14/14 complete)
- ToggleGroup: adopted in 2 of 5 instances — 3 remaining
- PillSelector: adopted in 1 of 3 instances — 2 remaining

**ConfirmationsClient.tsx Split (Phase 2):**
- 3 sub-components to extract: AnalyticsTab, DispatchersTab, AccountabilityTab

## Known Issues

1. SMS real-time not working until Supabase replication enabled
2. Route Pricing ~158K rows — always paginate, no SELECT *
3. ShiftReportForm.tsx ~100KB — edit subcomponents in src/components/shift-report/
4. SMSLog has no isRead field — badge uses inbound count from last 24h
5. Dispatcher /confirmations page doesn't exist (nav item added)
6. Next.js 16 build has intermittent manifest file errors during finalization (TypeScript passes clean)
7. quoteActions.ts and tbrTripActions.ts re-export constants from "use server" files
8. CallLog model created but no Twilio Voice webhook yet — call metrics will be 0 until webhook is set up
9. Accounting page only shows AccountingFlags tab — BillingReviews have no dedicated tab yet

## Next Session

1. **Roll out ToggleGroup** — 3 remaining instances + PillSelector 2 remaining
2. **ConfirmationsClient phase 2** — extract AnalyticsTab, DispatchersTab, AccountabilityTab
3. **Add BillingReviews tab to accounting page** — data exists, needs UI tab alongside Flags
4. **Twilio Voice webhook** — set up /api/twilio/voice/webhook to populate CallLog model
5. **Fix re-export proxy files** — quoteActions.ts and tbrTripActions.ts export constants from "use server" files
6. Create dispatcher /confirmations page
7. Complete Twilio production setup per TODO-TWILIO-SETUP.md

## Key Decisions

- CSS Modules only — no Tailwind. Modals MUST use CSS Modules with explicit `position: fixed`
- Server actions for CRUD — API routes only for webhooks/external
- **"use server" files can ONLY export async functions** — constants/objects go in separate files
- All server actions return `{ success: boolean, data?: T, error?: string }`
- `npm run db:push` — no migrations. Client components use *Client.tsx suffix
- getShiftCommunicationMetrics() is the single Twilio integration point — swap to RingCentral here only
- BillingTask model bridges AccountingFlag/BillingReview → task notification system
- Draft dismiss uses localStorage (persistent). hasMeaningfulChanges() prevents phantom drafts
- Handoff notes: 12h expiry, sessionStorage dismiss. Auto Twilio metrics: frozen snapshot at submit
- Quote follow-up uses existing setQuoteOutcome/recordFollowUp actions from shift report form
- SESSION-LOG.md is append-only (newest at top), PRIMER.md summarizes last 3
