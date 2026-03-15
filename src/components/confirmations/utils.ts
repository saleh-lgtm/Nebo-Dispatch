/**
 * Confirmation time utilities
 */

/**
 * Calculate time until confirmation is due
 */
export function getTimeUntilDue(dueAt: Date | string, now: Date = new Date()): string {
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));

  if (diffMins < 0) {
    const overdueMins = Math.abs(diffMins);
    if (overdueMins >= 60) {
      return `${Math.floor(overdueMins / 60)}h ${overdueMins % 60}m overdue`;
    }
    return `${overdueMins}m overdue`;
  }

  if (diffMins >= 60) {
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  }
  return `${diffMins}m`;
}

/**
 * Check if confirmation is overdue
 */
export function isOverdue(dueAt: Date | string, now: Date = new Date()): boolean {
  return new Date(dueAt).getTime() < now.getTime();
}

/**
 * Check if confirmation is urgent (due within 30 minutes)
 */
export function isUrgent(dueAt: Date | string, now: Date = new Date()): boolean {
  const due = new Date(dueAt);
  const diffMins = (due.getTime() - now.getTime()) / (1000 * 60);
  return diffMins < 30;
}

/**
 * Format time for display in Central timezone
 */
export function formatConfirmationTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

/**
 * Get urgency level for styling
 */
export function getUrgencyLevel(
  dueAt: Date | string,
  now: Date = new Date()
): "overdue" | "urgent" | "normal" {
  if (isOverdue(dueAt, now)) return "overdue";
  if (isUrgent(dueAt, now)) return "urgent";
  return "normal";
}
