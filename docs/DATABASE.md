# Database Reference

## 1. Overview

| Metric | Value |
|--------|-------|
| **Database Provider** | PostgreSQL (Supabase) |
| **ORM** | Prisma 7 with PrismaPg adapter |
| **Total Models** | 71 |
| **Total Enums** | 26 |
| **Schema Location** | `prisma/schema.prisma` |

## 2. Model Groups

### Auth & Users (6 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `User` | System users (dispatchers, admins, accounting) | → Shift, ShiftReport, Quote, Schedule, SMSLog, Notification |
| `PasswordResetToken` | Password reset tokens with expiration | → User |
| `UserPresence` | Real-time online status tracking | → User (1:1) |
| `DispatcherPreferences` | Scheduling preferences (days, shifts, hours) | → User (1:1) |
| `DispatcherFeatureAccess` | Per-dispatcher feature permissions | → User |
| `DispatcherTaskConfig` | Primary/secondary task assignments | → User (1:1) |

### Scheduling (8 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `Schedule` | Published shift assignments | → User, SchedulingRequest, ShiftSwapRequest |
| `SchedulingRequest` | Schedule change, time off, shift swap requests | → User, Schedule, Shift |
| `TimeOffRequest` | Vacation, sick, personal time requests | → User (requester), User (reviewer) |
| `ShiftSwapRequest` | Shift swap workflow between dispatchers | → User (requester/target/reviewer), Schedule |
| `ScheduleTemplate` | Reusable weekly schedule templates | → User (creator), ScheduleTemplateShift |
| `ScheduleTemplateShift` | Shift definitions within a template | → ScheduleTemplate |
| `Event` | Calendar events (game days, concerts, conferences) | → User (creator) |
| `Shift` | Clock in/out records | → User, ShiftReport, ShiftTask, Quote |

### Shift Reports (4 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `ShiftReport` | End-of-shift reports with metrics | → User, Shift, RetailLead, AccountingFlag |
| `ShiftReportDraft` | Auto-save drafts for shift reports | → User, Shift |
| `RetailLead` | Retail lead tracking within shift reports | → ShiftReport |
| `CourtReport` | Legal/court-related incident reports | → User |

### Tasks (6 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `Task` | Admin-assigned tasks to dispatchers | → User (assignee), User (admin) |
| `AdminTask` | Tasks assignable to all or specific dispatchers | → User (creator/assignee), AdminTaskCompletion |
| `AdminTaskCompletion` | Tracks task completion per user | → AdminTask, User |
| `ShiftTask` | Per-shift checklist tasks | → Shift, User (assigner) |
| `TaskTemplate` | Reusable task checklist templates | → TaskItem |
| `TaskItem` | Individual items within a task template | → TaskTemplate |

### Quotes & Sales (3 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `Quote` | Customer quotes with follow-up tracking | → User (creator/assigned), Shift, QuoteAction, SMSContact |
| `QuoteAction` | Action history on quotes (called, emailed, etc.) | → Quote, User |

### Trips & Confirmations (5 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `TripConfirmation` | 2-hour confirmation tasks from manifests | → User (completedBy), MissedConfirmationAccountability |
| `ManifestLog` | Incoming manifest email audit trail | — |
| `MissedConfirmationAccountability` | Tracks who was on duty when confirmation expired | → TripConfirmation, User, Shift |
| `TbrTrip` | Trips scraped from TBR Global portal | — |
| `TbrSyncLog` | TBR scraper sync audit trail | — |

### Fleet (7 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `FleetVehicle` | Company vehicles (sedans, SUVs, vans) | → VehiclePermit, VehicleInsurance, VehicleDocument |
| `VehiclePermit` | TCP, airport, city permits with expiration | → FleetVehicle |
| `VehicleInsurance` | Insurance policies with expiration | → FleetVehicle |
| `VehicleRegistration` | Vehicle registration with expiration | → FleetVehicle |
| `VehicleDocument` | Maintenance records, inspection reports | → FleetVehicle, User (uploader) |
| `VehicleAssignment` | Links house chauffeurs to fleet vehicles | → Affiliate, FleetVehicle |
| `DriverVehicle` | IOS driver personal vehicle info | → Affiliate (1:1) |

