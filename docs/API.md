# API Reference

## 1. Overview

This project uses **server actions** (`src/lib/*Actions.ts`) for all CRUD operations. API routes exist **only** for:

- **Webhooks** — Twilio SMS, status callbacks
- **External Integrations** — n8n TBR scraper, Cloudflare email worker
- **Cron Jobs** — Scheduled tasks via Vercel Cron
- **Special Cases** — NextAuth handler, iCal export, Excel parsing

**Do NOT create API routes for standard CRUD operations.** Use server actions instead.

## 2. Authentication Methods

| Method | Header/Mechanism | Used By |
|--------|------------------|---------|
| **Session (JWT)** | NextAuth cookie | Internal dashboard API calls |
| **API Key** | `Authorization: Bearer {secret}` or `x-{service}-secret` | n8n, cron jobs, Cloudflare worker |
| **Calendar Token** | `?token={token}` query param | iCal feed subscriptions |
| **Twilio Signature** | `x-twilio-signature` header | Twilio webhooks (validated via SDK) |

### Session Auth (NextAuth JWT)
```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}
```

### API Key Auth
```typescript
const secret = process.env.TBR_INGEST_SECRET;
const headerSecret = request.headers.get("x-tbr-ingest-secret");
if (headerSecret !== secret) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Twilio Signature Verification
```typescript
const isValid = twilio.validateRequest(authToken, twilioSignature, webhookUrl, params);
// Skippable in development with TWILIO_SKIP_SIGNATURE_VALIDATION=true
// ALWAYS enforced in production
```

## 3. Route Reference

### Authentication

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/auth/[...nextauth]` | GET, POST | None (handler) | NextAuth.js authentication handler |

**File:** `src/app/api/auth/[...nextauth]/route.ts`

---

### Twilio Webhooks

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/twilio/webhook` | GET, POST | Twilio signature | Receive inbound SMS messages |
| `/api/twilio/status` | GET, POST | Twilio signature | Receive SMS delivery status updates |

**File:** `src/app/api/twilio/webhook/route.ts`

**Caller:** Twilio (configured in Twilio console)

**POST Request (form-urlencoded):**
```
From=+15551234567
To=+15559876543
Body=Hello
MessageSid=SM1234567890
NumSegments=1
```

**Response:** TwiML XML
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>Auto-reply text (if applicable)</Message>
</Response>
```

**File:** `src/app/api/twilio/status/route.ts`

**POST Request (form-urlencoded):**
```
MessageSid=SM1234567890
MessageStatus=delivered
ErrorCode=30001 (optional)
ErrorMessage=Carrier error (optional)
```

---

