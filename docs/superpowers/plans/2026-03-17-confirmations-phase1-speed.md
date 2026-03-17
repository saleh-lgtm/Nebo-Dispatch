# Confirmations Phase 1: Speed & Efficiency

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dispatchers faster at confirming trips — one-click actions, smart sorting, live countdowns, auto-refresh.

**Architecture:** All changes are client-side UX improvements plus one new server action for polling. No new models or schema changes (indexes already exist). Optimistic UI updates local state immediately, reverts on server failure. Polling via `setInterval` + visibility API with `useRef` to avoid interval churn.

**Tech Stack:** React 19, CSS Modules, Next.js server actions, Prisma

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/admin/confirmations/components/utils.ts` | Modify | Add `getUrgencyLevel()`, `getCountdownDisplay()` helpers |
| `src/app/admin/confirmations/types.ts` | Modify | Add `UrgencyLevel` type, `CurrentUser` interface |
| `src/lib/tripConfirmationActions.ts` | Modify | Add `getNewConfirmationsSince()` server action |
| `src/app/admin/confirmations/components/TripsTable.module.css` | Modify | Quick-action buttons, urgency row borders, countdown colors, pulse animation |
| `src/app/admin/confirmations/components/TripsTableClient.tsx` | Modify | One-click buttons, countdown timer column, urgency row classes |
| `src/app/admin/confirmations/Confirmations.module.css` | Modify | Toast notification styles |
| `src/app/admin/confirmations/ConfirmationsClient.tsx` | Modify | Optimistic handlers, smart sort, auto-refresh polling, toast, currentUser prop, 15s timer |
| `src/app/admin/confirmations/page.tsx` | Modify | Pass `currentUser` prop from session |

---

## Task 1: Utility Helpers + Types

**Files:**
- Modify: `src/app/admin/confirmations/components/utils.ts`
- Modify: `src/app/admin/confirmations/types.ts`

- [ ] **Step 1: Add UrgencyLevel type and CurrentUser interface to types.ts**

Add at the end of the file, before the `STATUS_CONFIG` export:

```typescript
export type UrgencyLevel = "overdue" | "critical" | "warning" | "normal" | "completed";

export interface CurrentUser {
    id: string;
    name: string;
}
```

- [ ] **Step 2: Add urgency and countdown helpers to utils.ts**

Add these two functions at the end of `utils.ts`:

```typescript
import type { UrgencyLevel } from "../types";

/**
 * Determine urgency level based on due time and status
 * - overdue: past due time AND still PENDING
 * - critical: <10 min until due AND still PENDING
 * - warning: <30 min until due AND still PENDING
 * - normal: PENDING but not urgent
 * - completed: any non-PENDING status
 */
export const getUrgencyLevel = (
    dueAt: Date | string,
    status: string,
    now: number
): UrgencyLevel => {
    if (status !== "PENDING") return "completed";
    const dueTime = new Date(dueAt).getTime();
    const minutesUntilDue = (dueTime - now) / 60000;
    if (minutesUntilDue <= 0) return "overdue";
    if (minutesUntilDue <= 10) return "critical";
    if (minutesUntilDue <= 30) return "warning";
    return "normal";
};

/**
 * Format countdown display for due column
 * Returns { text, className } for rendering
 */
