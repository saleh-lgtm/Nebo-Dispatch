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

## Recent Sessions (last 3)

- **2026-03-16 Late Evening:** Set up persistent session logging — created SESSION-LOG.md, updated /session-end flow
- **2026-03-16 Evening:** Server action hardening — Zod validation, try/catch, standard return shape for 10 files (56 functions)
- **2026-03-16 Afternoon:** Created docs/ suite — ARCHITECTURE.md, DATABASE.md, API.md, INTEGRATIONS.md

## In Progress

**Server Action Hardening:**
- 10 of 45 server action files hardened — remaining 35 need review

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
5. ESLint error in useClockTimer.ts (pre-existing, not blocking)

## Next Session

1. Continue server action hardening — remaining 35 files
2. Complete Twilio production setup per TODO-TWILIO-SETUP.md
3. Add database indexes for TripConfirmation (status, dueAt)
4. Review/optimize slow queries on RoutePricing table

## Key Decisions

- CSS Modules only — no Tailwind
- Server actions for CRUD — API routes only for webhooks/external
- `npm run db:push` — no migrations
- Client components use *Client.tsx suffix
- All server actions return `{ success: boolean, data?: T, error?: string }`
- ZodError uses `.issues` not `.errors` for validation messages
- Documentation lives in docs/ — ARCHITECTURE, DATABASE, API, INTEGRATIONS
- SESSION-LOG.md is append-only (newest at top), PRIMER.md summarizes last 3
- Run /session-end at end of each session
