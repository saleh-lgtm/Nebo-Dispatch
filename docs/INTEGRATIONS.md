# Integrations Reference

## 1. Overview

| Service | Purpose | Status |
|---------|---------|--------|
| **Twilio** | SMS send/receive | ✅ Active (A2P 10DLC pending) |
| **Supabase** | PostgreSQL + Storage + Realtime | ✅ Active (Realtime pending for SMS) |
| **n8n Cloud** | TBR Global scraping automation | ✅ Active |
| **Cloudflare** | Email worker for manifest ingestion | ✅ Active |
| **Google Services** | Calendar sync, Sheets, Maps API | ✅ Active |
| **Vercel** | Hosting + Cron jobs | ✅ Active |

---

## 2. Twilio (SMS)

### What It Does
- Send outbound SMS to customers, drivers, affiliates
- Receive inbound SMS via webhook
- Track delivery status via status callbacks
- Handle opt-out compliance (STOP/START keywords)

### Environment Variables
```bash
TWILIO_ACCOUNT_SID=AC...          # Account SID from Twilio Console
TWILIO_AUTH_TOKEN=...             # Auth Token from Twilio Console
TWILIO_PHONE_NUMBER=+1...         # Your Twilio phone number (E.164 format)
TWILIO_WEBHOOK_URL=https://...    # Production webhook URL (for signature validation)
TWILIO_STATUS_CALLBACK_URL=https://... # Status callback URL
TWILIO_SKIP_SIGNATURE_VALIDATION=false # MUST be false in production
```

### Twilio Console Configuration
1. Go to **Phone Numbers** → Select your number
2. Under **Messaging Configuration**:
   - Webhook URL: `https://your-domain.com/api/twilio/webhook`
   - HTTP Method: `POST`
3. Under **Status Callback URL** (optional):
   - URL: `https://your-domain.com/api/twilio/status`

### Current Status
- ✅ E.164 phone validation
- ✅ Webhook signature validation
- ✅ Opt-out/STOP keyword handling
- ✅ Delivery status callbacks
- ✅ Rate limiting (50 messages/second)
- ⏳ **Pending:** A2P 10DLC registration (required for US business SMS)

### A2P 10DLC Compliance
Register your business in Twilio Console to prevent carrier filtering. Required for US compliance.

---

## 3. Supabase

### What It Provides
| Feature | Usage |
|---------|-------|
| **PostgreSQL** | Primary database (~71 models) |
| **Storage** | Vehicle documents, affiliate attachments |
| **Realtime** | Live SMS updates (pending setup) |

### Connection Setup
```bash
# Pooled connection (for serverless, uses PgBouncer)
DATABASE_URL="postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection (for migrations, Prisma introspection)
DIRECT_URL="postgresql://...@pooler.supabase.com:5432/postgres"
```

### Environment Variables
```bash
DATABASE_URL=...                      # Pooled connection string
DIRECT_URL=...                        # Direct connection string
NEXT_PUBLIC_SUPABASE_URL=https://...  # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...         # Service role key (server-side only)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # Anon key (pending, for Realtime)
```

### Realtime Status (Pending)
To enable live SMS updates:
1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Enable replication for `SMSLog` table, or run:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE "SMSLog";
   ```
3. Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` to environment

---

## 4. n8n Cloud

### What Workflows Exist
| Workflow | Purpose | Trigger |
|----------|---------|---------|
| TBR Scraper | Scrapes TBR Global portal for new trips | Scheduled (cron) |

### Connection Setup
- **n8n Cloud URL:** `https://neborides.app.n8n.cloud`
- **API Key:** JWT token stored in `N8N_API_KEY`

### Environment Variables
```bash
N8N_API_KEY=eyJ...                    # n8n API key (for MCP integration)
TBR_INGEST_SECRET=...                 # Secret for /api/tbr/ingest authentication
N8N_TBR_SYNC_WEBHOOK_URL=...          # Optional: trigger n8n from /api/tbr/sync
```

### API Routes Called by n8n
| Route | Auth Header | Purpose |
|-------|-------------|---------|
| `POST /api/tbr/ingest` | `x-tbr-ingest-secret` | Send scraped TBR trips |

### MCP Connection (Claude Code)
Configured in `.mcp.json`:
```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "n8n-mcp"],
      "env": {
        "N8N_API_URL": "https://neborides.app.n8n.cloud",
        "N8N_API_KEY": "..."
      }
    }
  }
}
```

