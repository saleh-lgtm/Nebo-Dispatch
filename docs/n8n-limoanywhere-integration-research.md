# n8n Integration Research: Nebo Dispatch App & LimoAnywhere

## Executive Summary

This document outlines the integration opportunities between your **Nebo Dispatch App** and **LimoAnywhere** using **n8n** as the automation middleware. The goal is to eliminate manual data entry, improve real-time synchronization, and enhance operational efficiency.

---

## Table of Contents

1. [Current System Analysis](#1-current-system-analysis)
2. [LimoAnywhere API Capabilities](#2-limoanywhere-api-capabilities)
3. [Integration Architecture](#3-integration-architecture)
4. [Recommended Workflows](#4-recommended-workflows)
5. [n8n Nodes & Tools](#5-n8n-nodes--tools)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Best Practices & Security](#7-best-practices--security)

---

## 1. Current System Analysis

### Nebo Dispatch App Features

Your Nebo dispatch app is a sophisticated operations management platform with:

| Feature Category | Capabilities |
|-----------------|--------------|
| **Shift Management** | Clock in/out, shift reports, metrics tracking, admin review |
| **Quote Management** | Lead tracking, follow-ups, 72-hour expiration, action history |
| **Trip Confirmations** | 2-hour pre-pickup reminders, manifest ingestion, accountability |
| **SMS Communications** | Twilio integration, conversation threading, opt-out compliance |
| **Affiliate Network** | FARM_IN/FARM_OUT partners, IOS, house chauffeurs, pricing grids |
| **Fleet Management** | Vehicle inventory, documents, permits, maintenance tracking |
| **Billing & Accounting** | Reservation flagging, billing reviews, dispute tracking |
| **SOPs & Tasks** | Standard procedures, task assignments, acknowledgment tracking |

### Key Data Models

- **User** - Dispatchers, admins, drivers with role-based access
- **Shift/ShiftReport** - Clock times, metrics, narratives, billing flags
- **Quote** - Leads with service types (Airport Transfer, Hourly, Point-to-Point, etc.)
- **TripConfirmation** - Pickup times, driver confirmation status
- **Affiliate** - Partners with pricing, documents, contacts
- **FleetVehicle** - Sedans, SUVs, Vans, Buses, Limos, Sprinters
- **SMSLog** - Twilio message tracking

### Existing Integrations

- **Twilio** - SMS/WhatsApp messaging
- **Supabase** - File storage
- **PostgreSQL** - Database via Prisma ORM
- **NextAuth** - Authentication

---

## 2. LimoAnywhere Integration via Zapier

> **Note:** Direct API access is not available at our account level. LimoAnywhere integrates with **Zapier**, which we'll use as a bridge to n8n.

### Architecture: LimoAnywhere → Zapier → n8n → Nebo

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  LimoAnywhere   │────►│   Zapier    │────►│    n8n      │────►│    Nebo     │
│  (Events)       │     │  (Bridge)   │     │  (Webhook)  │     │    App      │
└─────────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Available Zapier Triggers (LimoAnywhere → n8n)

These events can trigger Zaps that send data to n8n webhooks:

| Trigger | Description | Use Case |
|---------|-------------|----------|
| **New Reservation** | Fires when reservation is created | Create TripConfirmation in Nebo |
| **Updated Reservation** | Fires when reservation details change | Alert dispatchers, update records |
| **New Quote Request** | Fires when quote is submitted | Create Quote in Nebo for follow-up |
| **New Finalized Invoice** | Invoice marked as FINALIZED | Trigger billing review |
| **New Paid Reservation** | Payment status becomes PAID | Update accounting flags |
| **New Payment** | Payment transaction recorded | Sync payment status |
| **New Account** | Customer account created | Sync customer to Nebo |
| **Updated Account** | Account info changes | Update customer records |
| **New Driver Pay Log** | Driver payment created | Track driver compensation |
| **New Paid Bill** | Affiliate/Agent bill paid | Update affiliate records |

### Available Zapier Actions (n8n → LimoAnywhere)

n8n can trigger Zapier webhooks to perform these actions in LimoAnywhere:

| Action | Description | Use Case |
|--------|-------------|----------|
| **Create Reservation** | Create new reservation | Convert won quotes to bookings |
| **Create Quote Request** | Submit new quote | Sync Nebo quotes to LA |
| **Create Account** | Create customer account | Sync new customers |
| **Find Account** | Search by account ID | Lookup customer info |

### Resources

- [LimoAnywhere Zapier Integration Guide](https://kb.limoanywhere.com/docs/zapier-integration/)
- [Zapier + LimoAnywhere Integrations](https://zapier.com/apps/limo-anywhere/integrations)
- [New Reservation Trigger Setup](https://kb.limoanywhere.com/docs/how-to-utilize-the-zapier-new-reservation-trigger/)
- [New Quote Trigger Setup](https://kb.limoanywhere.com/docs/how-to-utilize-the-zapier-new-quote-trigger/)

---

## 3. Integration Architecture

### High-Level Architecture (via Zapier Bridge)

```
┌─────────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  LimoAnywhere   │────►│   Zapier    │────►│    n8n      │────►│  Nebo Dispatch  │
│  (Source of     │     │  (Bridge)   │     │  (Workflow  │     │  App (Your      │
│   Truth)        │     │             │     │  Automation)│     │   Interface)    │
└─────────────────┘     └─────────────┘     └─────────────┘     └─────────────────┘
        ▲                      │                   │                     │
        │                      ▼                   ▼                     ▼
        │               ┌──────────┐         ┌──────────┐         Shift Reports
        │               │ Webhooks │         │  Twilio  │         Confirmations
        └───────────────│  to n8n  │         │  Slack   │         Quotes
      (via Zapier       └──────────┘         │  Email   │         Affiliates
       Actions)                              └──────────┘
```

### Data Flow Patterns

1. **LimoAnywhere → Nebo** (via Zapier Triggers → n8n Webhooks)
   - New reservation → Zapier → n8n webhook → Create TripConfirmation
   - Reservation updated → Zapier → n8n → Notify dispatchers
   - Invoice finalized → Zapier → n8n → Create billing flag
   - New quote request → Zapier → n8n → Create Nebo Quote

2. **Nebo → LimoAnywhere** (via n8n → Zapier Webhooks)
   - Quote won in Nebo → n8n → Zapier webhook → Create LA reservation
   - New customer in Nebo → n8n → Zapier → Create LA account

3. **Zapier Setup Required**
   - Create Zaps with LimoAnywhere triggers
   - Use "Webhooks by Zapier" action to POST to n8n
   - Create Zaps with "Webhooks by Zapier" trigger for n8n → LA actions

---

## 4. Recommended Workflows

### Priority 1: Essential Automations

#### 4.1 New Reservation → Trip Confirmation

**Zapier Trigger:** New Reservation in LimoAnywhere
**n8n Webhook:** Receives reservation data
**Purpose:** Auto-create TripConfirmation records for 2-hour reminder system

```
[Zapier: New Reservation] → [Webhook to n8n]
    → [n8n: Parse reservation data]
    → [Calculate confirmation due time (pickup - 2 hours)]
    → [Create TripConfirmation in Nebo DB]
    → [Send Slack notification to dispatch channel]
```

**Zapier Setup:**
1. Trigger: LimoAnywhere → New Reservation
2. Action: Webhooks by Zapier → POST to `https://neborides.app.n8n.cloud/webhook/new-reservation`

**Benefits:**
- Eliminates manual manifest entry
- Real-time trip sync
- Automatic 2-hour confirmation windows

#### 4.2 Reservation Updated → Dispatcher Alert

**Zapier Trigger:** Updated Reservation in LimoAnywhere
**n8n Webhook:** Receives update data
**Purpose:** Alert dispatchers of trip changes instantly

```
[Zapier: Updated Reservation] → [Webhook to n8n]
    → [n8n: Compare with existing TripConfirmation]
    → [Determine change type (time, location, cancel)]
    → [IF critical change]
        → [Send Twilio SMS to on-duty dispatcher]
        → [Create Nebo notification]
    → [Update TripConfirmation record]
```

**Zapier Setup:**
1. Trigger: LimoAnywhere → Updated Reservation
2. Action: Webhooks by Zapier → POST to `https://neborides.app.n8n.cloud/webhook/reservation-updated`

**Benefits:**
- Instant awareness of changes
- No missed updates
- Audit trail in Nebo

#### 4.3 New Quote Request → Nebo Quote

**Zapier Trigger:** New Quote Request in LimoAnywhere
**n8n Webhook:** Receives quote data
**Purpose:** Sync LA quotes to Nebo for follow-up tracking

```
[Zapier: New Quote Request] → [Webhook to n8n]
    → [n8n: Parse quote details]
    → [Create Quote record in Nebo]
    → [Set 24-hour follow-up reminder]
    → [Notify dispatcher via Slack]
```

**Zapier Setup:**
1. Trigger: LimoAnywhere → New Quote Request
2. Action: Webhooks by Zapier → POST to `https://neborides.app.n8n.cloud/webhook/new-quote`

**Benefits:**
- Centralized quote tracking
- Automatic follow-up reminders
- No quotes fall through cracks

#### 4.4 Quote Won → Create LA Reservation

**Trigger:** Nebo webhook when quote marked as WON
**n8n Action:** Trigger Zapier to create reservation
**Purpose:** Auto-create reservation in LimoAnywhere

```
[Nebo: Quote Won] → [Webhook to n8n]
    → [n8n: Format reservation data]
    → [HTTP POST to Zapier Webhook]
    → [Zapier: Create Reservation in LA]
    → [n8n: Update Nebo quote with LA confirmation]
    → [Send confirmation SMS to customer]
```

**Zapier Setup:**
1. Trigger: Webhooks by Zapier → Catch Hook
2. Action: LimoAnywhere → Create Reservation

**Benefits:**
- Zero manual reservation entry
- Faster customer confirmation
- Reduced errors

### Priority 2: Operational Enhancements

#### 4.4 Daily Driver Schedule Sync

**Trigger:** Schedule (6:00 AM daily)
**Purpose:** Sync driver assignments from LA to Nebo

```
[Schedule: 6 AM] → [HTTP Request: Get today's driver assignments]
    → [Loop: For each assignment]
        → [Match driver to Nebo affiliate/house chauffeur]
        → [Update driver schedule in Nebo]
    → [Send daily brief to dispatchers]
```

#### 4.5 Billing Review Automation

**Trigger:** LimoAnywhere webhook (invoice.finalized)
**Purpose:** Flag trips for accounting review in Nebo

```
[Webhook: invoice.finalized] → [Get invoice details]
    → [Compare actual vs quoted charges]
    → [IF discrepancy > threshold]
        → [Create Nebo BillingReview record]
        → [Notify accounting team]
    → [Log completion in Nebo]
```

#### 4.6 Fleet Status Sync

**Trigger:** Schedule (hourly) + manual trigger
**Purpose:** Keep vehicle availability in sync

```
[Schedule/Manual] → [HTTP Request: Get LA vehicle status]
    → [Loop: Match to Nebo FleetVehicle]
    → [Update status (ACTIVE, MAINTENANCE, etc.)]
    → [IF vehicle goes to maintenance]
        → [Alert operations manager]
```

### Priority 3: Advanced Integrations

#### 4.7 Customer Communication Hub

**Trigger:** Multiple (booking confirmation, day-before reminder, post-trip survey)

```
[Trigger: Booking confirmed] → [Get customer details]
    → [Send booking confirmation via Twilio]
    → [Schedule reminder for day before]

[Trigger: 24 hours before trip] → [Send reminder SMS]
    → [Include driver info, vehicle type]

[Trigger: Trip completed] → [Wait 2 hours]
    → [Send satisfaction survey]
```

#### 4.8 Affiliate Pricing Sync

**Trigger:** Nebo affiliate pricing updated
**Purpose:** Sync pricing changes to LimoAnywhere

```
[Webhook: Nebo pricing change] → [Get affiliate pricing grid]
    → [Map to LA pricing format]
    → [HTTP Request: Update LA vendor pricing]
    → [Log sync completion]
```

#### 4.9 Real-time Dispatch Dashboard

**Trigger:** Schedule (every 30 seconds)
**Purpose:** Live trip status feed

```
[Schedule: 30s] → [HTTP Request: Get active trips from LA]
    → [Calculate ETAs, status]
    → [Webhook: Push to Nebo real-time dashboard]
```

#### 4.10 Intelligent Quote Follow-up

**Trigger:** Schedule + AI processing
**Purpose:** AI-powered lead prioritization

```
[Schedule: Every hour] → [Get open quotes from Nebo]
    → [AI Agent: Analyze quote history and customer signals]
    → [Prioritize leads by likelihood to convert]
    → [Send prioritized list to dispatchers]
    → [Auto-send follow-up emails for warm leads]
```

---

## 5. n8n Nodes & Tools

### Core Nodes for This Integration

| Node | Purpose | Use Case |
|------|---------|----------|
| **HTTP Request** | API calls to LimoAnywhere | All CRUD operations |
| **Webhook** | Receive events from LA/Nebo | Real-time triggers |
| **Schedule Trigger** | Periodic syncs | Daily/hourly jobs |
| **Twilio** | SMS/WhatsApp | Customer & driver comms |
| **Slack** | Team notifications | Dispatcher alerts |
| **Postgres** | Direct DB access | Nebo database operations |
| **Code** | Custom logic | Data transformation |
| **IF/Switch** | Conditional routing | Decision trees |
| **Loop Over Items** | Batch processing | Multi-record sync |

### Recommended Community Nodes

| Node | Purpose |
|------|---------|
| **n8n-nodes-base.respondToWebhook** | Webhook responses |
| **@n8n/n8n-nodes-langchain.agent** | AI-powered decisions |
| **n8n-nodes-base.aggregate** | Data rollups |

### Sample HTTP Request Configuration

```json
{
  "nodeType": "nodes-base.httpRequest",
  "parameters": {
    "url": "https://api.limoanywhere.com/v1/reservations",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "method": "GET",
    "sendQuery": true,
    "queryParameters": {
      "date": "={{ $now.format('yyyy-MM-dd') }}",
      "status": "confirmed"
    }
  }
}
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

| Task | Priority | Effort |
|------|----------|--------|
| Set up Zapier account (if not done) | High | 1 hour |
| Create n8n webhook endpoints | High | 1 day |
| Create first Zap: New Reservation → n8n | High | 2 hours |
| Build n8n workflow for TripConfirmation | High | 2 days |
| Test end-to-end reservation sync | High | 1 day |
| Create Nebo API endpoints for n8n | High | 2 days |

### Phase 2: Core Automation (Week 3-4)

| Task | Priority | Effort |
|------|----------|--------|
| Create Zap: Updated Reservation → n8n | High | 2 hours |
| Build dispatcher notification workflow | High | 1 day |
| Create Zap: New Quote Request → n8n | High | 2 hours |
| Build quote sync workflow | High | 1 day |
| Create reverse Zap: n8n → Create Reservation | High | 3 hours |
| Build Quote Won → LA Reservation workflow | High | 2 days |
| End-to-end testing | High | 1 day |

### Phase 3: Enhancement (Week 5-6)

| Task | Priority | Effort |
|------|----------|--------|
| Create Zap: Invoice Finalized → n8n | Medium | 2 hours |
| Build billing review workflow | Medium | 2 days |
| Create Zap: New Payment → n8n | Medium | 2 hours |
| Build payment sync workflow | Medium | 1 day |
| Customer communication workflows | Medium | 3 days |

### Phase 4: Intelligence (Week 7-8)

| Task | Priority | Effort |
|------|----------|--------|
| AI-powered quote prioritization | Low | 3 days |
| Advanced analytics workflows | Low | 3 days |
| Documentation & training | Medium | 2 days |
| Monitor & optimize Zapier task usage | Medium | Ongoing |

---

## 7. Best Practices & Security

### API Security

1. **Credential Management**
   - Store API keys in n8n credentials, never in workflow
   - Use environment variables for sensitive data
   - Rotate API keys quarterly

2. **Webhook Security**
   - Validate webhook signatures from LimoAnywhere
   - Use HTTPS only
   - Implement rate limiting

3. **Data Protection**
   - Encrypt sensitive customer data
   - Log all API transactions for audit
   - Implement PII masking in logs

### Error Handling

```javascript
// Example error handling in n8n Code node
try {
  const response = await $http.request({
    method: 'POST',
    url: 'https://api.limoanywhere.com/v1/reservations',
    body: reservationData
  });
  return { success: true, data: response };
} catch (error) {
  // Log error to Slack
  await $http.request({
    method: 'POST',
    url: 'https://hooks.slack.com/services/YOUR/WEBHOOK',
    body: {
      text: `LimoAnywhere API Error: ${error.message}`,
      channel: '#dispatch-errors'
    }
  });
  return { success: false, error: error.message };
}
```

### Monitoring & Alerting

1. **Workflow Monitoring**
   - Set up n8n execution alerts
   - Monitor failed executions
   - Track execution times

2. **Data Quality**
   - Validate data before sync
   - Flag mismatches for review
   - Daily reconciliation reports

3. **Performance**
   - Use pagination for large datasets
   - Implement retry logic with backoff
   - Cache frequently accessed data

### Recommended Slack Channels

| Channel | Purpose |
|---------|---------|
| `#n8n-alerts` | Critical workflow failures |
| `#trip-updates` | Real-time reservation changes |
| `#billing-review` | Accounting flags |
| `#dispatch-ops` | General dispatch notifications |

---

## Appendix A: Zapier Setup Instructions

### Step 1: Create n8n Webhook Endpoints

In your n8n instance, create these webhook triggers:

| Webhook Path | Purpose |
|--------------|---------|
| `/webhook/new-reservation` | Receive new reservations from LA |
| `/webhook/reservation-updated` | Receive reservation updates |
| `/webhook/new-quote` | Receive new quote requests |
| `/webhook/invoice-finalized` | Receive finalized invoices |
| `/webhook/payment-received` | Receive payment notifications |

### Step 2: Create Zaps (LimoAnywhere → n8n)

**Zap 1: New Reservation → n8n**
1. Trigger: LimoAnywhere → New Reservation
2. Action: Webhooks by Zapier → POST
   - URL: `https://neborides.app.n8n.cloud/webhook/new-reservation`
   - Payload Type: JSON
   - Data: Map all reservation fields

**Zap 2: Updated Reservation → n8n**
1. Trigger: LimoAnywhere → Updated Reservation
2. Action: Webhooks by Zapier → POST
   - URL: `https://neborides.app.n8n.cloud/webhook/reservation-updated`

**Zap 3: New Quote Request → n8n**
1. Trigger: LimoAnywhere → New Quote Request
2. Action: Webhooks by Zapier → POST
   - URL: `https://neborides.app.n8n.cloud/webhook/new-quote`

### Step 3: Create Zaps (n8n → LimoAnywhere)

**Zap 4: Create Reservation from n8n**
1. Trigger: Webhooks by Zapier → Catch Hook
   - Get your Zapier webhook URL
2. Action: LimoAnywhere → Create Reservation
   - Map fields from webhook payload

### Zapier Pricing Consideration

- Free plan: 100 tasks/month
- Starter: 750 tasks/month ($29.99)
- Professional: 2,000 tasks/month ($73.50)

*Each Zap execution = 1 task. Monitor usage if high volume.*

---

## Appendix B: Nebo API Endpoints to Create

For n8n to interact with Nebo, consider adding these API routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/n8n/confirmations` | POST | Create TripConfirmation |
| `/api/n8n/confirmations/{id}` | PUT | Update confirmation |
| `/api/n8n/quotes/{id}/won` | POST | Mark quote as won |
| `/api/n8n/notifications` | POST | Create system notification |
| `/api/n8n/billing-flags` | POST | Create billing flag |

---

## Appendix C: Resources

- [LimoAnywhere Zapier Integration Guide](https://kb.limoanywhere.com/docs/zapier-integration/)
- [Zapier + LimoAnywhere Integrations](https://zapier.com/apps/limo-anywhere/integrations)
- [New Reservation Trigger Setup](https://kb.limoanywhere.com/docs/how-to-utilize-the-zapier-new-reservation-trigger/)
- [New Quote Trigger Setup](https://kb.limoanywhere.com/docs/how-to-utilize-the-zapier-new-quote-trigger/)
- [LimoAnywhere Knowledge Center](https://kb.limoanywhere.com/docs/)
- [n8n Webhook Node Docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Twilio n8n Integration](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.twilio/)
- [Zapier Webhooks by Zapier](https://zapier.com/apps/webhook/integrations)

---

## Next Steps

1. **Set up Zapier account** - Connect LimoAnywhere to Zapier
2. **Create n8n webhook endpoints** - Set up receivers in n8n
3. **Build first Zap** - New Reservation → n8n webhook
4. **Build Nebo API routes** - Create endpoints for n8n to call
5. **Test end-to-end** - Verify reservation sync works
6. **Monitor Zapier tasks** - Track usage to optimize costs

---

*Document prepared: February 27, 2026*
*Author: Claude Code*
*Version: 1.0*
