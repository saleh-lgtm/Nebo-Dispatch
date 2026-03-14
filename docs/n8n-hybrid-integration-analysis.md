# Hybrid Integration Analysis: n8n Email Manifests + Zapier Accounts

## Executive Summary

This document analyzes a cost-optimized integration strategy:
- **Email Manifests via n8n** (IMAP) - For reservations, updates, trips
- **Zapier** (minimal) - Only for account creation/updates

This approach reduces Zapier costs by **~80-90%** while maintaining full functionality.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Cost Comparison](#2-cost-comparison)
3. [Email Manifest Workflow (n8n)](#3-email-manifest-workflow-n8n)
4. [Zapier Scope (Accounts Only)](#4-zapier-scope-accounts-only)
5. [Technical Implementation](#5-technical-implementation)
6. [Pros and Cons](#6-pros-and-cons)
7. [Latency Analysis](#7-latency-analysis)
8. [Recommended Approach](#8-recommended-approach)

---

## 1. Architecture Overview

### Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRIP/RESERVATION DATA                              │
│                                                                              │
│  ┌─────────────────┐     ┌─────────────┐     ┌─────────────────┐            │
│  │  LimoAnywhere   │────►│   n8n       │────►│  Nebo App       │            │
│  │  (Sends Email   │     │  (IMAP +    │     │  /api/manifests │            │
│  │   Manifests)    │     │   Parse)    │     │  /ingest        │            │
│  └─────────────────┘     └─────────────┘     └─────────────────┘            │
│                                                                              │
│  Flow: LimoAnywhere sends manifest email → n8n reads via IMAP →             │
│        n8n parses trip data → POSTs to Nebo API → TripConfirmations created │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           ACCOUNT DATA (LOW VOLUME)                          │
│                                                                              │
│  ┌─────────────────┐     ┌─────────────┐     ┌─────────────────┐            │
│  │  LimoAnywhere   │────►│   Zapier    │────►│  Nebo App       │            │
│  │  (Account       │     │  (Trigger)  │     │  (Webhook)      │            │
│  │   Events)       │     │             │     │                 │            │
│  └─────────────────┘     └─────────────┘     └─────────────────┘            │
│                                                                              │
│  Flow: LA account event → Zapier trigger → Webhook to n8n/Nebo →            │
│        Customer synced                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cost Comparison

### Full Zapier Approach (Original)

| Event Type | Daily Volume | Monthly Tasks | % of Total |
|------------|-------------|---------------|------------|
| New reservations | 30 | 900 | 26% |
| Updated reservations | 50 | 1,500 | 43% |
| New quotes | 20 | 600 | 17% |
| Invoice finalized | 20 | 600 | 17% |
| **Subtotal (Trips)** | 120 | **3,600** | **86%** |
| New accounts | 3 | 90 | 3% |
| Updated accounts | 5 | 150 | 4% |
| New payment | 10 | 300 | 9% |
| **Subtotal (Accounts)** | 18 | **540** | **14%** |
| **TOTAL** | 138 | **4,140** | 100% |

**Required Plan:** Team ($449/month) or higher

### Hybrid Approach (Email + Zapier)

| Channel | Event Type | Monthly Tasks | Cost |
|---------|------------|---------------|------|
| n8n IMAP | Manifests (all trips) | 0 | $0 |
| Zapier | New accounts | 90 | - |
| Zapier | Updated accounts | 150 | - |
| Zapier | (Optional) Payments | 300 | - |
| **Zapier Total** | | **240-540** | **$0-30/mo** |

**Required Plan:** Free (100) or Starter ($30/month for 750)

### Monthly Savings

| Approach | Monthly Cost | Annual Cost |
|----------|-------------|-------------|
| Full Zapier | $449 | $5,388 |
| Hybrid (Email + Zapier) | $0-30 | $0-360 |
| **SAVINGS** | **$419-449** | **$5,028-5,388** |

---

## 3. Email Manifest Workflow (n8n)

### How LimoAnywhere Sends Manifests

LimoAnywhere typically sends daily manifest emails containing:
- All reservations for the day
- Pickup times, locations, passenger info
- Driver assignments
- Vehicle assignments
- Special instructions

### Your Existing Infrastructure

**Nebo already has manifest ingestion built:**

```
/api/manifests/ingest (POST)
├── Accepts: JSON, form-data, CloudMailin, SendGrid formats
├── Authentication: Basic Auth, x-manifest-secret header, URL param
├── Rate Limiting: 100 requests/hour
├── Parsing: parseManifestEmail() extracts trips
└── Output: Creates TripConfirmation records
```

### n8n Email Manifest Workflow

```
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│  Email Trigger     │────►│  Parse/Extract     │────►│  POST to Nebo      │
│  (IMAP)            │     │  Email Body        │     │  /api/manifests    │
│                    │     │                    │     │  /ingest           │
│  - Poll every 5min │     │  - Get plain text  │     │                    │
│  - Filter: from LA │     │  - Extract body    │     │  - Auth header     │
│  - Mark as read    │     │  - Get subject     │     │  - JSON payload    │
└────────────────────┘     └────────────────────┘     └────────────────────┘
         │                          │                          │
         ▼                          ▼                          ▼
   Check every 5min          Format for API            Nebo parses &
   for new manifests         ingestion endpoint        creates trips
```

### Workflow Configuration

```json
{
  "nodes": [
    {
      "name": "Email Trigger (IMAP)",
      "type": "n8n-nodes-base.emailReadImap",
      "typeVersion": 2.1,
      "parameters": {
        "mailbox": "INBOX",
        "postProcessAction": "read",
        "format": "simple",
        "options": {
          "customEmailConfig": {
            "from": "*@limoanywhere.com"
          }
        }
      },
      "credentials": {
        "imap": "LimoAnywhere Manifest Email"
      }
    },
    {
      "name": "Format for Nebo API",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "body": "={{ $json.text }}",
          "from": "={{ $json.from }}",
          "subject": "={{ $json.subject }}"
        }
      }
    },
    {
      "name": "POST to Nebo",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://your-nebo-app.com/api/manifests/ingest",
        "method": "POST",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpBasicAuth",
        "sendBody": true,
        "bodyParameters": {
          "body": "={{ $json.body }}",
          "from": "={{ $json.from }}",
          "subject": "={{ $json.subject }}"
        }
      }
    }
  ]
}
```

### Email Setup Requirements

1. **Dedicated Email Account** - e.g., `manifests@neborides.com`
2. **IMAP Access** - Gmail, Microsoft 365, or custom
3. **LimoAnywhere Configuration** - Set manifest email destination
4. **n8n Credentials** - IMAP credentials configured

---

## 4. Zapier Scope (Accounts Only)

### Minimal Zapier Usage

| Zapier Trigger | Monthly Volume | Purpose |
|----------------|----------------|---------|
| New Account | ~90 | Sync new customers to Nebo |
| Updated Account | ~150 | Update customer info |
| **Total** | **~240** | Fits in **Free** or **Starter** plan |

### Zap 1: New Account → Nebo

```
Trigger: LimoAnywhere → New Account
Action: Webhooks by Zapier → POST to n8n webhook

Payload:
{
  "event": "new_account",
  "account_id": "{{account_id}}",
  "name": "{{first_name}} {{last_name}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "company": "{{company}}"
}
```

### Zap 2: Updated Account → Nebo

```
Trigger: LimoAnywhere → Updated Account
Action: Webhooks by Zapier → POST to n8n webhook

Payload:
{
  "event": "updated_account",
  "account_id": "{{account_id}}",
  "changes": {
    "name": "{{name}}",
    "email": "{{email}}",
    "phone": "{{phone}}"
  }
}
```

---

## 5. Technical Implementation

### Phase 1: n8n Email Manifest (Week 1)

| Task | Effort |
|------|--------|
| Set up dedicated manifest email account | 1 hour |
| Configure IMAP credentials in n8n | 30 min |
| Create Email Trigger workflow | 2 hours |
| Configure LimoAnywhere to send manifests to email | 1 hour |
| Test end-to-end flow | 2 hours |
| Monitor and verify trip creation | Ongoing |

### Phase 2: Zapier Accounts (Week 2)

| Task | Effort |
|------|--------|
| Create Zapier account (if needed) | 15 min |
| Create Zap: New Account → n8n | 1 hour |
| Create Zap: Updated Account → n8n | 1 hour |
| Create n8n workflow to process accounts | 2 hours |
| Create Nebo API endpoint for accounts | 3 hours |
| Test end-to-end | 2 hours |

### Required Nebo API Endpoints

```typescript
// Already exists:
POST /api/manifests/ingest

// Need to create:
POST /api/n8n/accounts
  - Create or update customer record
  - Body: { event, account_id, name, email, phone, company }

POST /api/n8n/accounts/:id
  - Update existing customer
  - Body: { changes: {...} }
```

---

## 6. Pros and Cons

### Email Manifest Approach

| Pros | Cons |
|------|------|
| **$0 cost** - No Zapier tasks | Slight delay (5-min polling) |
| **Already built** - Nebo has ingestion API | Requires email account setup |
| **Reliable** - Email is battle-tested | Email delivery can fail (rare) |
| **Full data** - Complete manifest included | Parsing depends on email format |
| **Unlimited volume** - No task limits | Need to configure LA email settings |
| **Direct control** - No third-party dependency | - |

### Zapier for Accounts Only

| Pros | Cons |
|------|------|
| **Real-time** - Instant triggers | Still costs $0-30/month |
| **Simple setup** - Point and click | Vendor dependency |
| **Account-specific** - Captures all fields | Limited to Zapier's exposed fields |
| **Low volume** - Fits free tier | Tasks can add up |

### Comparison Matrix

| Factor | Full Zapier | Hybrid (Email + Zapier) |
|--------|-------------|------------------------|
| **Monthly Cost** | $449 | $0-30 |
| **Latency (Trips)** | 1-3 sec | 5-10 min (polling) |
| **Latency (Accounts)** | 1-3 sec | 1-3 sec |
| **Reliability** | High | High |
| **Complexity** | Low | Medium |
| **Vendor Lock-in** | High | Low |
| **Scalability** | Limited by tasks | Unlimited |

---

## 7. Latency Analysis

### Email Manifest Timing

| Step | Duration | Cumulative |
|------|----------|------------|
| LA sends manifest email | Instant | 0 |
| Email delivery | 10-60 sec | ~30 sec |
| n8n polls (5-min interval) | 0-5 min | ~2.5 min avg |
| n8n processes email | 1-2 sec | ~2.5 min |
| Nebo creates confirmations | 1-2 sec | **~3 min avg** |

**Impact:** TripConfirmations appear within 3-7 minutes of manifest generation.
**For 2-hour confirmations:** This delay is **negligible** (0.25% of window).

### Zapier Account Timing

| Step | Duration | Cumulative |
|------|----------|------------|
| LA creates/updates account | Instant | 0 |
| Zapier trigger | Instant | 0 |
| Zapier → n8n webhook | 1-2 sec | 2 sec |
| n8n processes | 1 sec | 3 sec |
| Nebo syncs account | 1 sec | **~4 sec total** |

**Impact:** Customer data syncs within seconds.

---

## 8. Recommended Approach

### Final Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     RECOMMENDED HYBRID SETUP                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   HIGH VOLUME (via n8n Email - $0/month):                        │
│   ├── Daily manifest emails → TripConfirmations                  │
│   ├── Trip updates (in manifest)                                 │
│   └── Quote data (if included in manifest)                       │
│                                                                   │
│   LOW VOLUME (via Zapier - $0-30/month):                         │
│   ├── New Account → Customer sync                                │
│   └── Updated Account → Customer update                          │
│                                                                   │
│   OPTIONAL ADDITIONS (if needed):                                │
│   ├── Invoice Finalized → Billing flag (Zapier)                  │
│   └── Payment Received → Payment sync (Zapier)                   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Monthly Cost Summary

| Component | Tasks | Cost |
|-----------|-------|------|
| n8n Email Manifests | Unlimited | $0 (included in n8n) |
| Zapier: New Account | ~90 | - |
| Zapier: Updated Account | ~150 | - |
| **Zapier Total** | **~240** | **$0 (Free tier)** |
| **TOTAL** | - | **$0-30/month** |

### vs Original Full Zapier: **Save $419-449/month**

---

## Implementation Checklist

### Week 1: Email Manifest Setup

- [ ] Create dedicated email: `manifests@neborides.com`
- [ ] Enable IMAP access on email account
- [ ] Configure n8n IMAP credentials
- [ ] Create n8n Email Trigger workflow
- [ ] Test with sample manifest email
- [ ] Configure LimoAnywhere to send manifests to new email
- [ ] Verify TripConfirmations being created
- [ ] Set up alerting for failed ingestions

### Week 2: Zapier Accounts Setup

- [ ] Create/login to Zapier account
- [ ] Connect LimoAnywhere to Zapier
- [ ] Create Zap: New Account → n8n webhook
- [ ] Create Zap: Updated Account → n8n webhook
- [ ] Build n8n workflow to process account webhooks
- [ ] Create Nebo `/api/n8n/accounts` endpoint
- [ ] Test account sync end-to-end
- [ ] Monitor Zapier task usage

### Week 3: Verification & Optimization

- [ ] Verify all trips syncing correctly
- [ ] Verify accounts syncing correctly
- [ ] Set up monitoring/alerting
- [ ] Document the integration
- [ ] Train team on new workflow
- [ ] Remove any unused Zapier zaps

---

## Questions to Confirm

Before implementation, confirm with LimoAnywhere:

1. **Does LA send manifest emails?** (Most systems do - daily/hourly summaries)
2. **What format are the manifest emails?** (HTML, plain text, PDF attachment?)
3. **Can you configure the destination email address?**
4. **How often are manifests sent?** (Real-time, hourly, daily?)
5. **What trip data is included in the manifest?**

---

*Document prepared: February 27, 2026*
*Version: 1.0*
