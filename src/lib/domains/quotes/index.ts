/**
 * Quotes Domain
 *
 * Unified export for quote management and lead tracking.
 *
 * Usage:
 *   // Import actions (server-side)
 *   import { createQuote, getQuoteStats } from "@/lib/domains/quotes";
 *
 *   // Import types
 *   import type { CreateQuoteData, QuoteStats } from "@/lib/domains/quotes";
 *
 *   // Import constants
 *   import { QUOTE_STATUS_LABELS, SERVICE_TYPES } from "@/lib/domains/quotes";
 */

// ============================================
// TYPE EXPORTS
// ============================================

export type {
  // Create/Update
  CreateQuoteData,
  UpdateQuoteData,

  // Query
  QuoteQueryOptions,
  DateRange,

  // Actions
  QuoteActionMetadata,
  QuoteActionResult,

  // Stats
  QuoteStats,
  QuoteAnalytics,

  // Extended types
  QuoteWithUsers,
  QuoteWithHistory,
  QuoteWithRecentActions,
  QuoteWithComputedFlag,
} from "./types";

// Re-export Prisma enums
export { QuoteStatus, QuoteOutcome, QuoteActionType } from "./types";

// ============================================
// CONSTANT EXPORTS
// ============================================

export {
  // Time config
  QUOTE_EXPIRATION_HOURS,
  QUOTE_EXPIRATION_MS,
  DEFAULT_FOLLOWUP_HOURS,
  DEFAULT_FOLLOWUP_MS,
  FLAG_THRESHOLD_HOURS,
  FLAG_THRESHOLD_MS,

  // Status config
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  ACTIVE_STATUSES,
  CLOSED_STATUSES,

  // Outcome config
  QUOTE_OUTCOME_LABELS,
  QUOTE_OUTCOME_COLORS,
  LOST_REASONS,

  // Action type config
  ACTION_TYPE_LABELS,
  FOLLOWUP_ACTION_TYPES,
  ACTION_TYPE_ICONS,

  // Options
  LEAD_SOURCES,
  SERVICE_TYPES,

  // Helper functions
  shouldBeFlagged,
  calculateExpirationDate,
  calculateNextFollowUp,
  isExpiringSoon,
} from "./constants";

export type { LeadSource, ServiceType, LostReason } from "./constants";

// ============================================
// SERVER ACTION EXPORTS
// ============================================

export {
  // Read operations
  getQuotes,
  getPendingQuotes,
  getShiftQuotes,
  getQuoteWithHistory,
  getQuoteStats,
  getQuoteAnalytics,

  // Write operations
  createQuote,
  recordQuoteAction,
  recordFollowUp,
  setQuoteOutcome,
  convertQuote,
  updateQuoteStatus,
  assignQuote,
  addQuoteNote,
} from "./actions";

// ============================================
// SERVICE EXPORTS
// ============================================
// NOTE: Service functions (queryQuotes, getActiveShift) are NOT exported
// from the barrel to prevent client-side bundling of Prisma.
// Import directly from "@/lib/domains/quotes/service" for server-side use only.
