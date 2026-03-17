# Dashboard Confirmation Widget — Fix & Enhance

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix slow loading, eliminate the modal in favor of one-click actions, and add accountability point deductions with notifications when confirmations expire.

**Architecture:** Three independent workstreams: (1) optimize the server query to scope to next-24h PENDING only, (2) replace the modal-based widget with inline one-click Confirm/No Answer buttons + CSS Modules, (3) add `accountabilityScore` to User model and wire point deductions + notifications into the existing `markExpiredConfirmations()` flow.

**Tech Stack:** Next.js 16 + React 19 + Prisma 7 + CSS Modules

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `accountabilityScore` field to User, add `MISSED_CONFIRMATION` to NotificationType |
| `src/lib/tripConfirmationActions.ts` | Modify | Optimize `getUpcomingConfirmations()` query; add point deduction + notification logic to `markExpiredConfirmations()` |
| `src/components/ConfirmationWidget.tsx` | Delete | Replaced by CSS Modules version |
| `src/components/dashboard/index.ts` | Modify | Update barrel: remove old ConfirmationWidget re-export, add new DashboardConfirmationWidget |
| `src/components/confirmations/DashboardConfirmationWidget.tsx` | Create | New one-click widget (no modal), CSS Modules |
| `src/components/confirmations/DashboardConfirmationWidget.module.css` | Create | Styles for the new widget |
| `src/app/dashboard/DashboardClient.tsx` | Modify | Import new widget, add accountability score stat card |
| `src/app/dashboard/page.tsx` | Modify | Change limit to 10, fetch user's accountabilityScore |

---

## Issue 1: Slow Loading

### Current State
`getUpcomingConfirmations()` fetches ALL PENDING confirmations with `pickupAt >= now` — no upper bound. If there are 200 pending trips for the next week, they all get queried even though only 6 are shown.

### Fix
Add `pickupAt` upper bound of 24 hours from now, keep `take: limit`, keep `orderBy: dueAt asc`. The existing `@@index([status, archivedAt, pickupAt])` covers this query.

### Task 1: Optimize getUpcomingConfirmations query

**Files:**
- Modify: `src/lib/tripConfirmationActions.ts:15-43`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update the query**

In `getUpcomingConfirmations()`, add a 24-hour ceiling on `pickupAt` and change default limit to 10:

```typescript
export async function getUpcomingConfirmations(limit: number = 10) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const confirmations = await prisma.tripConfirmation.findMany({
        where: {
            status: "PENDING",
            archivedAt: null,
            pickupAt: {
                gte: now,
                lte: twentyFourHoursFromNow,
            },
        },
        orderBy: {
            dueAt: "asc",
        },
        take: limit,
        include: {
            completedBy: {
                select: { id: true, name: true },
            },
        },
    });

    return confirmations;
}
```

- [ ] **Step 2: Update dashboard page.tsx call**