export const getCountdownDisplay = (
    dueAt: Date | string,
    status: string,
    now: number
): { text: string; urgency: UrgencyLevel } => {
    if (status !== "PENDING") {
        return { text: formatTime(dueAt), urgency: "completed" };
    }
    const dueTime = new Date(dueAt).getTime();
    const diffMs = dueTime - now;
    const absMins = Math.abs(Math.round(diffMs / 60000));
    const hours = Math.floor(absMins / 60);
    const mins = absMins % 60;
    const urgency = getUrgencyLevel(dueAt, status, now);

    if (diffMs <= 0) {
        // Overdue
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${absMins}m`;
        return { text: `OVERDUE ${timeStr}`, urgency };
    }
    // Upcoming
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${absMins} min`;
    return { text: timeStr, urgency };
};
```

Note: The `import type { UrgencyLevel }` needs to be added at the top of utils.ts. Also, `formatTime` is already defined in utils.ts so the countdown can reference it.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/confirmations/components/utils.ts src/app/admin/confirmations/types.ts
git commit -m "feat(confirmations): add urgency level helpers and countdown display utils"
```

---

## Task 2: New Server Action for Polling

**Files:**
- Modify: `src/lib/tripConfirmationActions.ts`

- [ ] **Step 1: Add getNewConfirmationsSince function**

Add this function after the existing `getPendingConfirmationCount` function (around line 1108):

```typescript
/**
 * Get confirmations created since a given timestamp
 * Used for auto-refresh polling — returns only new records
 * Uses createdAt only (indexed) to avoid full table scan on updatedAt
 */
export async function getNewConfirmationsSince(since: Date) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    // Role check — only admin roles can view confirmations
    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    // Validate input
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
        throw new Error("Invalid date parameter");
    }

    const newConfirmations = await prisma.tripConfirmation.findMany({
        where: {
            createdAt: { gt: sinceDate },
        },
        orderBy: { dueAt: "asc" },
        include: {
            completedBy: {
                select: { id: true, name: true },
            },
        },
        take: 50,
    });

    return {
        confirmations: newConfirmations,
        timestamp: new Date(),
    };
}
```

Note: This only polls for NEW confirmations (via `createdAt` which is indexed). Status changes from other dispatchers are not picked up by polling — they rely on manual refresh or will be addressed in Phase 2 with real-time updates.

- [ ] **Step 2: Commit**

```bash
git add src/lib/tripConfirmationActions.ts
git commit -m "feat(confirmations): add getNewConfirmationsSince for auto-refresh polling"
```

---

## Task 3: Table CSS — Quick Action Buttons, Urgency Borders, Countdown, Pulse

**Files:**
- Modify: `src/app/admin/confirmations/components/TripsTable.module.css`

- [ ] **Step 1: Widen the actions column and add quick-action button styles**

Replace the existing `.colActions` width rule (line 17-19):

```css
.tripsTable .colActions {
    width: 200px;
    text-align: right;
}
```

Add these new styles after the existing `.actionBtn:disabled` block (after line 285):

```css
/* Quick Action Buttons */
.quickActions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    justify-content: flex-end;
}

.quickConfirmBtn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    background: var(--success);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
}

.quickConfirmBtn:hover:not(:disabled) {
    background: var(--success-hover);
    transform: translateY(-1px);
}

.quickConfirmBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.quickNoAnswerBtn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    background: var(--warning);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
}

.quickNoAnswerBtn:hover:not(:disabled) {
    background: var(--warning-hover);
    transform: translateY(-1px);
}

.quickNoAnswerBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.editBtn {
    padding: 0.375rem 0.5rem;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
}

.editBtn:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
}

.editBtn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

- [ ] **Step 2: Add urgency row border styles**

Add after the existing `.tripsTable tbody tr.overdue:hover` block (after line 92):

```css
/* Urgency row indicators */
.tripsTable tbody tr.urgencyOverdue {
    background: var(--danger-soft);
    border-left: 3px solid var(--danger);
}

.tripsTable tbody tr.urgencyOverdue:hover {
    background: rgba(239, 68, 68, 0.12);
}

.tripsTable tbody tr.urgencyCritical {
    border-left: 3px solid var(--danger);
}

.tripsTable tbody tr.urgencyWarning {
    border-left: 3px solid var(--warning);
}

/* Section divider between pending and completed */
.sectionDivider td {
    padding: 0.25rem 1rem;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
}

.sectionDividerContent {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
```

- [ ] **Step 3: Add countdown timer styles and pulse animation**

Add after the existing `.timeDiffOverdue` block (after line 178):

```css
/* Countdown timer */
.countdown {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    font-size: 0.8125rem;
    white-space: nowrap;
}

.countdownNormal {
    color: var(--success);
}

.countdownWarning {
    color: var(--warning);
}

.countdownCritical {
    color: var(--danger);
    animation: pulse 2s ease-in-out infinite;
}

.countdownOverdue {
    color: var(--danger);
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/confirmations/components/TripsTable.module.css
git commit -m "style(confirmations): add quick-action buttons, urgency borders, countdown timer styles"
```

---

## Task 4: TripsTableClient — One-Click Buttons + Countdown + Urgency Rows

**Files:**
- Modify: `src/app/admin/confirmations/components/TripsTableClient.tsx`

- [ ] **Step 1: Update props interface**

Add new props to the `TripsTableProps` interface:

```typescript
interface TripsTableProps {
    trips: TripConfirmation[];
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onSelectTrip: (trip: TripConfirmation) => void;
    onQuickAction: (tripId: string, status: "CONFIRMED" | "NO_ANSWER") => void;
    completingId: string | null;
    now: number;
    pendingDividerIndex?: number;
}
```

Add imports at the top:

```typescript
import { CheckCircle, PhoneOff } from "lucide-react";
import { getCountdownDisplay, getUrgencyLevel } from "./utils";
```

Remove the existing imports of `formatDate, formatTime, formatDateTime, isOverdue, getTimeDiff` and replace with:

```typescript
import { formatDate, formatTime, formatDateTime, getCountdownDisplay, getUrgencyLevel } from "./utils";
```

- [ ] **Step 2: Replace the Due column cell rendering**

Replace the existing Due `<td>` block (the one with `dueCell`, `timeDiff`, etc.) with:

```tsx
<td className={styles.colDue}>
    {(() => {
        const { text, urgency } = getCountdownDisplay(trip.dueAt, trip.status, now);
        const countdownClass =
            urgency === "overdue" ? styles.countdownOverdue :
            urgency === "critical" ? styles.countdownCritical :
            urgency === "warning" ? styles.countdownWarning :
            urgency === "completed" ? "" :
            styles.countdownNormal;
        return (
            <div className={styles.dueCell}>
                <span className={`${styles.countdown} ${countdownClass}`}>
                    {text}
                </span>
            </div>
        );
    })()}
</td>
```

- [ ] **Step 3: Replace the row className logic**

Replace the existing `className` on the `<tr>` element. Change from:

```tsx
<tr key={trip.id} className={overdue ? styles.overdue : ""}>
```

To:

```tsx
<tr
    key={trip.id}
    className={
        urgencyLevel === "overdue" ? styles.urgencyOverdue :
        urgencyLevel === "critical" ? styles.urgencyCritical :
        urgencyLevel === "warning" ? styles.urgencyWarning :
        ""
    }
>
```

And compute `urgencyLevel` at the top of the `.map()` callback (replacing the old `isPending` / `overdue` consts):

```tsx
trips.map((trip) => {
    const config = STATUS_CONFIG[trip.status] || STATUS_CONFIG.PENDING;
    const Icon = config.icon;
    const urgencyLevel = getUrgencyLevel(trip.dueAt, trip.status, now);
```

Remove the now-unused `isPending` and `overdue` variables.

- [ ] **Step 4: Replace the Actions column with quick-action buttons**

Replace the existing Actions `<td>` block with:

```tsx
<td className={styles.colActions}>
    <div className={styles.quickActions}>
        {trip.status === "PENDING" ? (
            <>
                <button
                    className={styles.quickConfirmBtn}
                    onClick={(e) => { e.stopPropagation(); onQuickAction(trip.id, "CONFIRMED"); }}
                    disabled={completingId === trip.id}
                    title="Confirm trip"
                >
                    <CheckCircle size={14} />
                    Confirm
                </button>
                <button
                    className={styles.quickNoAnswerBtn}
                    onClick={(e) => { e.stopPropagation(); onQuickAction(trip.id, "NO_ANSWER"); }}
                    disabled={completingId === trip.id}
                    title="Mark no answer"
                >
                    <PhoneOff size={14} />
                    No Ans
                </button>
                <button
                    className={styles.editBtn}
                    onClick={() => onSelectTrip(trip)}
                    disabled={completingId === trip.id}
                >
                    Edit
                </button>
            </>
        ) : (
            <button
                className={styles.editBtn}
                onClick={() => onSelectTrip(trip)}
                disabled={completingId === trip.id}
            >
                Edit
            </button>
        )}
    </div>
</td>
```

- [ ] **Step 5: Add section divider row between pending and completed**

After the `.map()` renders each row, insert a divider row when transitioning from PENDING to non-PENDING. Inside the `.map()`, after the closing `</tr>`, check if the next trip is non-PENDING:

This is complex to do inside `.map()`, so instead we handle it via the `pendingDividerIndex` prop. In the `<tbody>`, replace the simple `.map()` with:

```tsx
<tbody>
    {trips.length === 0 ? (
        <tr className={styles.emptyRow}>
            <td colSpan={10}>
                <div className={styles.emptyState}>
                    <Calendar size={40} />
                    <p>No trips found</p>
                    <span>Try adjusting your filters</span>
                </div>
            </td>
        </tr>
    ) : (
        trips.map((trip, index) => {
            const config = STATUS_CONFIG[trip.status] || STATUS_CONFIG.PENDING;
            const Icon = config.icon;
            const urgencyLevel = getUrgencyLevel(trip.dueAt, trip.status, now);
            const showDivider = pendingDividerIndex !== undefined && index === pendingDividerIndex;

            return (
                <Fragment key={trip.id}>
                    {showDivider && (
                        <tr className={styles.sectionDivider}>
                            <td colSpan={10}>
                                <div className={styles.sectionDividerContent}>
                                    <span>Completed / Expired</span>
                                </div>
                            </td>
                        </tr>
                    )}
                    <tr
                        className={
                            urgencyLevel === "overdue" ? styles.urgencyOverdue :
                            urgencyLevel === "critical" ? styles.urgencyCritical :
                            urgencyLevel === "warning" ? styles.urgencyWarning :
                            ""
                        }
                    >
                        {/* ... all existing <td> cells ... */}
                    </tr>
                </Fragment>
            );
        })
    )}
</tbody>
```

Add `import { Fragment } from "react";` at the top.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/confirmations/components/TripsTableClient.tsx
git commit -m "feat(confirmations): one-click confirm/no-answer buttons, live countdown, urgency rows"
```

---

## Task 5: Toast Notification Styles

**Files:**
- Modify: `src/app/admin/confirmations/Confirmations.module.css`

- [ ] **Step 1: Add toast styles at the end of the file**

```css
/* ===== TOAST NOTIFICATIONS ===== */
.toast {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: white;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 1000;
    animation: toastSlideIn 0.3s ease-out;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.toastSuccess {
    background: var(--success);
}

.toastError {
    background: var(--danger);
}

.toastDismiss {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.25rem;
    opacity: 0.8;
    display: flex;
    align-items: center;
}

.toastDismiss:hover {
    opacity: 1;
}

@keyframes toastSlideIn {
    from {
        transform: translateY(1rem);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/confirmations/Confirmations.module.css
git commit -m "style(confirmations): add toast notification styles"
```

---

## Task 6: page.tsx — Pass currentUser Prop

**Files:**
- Modify: `src/app/admin/confirmations/page.tsx`

- [ ] **Step 1: Add currentUser prop to ConfirmationsClient**

In the return statement, add the `currentUser` prop:

```tsx
    return (
        <ConfirmationsClient
            stats={stats}
            allConfirmations={allConfirmationsData.confirmations}
            totalConfirmations={allConfirmationsData.total}
            dispatchers={dispatchers}
            currentUser={{
                id: session.user.id,
                name: session.user.name || "Unknown",
            }}
        />
    );
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/confirmations/page.tsx
git commit -m "feat(confirmations): pass currentUser from session to client component"
```

---

## Task 7: ConfirmationsClient — Optimistic UI, Smart Sort, Auto-Refresh, Toast

**Files:**
- Modify: `src/app/admin/confirmations/ConfirmationsClient.tsx`

This is the largest change. It modifies the parent component to orchestrate everything.

- [ ] **Step 1: Update imports and Props interface**

Add new imports:

```typescript
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { getNewConfirmationsSince } from "@/lib/tripConfirmationActions";
import type { CurrentUser } from "./types";
```

Note: Add `useRef` to the existing React import (which already has `useState, useMemo, useCallback, useEffect`).

Update the `Props` interface — add `currentUser`:

```typescript
interface Props {
    stats: Stats;
    dispatcherMetrics?: DispatcherMetric[];
    todayConfirmations?: TripConfirmation[];
    accountabilityMetrics?: AccountabilityMetric[];
    missedConfirmations?: MissedConfirmation[];
    allConfirmations: TripConfirmation[];
    totalConfirmations: number;
    dispatchers: Dispatcher[];
    currentUser: CurrentUser;
}
```

Add `currentUser` to the destructured props.

- [ ] **Step 2: Change default sort to dueAt ascending**

Change the initial state defaults:

```typescript
const [sortField, setSortField] = useState<SortField>("dueAt");
const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
```

- [ ] **Step 3: Change timer interval to 15 seconds**

Replace the existing `useEffect` for time updates:

```typescript
// Update time every 15 seconds for accurate countdown displays
useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
}, []);
```

- [ ] **Step 4: Add toast state**

Add after the existing state declarations:

```typescript
// Toast notification state
const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

// Auto-dismiss toast after 5 seconds
useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
}, [toast]);
```

- [ ] **Step 5: Add auto-refresh polling**

Add after the toast state:

```typescript
// Auto-refresh: poll for new confirmations every 30 seconds
// Use useRef to avoid interval churn when lastRefresh updates
const lastRefreshRef = useRef(new Date());
const selectedTabRef = useRef(selectedTab);
selectedTabRef.current = selectedTab;

useEffect(() => {
    const poll = async () => {
        // Don't poll when tab is hidden
        if (document.visibilityState === "hidden") return;
        // Don't poll while on non-trips tabs
        if (selectedTabRef.current !== "trips") return;

        try {
            const result = await getNewConfirmationsSince(lastRefreshRef.current);
            if (result.confirmations.length > 0) {
                setConfirmations(prev => {
                    const existingIds = new Set(prev.map(c => c.id));
                    const newTrips = result.confirmations.filter(c => !existingIds.has(c.id));

                    if (newTrips.length > 0) {
                        setTotalCount(prevCount => prevCount + newTrips.length);
                        setToast({ message: `${newTrips.length} new trip${newTrips.length > 1 ? "s" : ""} added`, type: "success" });
                        return [...(newTrips as TripConfirmation[]), ...prev];
                    }

                    return prev;
                });
                lastRefreshRef.current = result.timestamp;
            }
        } catch (err) {
            console.error("Auto-refresh failed:", err);
        }
    };

    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
}, []); // Empty deps — refs handle mutable state without re-registering
```

Note: Uses `useRef` for `lastRefresh` and `selectedTab` to keep the interval stable. The interval never tears down and re-registers, avoiding the churn problem. Only truly new trips (not in the existing list) trigger the toast and count update.

- [ ] **Step 6: Add optimistic quick-action handler**

Add after the existing `handleStatusChange` function:

```typescript
const handleQuickAction = useCallback(async (
    tripId: string,
    newStatus: "CONFIRMED" | "NO_ANSWER"
) => {
    // Save previous state for rollback
    const prevConfirmations = [...confirmations];
    const prevTotalCount = totalCount;

    // Optimistic update
    setConfirmations(prev => prev.map(c =>
        c.id === tripId ? {
            ...c,
            status: newStatus,
            completedAt: new Date().toISOString(),
            completedBy: { id: currentUser.id, name: currentUser.name },
            minutesBeforeDue: Math.round(
                (new Date(c.dueAt).getTime() - Date.now()) / 60000
            ),
        } : c
    ));
    setCompleting(tripId);

    try {
        await completeConfirmation(tripId, newStatus);
    } catch {
        // Revert on failure
        setConfirmations(prevConfirmations);
        setTotalCount(prevTotalCount);
        setToast({ message: "Failed to update - please try again", type: "error" });
    } finally {
        setCompleting(null);
    }
}, [confirmations, totalCount, currentUser]);
```

- [ ] **Step 7: Replace the smart sort logic in filteredAndSortedConfirmations**

Replace the entire `filteredAndSortedConfirmations` useMemo with:

```typescript
const filteredAndSortedConfirmations = useMemo(() => {
    let filtered = [...confirmations];
    const currentTime = Date.now();

    // Search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
            (c) =>
                c.tripNumber.toLowerCase().includes(query) ||
                c.passengerName.toLowerCase().includes(query) ||
                c.driverName.toLowerCase().includes(query) ||
                (c.accountName && c.accountName.toLowerCase().includes(query))
        );
    }

    // Status filter
    if (statusFilter !== "ALL") {
        filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // Dispatcher filter
    if (dispatcherFilter !== "ALL") {
        filtered = filtered.filter((c) => c.completedBy?.id === dispatcherFilter);
    }

    // Smart sort: when sorting by dueAt ascending (default),
    // group PENDING first (overdue → critical → warning → normal), then completed
    if (sortField === "dueAt" && sortDirection === "asc") {
        const pending = filtered.filter(c => c.status === "PENDING");
        const nonPending = filtered.filter(c => c.status !== "PENDING");

        // Sort pending by dueAt ascending (most urgent first — overdue at top)
        pending.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

        // Sort non-pending by completedAt descending (most recently completed first)
        nonPending.sort((a, b) => {
            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bTime - aTime;
        });

        return [...pending, ...nonPending];
    }

    // Legacy smart sort for pickupAt desc
    if (sortField === "pickupAt" && sortDirection === "desc") {
        const upcoming = filtered.filter((c) => new Date(c.pickupAt).getTime() >= currentTime);
        const past = filtered.filter((c) => new Date(c.pickupAt).getTime() < currentTime);
        upcoming.sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());
        past.sort((a, b) => new Date(b.pickupAt).getTime() - new Date(a.pickupAt).getTime());
        return [...upcoming, ...past];
    }

    // Generic sort for all other combinations
    filtered.sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;

        switch (sortField) {
            case "pickupAt": aVal = new Date(a.pickupAt).getTime(); bVal = new Date(b.pickupAt).getTime(); break;
            case "dueAt": aVal = new Date(a.dueAt).getTime(); bVal = new Date(b.dueAt).getTime(); break;
            case "createdAt": aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); break;
            case "completedAt": aVal = a.completedAt ? new Date(a.completedAt).getTime() : 0; bVal = b.completedAt ? new Date(b.completedAt).getTime() : 0; break;
            case "tripNumber": aVal = parseInt(a.tripNumber) || 0; bVal = parseInt(b.tripNumber) || 0; break;
            case "status": aVal = a.status; bVal = b.status; break;
        }

        if (aVal === null || bVal === null) return 0;
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
    });

    return filtered;
}, [confirmations, searchQuery, statusFilter, dispatcherFilter, sortField, sortDirection]);
```

- [ ] **Step 8: Compute pendingDividerIndex**

Add after `filteredAndSortedConfirmations`:

```typescript
// Find where pending trips end and completed begin (for divider row)
const pendingDividerIndex = useMemo(() => {
    if (sortField !== "dueAt" || sortDirection !== "asc") return undefined;
    const paginated = filteredAndSortedConfirmations.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        (currentPage - 1) * ITEMS_PER_PAGE + ITEMS_PER_PAGE
    );
    for (let i = 0; i < paginated.length; i++) {
        if (paginated[i].status !== "PENDING" && (i === 0 || paginated[i - 1].status === "PENDING")) {
            return i;
        }
    }
    return undefined;
}, [filteredAndSortedConfirmations, sortField, sortDirection, currentPage]);
```

- [ ] **Step 9: Pass new props to TripsTableClient**

Update the `<TripsTableClient>` call to include new props:

```tsx
<TripsTableClient
    trips={paginatedConfirmations}
    sortField={sortField}
    sortDirection={sortDirection}
    onSort={handleSort}
    currentPage={currentPage}
    totalPages={totalPages}
    onPageChange={setCurrentPage}
    onSelectTrip={setSelectedTrip}
    onQuickAction={handleQuickAction}
    completingId={completing}
    now={now}
    pendingDividerIndex={pendingDividerIndex}
/>
```

- [ ] **Step 10: Add toast rendering before the closing </div>**

Add just before the final `</div>` of the component:

```tsx
{/* Toast Notification */}
{toast && (
    <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
        <span>{toast.message}</span>
        <button className={styles.toastDismiss} onClick={() => setToast(null)}>
            <X size={14} />
        </button>
    </div>
)}
```

- [ ] **Step 11: Remove the _isLastUpcoming mutation**

The old sort logic mutated trip objects with `_isLastUpcoming`. This is now gone since we replaced the sort logic. Verify no references to `_isLastUpcoming` remain.

- [ ] **Step 12: Commit**

```bash
git add src/app/admin/confirmations/ConfirmationsClient.tsx
git commit -m "feat(confirmations): optimistic one-click actions, smart sort, auto-refresh, toast notifications"
```

---

## Task 8: Verification

- [ ] **Step 1: Run typecheck and lint**

Run: `npm run build`
Expected: Builds successfully with no type errors.

- [ ] **Step 2: Manual verification checklist**

Open `/admin/confirmations` in the browser and verify:

1. PENDING trips show green "Confirm" + amber "No Ans" + gray "Edit" buttons
2. Non-PENDING trips show only gray "Edit" button
3. Clicking "Confirm" immediately updates the row (optimistic) without opening modal
4. Clicking "No Ans" immediately updates the row (optimistic) without opening modal
5. Clicking "Edit" still opens the modal
6. Default sort shows: overdue PENDING first, then due-soon PENDING, then upcoming, then completed below a divider
7. Due column shows live countdown ("47 min", "OVERDUE 8m") with color coding
8. Countdown updates every 15 seconds
9. Overdue rows have red left border
10. Due-soon (<30 min) rows have amber left border
11. Critical (<10 min) rows have pulse animation on countdown
12. Wait 30 seconds — if new trips exist, they appear with a toast
13. Toast auto-dismisses after 5 seconds

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(confirmations): phase 1 verification fixes"
```