---

## 5. Cloudflare

### Email Worker Purpose
Receives manifest emails from TBR Global affiliates and forwards to the app for processing.

### Email Flow
```
TBR Affiliate → manifests@domain.com → Cloudflare Email Routing
     ↓
Cloudflare Worker (cloudflare-email-worker.js)
     ↓
POST /api/manifests/ingest (with x-manifest-secret header)
     ↓
Parse email → Create TripConfirmation records
```

### Environment Variables (Cloudflare Worker)
Set in **Cloudflare Dashboard** → **Workers** → **Settings** → **Variables**:
```bash
INGEST_URL=https://your-domain.com/api/manifests/ingest
MANIFEST_SECRET=...                   # Same as MANIFEST_INGEST_SECRET in app
```

### App Environment Variables
```bash
MANIFEST_INGEST_SECRET=...            # Shared secret with Cloudflare Worker
```

### MCP Connection (Claude Code)
Configured in `.mcp.json`:
```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "...",
        "CLOUDFLARE_ACCOUNT_ID": "..."
      }
    }
  }
}
```

---

## 6. Google Services

### Calendar Sync
- **Route:** `GET /api/calendar/[userId]?token=...`
- **Format:** iCal (.ics)
- **Usage:** Users subscribe via Google Calendar or Apple Calendar

### Google Sheets Integration (TBR → LimoAnywhere)
Trips pushed from TBR are written to a Google Sheet via Apps Script, which triggers Zapier to create LimoAnywhere reservations.

### Environment Variables
```bash
GOOGLE_MAPS_API_KEY=...               # For geocoding addresses
GOOGLE_SHEETS_SPREADSHEET_ID=...      # Target spreadsheet ID
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
GOOGLE_APPS_SCRIPT_SECRET=...         # Secret for Apps Script authentication
```

---

## 7. Vercel

### Deployment Config
Production domain: `neboops.com`

### Cron Jobs (`vercel.json`)
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

### Environment Variables (Vercel Dashboard)
All variables from `.env` must be added to **Vercel** → **Settings** → **Environment Variables**:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Pooled Supabase connection |
| `NEXTAUTH_SECRET` | ✅ | Random 32+ char string |
| `NEXTAUTH_URL` | ✅ | Production URL |
| `TWILIO_*` | ✅ | All Twilio variables |
| `SUPABASE_*` | ✅ | All Supabase variables |
| `CRON_SECRET` | ✅ | For cron job auth |
| `TBR_INGEST_SECRET` | ✅ | For n8n auth |
| `MANIFEST_INGEST_SECRET` | ✅ | For Cloudflare worker auth |
| `GOOGLE_*` | Optional | For Sheets/Maps integration |

---

## 8. Setup Checklist

### Fresh Deployment

#### Supabase
- [ ] Create new Supabase project
- [ ] Copy connection strings (pooled + direct)
- [ ] Run `npm run db:push` to create tables
- [ ] Enable Storage for vehicle-documents bucket
- [ ] (Optional) Enable Realtime for SMSLog table

#### Vercel
- [ ] Connect GitHub repo to Vercel
- [ ] Add all environment variables
- [ ] Deploy and verify build succeeds
- [ ] Configure custom domain

#### Twilio
- [ ] Create Twilio account and get phone number
- [ ] Copy Account SID, Auth Token, Phone Number
- [ ] Configure webhook URL in Twilio Console
- [ ] Set `TWILIO_SKIP_SIGNATURE_VALIDATION=false`
- [ ] Register for A2P 10DLC (US compliance)

#### n8n
- [ ] Create n8n Cloud account
- [ ] Import TBR scraper workflow
- [ ] Configure workflow to POST to `/api/tbr/ingest`
- [ ] Set `x-tbr-ingest-secret` header in HTTP Request node
- [ ] Enable scheduled trigger

#### Cloudflare
- [ ] Add domain to Cloudflare
- [ ] Configure Email Routing (MX records)
- [ ] Create Email Worker with `cloudflare-email-worker.js`
- [ ] Set Worker environment variables (INGEST_URL, MANIFEST_SECRET)
- [ ] Create custom email address (e.g., manifests@domain.com)
- [ ] Route email address to Worker

#### Google Services
- [ ] Create Google Cloud project
- [ ] Enable Maps Geocoding API, get API key
- [ ] Create Google Sheet for TBR trips
- [ ] Deploy Apps Script web app
- [ ] Copy script URL and secret to environment