### TBR Global Integration

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/tbr/ingest` | GET, POST | `x-tbr-ingest-secret` or Basic Auth | Receive scraped TBR trips from n8n |
| `/api/tbr/sync` | GET, POST | `CRON_SECRET` | Trigger manual TBR sync, get status |
| `/api/tbr/push-to-la` | POST | None (internal) | Push trip to Google Sheet → LimoAnywhere |

**File:** `src/app/api/tbr/ingest/route.ts`

**Caller:** n8n Cloud (scheduled scraper workflow)

**POST Request:**
```json
{
  "trips": [
    {
      "tbrTripId": "TBR-12345",
      "passengerName": "John Doe",
      "passengerPhone": "+15551234567",
      "pickupDatetime": "2024-01-15T10:00:00Z",
      "pickupAddress": "DFW Airport Terminal A",
      "dropoffAddress": "123 Main St, Dallas, TX",
      "vehicleType": "Executive Sedan",
      "fareAmount": 150.00
    }
  ],
  "source": "n8n-scraper"
}
```

**Response:**
```json
{
  "success": true,
  "created": 5,
  "updated": 2,
  "unchanged": 3,
  "statusChanges": 1,
  "alertsSent": 1,
  "errors": [],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Manifest Ingestion

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/manifests/ingest` | GET, POST | `x-manifest-secret` or Basic Auth | Receive parsed manifest emails |

**File:** `src/app/api/manifests/ingest/route.ts`

**Caller:** Cloudflare Email Worker

**POST Request:**
```json
{
  "from": "dispatch@affiliate.com",
  "subject": "Daily Manifest - Jan 15",
  "body": "Trip #43273\nDriver: John Smith\nPassenger: Jane Doe\nPickup: 10:00 AM..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 trips",
  "extracted": 5,
  "created": 4,
  "duplicate": 1,
  "errors": []
}
```

---

### Calendar Export

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/calendar/[userId]` | GET | Token query param | Generate iCal feed for schedule |

**File:** `src/app/api/calendar/[userId]/route.ts`

**Caller:** Google Calendar, Apple Calendar (subscription)

**Request:** `GET /api/calendar/abc123?token=xyz789&download=true`

**Response:** `text/calendar` (iCal format)
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nebo Dispatch//Schedule//EN
BEGIN:VEVENT
...
END:VEVENT
END:VCALENDAR
```

---

### Reports

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/reports/engagement` | GET | Session (ADMIN+) | Get dispatcher engagement metrics |

**File:** `src/app/api/reports/engagement/route.ts`

**Query Params:**
- `days` — Number of days (1-90, default: 7)
- `type` — `full`, `trend`, or `dispatcher`
- `userId` — Required when type=dispatcher

**Response:**
```json
{
  "success": true,
  "data": { /* engagement metrics */ },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Pricing

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/pricing/import` | POST | Session (ADMIN+) | Parse Excel pricing file |

**File:** `src/app/api/pricing/import/route.ts`

**Request:** `multipart/form-data` with `file` field (.xlsx or .xls)

**Response:**
```json
{
  "success": true,
  "rows": [
    { "vehicleCode": "SEDAN", "zoneFrom": "DFW", "zoneTo": "Downtown", "rate": 75.00 }
  ],
  "totalRows": 158000,
  "skippedRows": 50,
  "fileName": "pricing.xlsx",
  "fileSize": 2048576
}
```

---

### Presence

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/presence/offline` | POST | Session | Mark user as offline |

**File:** `src/app/api/presence/offline/route.ts`

**Response:**
```json
{ "success": true }
```

---

### Confirmations

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/confirmations/expire` | GET, POST | `CRON_SECRET` | Mark expired confirmations (cron) |
| `/api/confirmations/debug` | GET | Session (SUPER_ADMIN) | Debug confirmation table status |

**File:** `src/app/api/confirmations/expire/route.ts`

**Caller:** Vercel Cron (configured in `vercel.json`)

**Response:**
```json
{
  "success": true,
  "message": "Processed 3 expired confirmations",
  "expired": 3,
  "accountabilityRecords": 2,
  "timestamp": "2024-01-15T00:00:00Z"
}
```

## 4. Webhook Endpoints

### Twilio SMS Webhook
- **URL:** `/api/twilio/webhook`
- **Configure in:** Twilio Console → Phone Numbers → Messaging Configuration
- **Webhook URL:** `https://your-app.vercel.app/api/twilio/webhook`
- **Security:** Twilio signature validation (enforced in production)

### Twilio Status Callback
- **URL:** `/api/twilio/status`
- **Configure in:** Twilio Console or per-message StatusCallback parameter
- **Security:** Twilio signature validation

### Manifest Email Ingestion
- **URL:** `/api/manifests/ingest`
- **Configure in:** Cloudflare Email Worker environment variables
- **Security:** `x-manifest-secret` header or Basic Auth (`manifest:{secret}`)

### TBR Trip Ingestion
- **URL:** `/api/tbr/ingest`
- **Configure in:** n8n workflow HTTP Request node
- **Security:** `x-tbr-ingest-secret` header or Basic Auth (`tbr:{secret}`)

## 5. Cron Endpoints

### Confirmation Expiry (Vercel Cron)

**Config:** `vercel.json`
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

**Auth:** `Authorization: Bearer {CRON_SECRET}` or `x-cron-secret` header

### TBR Sync Trigger

**URL:** `/api/tbr/sync`

**Auth:** Same as confirmation expiry

**Note:** Can trigger n8n workflow if `N8N_TBR_SYNC_WEBHOOK_URL` is configured

## 6. Error Response Format

All API routes use a consistent error response format:

```json
{
  "error": "Human-readable error message",
  "details": "Technical details (optional, for debugging)"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Bad request (invalid input) |
| `401` | Unauthorized (missing/invalid auth) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not found |
| `405` | Method not allowed |
| `409` | Conflict (e.g., duplicate push) |
| `429` | Rate limit exceeded |
| `500` | Server error |

### Rate Limiting

The following endpoints implement IP-based rate limiting:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/tbr/ingest` | 100 requests | 1 hour |
| `/api/manifests/ingest` | 100 requests | 1 hour |
