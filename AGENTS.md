# AGENTS.md

## Project Overview

Nebo Dispatch is a dispatch management application for a limousine/transportation company. It handles shift management, trip confirmations, quote tracking, affiliate networks, fleet management, and SMS communications.

**Stack:** Next.js 16.1.6 (App Router), React 19, TypeScript, Prisma 7 ORM, PostgreSQL (Supabase), NextAuth.js, Twilio, Zod validation.

## Setup Commands

```bash
# Install dependencies
npm install

# Generate Prisma client (required after clone or schema changes)
npm run db:generate

# Push schema to database (development only)
npm run db:push

# Seed super admin user
npm run seed:super-admin

# Alternative Prisma seed
npx prisma db seed
```

## Development Workflow

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production (clears .next, generates Prisma, builds)
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

### Package.json Scripts Reference

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev` | Start development server with hot reload |
| `build` | `rm -rf .next && prisma generate && next build` | Clean build with fresh Prisma client |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run ESLint with Next.js config |
| `seed:super-admin` | `npx tsx prisma/seed-super-admin.ts` | Create initial super admin user |
| `db:push` | `prisma db push` | Push schema changes to database |
| `db:generate` | `prisma generate` | Generate Prisma client |

## Environment Variables

Required in `.env`:

```bash
# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://..."

# NextAuth.js
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Supabase (for storage and realtime)
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"  # For client-side

# Twilio SMS
TWILIO_ACCOUNT_SID="ACxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+1xxxxxxxxxx"
TWILIO_STATUS_CALLBACK_URL="https://yourdomain.com/api/twilio/status"

# TBR Global Integration (optional)
TBR_INGEST_SECRET="secret-for-n8n-api-auth"

