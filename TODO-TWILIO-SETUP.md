# Twilio SMS Setup TODO

## Real-time Updates Setup (Required for live SMS updates)

### 1. Enable Supabase Replication
- [ ] Go to Supabase Dashboard → **Database** → **Replication**
- [ ] Find `SMSLog` table and toggle it **ON**

Or run this SQL in Supabase SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE "SMSLog";
```

### 2. Add Anon Key to .env
- [ ] Go to Supabase Dashboard → **Settings** → **API**
- [ ] Copy the `anon` `public` key
- [ ] Add to `.env`:
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Production Deployment Checklist

### Environment Variables
- [ ] Remove `TWILIO_SKIP_SIGNATURE_VALIDATION=true` (CRITICAL for security)
- [ ] Set `TWILIO_STATUS_CALLBACK_URL` to your production domain:
  ```
  TWILIO_STATUS_CALLBACK_URL=https://yourdomain.com/api/twilio/status
  ```
- [ ] Set `TWILIO_WEBHOOK_URL` if behind proxy/CDN:
  ```
  TWILIO_WEBHOOK_URL=https://yourdomain.com/api/twilio/webhook
  ```

### Twilio Console Setup
- [ ] Go to **Phone Numbers** → Your number → **Messaging Configuration**
- [ ] Set webhook URL: `https://yourdomain.com/api/twilio/webhook`
- [ ] Set HTTP method to **POST**

### A2P 10DLC Registration (US Compliance)
- [ ] Register your business in Twilio Console for A2P 10DLC
- [ ] This prevents carrier filtering and improves deliverability
- [ ] Required for sending business SMS in the US

---

## Features Implemented

- [x] E.164 phone number validation
- [x] Webhook signature validation (security)
- [x] Opt-out/STOP keyword handling (compliance)
- [x] Delivery status callbacks
- [x] Message segment cost warnings
- [x] Rate limiting (50 MPS)
- [x] Retry with exponential backoff
- [x] Real-time updates hook (needs Supabase setup)
- [x] Contact linking to Affiliates/Quotes