### Affiliates & Network (9 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `Affiliate` | Partners (farm-in, farm-out, IOS, chauffeurs) | → User, AffiliatePricing, AffiliateAttachment, AffiliateTag |
| `AffiliatePricing` | Flat rate pricing by service type | → Affiliate |
| `AffiliateRoutePrice` | Route-based pricing (pickup/dropoff pairs) | → Affiliate |
| `AffiliateAttachment` | Contracts, W-9s, insurance certificates | → Affiliate, User (uploader) |
| `AffiliateAuditConfig` | Audit frequency settings for shift reports | → Affiliate (1:1) |
| `AffiliateTag` | Tags for organizing affiliates (blast SMS) | → AffiliateTagAssignment |
| `AffiliateTagAssignment` | Affiliate ↔ Tag junction table | → Affiliate, AffiliateTag, User |
| `SchedulePreferences` | House chauffeur scheduling preferences | → Affiliate (1:1) |
| `TbrVehicleMapping` | TBR → LimoAnywhere vehicle type mapping | — |

### SMS & Communications (7 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `SMSLog` | Inbound/outbound SMS message log | → User (sender), SMSContact |
| `SMSContact` | Phone number ↔ entity links | → Affiliate, Quote, SMSLog |
| `SMSOptOut` | TCPA opt-out/opt-in tracking | — |
| `Contact` | Customer contact directory | → User (creator/approver), ContactTag |
| `ContactTag` | Tags for organizing contacts | → ContactTagAssignment |
| `ContactTagAssignment` | Contact ↔ Tag junction table | → Contact, ContactTag, User |
| `BlastSMSLog` | Bulk SMS campaign audit trail | → User (sender) |

### Accounting & Billing (5 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `AccountingFlag` | Reservations flagged for accounting review | → ShiftReport, User (flagger/reviewer) |
| `BillingReview` | Trip billing adjustments (tolls, tips, etc.) | → User (submitter/reviewer), Shift, ShiftReport |
| `RoutePrice` | Route pricing lookup (~158K rows) | — |
| `RoutePriceImport` | Pricing import audit trail | → User (importer) |

### SOPs (7 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `SOP` | Standard operating procedures | → User (creator), SOPRead, SOPFavorite, SOPQuiz |
| `SOPRead` | Tracks who read/acknowledged an SOP | → SOP, User |
| `SOPFavorite` | User bookmarks for SOPs | → SOP, User |
| `SOPVersion` | Version history for SOPs | → SOP, User |
| `SOPRelated` | Links related SOPs together | → SOP (from/to) |
| `SOPQuiz` | Quiz for testing SOP knowledge | → SOP, SOPQuizQuestion, SOPQuizAttempt |
| `SOPQuizQuestion` | Individual quiz questions | → SOPQuiz |
| `SOPQuizAttempt` | User quiz attempts with scores | → SOPQuiz, User |

### Notes & Announcements (2 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `GlobalNote` | Shift handoff notes and company announcements | → User (author), Shift, AnnouncementRead |
| `AnnouncementRead` | Tracks announcement acknowledgments | → GlobalNote, User |

### System (3 models)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| `AuditLog` | Security audit trail (actions, entities, IPs) | → User |
| `Notification` | User notifications (swaps, approvals, tasks) | → User |
| `Portal` | External portal quick access links | → User (creator/approver) |

## 3. Enum Reference

### User & Auth
| Enum | Values |
|------|--------|
| `Role` | `SUPER_ADMIN`, `ADMIN`, `ACCOUNTING`, `DISPATCHER` |
| `ApprovalStatus` | `PENDING`, `APPROVED`, `REJECTED` |

### Scheduling
| Enum | Values |
|------|--------|
| `RequestType` | `HOURS_MODIFICATION`, `SCHEDULE_CHANGE`, `REVIEW`, `TIME_OFF`, `SHIFT_SWAP` |
| `RequestStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `TimeOffStatus` | `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `ShiftSwapStatus` | `PENDING_TARGET`, `PENDING_ADMIN`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `EventType` | `GAME_DAY`, `CONCERT`, `CONFERENCE`, `HOLIDAY`, `PROMOTION`, `GENERAL` |

