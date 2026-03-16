# Architecture Overview

## 1. System Overview

Nebo Dispatch is an internal operations platform for Nebo Rides, a chauffeured transportation company with offices in Dallas, Austin, and San Antonio. The staff-only application handles dispatch operations, shift management, scheduling, fleet tracking, SMS communications, affiliate networks, and trip confirmations. Built with Next.js 16 App Router, it uses server actions for mutations, PostgreSQL via Prisma for persistence, and integrates with external systems including Twilio (SMS), n8n (automation), and Cloudflare (email processing).

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEBO DISPATCH                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │   Browser    │───▶│              Next.js App (Vercel)                │   │
│  │   (Staff)    │◀───│                                                  │   │
│  └──────────────┘    │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
│                      │  │ page.tsx   │  │ *Client.tsx│  │ middleware │  │   │
│                      │  │ (Server)   │──│ (Client)   │  │ (Auth)     │  │   │
│                      │  └─────┬──────┘  └────────────┘  └────────────┘  │   │
│                      │        │                                          │   │
│                      │        ▼                                          │   │
│                      │  ┌────────────────────────────────────────────┐  │   │
│                      │  │        Server Actions (src/lib/*Actions.ts) │  │   │
│                      │  │  • 45 action files • Zod validation        │  │   │
│                      │  │  • Role checks     • Audit logging         │  │   │
│                      │  └─────────────────────┬──────────────────────┘  │   │
│                      │                        │                          │   │
│                      │                        ▼                          │   │
│                      │  ┌────────────────────────────────────────────┐  │   │
│                      │  │       Prisma Client (src/lib/prisma.ts)    │  │   │
│                      │  │       ~50 models • PrismaPg adapter        │  │   │
│                      │  └─────────────────────┬──────────────────────┘  │   │
│                      └────────────────────────┼──────────────────────────┘   │
│                                               │                              │
│                                               ▼                              │
│                      ┌────────────────────────────────────────────────────┐  │
│                      │              Supabase PostgreSQL                   │  │
│                      │   • 50 models • Storage for documents/images       │  │
│                      └────────────────────────────────────────────────────┘  │
│                                               ▲                              │
├───────────────────────────────────────────────┼──────────────────────────────┤
│                    EXTERNAL INTEGRATIONS      │                              │
│                                               │                              │
│  ┌──────────────┐    ┌───────────────────┐   │   ┌───────────────────┐      │
│  │  n8n Cloud   │───▶│ api/tbr/ingest    │───┘   │ api/calendar/[id] │◀─────│
│  │ TBR Scraper  │    │ api/tbr/sync      │       │   iCal Export     │      │
│  └──────────────┘    └───────────────────┘       └───────────────────┘      │
│                                                                              │
│  ┌──────────────┐    ┌───────────────────┐       ┌───────────────────┐      │
│  │  Cloudflare  │───▶│ api/manifests/    │       │ api/confirmations │◀─────│
│  │ Email Worker │    │ ingest            │       │ /expire (cron)    │      │
│  └──────────────┘    └───────────────────┘       └───────────────────┘      │
│                                                                              │
│  ┌──────────────┐    ┌───────────────────┐                                  │
│  │   Twilio     │◀──▶│ api/twilio/       │                                  │
│  │   SMS/Voice  │    │ webhook, status   │                                  │
│  └──────────────┘    └───────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout with Providers
│   ├── globals.css               # Global styles only
│   │
│   ├── login/                    # Auth pages (public)
│   ├── signup/
│   ├── forgot-password/
│   ├── reset-password/
│   │
│   ├── dashboard/                # Main dispatcher view
│   ├── schedule/                 # Personal schedule
│   ├── reports/shift/            # Shift report submission
│   ├── fleet/                    # Vehicle management
│   ├── sms/                      # SMS conversations
│   ├── sops/                     # Standard operating procedures
│   ├── tbr-trips/                # TBR Global trips
│   ├── affiliates/               # Network affiliates
│   ├── accounting/               # Billing & flags
│   │
│   ├── admin/                    # Admin-only routes
│   │   ├── scheduler/            # Schedule management
│   │   ├── users/                # User management (SUPER_ADMIN)
│   │   ├── confirmations/        # Trip confirmations
│   │   ├── pricing/              # Route pricing
│   │   ├── audit/                # Audit logs (SUPER_ADMIN)
│   │   └── ...                   # Other admin features
│   │
│   └── api/                      # API routes (webhooks/integrations only)
│       ├── auth/[...nextauth]/   # NextAuth.js handler
│       ├── twilio/webhook/       # Inbound SMS webhook
│       ├── tbr/ingest/           # n8n TBR trip ingestion
│       ├── manifests/ingest/     # Email manifest ingestion
│       ├── calendar/[userId]/    # iCal feed export
│       └── confirmations/expire/ # Cron job (Vercel)
│
├── components/
│   ├── ui/                       # Shared UI primitives
│   ├── AppLayout.tsx             # Main app shell
│   ├── Providers.tsx             # Context providers (NextAuth)
│   └── [feature]/                # Feature-specific components
│       └── *Client.tsx           # Client components with "use client"
│
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── auth.ts                   # NextAuth configuration
│   ├── schemas.ts                # Zod validation schemas
│   ├── *Actions.ts               # 45 server action files
│   ├── domains/                  # Domain logic modules
│   └── errors/                   # Error handling utilities
│
├── hooks/                        # Custom React hooks
├── styles/                       # Additional CSS modules
└── types/                        # TypeScript type definitions
```

## 4. Request Flow

### Typical Page Load: `/dashboard`

```
1. Browser requests /dashboard
                    │
                    ▼
2. middleware.ts intercepts
   ├── Calls getToken() to check JWT
   ├── No token? → Redirect to /login?callbackUrl=/dashboard
   └── Has token? → Check role for route access → Continue
                    │
                    ▼
3. dashboard/page.tsx (Server Component)
   ├── Calls getServerSession(authOptions)
   ├── Calls server actions (e.g., getClockStatus, getRecentActivity)
   └── Renders DashboardClient with fetched data as props
                    │
                    ▼
4. Server actions in src/lib/clockActions.ts
   ├── Validates session exists
   ├── Queries Prisma for user data
   └── Returns { success: true, data: {...} }
                    │
                    ▼
5. DashboardClient.tsx (Client Component)
   ├── Receives data as props
   ├── Manages local UI state
   └── Calls server actions on user interactions (e.g., clockIn)
```

## 5. External System Data Flows

### TBR Global Trip Scraping

```
n8n Cloud (scheduled scraper)
    │
    │ POST /api/tbr/ingest
    │ Header: x-tbr-ingest-secret or Basic Auth (tbr:secret)
    │ Body: { trips: IngestedTbrTrip[], source: "n8n-scraper" }
    │
    ▼
api/tbr/ingest/route.ts
    ├── Rate limit check (100 req/hour per IP)
    ├── Validate auth header
    ├── Validate trip data (Zod)
    ├── Call processTbrIngest() → Create/update TbrTrip records
    ├── Send SMS alerts for status changes on pushed trips
    └── Return { created, updated, unchanged, statusChanges }
```

### Manifest Email Ingestion

```
Affiliate sends manifest email to manifests@domain.com
    │
    ▼
Cloudflare Email Routing → cloudflare-email-worker.js
    │
    │ POST to INGEST_URL (api/manifests/ingest)
    │ Header: X-Manifest-Secret
    │ Body: { from, subject, body }
    │
    ▼
api/manifests/ingest/route.ts
    ├── Rate limit check (100 req/hour per IP)
    ├── Validate auth (Basic Auth or x-manifest-secret header)
    ├── Parse email body (supports CloudMailin, SendGrid formats)
    ├── Call parseManifestEmail() → Extract trip data
    ├── Call ingestManifestTrips() → Create TripConfirmation + ManifestLog
    └── Return { created, duplicate, errors }
```

### Twilio SMS Webhook

```
Customer sends SMS to Nebo number
    │
    ▼
Twilio webhook → POST /api/twilio/webhook
    │
    ▼
api/twilio/webhook/route.ts
    ├── Validate Twilio signature (ENFORCED in production)
    ├── Parse form data (From, To, Body, MessageSid)
    ├── Handle opt-out keywords (STOP, HELP, START)
    ├── Create SMSLog record (direction: INBOUND)
    ├── Update SMSOptOut if applicable
    └── Return TwiML response (with auto-reply if needed)
```

### Calendar iCal Export

```
Google Calendar / Apple Calendar subscription
    │
    │ GET /api/calendar/[userId]?token=xxx
    │
    ▼
api/calendar/[userId]/route.ts
    ├── Verify calendar token matches user
    ├── Call generateICalFeed() → Build iCal from Schedule records
    └── Return text/calendar with Cache-Control: no-cache
```

## 6. Authentication & Authorization

### Three-Layer Security Model

| Layer | Location | Purpose |
|-------|----------|---------|
| **Middleware** | `src/middleware.ts` | Route protection, redirects unauthenticated users |
| **Page** | `page.tsx` | Session check, role-based rendering |
| **Action** | `*Actions.ts` | Authorization before database access |

### NextAuth Configuration (`src/lib/auth.ts`)

- **Strategy**: JWT with 8-hour session lifetime
- **Provider**: Credentials (email/password with bcrypt)
- **Security Features**:
  - Account lockout after 5 failed attempts (15-minute duration)
  - IP-based rate limiting (20 attempts per 15 minutes)
  - Approval status check (PENDING/REJECTED blocks login)
  - Secure cookies in production (`__Secure-`, `__Host-` prefixes)

### Role Hierarchy

```
SUPER_ADMIN ─┬─ Full system access
             ├─ User management (/admin/users)
             └─ Audit logs (/admin/audit)

ADMIN ───────┬─ Scheduling, dispatchers, fleet
             ├─ Confirmations, TBR settings
             └─ Pricing, reports, analytics

ACCOUNTING ──┬─ Accounting flags, billing review
             └─ Affiliate audit, pricing view

DISPATCHER ──┬─ Dashboard, shift clock, quotes
             ├─ SMS, schedule view, fleet view
             └─ SOPs, contacts, confirmations
```

## 7. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────┐      ┌─────────────────────┐          │
│   │      Vercel         │      │     Supabase        │          │
│   │  ─────────────────  │      │  ─────────────────  │          │
│   │  Next.js App        │◀────▶│  PostgreSQL DB      │          │
│   │  Edge Functions     │      │  (~50 models)       │          │
│   │  Cron Jobs          │      │  Storage (files)    │          │
│   │  (vercel.json)      │      │  Realtime (SMS)     │          │
│   └─────────────────────┘      └─────────────────────┘          │
│                                                                  │
│   ┌─────────────────────┐      ┌─────────────────────┐          │
│   │     n8n Cloud       │      │    Cloudflare       │          │
│   │  ─────────────────  │      │  ─────────────────  │          │
│   │  TBR Global Scraper │      │  Email Routing      │          │
│   │  Scheduled workflows│      │  Email Worker (JS)  │          │
│   │  API: neborides.    │      │  Manifest forwarding│          │
│   │  app.n8n.cloud      │      │                     │          │
│   └─────────────────────┘      └─────────────────────┘          │
│                                                                  │
│   ┌─────────────────────┐                                       │
│   │      Twilio         │                                       │
│   │  ─────────────────  │                                       │
│   │  SMS Send/Receive   │                                       │
│   │  A2P 10DLC (pending)│                                       │
│   └─────────────────────┘                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Vercel Cron Jobs (`vercel.json`)

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| `0 0 * * *` (daily midnight) | `/api/confirmations/expire` | Expire stale trip confirmations |

### Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | Supabase | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth | JWT signing key |
| `TWILIO_*` | Twilio | Account SID, Auth Token, Phone Number |
| `TBR_INGEST_SECRET` | n8n | API authentication for TBR ingest |
| `MANIFEST_INGEST_SECRET` | Cloudflare | API authentication for email worker |
