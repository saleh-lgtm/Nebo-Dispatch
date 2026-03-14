# TBR Global → LimoAnywhere Integration Setup

## Overview

This integration allows you to:
1. Scrape upcoming trips from TBR Global's affiliate portal
2. View and manage TBR trips in Nebo
3. Push TBR trips to LimoAnywhere with one click
4. Receive alerts when pushed trips change status

## Architecture

```
TBR Global Portal → n8n Scraper → Nebo /api/tbr/ingest → Database
                                                        ↓
LimoAnywhere ← Zapier Webhook ← n8n Push Workflow ← Nebo UI (Push Button)
```

## Environment Variables

Add these to your `.env` file:

```bash
# TBR Global Integration
TBR_INGEST_SECRET=your-secret-key-here    # Secret for n8n → Nebo API auth
TBR_USERNAME=your-tbr-email@company.com   # TBR portal login (set in n8n env)
TBR_PASSWORD=your-tbr-password            # TBR portal password (set in n8n env)

# n8n Webhooks (optional - for manual sync trigger)
N8N_TBR_SYNC_WEBHOOK_URL=https://your-n8n.cloud/webhook/tbr-sync-trigger

# Zapier Integration (for LimoAnywhere push)
ZAPIER_LA_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxxx

# For client-side push (if not using n8n/Zapier middleware)
NEXT_PUBLIC_ZAPIER_LA_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/xxxxx
```

## Setup Steps

### 1. Database Migration

The TBR tables are already in the Prisma schema. If you need to push changes:

```bash
npx prisma db push
npx prisma generate
```

### 2. Seed Vehicle Mappings

Run this in your app to seed default vehicle type mappings:

```typescript
import { seedDefaultMappings } from "@/lib/vehicleMappingActions";
await seedDefaultMappings();
```

Or access `/admin/tbr-settings` and click "Seed Defaults".

### 3. Configure n8n Workflow

1. Import `/n8n-workflows/tbr-trip-scraper.json` into your n8n instance
2. Create HTTP Header Auth credential:
   - Name: `Nebo TBR Auth`
   - Header Name: `x-tbr-ingest-secret`
   - Header Value: Your `TBR_INGEST_SECRET` from Nebo env
3. Set environment variables in n8n:
   - `TBR_USERNAME`: Your TBR Global email
   - `TBR_PASSWORD`: Your TBR Global password
4. Configure Slack credential (optional)
5. Update the POST URL to your Nebo domain: `https://yourdomain.com/api/tbr/ingest`

### 4. Test TBR Portal Access

Before activating the scraper:
1. Log into system.tbrglobal.com manually
2. Navigate to the upcoming trips page
3. Open browser DevTools → Network tab
4. Check if trips load via JSON API or are rendered in HTML

If JSON API exists:
- Update n8n workflow to use HTTP Request node instead of browser automation
- This is faster and more reliable

If HTML only:
- Use n8n Playwright/Browser node for scraping
- The Code node in the template has placeholder logic

### 5. Configure Zapier for LimoAnywhere

Since LimoAnywhere doesn't have direct API access at standard account levels:

1. Create a Zap with trigger: "Webhooks by Zapier" → "Catch Hook"
2. Note the webhook URL
3. Add action: "LimoAnywhere" → "Create Reservation"
4. Map fields from webhook to LA fields
5. Add `ZAPIER_LA_WEBHOOK_URL` to your Nebo env

### 6. Activate the Workflow

1. In n8n, activate the TBR scraper workflow
2. It will run every 30 minutes
3. Monitor the #dispatch-alerts Slack channel for sync results

## API Endpoints

### POST /api/tbr/ingest

Receives scraped trips from n8n.

**Headers:**
- `x-tbr-ingest-secret`: Your TBR_INGEST_SECRET

**Body:**
```json
{
  "trips": [
    {
      "tbrTripId": "TBR-12345",
      "status": "Confirmed",
      "passengerName": "John Doe",
      "passengerPhone": "+15551234567",
      "passengerEmail": "john@example.com",
      "passengerCount": 2,
      "pickupDatetime": "2024-03-15T14:00:00Z",
      "pickupAddress": "123 Main St, Dallas, TX",
      "dropoffAddress": "DFW Airport, Terminal D",
      "vehicleType": "Executive Sedan",
      "flightNumber": "AA1234",
      "notes": "VIP client",
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
  "unchanged": 10,
  "statusChanges": 1,
  "alertsSent": 1,
  "errors": []
}
```

### POST /api/tbr/sync

Manual sync trigger. Requires CRON_SECRET auth.

### GET /api/tbr/sync

Get current sync status (development only).

## Dashboard

Access the TBR trips dashboard at `/tbr-trips`.

Features:
- View all TBR trips with status badges
- Filter by TBR status and LA sync status
- Search by passenger, TBR ID, or address
- Click trip row to view details
- Push unpushed trips to LimoAnywhere
- See status change alerts for pushed trips

## Status Codes

### TBR Status
- **PENDING**: New trip from TBR
- **CONFIRMED**: Confirmed by TBR
- **MODIFIED**: Trip details changed (⚠️ alert if pushed)
- **CANCELLED**: Trip cancelled (⚠️ alert if pushed)

### LA Sync Status
- **NOT_PUSHED**: Not yet sent to LimoAnywhere
- **PUSHED**: Successfully created in LA
- **PUSH_FAILED**: Push attempt failed

## Alerts

SMS alerts are sent when:
1. A trip that was already pushed to LA changes status to MODIFIED or CANCELLED
2. Alerts go to the number in `TWILIO_TO` env variable

Alert format:
```
⚠️ TBR Trip TBR-12345 Status Changed
Passenger: John Doe
Date: Mar 15, 2024 2:00 PM
CONFIRMED → CANCELLED
LA Res: LA-123456
Action Required: Update in LimoAnywhere
```

## Troubleshooting

### n8n workflow not running
- Check schedule trigger is enabled
- Verify credentials are correct
- Check n8n execution logs

### Trips not appearing in Nebo
- Verify TBR_INGEST_SECRET matches
- Check n8n → Nebo API call response
- Look at Nebo server logs

### Push to LA failing
- Verify Zapier webhook URL is correct
- Check Zapier task history
- Ensure LA credentials in Zapier are valid

### Vehicle types not mapping correctly
- Check `/admin/tbr-settings` for mappings
- Add missing TBR vehicle types
- Mappings are case-insensitive with partial matching

## Files

- `/src/lib/tbrTripActions.ts` - Core business logic
- `/src/lib/vehicleMappingActions.ts` - Vehicle mapping CRUD
- `/src/app/api/tbr/ingest/route.ts` - n8n ingestion endpoint
- `/src/app/api/tbr/sync/route.ts` - Sync trigger endpoint
- `/src/app/tbr-trips/` - Dashboard UI
- `/n8n-workflows/tbr-trip-scraper.json` - n8n workflow template