In `src/app/dashboard/page.tsx`, change `getUpcomingConfirmations(6)` → `getUpcomingConfirmations(10)`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/tripConfirmationActions.ts src/app/dashboard/page.tsx
git commit -m "perf: scope dashboard confirmations to next 24h, limit 10"
```

---

## Issue 2: Modal Position Bug → One-Click Pattern

### Current State
`ConfirmationWidget.tsx` uses `<style jsx>` (not CSS Modules) and opens a modal on click. The modal positioning is broken on the dashboard due to stacking context issues.

### Fix
Replace the entire widget with a new CSS Modules component that has **no modal at all**. Each card gets inline Confirm + No Answer buttons (matching the one-click pattern from `/admin/confirmations`). Cards show: trip #, passenger, driver, pickup time, countdown, and the two action buttons. Overdue = red left border, due-soon (<30min) = amber left border.

**UX trade-off:** The old widget had a notes field in the modal. The new one-click pattern deliberately removes this — dispatchers can add notes from the full `/admin/confirmations` page if needed. Speed of confirmation is prioritized on the dashboard.

### Task 2: Create new DashboardConfirmationWidget with CSS Modules

**Files:**
- Create: `src/components/confirmations/DashboardConfirmationWidget.tsx`
- Create: `src/components/confirmations/DashboardConfirmationWidget.module.css`
- Modify: `src/app/dashboard/DashboardClient.tsx`
- Modify: `src/components/dashboard/index.ts`
- Delete: `src/components/ConfirmationWidget.tsx`

- [ ] **Step 1: Create the CSS Module**

Create `src/components/confirmations/DashboardConfirmationWidget.module.css` with styles for:
- `.widget` — card container with border-radius, bg-card background
- `.widgetActive` — amber border + shadow when there are items (compound with `.widget`)
- `.header` — flex row: title + count badge
- `.banner` — action-required banner (amber background)
- `.list` — scrollable list, max-height 400px
- `.card` — flex row for each confirmation, with left border-left: 4px solid transparent
- `.cardOverdue` — `border-left-color: var(--danger)` (red)
- `.cardUrgent` — `border-left-color: var(--warning)` (amber)
- `.cardCompleting` — opacity 0.5 transition for optimistic hide
- `.position` — queue position circle (24px, rounded)
- `.positionFirst` — amber background for #1
- `.info` — trip number, passenger, driver, pickup time
- `.tripRow` — trip number + pickup time
- `.detailRow` — passenger + driver icons
- `.actions` — flex row: Confirm (green) + No Answer (amber) buttons
- `.confirmBtn` — green background, white text, rounded
- `.noAnswerBtn` — amber background, white text, rounded
- `.countdown` — time badge with `.countdownOverdue` and `.countdownUrgent` variants
- `.emptyState` — "Queue is clear" centered state
- `.countBadge` — red pill with pulse animation

- [ ] **Step 2: Create the widget component**

Create `src/components/confirmations/DashboardConfirmationWidget.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Phone, Clock, User, Car, CheckCircle, PhoneOff, AlertTriangle } from "lucide-react";
import { completeConfirmation } from "@/lib/tripConfirmationActions";
import { useRouter } from "next/navigation";
import styles from "./DashboardConfirmationWidget.module.css";

type ConfirmationStatus = "CONFIRMED" | "NO_ANSWER";

interface Confirmation {
    id: string;
    tripNumber: string;
    pickupAt: Date | string;
    dueAt: Date | string;
    passengerName: string;
    driverName: string;
    status: string;
}

interface Props {
    confirmations: Confirmation[];
}

