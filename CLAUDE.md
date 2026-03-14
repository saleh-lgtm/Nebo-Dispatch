# CLAUDE.md

## Quick Context

Nebo Dispatch - Transportation company dispatch management app.
Next.js 16 + React 19 + Prisma 7 + PostgreSQL (Supabase) + Twilio SMS.

## Commands

```bash
npm run dev          # Dev server
npm run build        # Production build (clears .next, generates Prisma)
npm run lint         # ESLint
npm run db:generate  # Prisma client
npm run db:push      # Push schema to DB
```

## Architecture

- **Pages:** `src/app/` (App Router, server components by default)
- **Client Components:** `*Client.tsx` suffix with `"use client"`
- **Server Actions:** `src/lib/*Actions.ts` with `"use server"`
- **Database:** `prisma/schema.prisma` (~50 models)
- **Auth:** NextAuth.js with roles: SUPER_ADMIN, ADMIN, ACCOUNTING, DISPATCHER
- **Middleware:** `src/middleware.ts` handles route protection

## Key Files

| Area | Files |
|------|-------|
| Auth | `src/lib/auth.ts`, `src/middleware.ts` |
| Database | `prisma/schema.prisma`, `src/lib/prisma.ts` |
| Dashboard | `src/app/dashboard/`, `src/components/ClockButton.tsx` |
| Shifts | `src/lib/clockActions.ts`, `src/components/ShiftReportForm.tsx` |
| Quotes | `src/lib/quoteActions.ts`, `src/components/quotes/` |
| SMS | `src/lib/twilioActions.ts`, `src/app/sms/` |
| Fleet | `src/lib/fleetActions.ts`, `src/app/fleet/` |
| TBR | `src/lib/tbrTripActions.ts`, `src/app/tbr-trips/` |

## Patterns

1. **Server actions** directly use Prisma (no API layer for mutations)
2. **Validation** with Zod schemas in `src/lib/schemas.ts`
3. **CSS Modules** co-located with components (`*.module.css`)
4. **Audit logging** for sensitive actions via `src/lib/auditActions.ts`

## Don'ts

- Don't use `npx prisma migrate` - we use `db push` (no migrations)
- Don't skip Prisma generate after schema changes
- Don't hardcode credentials - use `.env`
- Don't create API routes for simple CRUD - use server actions
