# PRIMER.md — Nebo Dispatch Session Snapshot

## Current State

Production dispatch platform for Nebo Rides (Dallas, Austin, San Antonio).
Staff-only tool for dispatchers, admins, and accounting.

**Stack:** Next.js 16.1.6 + React 19 + Prisma 7 + Supabase PostgreSQL
**Deployment:** Vercel — deployed and operational

**Working Features:**
- Auth: NextAuth.js, 4 roles (SUPER_ADMIN, ADMIN, ACCOUNTING, DISPATCHER)
- Dashboard, shift clock, quotes, scheduling (Phase 2-4 complete)
- SMS via Twilio, Fleet management, TBR Global scraping via n8n
- Confirmations, manifest ingestion via Cloudflare email worker
- Accounting flags, billing review
- 45 server action files, 71 Prisma models, 26 enums

## This Session

Created comprehensive documentation suite in `docs/`.

**Files Created:**
- `docs/ARCHITECTURE.md` — system overview, data flow diagrams, deployment architecture
- `docs/DATABASE.md` — 71 models, 26 enums, relationships, performance notes
- `docs/API.md` — 13 API routes, auth methods, webhooks, cron endpoints
- `docs/INTEGRATIONS.md` — 6 external services, setup checklist, environment config

**Commits:**
- c3669b9 — docs: add ARCHITECTURE.md
- 9ef7794 — docs: add DATABASE.md
- e4564ce — docs: add API.md
- f7cd301 — docs: add INTEGRATIONS.md

**Pending Changes:**
- CLEANUP-CHECKLIST.md deleted (staged)
- .claude/settings.json untracked

## In Progress

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

## Next Session

1. Complete Twilio production setup per TODO-TWILIO-SETUP.md
2. Add database indexes for TripConfirmation (status, dueAt)
3. Review/optimize slow queries on RoutePricing table
4. Consider adding docs/FEATURES.md for feature-by-feature guide
5. Stage and commit pending .claude/settings.json if needed

## Key Decisions

- CSS Modules only — no Tailwind
- Server actions for CRUD — API routes only for webhooks/external
- `npm run db:push` — no migrations
- Client components use *Client.tsx suffix
- Documentation lives in docs/ — ARCHITECTURE, DATABASE, API, INTEGRATIONS
- Run /session-end at end of each session to update this file
