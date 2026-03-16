# PRIMER.md — Nebo Dispatch Session Snapshot

## Current State

Production app for Nebo Rides transportation company. Staff-only dispatch platform.

**Stack:** Next.js 16.1.6 + React 19 + Prisma 7 + Supabase PostgreSQL
**Deployment:** Vercel
**Status:** Deployed and operational

**Core Features (Working):**
- Auth: NextAuth.js with 4 roles (SUPER_ADMIN, ADMIN, ACCOUNTING, DISPATCHER)
- Dashboard with shift clock and quotes
- Scheduling with real-time sync, templates, conflicts, suggestions (Phase 2-4 complete)
- SMS/Communications via Twilio
- Fleet management
- TBR Global trip scraping via n8n
- Confirmations and manifest ingestion via Cloudflare email worker
- Accounting flags and billing review
- 45 server action files, ~50 Prisma models

## This Session

Initial session — baseline snapshot created.

**Files Created:**
- `.claude/commands/session-end.md` — /session-end slash command
- `PRIMER.md` — this file

**Recent Commits (last 10):**
- ff4a388 — project rules (components, server-actions, database, auth)
- 1cec255 — slash commands (check, db-push, new-page, new-action, find-feature)
- 236259f — expanded CLAUDE.md with feature map
- 4a83a7d — removed unused code and legacy Zapier integration
- 2dc2e0e — Scheduler Phase 2-4: real-time sync, templates, conflicts, suggestions
- cb4b1fc — trigger redeploy
- 609688a — favicon fix for Next.js 16
- 94bf58d — switched to Google Apps Script for Sheet integration
- 0969b7b — notification type icons
- 7a7b80f — reusable components for shift-swap and confirmations

## In Progress

**Twilio SMS Real-time Setup (TODO-TWILIO-SETUP.md):**
- [ ] Enable Supabase replication for SMSLog table
- [ ] Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env
- [ ] Production: remove TWILIO_SKIP_SIGNATURE_VALIDATION
- [ ] A2P 10DLC registration for US compliance

**Deleted this session:**
- CLEANUP-CHECKLIST.md (removed, marked D in git)

## Known Issues

1. **SMS Real-time:** Not working until Supabase replication enabled
2. **Route Pricing:** ~158K rows — needs careful pagination, no SELECT *
3. **ShiftReportForm.tsx:** ~100KB file — prefer editing subcomponents in src/components/shift-report/
4. **TripConfirmation queries:** Need status + dueAt index for performance

## Next Session

1. Complete Twilio production setup per TODO-TWILIO-SETUP.md
2. Add database indexes for TripConfirmation (status, dueAt)
3. Review and optimize any slow queries on RoutePricing table
4. Consider breaking down large components if performance issues arise

## Key Decisions

- **No Tailwind** — CSS Modules only (co-located .module.css files)
- **No API routes for CRUD** — server actions in src/lib/*Actions.ts
- **No migrations** — use `npm run db:push` (Prisma push)
- **Client components** — must use *Client.tsx suffix
- **Session snapshots** — use /session-end command at end of each session
