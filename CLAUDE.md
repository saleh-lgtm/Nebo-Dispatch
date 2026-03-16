# CLAUDE.md

## Project Overview

Nebo Dispatch — Internal operations platform for Nebo Rides, a chauffeured transportation company headquartered in Dallas, TX with regional offices in Austin and San Antonio. Staff-only tool used by dispatchers, admins, and accounting. NOT public-facing.

## Tech Stack

Next.js 16 + React 19 + Prisma 7 + PostgreSQL (Supabase) + Twilio SMS + n8n automation + Cloudflare email worker.

## Commands
```bash
npm run dev              # Dev server
npm run build            # Production build (clears .next, generates Prisma)
npm run lint             # ESLint
npm run db:generate      # Prisma client
npm run db:push          # Push schema to DB
npm run seed:super-admin # Seed super admin user
```

## Architecture

- **Pages:** `src/app/` (App Router, server components by default)
- **Client Components:** `*Client.tsx` suffix with `"use client"` directive
- **Server Actions:** `src/lib/*Actions.ts` with `"use server"` — no API layer for mutations
- **API Routes:** `src/app/api/` — only for webhooks, external integrations, and cron jobs
- **Database:** `prisma/schema.prisma` (~50 models, ~20 enums)
- **Auth:** NextAuth.js v4 with credentials provider, JWT strategy
- **Middleware:** `src/middleware.ts` handles route protection by role
- **Validation:** Zod schemas in `src/lib/schemas.ts`
- **Styling:** CSS Modules co-located with components (`*.module.css`) + globals.css

## Roles & Permissions

| Role | Access |
|------|--------|
| SUPER_ADMIN | Everything — user management, system settings, all features |
| ADMIN | Dashboard, scheduling, dispatchers, approvals, reports, analytics, fleet, pricing, notes, SOPs, confirmations, TBR settings |
| ACCOUNTING | Accounting flags, billing review, pricing, affiliate audit |
| DISPATCHER | Dashboard, shift clock, shift reports, quotes, SMS, schedule view, fleet view, SOPs, contacts, confirmations |

Always check role in server actions via `getServerSession` before mutations.

## Feature Map

| Feature | Pages | Server Actions | Key Models |
|---------|-------|---------------|------------|
| Auth & Users | login/, signup/, admin/users/ | authActions.ts, userActions.ts | User, Session, Account |
| Dashboard | dashboard/ | clockActions.ts | ClockEntry, Shift |
| Shift Reports | reports/shift/ | shiftReportActions.ts | ShiftReport |
| Quotes | (in dashboard) | quoteActions.ts | Quote, QuoteFollowUp |
| SMS/Comms | sms/, communications/, admin/sms/ | twilioActions.ts, smsActions.ts | SMSMessage, SMSConversation |
| Scheduling | schedule/, admin/scheduler/ | scheduleActions.ts | Schedule, TimeOffRequest, ShiftSwap |
| Fleet | fleet/, fleet/[vehicleId]/ | fleetActions.ts | Vehicle, VehicleDocument |
| Network/Affiliates | network/, affiliates/ | affiliateActions.ts, networkActions.ts | Affiliate, AffiliatePricing |
| Confirmations | admin/confirmations/ | confirmationActions.ts | TripConfirmation, ManifestLog |
| TBR Global | tbr-trips/, admin/tbr-settings/ | tbrTripActions.ts | TbrTrip, TbrSyncLog |
| Accounting | accounting/ | accountingActions.ts, flagActions.ts | AccountingFlag, BillingReview |
| Tasks | admin/tasks/ | taskActions.ts | Task, ShiftTask |
| Requests | admin/requests/, admin/approvals/ | requestActions.ts | Request |
| SOPs | sops/, admin/sops/ | sopActions.ts | SOP, SOPAcknowledgment |
| Contacts | admin/contacts/, dispatcher/directory/ | contactActions.ts | Contact, ContactTag |
| Pricing | admin/pricing/ | pricingActions.ts | RoutePricing (~158K routes) |
| Notes | admin/notes/ | notesActions.ts | GlobalNote |
| Notifications | (system-wide) | notificationActions.ts | Notification |
| Audit | admin/audit/ | auditActions.ts | AuditLog |

## External Integrations

| Service | Purpose | Entry Point |
|---------|---------|-------------|
| Twilio | SMS send/receive | twilioActions.ts, api/twilio/webhook/ |
| Supabase | PostgreSQL + Storage | prisma/schema.prisma, lib/prisma.ts |
| n8n | TBR scraping, automation | api/tbr/ingest/, api/tbr/sync/ |
| Cloudflare | Email worker for manifests | cloudflare-email-worker.js, api/manifests/ingest/ |
| Google Calendar | Schedule sync | api/calendar/[userId]/ |

## Key Patterns

1. Server actions directly use Prisma — no API layer for mutations
2. API routes ONLY for: webhooks, external integrations, cron jobs
3. Validation with Zod schemas in src/lib/schemas.ts
4. CSS Modules co-located with components (*.module.css)
5. Audit logging for sensitive actions via auditActions.ts
6. Page pattern: page.tsx (Server Component) passes data to *Client.tsx

## Key Files

| Area | Files |
|------|-------|
| Auth config | src/lib/auth.ts, src/middleware.ts |
| DB client | src/lib/prisma.ts |
| DB schema | prisma/schema.prisma |
| Validation | src/lib/schemas.ts |
| Shared types | src/types/ (12 type files) |
| Shared UI | src/components/ui/ |

## Don'ts

- Don't use `npx prisma migrate` — we use `db push`
- Don't skip `prisma generate` after schema changes
- Don't hardcode credentials — use .env
- Don't create API routes for CRUD — use server actions
- Don't create components without *Client.tsx suffix if they need "use client"
- Don't put business logic in page.tsx — use server actions in src/lib/
- Don't install Redux or Zustand — server actions + React state are sufficient
- Don't use Tailwind — this project uses CSS Modules
- Don't modify globals.css for component styles — use .module.css
