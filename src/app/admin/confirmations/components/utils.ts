import type { UrgencyLevel } from "../types";

export const formatDateTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
    });
};

export const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Chicago",
    });
};

export const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
    });
};

export const isOverdue = (dueAt: Date | string, now: number) => {
    return new Date(dueAt).getTime() < now;
};

export const getTimeDiff = (target: Date | string, now: number) => {
    const diff = new Date(target).getTime() - now;
    const mins = Math.abs(Math.round(diff / 60000));
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hours > 0) {
        return `${hours}h ${remainingMins}m`;
    }
    return `${mins}m`;
};

/**
 * Determine urgency level based on due time and status
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
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${absMins}m`;
        return { text: `OVERDUE ${timeStr}`, urgency };
    }
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${absMins} min`;
    return { text: timeStr, urgency };
};