### Reports & Tasks
| Enum | Values |
|------|--------|
| `ReportStatus` | `DRAFT`, `SUBMITTED`, `REVIEWED`, `FLAGGED` |
| `TaskStatus` | `PENDING`, `IN_PROGRESS`, `COMPLETED` |
| `RetailLeadOutcome` | `WON`, `NEEDS_FOLLOW_UP`, `LOST` |
| `LostReason` | `VEHICLE_TYPE`, `AVAILABILITY`, `PRICING`, `OTHER` |

### Quotes
| Enum | Values |
|------|--------|
| `QuoteStatus` | `PENDING`, `FOLLOWING_UP`, `CONVERTED`, `LOST`, `EXPIRED` |
| `QuoteOutcome` | `WON`, `LOST` |
| `QuoteActionType` | `CREATED`, `CALLED`, `EMAILED`, `TEXTED`, `FOLLOW_UP`, `NOTE_ADDED`, `REASSIGNED`, `STATUS_CHANGE`, `OUTCOME_SET` |

### Fleet & Affiliates
| Enum | Values |
|------|--------|
| `VehicleType` | `SEDAN`, `SUV`, `VAN`, `BUS`, `LIMOUSINE`, `STRETCH_LIMO`, `SPRINTER`, `MINI_BUS`, `COACH`, `OTHER` |
| `VehicleStatus` | `ACTIVE`, `INACTIVE`, `MAINTENANCE`, `RETIRED` |
| `AffiliateType` | `FARM_IN`, `FARM_OUT`, `IOS`, `HOUSE_CHAUFFEUR` |

### Accounting
| Enum | Values |
|------|--------|
| `AccountingFlagStatus` | `PENDING`, `IN_REVIEW`, `RESOLVED` |
| `BillingReviewReason` | `EXTRA_WAITING_TIME`, `EXTRA_STOPS`, `ROUTE_CHANGE`, `TOLL_FEES`, `PARKING_FEES`, `GRATUITY_ADJUSTMENT`, `PRICE_CORRECTION`, `NO_SHOW_CHARGE`, `CANCELLATION_FEE`, `DAMAGE_CHARGE`, `AFFILIATE_BILLING`, `OTHER` |

### Communications
| Enum | Values |
|------|--------|
| `SMSDirection` | `INBOUND`, `OUTBOUND` |
| `NotificationType` | `SHIFT_SWAP_REQUEST`, `SHIFT_SWAP_RESPONSE`, `SHIFT_SWAP_APPROVED`, `SHIFT_SWAP_REJECTED`, `TIME_OFF_APPROVED`, `TIME_OFF_REJECTED`, `TASK_ASSIGNED`, `TASK_DUE_SOON`, `SCHEDULE_PUBLISHED`, `SOP_REQUIRES_ACK`, `CONFIRMATION_DUE`, `GENERAL` |

### Trips & TBR
| Enum | Values |
|------|--------|
| `ConfirmationStatus` | `PENDING`, `CONFIRMED`, `NO_ANSWER`, `CANCELLED`, `RESCHEDULED`, `EXPIRED` |
| `TbrTripStatus` | `PENDING`, `CONFIRMED`, `MODIFIED`, `CANCELLED` |
| `LaSyncStatus` | `NOT_PUSHED`, `PUSHED`, `PUSH_FAILED` |

### Permissions
| Enum | Values |
|------|--------|
| `DispatcherFeature` | `QUOTES`, `CONTACTS`, `SMS`, `FLEET`, `SCHEDULER`, `REPORTS`, `DIRECTORY`, `CONFIRMATIONS`, `TBR_TRIPS`, `NOTES`, `TASKS`, `ANALYTICS` |
| `PermissionLevel` | `NONE`, `READ`, `EDIT` |

## 4. Key Relationships

### User Hub
```
User ─┬─► Shift ─► ShiftReport ─► AccountingFlag
      ├─► Schedule ─► ShiftSwapRequest
      ├─► Quote ─► QuoteAction
      ├─► SMSLog
      ├─► Notification
      ├─► TimeOffRequest
      ├─► AdminTask (assigned)
      ├─► SOP (created) ─► SOPRead, SOPQuiz
      └─► AuditLog
```

### Fleet Chain
```
FleetVehicle ─┬─► VehiclePermit (1:N)
              ├─► VehicleInsurance (1:N)
              ├─► VehicleRegistration (1:N)
              ├─► VehicleDocument (1:N)
              └─► VehicleAssignment ─► Affiliate (HOUSE_CHAUFFEUR)
```

