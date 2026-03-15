"use server";

/**
 * Quote Actions - Legacy Re-exports
 *
 * @deprecated Import from "@/lib/domains/quotes" instead.
 *
 * This file re-exports from the new domain structure for backward compatibility.
 * Will be removed in a future version.
 */

// Re-export all actions
export {
  getQuotes,
  getPendingQuotes,
  getShiftQuotes,
  getQuoteWithHistory,
  getQuoteStats,
  getQuoteAnalytics,
  createQuote,
  recordQuoteAction,
  recordFollowUp,
  setQuoteOutcome,
  convertQuote,
  updateQuoteStatus,
  assignQuote,
  addQuoteNote,
} from "./domains/quotes/actions";

// Re-export types
export type {
  CreateQuoteData,
  UpdateQuoteData,
  QuoteQueryOptions,
  DateRange,
  QuoteActionMetadata,
  QuoteActionResult,
  QuoteStats,
  QuoteAnalytics,
  QuoteWithUsers,
  QuoteWithHistory,
  QuoteWithRecentActions,
  QuoteWithComputedFlag,
} from "./domains/quotes/types";

// Re-export constants
export {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  QUOTE_OUTCOME_LABELS,
  QUOTE_OUTCOME_COLORS,
  LOST_REASONS,
  ACTION_TYPE_LABELS,
  LEAD_SOURCES,
  SERVICE_TYPES,
  shouldBeFlagged,
  calculateExpirationDate,
  calculateNextFollowUp,
  isExpiringSoon,
} from "./domains/quotes/constants";
