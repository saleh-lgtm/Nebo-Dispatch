/**
 * Time Off Utilities
 */

/**
 * Format date with full details
 */
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format date in short form (Mon DD)
 */
export function formatShortDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Calculate number of days in a time off request
 */
export function calculateDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Include both start and end day
}

/**
 * Check if request is in the past
 */
export function isPastRequest(endDate: Date): boolean {
  return new Date(endDate).getTime() < Date.now();
}