export default function DashboardConfirmationWidget({ confirmations }: Props) {
    const router = useRouter();
    const [completing, setCompleting] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());

    // Update countdown every 15 seconds
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 15000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = useCallback(async (id: string, status: ConfirmationStatus) => {
        setCompleting(id);
        setError(null);
        // Optimistic: hide card immediately
        setDismissed(prev => new Set(prev).add(id));
        try {
            await completeConfirmation(id, status, "");
            router.refresh();
        } catch (err) {
            // Revert optimistic dismiss
            setDismissed(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setError(err instanceof Error ? err.message : "Failed");
        } finally {
            setCompleting(null);
        }
    }, [router]);

    const getTimeUntilDue = (dueAt: Date | string) => {
        const diffMs = new Date(dueAt).getTime() - now.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));
        if (diffMins < 0) {
            const over = Math.abs(diffMins);
            return over >= 60 ? `${Math.floor(over / 60)}h ${over % 60}m overdue` : `${over}m overdue`;
        }
        return diffMins >= 60 ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m` : `${diffMins}m`;
    };

    const isOverdue = (dueAt: Date | string) => new Date(dueAt).getTime() < now.getTime();
    const isUrgent = (dueAt: Date | string) => {
        const diff = (new Date(dueAt).getTime() - now.getTime()) / 60000;
        return diff < 30 && diff >= 0;
    };

    const formatTime = (date: Date | string) =>
        new Date(date).toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
        });

    const visible = confirmations.filter(c => !dismissed.has(c.id));

    if (visible.length === 0) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <div className={styles.title}><Phone size={18} /> Dispatcher Queue</div>
                    <span className={styles.label}>Confirmations</span>
                </div>
                <div className={styles.emptyState}>
                    <CheckCircle size={32} />
                    <p>Queue is clear</p>
                    <span>No confirmations needed right now</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.widget} ${styles.widgetActive}`}>
            <div className={styles.header}>
                <div className={styles.title}><Phone size={18} /> Dispatcher Queue</div>
                <div className={styles.headerRight}>
                    <span className={styles.label}>Next {visible.length} trips</span>
                    <span className={styles.countBadge}>{visible.length}</span>
                </div>
            </div>
            <div className={styles.banner}>
                <AlertTriangle size={14} /> Action Required — Confirm these trips now
            </div>

            {error && <div className={styles.errorBanner}>{error}</div>}

            <div className={styles.list}>
                {visible.map((conf, i) => {
                    const overdue = isOverdue(conf.dueAt);
                    const urgent = isUrgent(conf.dueAt);
                    const isProcessing = completing === conf.id;

                    return (
                        <div
                            key={conf.id}
                            className={`${styles.card} ${overdue ? styles.cardOverdue : ""} ${urgent ? styles.cardUrgent : ""} ${isProcessing ? styles.cardCompleting : ""}`}
                        >
                            <div className={styles.position}>
                                <span className={`${styles.positionNum} ${i === 0 ? styles.positionFirst : ""}`}>
                                    {i + 1}
                                </span>
                            </div>
                            <div className={styles.info}>
                                <div className={styles.tripRow}>
                                    <span className={styles.tripNumber}>#{conf.tripNumber}</span>
                                    <span className={styles.pickupTime}>
                                        <Clock size={12} /> PU: {formatTime(conf.pickupAt)}
                                    </span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span><User size={12} /> {conf.passengerName}</span>
                                    <span><Car size={12} /> {conf.driverName}</span>
                                </div>
                            </div>
                            <div className={styles.rightCol}>
                                <span className={`${styles.countdown} ${overdue ? styles.countdownOverdue : urgent ? styles.countdownUrgent : ""}`}>
                                    {overdue && <AlertTriangle size={12} />}
                                    {getTimeUntilDue(conf.dueAt)}
                                </span>
                                <div className={styles.actions}>
                                    <button
                                        className={styles.confirmBtn}
                                        onClick={() => handleAction(conf.id, "CONFIRMED")}
                                        disabled={isProcessing}
                                        title="Confirmed"
                                    >
                                        <CheckCircle size={14} /> Confirm
                                    </button>
                                    <button
                                        className={styles.noAnswerBtn}
                                        onClick={() => handleAction(conf.id, "NO_ANSWER")}
                                        disabled={isProcessing}
                                        title="No Answer"
                                    >
                                        <PhoneOff size={14} /> No Answer
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Update DashboardClient.tsx to use new widget**

In `src/app/dashboard/DashboardClient.tsx`:
- Change import from `@/components/ConfirmationWidget` → `@/components/confirmations/DashboardConfirmationWidget`
- Update the JSX: `<DashboardConfirmationWidget confirmations={upcomingConfirmations} />`

- [ ] **Step 4: Update barrel file**

In `src/components/dashboard/index.ts`, replace line 30:
```typescript
// OLD: export { default as ConfirmationWidget } from "../ConfirmationWidget";
// NEW:
export { default as DashboardConfirmationWidget } from "../confirmations/DashboardConfirmationWidget";
```

- [ ] **Step 5: Delete old widget**

Delete `src/components/ConfirmationWidget.tsx` (770 lines of `<style jsx>` replaced by CSS Modules).

- [ ] **Step 6: Verify no other imports of old widget**

Run: `grep -r "ConfirmationWidget" src/ --include="*.tsx" --include="*.ts"`
Expected: Only the new `DashboardConfirmationWidget` references remain.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/components/confirmations/DashboardConfirmationWidget.tsx \
        src/components/confirmations/DashboardConfirmationWidget.module.css \
        src/app/dashboard/DashboardClient.tsx \
        src/components/dashboard/index.ts
git rm src/components/ConfirmationWidget.tsx
git commit -m "feat: replace confirmation widget with one-click CSS Modules version"
```

---

## Issue 3: Accountability Scoring

### Current State
- `MissedConfirmationAccountability` model **already exists** — tracks which dispatchers were on-shift when a confirmation expired
- `markExpiredConfirmations()` **already creates** accountability records linking dispatchers to missed confirmations
- **Missing:** No point deduction, no notification, no score on User model

### Design: Point System

```
User.accountabilityScore  Int  @default(100)
```

- Every user starts at 100
- Each missed confirmation deducts 1 point from every dispatcher who was clocked in
- Score floors at 0 (cannot go negative)
- A `MISSED_CONFIRMATION` notification is created for each affected dispatcher per missed trip
- The score is visible on the dispatcher's dashboard (in the stats grid)

### Why `accountabilityScore` on User (not a separate model)?
- Simple read: one field, no joins, no aggregation
- The `MissedConfirmationAccountability` table already stores the detailed history
- Score can be recalculated from history if needed (`100 - COUNT(missed)`)
- No need for a separate scoring model for a single integer

### Task 3: Add accountabilityScore to schema

**Files:**
- Modify: `prisma/schema.prisma` (User model + NotificationType enum)

- [ ] **Step 1: Add field and enum value**

Add to User model (after `tokenVersion`):
```prisma
accountabilityScore Int @default(100)
```

Add to NotificationType enum:
```prisma
MISSED_CONFIRMATION  // Dispatcher missed a confirmation while on shift
```

- [ ] **Step 2: Generate and push**

Run: `npx prisma generate && npx prisma db push`
Expected: Generated Prisma Client, schema synced, new column added with default 100

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add accountabilityScore to User, MISSED_CONFIRMATION notification type"
```

### Task 4: Wire point deduction + notifications into markExpiredConfirmations

**Files:**
- Modify: `src/lib/tripConfirmationActions.ts:621-721` (`markExpiredConfirmations`)

- [ ] **Step 1: Add point deduction after accountability records are created**

After the accountability records are created (line ~706), before the `updateMany` that marks confirmations EXPIRED, add:

```typescript
// Deduct 1 point per missed confirmation per dispatcher (floor at 0)
const deductionsByDispatcher = new Map<string, number>();
for (const record of accountabilityData) {
    deductionsByDispatcher.set(
        record.dispatcherId,
        (deductionsByDispatcher.get(record.dispatcherId) || 0) + 1
    );
}

for (const [dispatcherId, points] of deductionsByDispatcher) {
    // Read current score, clamp to 0
    const user = await prisma.user.findUnique({
        where: { id: dispatcherId },
        select: { accountabilityScore: true },
    });
    const currentScore = user?.accountabilityScore ?? 100;
    const newScore = Math.max(0, currentScore - points);
    await prisma.user.update({
        where: { id: dispatcherId },
        data: { accountabilityScore: newScore },
    });
}
```

Note: We read-then-write instead of using `decrement` to enforce the floor at 0. The cron runs every 5 minutes — race conditions between two cron invocations are not a concern since the cron schedule prevents overlap.

- [ ] **Step 2: Add notifications for each affected dispatcher**

After deductions, create notifications. We already have `toExpire` with `id` and `dueAt` but need `tripNumber` and `passengerName` for the message. Add those to the initial `select`:

First, update the `toExpire` query at line 631 to also select `tripNumber` and `passengerName`:

```typescript
const toExpire = await prisma.tripConfirmation.findMany({
    where: {
        status: "PENDING",
        pickupAt: { lt: now },
        archivedAt: null,
    },
    select: {
        id: true,
        dueAt: true,
        pickupAt: true,
        tripNumber: true,
        passengerName: true,
    },
});
```

Then after deductions, create notifications:

```typescript
// Create notification per dispatcher per missed confirmation
const tripMap = new Map(toExpire.map(c => [c.id, c]));

for (const record of accountabilityData) {
    const trip = tripMap.get(record.confirmationId);
    if (!trip) continue;

    await prisma.notification.create({
        data: {
            userId: record.dispatcherId,
            type: "MISSED_CONFIRMATION",
            title: "Missed Confirmation",
            message: `Missed confirmation: Trip #${trip.tripNumber} for ${trip.passengerName} — -1 point`,
            entityType: "TripConfirmation",
            entityId: record.confirmationId,
            actionUrl: "/admin/confirmations",
        },
    });
}
```

**Design choice on atomicity:** The accountability records, point deductions, and notifications are NOT wrapped in a `$transaction`. This is intentional — `markExpiredConfirmations` runs from a cron endpoint, and partial failure is acceptable: accountability records (the source of truth) are created first, points and notifications follow. If the cron crashes mid-way, the accountability records persist and scores can be reconciled from `MissedConfirmationAccountability` count.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/tripConfirmationActions.ts
git commit -m "feat: deduct accountability points and notify dispatchers on missed confirmations"
```