# n8n/Zapier Integration (optional)
N8N_TBR_SYNC_WEBHOOK_URL="https://your-n8n.cloud/webhook/..."
ZAPIER_LA_WEBHOOK_URL="https://hooks.zapier.com/..."
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin-only pages
│   │   ├── analytics/      # Business analytics dashboard
│   │   ├── approvals/      # User/portal approval workflow
│   │   ├── audit/          # Audit logs (SUPER_ADMIN only)
│   │   ├── confirmations/  # Trip confirmation management
│   │   ├── hours/          # Employee hours tracking
│   │   ├── notes/          # Company announcements
│   │   ├── pricing/        # Route pricing management
│   │   ├── reports/        # Shift report review
│   │   ├── requests/       # PTO/swap request management
│   │   ├── scheduler/      # Shift scheduling
│   │   ├── sms/            # SMS conversation management
│   │   ├── sops/           # SOP administration
│   │   ├── tasks/          # Task assignment
│   │   └── users/          # User management (SUPER_ADMIN only)
│   ├── api/                # API routes
│   │   ├── auth/[...nextauth]/ # NextAuth endpoints
│   │   ├── confirmations/  # Trip confirmation APIs
│   │   ├── manifests/      # Email manifest ingestion
│   │   ├── presence/       # User presence tracking
│   │   ├── tbr/            # TBR Global integration
│   │   └── twilio/         # Twilio webhooks
│   ├── accounting/         # Accounting/billing features
│   ├── affiliates/         # Affiliate/partner management
│   ├── dashboard/          # Main dispatcher dashboard
│   ├── dispatcher/         # Dispatcher-specific views
│   ├── fleet/              # Fleet vehicle management
│   ├── network/            # Network partners directory
│   ├── portals/            # External portal quick links
│   ├── schedule/           # Schedule viewing
│   ├── sms/                # SMS conversations
│   ├── sops/               # SOPs for dispatchers
│   └── tbr-trips/          # TBR Global trips dashboard
├── components/             # React components
│   ├── ui/                 # Shared UI (Modal, Badge, Toast, Skeleton)
│   ├── quotes/             # Quote management
│   ├── shift-report/       # Shift report form sections
│   ├── sms/                # SMS chat components
│   └── ...                 # Feature-specific components
├── lib/                    # Server actions & utilities
│   ├── prisma.ts           # Prisma client singleton
│   ├── auth.ts             # NextAuth configuration
│   ├── schemas.ts          # Zod validation schemas
│   └── *Actions.ts         # Server actions by domain
├── hooks/                  # Custom React hooks (useToast, etc.)
├── types/                  # TypeScript type definitions
└── middleware.ts           # Route protection & role checks
prisma/
├── schema.prisma           # Database schema (~1800 lines, ~50 models)
├── seed-super-admin.ts     # Super admin seeder
├── seed.js                 # General seeder
└── seed-fifa-events.js     # Event data seeder
```

## Code Style

### ESLint Configuration
- Uses `eslint-config-next` with Core Web Vitals and TypeScript rules
- Ignores `.next/`, `out/`, `build/`, `.claude/` directories
- Run with `npm run lint`

### File Conventions
- **Pages:** `src/app/[route]/page.tsx` (server component by default)
- **Client Components:** `*Client.tsx` suffix for client-side interactivity
- **Server Actions:** `src/lib/*Actions.ts` with `"use server"` directive
- **CSS:** CSS Modules (`*.module.css`) co-located with components
- **Types:** `src/types/*.ts` or inline TypeScript

### Naming Conventions
- **Components:** PascalCase (`ShiftReportForm.tsx`)
- **Server Actions:** camelCase functions (`getShiftReport`, `createQuote`)
- **Prisma Enums:** SCREAMING_SNAKE_CASE (`SUPER_ADMIN`, `PENDING`)

### Patterns
- Server actions use Prisma directly (no separate API layer for mutations)
- Client components fetch via server actions or `/api/` routes
- Authentication via `getServerSession(authOptions)` from NextAuth
- Validation with Zod schemas defined in `src/lib/schemas.ts`
- Role-based access control enforced in `src/middleware.ts`

## Database

### Prisma Commands
```bash
# Generate client after schema changes
npx prisma generate

# Push schema to database (dev only, no migrations)
npx prisma db push

# Open Prisma Studio GUI
npx prisma studio

# Create migration (if using migrations)
npx prisma migrate dev --name <migration_name>

# Run seed script
npx prisma db seed
```

### Key Models

| Model | Purpose |
|-------|---------|
| `User` | Dispatchers, admins with roles (SUPER_ADMIN, ADMIN, ACCOUNTING, DISPATCHER) |
| `Shift` | Clock in/out records with schedule comparison |
| `ShiftReport` | End-of-shift reports with metrics and admin review |
| `Quote` | Customer quotes with CRM-like follow-up tracking |
| `Affiliate` | Partners: FARM_IN, FARM_OUT, IOS, HOUSE_CHAUFFEUR |
| `FleetVehicle` | Company vehicles with permits/insurance/registration |
| `TripConfirmation` | 2-hour confirmation reminders from manifests |
| `TbrTrip` | TBR Global trips for LimoAnywhere integration |
| `SMSLog` | Twilio SMS message tracking |
| `SOP` | Standard operating procedures with quizzes |
| `AdminTask` | Tasks assigned to dispatchers |
| `TimeOffRequest` | PTO requests with approval workflow |
| `ShiftSwapRequest` | Shift swap requests between dispatchers |
| `RoutePrice` | Pricing lookup table (~158K rows from Excel) |

### Performance Indexes
Critical indexes are defined in schema for:
- `User.email` - Auth queries on every request
- `Shift.userId, clockOut` - Active shift lookups
- `Quote.status, createdAt` - Quote dashboards
- `TripConfirmation.status, dueAt` - Confirmation widget

## Authentication & Authorization

### NextAuth.js Setup
- Credentials provider with email/password
- Session stored in JWT
- Configured in `src/lib/auth.ts`

### User Roles
| Role | Access |
|------|--------|
| `SUPER_ADMIN` | Full access including user management and audit |
| `ADMIN` | Admin pages except user management and audit |
| `ACCOUNTING` | Accounting routes and billing features |
| `DISPATCHER` | Dashboard, shift management, quotes |

### Middleware Protection
Routes are protected in `src/middleware.ts`:
- `/dashboard`, `/schedule`, `/reports`, etc. require authentication
- `/admin/*` requires ADMIN or SUPER_ADMIN role
- `/admin/users`, `/admin/audit` require SUPER_ADMIN only
- `/accounting/*` requires ACCOUNTING, ADMIN, or SUPER_ADMIN

### Usage in Server Components
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const session = await getServerSession(authOptions);
if (!session?.user) redirect("/login");
```

## External Integrations

### Twilio SMS
- **Actions:** `src/lib/twilioActions.ts`
- **Webhooks:** `src/app/api/twilio/webhook/`, `src/app/api/twilio/status/`
- **Rate Limiting:** `src/lib/smsRateLimiter.ts` (50 messages/second)
- **Opt-out Handling:** STOP keyword compliance
- **Real-time Updates:** Requires Supabase Realtime on `SMSLog` table

### Supabase
- **Storage:** File uploads for vehicles, affiliates (`src/lib/storageActions.ts`)
- **Realtime:** SMS conversation updates (enable via Dashboard → Replication)
- **Database:** PostgreSQL with connection pooling

### TBR Global Integration
- **Scraper:** n8n workflow (`n8n-workflows/tbr-trip-scraper.json`)
- **Ingestion API:** `POST /api/tbr/ingest` with `x-tbr-ingest-secret` header
- **Actions:** `src/lib/tbrTripActions.ts`, `src/lib/vehicleMappingActions.ts`
- **Dashboard:** `/tbr-trips`
- **LimoAnywhere Push:** Via Zapier webhook

### n8n Workflows
Located in `n8n-workflows/`:
- TBR trip scraper (runs every 30 minutes)
- Import workflows via n8n UI and configure credentials

### Cloudflare Email Worker
- `cloudflare-email-worker.js` - Processes manifest emails for trip confirmations
- Sends parsed data to `/api/manifests/ingest`

## Scheduled Tasks (Vercel Cron)

Configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/confirmations/expire",
      "schedule": "0 0 * * *"
    }
  ]
}
```
- Runs daily at midnight UTC
- Expires old trip confirmations

## Security Configuration

### Next.js Security Headers (`next.config.ts`)
- HSTS with preload
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: enabled
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy configured for Next.js, Supabase, Twilio

### Application Security
- Passwords hashed with bcryptjs
- Password policy enforcement (`src/lib/passwordPolicy.ts`)
- Rate limiting on SMS and auth endpoints (`src/lib/apiRateLimiter.ts`)
- Audit logging for sensitive actions (`src/lib/auditActions.ts`)
- Security audit utilities (`src/lib/securityAudit.ts`)

## Common Development Tasks

### Adding a New Server Action
1. Create or edit `src/lib/<domain>Actions.ts`
2. Add `"use server"` directive at top
3. Import Prisma: `import { prisma } from "./prisma"`
4. Export async functions with proper error handling

### Adding a New Page
1. Create `src/app/<route>/page.tsx` (server component)
2. For interactivity, create `<Route>Client.tsx` with `"use client"`
3. Import and render client component in page.tsx
4. Add route protection in `middleware.ts` if needed

### Adding a New Prisma Model
1. Edit `prisma/schema.prisma`
2. Add appropriate indexes for query performance
3. Run `npx prisma generate`
4. Run `npx prisma db push` (dev) or create migration
5. Create server actions in `src/lib/<model>Actions.ts`

### Adding Environment Variables
1. Add to `.env` locally
2. Add to Vercel project settings for production
3. If client-side needed, prefix with `NEXT_PUBLIC_`

## Build and Deployment

### Vercel Deployment
- Auto-deploys from main branch
- Build command: `npm run build`
- Output directory: `.next`
- Node.js version: 20.x

### Build Process
1. Clears `.next` directory
2. Generates fresh Prisma client
3. Runs Next.js build with optimizations

### Pre-deployment Checklist
- [ ] All TypeScript errors resolved (`npx tsc --noEmit`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Environment variables set in Vercel
- [ ] Database migrations applied
- [ ] Twilio webhooks point to production URL

## Troubleshooting

### Prisma Client Issues
```bash
# Regenerate Prisma client
rm -rf node_modules/.prisma
npx prisma generate
```

### Database Connection
- Verify `DATABASE_URL` in `.env`
- Check Supabase project is running
- Review connection pooling settings
- For SSL issues: `?sslmode=require` in connection string

### Build Failures
```bash
# Check TypeScript errors
npx tsc --noEmit

# Run local build
npm run build

# Clear Next.js cache
rm -rf .next
```

### Authentication Issues
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches current domain
- Clear browser cookies and retry

### Twilio SMS Issues
- Verify credentials in `.env`
- Check webhook URLs point to correct domain
- Review Twilio Console for error logs
- Ensure phone number format is E.164 (+1XXXXXXXXXX)

## Shell Scripts (Development Utilities)

| Script | Purpose |
|--------|---------|
| `check-tbr-page.sh` | Test TBR portal page access |
| `test-browserless.sh` | Test browserless.io connection |
| `test-tbr-scrape.sh` | Test TBR scraping workflow |
| `update-workflow.sh` | Update n8n workflow configuration |

## Documentation

- `README.md` - Basic project setup (default Next.js)
- `TODO-TWILIO-SETUP.md` - Twilio configuration checklist
- `docs/tbr-integration-setup.md` - TBR Global integration guide
- `docs/n8n-limoanywhere-integration-research.md` - n8n integration research
- `docs/n8n-hybrid-integration-analysis.md` - Hybrid integration analysis
