/**
 * Quotes Domain Constants
 *
 * Configuration values, labels, and mappings for quote management.
 */

import { QuoteStatus, QuoteOutcome, QuoteActionType } from "@prisma/client";

// ============================================
// TIME CONFIGURATION
// ============================================

/**
 * Quote expiration settings
 */
export const QUOTE_EXPIRATION_HOURS = 72;
export const QUOTE_EXPIRATION_MS = QUOTE_EXPIRATION_HOURS * 60 * 60 * 1000;

/**
 * Follow-up intervals
 */
export const DEFAULT_FOLLOWUP_HOURS = 24;
export const DEFAULT_FOLLOWUP_MS = DEFAULT_FOLLOWUP_HOURS * 60 * 60 * 1000;

/**
 * Flag threshold - quotes without action for this long get flagged
 */
export const FLAG_THRESHOLD_HOURS = 24;
export const FLAG_THRESHOLD_MS = FLAG_THRESHOLD_HOURS * 60 * 60 * 1000;

// ============================================
// STATUS CONFIGURATION
// ============================================

/**
 * Human-readable labels for quote statuses
 */
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  PENDING: "Pending",
  FOLLOWING_UP: "Following Up",
  CONVERTED: "Converted",
  LOST: "Lost",
  EXPIRED: "Expired",
};

/**
 * Status colors for UI display
 */
export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  PENDING: "#f59e0b",      // amber
  FOLLOWING_UP: "#3b82f6", // blue
  CONVERTED: "#10b981",    // green
  LOST: "#ef4444",         // red
  EXPIRED: "#6b7280",      // gray
};

/**
 * Statuses that are considered "active" (not closed)
 */
export const ACTIVE_STATUSES: QuoteStatus[] = ["PENDING", "FOLLOWING_UP"];

/**
 * Statuses that are considered "closed"
 */
export const CLOSED_STATUSES: QuoteStatus[] = ["CONVERTED", "LOST", "EXPIRED"];

// ============================================
// OUTCOME CONFIGURATION
// ============================================

/**
 * Human-readable labels for quote outcomes
 */
export const QUOTE_OUTCOME_LABELS: Record<QuoteOutcome, string> = {
  WON: "Won",
  LOST: "Lost",
};

/**
 * Outcome colors for UI display
 */
export const QUOTE_OUTCOME_COLORS: Record<QuoteOutcome, string> = {
  WON: "#10b981",  // green
  LOST: "#ef4444", // red
};

/**
 * Common lost reasons (for UI selection in outcomeReason field)
 */
export const LOST_REASONS = [
  "Price too high",
  "Bad timing",
  "Went with competitor",
  "No response",
  "Changed plans",
  "Other",
] as const;

export type LostReason = typeof LOST_REASONS[number];

// ============================================
// ACTION TYPE CONFIGURATION
// ============================================

/**
 * Human-readable labels for action types
 */
export const ACTION_TYPE_LABELS: Record<QuoteActionType, string> = {
  CREATED: "Created",
  CALLED: "Called",
  EMAILED: "Emailed",
  TEXTED: "Texted",
  FOLLOW_UP: "Follow Up",
  NOTE_ADDED: "Note Added",
  STATUS_CHANGE: "Status Changed",
  OUTCOME_SET: "Outcome Set",
  REASSIGNED: "Reassigned",
};

/**
 * Action types that count as follow-ups
 */
export const FOLLOWUP_ACTION_TYPES: QuoteActionType[] = [
  "FOLLOW_UP",
  "CALLED",
  "EMAILED",
  "TEXTED",
];

/**
 * Action type icons (Lucide icon names)
 */
export const ACTION_TYPE_ICONS: Record<QuoteActionType, string> = {
  CREATED: "Plus",
  CALLED: "Phone",
  EMAILED: "Mail",
  TEXTED: "MessageSquare",
  FOLLOW_UP: "RefreshCw",
  NOTE_ADDED: "StickyNote",
  STATUS_CHANGE: "ArrowRightLeft",
  OUTCOME_SET: "CheckCircle",
  REASSIGNED: "UserPlus",
};

// ============================================
// SOURCE OPTIONS
// ============================================

/**
 * Common lead sources
 */
export const LEAD_SOURCES = [
  "Phone Call",
  "Website Form",
  "Email Inquiry",
  "Referral",
  "Repeat Customer",
  "Google",
  "Yelp",
  "Social Media",
  "Walk-in",
  "Other",
] as const;

export type LeadSource = typeof LEAD_SOURCES[number];

// ============================================
// SERVICE TYPE OPTIONS
// ============================================

/**
 * Common service types
 */
export const SERVICE_TYPES = [
  "Airport Transfer",
  "Point to Point",
  "Hourly Charter",
  "Wedding",
  "Prom/Formal",
  "Corporate",
  "Wine Tour",
  "Concert/Event",
  "Night Out",
  "Other",
] as const;

export type ServiceType = typeof SERVICE_TYPES[number];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a quote should be flagged based on last action time
 */
export function shouldBeFlagged(lastActionAt: Date | null): boolean {
  if (!lastActionAt) return true;
  const threshold = new Date(Date.now() - FLAG_THRESHOLD_MS);
  return lastActionAt < threshold;
}

/**
 * Calculate expiration date from creation date
 */
export function calculateExpirationDate(createdAt: Date = new Date()): Date {
  return new Date(createdAt.getTime() + QUOTE_EXPIRATION_MS);
}

/**
 * Calculate next follow-up date
 */
export function calculateNextFollowUp(fromDate: Date = new Date()): Date {
  return new Date(fromDate.getTime() + DEFAULT_FOLLOWUP_MS);
}

/**
 * Check if quote is expiring soon (within 24 hours)
 */
export function isExpiringSoon(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  const now = new Date();
  const threshold = new Date(now.getTime() + DEFAULT_FOLLOWUP_MS);
  return expiresAt > now && expiresAt < threshold;
}
