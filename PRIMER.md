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
- Confirmations: one-click confirm, smart sort, countdown timer, accountability scoring, cross-dispatcher sync, 4-tab command center (Trips, Analytics, Dispatchers, Accountability — all extracted)
- Shift reports: auto-tracked Twilio SMS/call metrics, quote follow-up actions, billing flags → tasks
- Accounting: flags + billing reviews auto-create BillingTasks with nav badge
- Shared UI: ToggleGroup, TabBar, PillSelector — all fully rolled out
- **Unified Performance Dashboard** at /admin/scorecard — 3 tabs:
  - Scorecard: team leaderboard with 6 weighted categories, click-through to individual detail
  - Trends & Volume: daily activity trend (SMS/quotes/confirmations), dispatcher comparison top 8
  - Hours: scheduled/worked/overtime per dispatcher, efficiency table
- **Front Email Integration:** Live email metrics in scorecard. Admin settings at /admin/settings.
- /admin/analytics deleted — permanent 301 redirect to /admin/scorecard
- **75 Prisma models**, 27 enums, 47 server action files

## Recent Sessions (last 3)

- **2026-03-19 ~Early Morning:** Merged analytics + scorecard into unified 3-tab performance dashboard. Deleted analyticsActions.ts (ShiftReport-based), created trendsActions.ts (SMSLog/Quote/TripConfirmation-based). Built TrendsTabClient + HoursTabClient with Recharts charts. Added /admin/analytics → /admin/scorecard redirect. Confirmed confirmations Phase 2 already complete.
- **2026-03-18 ~Late Night (2):** Audited analytics + scorecard pages for merge. Decision: 3 tabs at /admin/scorecard, drop Engagement tab, kill ShiftReport-based metrics.
- **2026-03-18 ~Late Night:** Front email integration — FrontTeammateMapping model, email metrics in scorecard (6th category), admin settings page. Fixed 5 scorecard data bugs.

## In Progress

**Performance Dashboard (uncommitted):**
- 3-tab structure complete and functional. Needs build verification on Vercel and commit.
- EngagementLeaderboard component is orphaned after analytics deletion — decide: delete or relocate.

## Known Issues

1. SMS real-time not working until Supabase replication enabled
2. Route Pricing ~158K rows — always paginate, no SELECT *
3. ShiftReportForm.tsx ~100KB — edit subcomponents in src/components/shift-report/
4. SMSLog has no isRead field — badge uses inbound count from last 24h
5. Dispatcher /confirmations page doesn't exist (nav item added)
6. Next.js 16 build has intermittent manifest file errors during finalization
7. quoteActions.ts and tbrTripActions.ts re-export constants from "use server" files
8. CallLog model created but no Twilio Voice webhook yet — call metrics will be 0
9. Accounting page only shows AccountingFlags tab — BillingReviews have no dedicated tab
10. Front API analytics endpoints return 403 — all metrics computed from /events endpoint
11. Some dispatchers have duplicate user accounts (nebo.com + personal email)
12. scorecard.module.css uses --border-color but globals.css defines --border (inconsistent)
13. hoursActions.ts HoursSummary interface not exported — duplicated in HoursTabClient
14. EngagementLeaderboard component orphaned after analytics page deletion

## Next Session

1. **Commit performance dashboard merge** — stage all changes, verify build, commit
2. **Clean up orphaned EngagementLeaderboard** — delete or relocate to its own page
3. **Export HoursSummary from hoursActions.ts** — remove duplicate interface in HoursTabClient
4. **Fix --border-color inconsistency** — audit scorecard CSS files, align with globals.css --border
5. **Add BillingReviews tab to accounting page** — data exists, needs UI tab alongside Flags
6. **Twilio Voice webhook** — /api/twilio/voice/webhook to populate CallLog model
7. **Fix re-export proxy files** — quoteActions.ts and tbrTripActions.ts
8. Create dispatcher /confirmations page

## Key Decisions

- CSS Modules only — no Tailwind. Modals MUST use CSS Modules with explicit `position: fixed`
- Server actions for CRUD — API routes only for webhooks/external
- **"use server" files can ONLY export async functions** — constants/objects go in separate files
- All server actions return `{ success: boolean, data?: T, error?: string }`
- `npm run db:push` — no migrations. Client components use *Client.tsx suffix
- Scorecard weights: Confirmations 25% | Comms 15% | Email 15% | Punctuality 20% | Quotes 15% | Reports 10%
- Scorecard N/A: categories with no data → null, excluded from overall score, weight redistributed
- SMS counts from SMSLog directly, not ShiftReport auto fields
- Trends/Hours tabs fetch client-side (not SSR) — only Scorecard tab SSR-fetches for fast first paint
- Merged performance page at /admin/scorecard — Engagement tab dropped, ShiftReport metrics killed
- /admin/analytics permanently redirects to /admin/scorecard (301 in next.config.ts)
- SESSION-LOG.md is append-only (newest at top), PRIMER.md summarizes last 3