### Affiliate Chain
```
Affiliate ─┬─► AffiliatePricing (flat rates)
           ├─► AffiliateRoutePrice (route rates)
           ├─► AffiliateAttachment (documents)
           ├─► AffiliateTagAssignment ─► AffiliateTag
           ├─► DriverVehicle (IOS 1:1)
           ├─► SchedulePreferences (chauffeur 1:1)
           └─► VehicleAssignment ─► FleetVehicle
```

### Confirmation Chain
```
ManifestLog (email ingestion)
     │
     ▼
TripConfirmation ─► MissedConfirmationAccountability ─► User, Shift
```

### TBR Chain
```
TbrSyncLog (sync audit)
     │
     ▼
TbrTrip ─► TbrVehicleMapping (vehicle type lookup)
```

## 5. Performance Notes

### High-Volume Tables

| Table | Row Count | Notes |
|-------|-----------|-------|
| `RoutePrice` | ~158,000 | **Always paginate**. Use `zoneFromNorm`/`zoneToNorm` indexes for search. Never `SELECT *`. |
| `SMSLog` | Growing | Index on `conversationPhone` for threading. |
| `AuditLog` | Growing | Index on `userId, createdAt` for user history. |
| `TripConfirmation` | Growing | Compound index `status, dueAt` for dashboard widget. |

### Models with Explicit Indexes

```
User:                @@index([email]), @@index([role, isActive, createdAt]), @@index([approvalStatus])
Shift:               @@index([userId, clockOut]), @@index([userId, clockIn])
ShiftReport:         @@index([userId, createdAt]), @@index([status]), @@index([createdAt])
Schedule:            @@index([weekStart]), @@index([userId, weekStart]), @@index([userId, shiftStart])
Quote:               @@index([status, createdAt]), @@index([assignedToId, status]), @@index([expiresAt])
TripConfirmation:    @@index([status, dueAt]), @@index([dueAt]), @@index([status, archivedAt, pickupAt])
TbrTrip:             @@index([tbrTripId]), @@index([pickupDatetime]), @@index([laSyncStatus])
RoutePrice:          @@index([zoneFromNorm, zoneToNorm]), @@index([vehicleCode])
Affiliate:           @@index([type, isActive, isApproved]), @@index([name])
Contact:             @@index([name]), @@index([approvalStatus, isActive]), @@index([phone])
SMSLog:              @@index([conversationPhone, createdAt]), @@index([status, createdAt])
Notification:        @@index([userId, isRead, createdAt])
AuditLog:            @@index([userId, createdAt]), @@index([entity, entityId])
```

### Soft Delete Patterns

| Model | Field | Usage |
|-------|-------|-------|
| `TripConfirmation` | `archivedAt` | Archived after completion |
| `TbrTrip` | `archivedAt` | Archived old trips |
| `User` | `isActive` | Deactivated users (not deleted) |
| `Affiliate` | `isActive` | Deactivated affiliates |

## 6. Schema Conventions

### ID Strategy
- All models use `@id @default(cuid())` for primary keys
- CUIDs are collision-resistant and sortable by creation time

### Timestamp Fields
```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```
- Every model should have `createdAt`
- Models with editable data should have `updatedAt`

### Text Fields
- Short strings: `String` (default VARCHAR)
- Long text: `String @db.Text` (unlimited length)
- JSON data: `Json` type for flexible structures

### Relation Patterns
```prisma
// Required relation with cascade delete
userId  String
user    User @relation(fields: [userId], references: [id], onDelete: Cascade)

// Optional relation with set null
reviewedById String?
reviewedBy   User?  @relation(fields: [reviewedById], references: [id])
```

### Self-Referential Relations
```prisma
// User approved by another user
approvedById String?
approvedBy   User?  @relation("ApprovedBy", fields: [approvedById], references: [id])
approvedUsers User[] @relation("ApprovedBy")
```

### Junction Tables (Many-to-Many)
```prisma
model ContactTagAssignment {
  contactId String
  tagId     String
  @@unique([contactId, tagId])  // Prevent duplicates
  @@index([contactId])
  @@index([tagId])
}
```

### Enum Usage
- Define enums in schema, not as TypeScript string unions
- Use descriptive names matching domain language
- Import from `@prisma/client` in application code