### Task 5: Show accountability score on dispatcher dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx` — fetch user's accountabilityScore
- Modify: `src/app/dashboard/DashboardClient.tsx` — show score in stats grid

- [ ] **Step 1: Pass score to dashboard**

In `page.tsx`, after fetching the session, query the user's `accountabilityScore`:

```typescript
const userScore = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { accountabilityScore: true },
});
```

Pass `accountabilityScore={userScore?.accountabilityScore ?? 100}` to DashboardClient.

- [ ] **Step 2: Add prop to DashboardClient**

Add `accountabilityScore: number` to the Props interface.

- [ ] **Step 3: Show score in DashboardClient stats grid**

Add a stat card visible to DISPATCHER and ADMIN roles. Use existing stat card pattern from the dashboard (same CSS Module classes already in `Dashboard.module.css`). Show:
- Icon: Shield or Award from lucide-react
- Label: "Accountability"
- Value: `{accountabilityScore}` (out of 100)
- Footer: color-coded text — green "Good standing" if ≥ 90, amber "Needs improvement" if ≥ 70, red "At risk" if < 70
- Use existing `styles.statCard`, `styles.statIcon`, `styles.statValue`, `styles.statLabel` classes

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/dashboard/DashboardClient.tsx
git commit -m "feat: show accountability score on dispatcher dashboard"
```

---

## Summary of Changes

| # | What | Why |
|---|------|-----|
| 1 | Add `pickupAt <= now + 24h` filter, limit 10 | Widget was fetching ALL future PENDING — now scoped to next 24h |
| 2 | Replace modal widget with one-click CSS Modules widget | Modal had position bug; one-click matches confirmations page pattern |
| 3 | Update barrel at `src/components/dashboard/index.ts` | Old widget re-exported there — must update or build breaks |
| 4 | Add `accountabilityScore` to User model | Store running point total (floors at 0) |
| 5 | Add `MISSED_CONFIRMATION` to NotificationType | New notification type for missed confirmations |
| 6 | Wire deduction + notification into `markExpiredConfirmations()` | -1 point per missed confirmation per on-duty dispatcher |
| 7 | Show score on dispatcher dashboard | Dispatchers see their accountability score |

## Risk Assessment

- **Schema change** adds a column with a default — non-destructive, no data loss
- **Enum addition** is additive — existing NotificationType values unchanged
- **Old widget deletion** — imported in DashboardClient.tsx and re-exported in `src/components/dashboard/index.ts` — both updated in Task 2
- **Point deduction** uses read-then-write with Math.max(0) floor — no negative scores
- **Notification creation** in cron context — if cron fails partway, accountability records (source of truth) are already saved; scores can be reconciled from history
- **Notes field removed** — deliberate UX trade-off; dispatchers can use full confirmations page for notes
