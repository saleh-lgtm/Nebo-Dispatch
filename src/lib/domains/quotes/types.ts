/**
 * Quotes Domain Types
 *
 * Type definitions for quote management and lead tracking.
 */

import { QuoteStatus, QuoteOutcome, QuoteActionType, Quote, QuoteAction } from "@prisma/client";

// ============================================
// CREATE/UPDATE TYPES
// ============================================

/**
 * Data required to create a new quote
 */
export interface CreateQuoteData {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceType: string;
  source?: string;
  dateOfService?: Date;
  pickupDate?: Date;
  pickupLocation?: string;
  dropoffLocation?: string;
  estimatedAmount?: number;
  notes?: string;
  shiftId?: string;
}

/**
 * Data for updating an existing quote
 */
export interface UpdateQuoteData {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceType?: string;
  source?: string;
  dateOfService?: Date;
  pickupDate?: Date;
  pickupLocation?: string;
  dropoffLocation?: string;
  estimatedAmount?: number;
  notes?: string;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Options for querying quotes
 */
export interface QuoteQueryOptions {
  status?: QuoteStatus[];
  assignedToId?: string;
  limit?: number;
  includeExpired?: boolean;
}

/**
 * Date range for analytics queries
 */
export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================
// ACTION TYPES
// ============================================

/**
 * Metadata for quote actions
 */
export interface QuoteActionMetadata {
  outcome?: QuoteOutcome;
  reason?: string;
  newStatus?: QuoteStatus;
  assignedTo?: string;
  reservationId?: string;
  [key: string]: unknown;
}

/**
 * Result of recording an action
 */
export interface QuoteActionResult {
  quote: Quote;
  action: QuoteAction & {
    user: { id: string; name: string | null };
  };
}

// ============================================
// STATS TYPES
// ============================================

/**
 * Quote statistics for dashboard
 */
export interface QuoteStats {
  pending: number;
  followingUp: number;
  converted: number;
  lost: number;
  expired: number;
  flagged: number;
  expiringSoon: number;
}

/**
 * Quote analytics for reporting
 */
export interface QuoteAnalytics {
  totalQuotes: number;
  convertedQuotes: number;
  lostQuotes: number;
  conversionRate: number;
  avgActionsPerQuote: number;
}

// ============================================
// EXTENDED TYPES
// ============================================

/**
 * Quote with related user data
 */
export interface QuoteWithUsers extends Quote {
  createdBy: { id: string; name: string | null };
  assignedTo?: { id: string; name: string | null } | null;
}

/**
 * Quote with action history
 */
export interface QuoteWithHistory extends Quote {
  createdBy: { id: string; name: string | null; email: string | null };
  assignedTo?: { id: string; name: string | null; email: string | null } | null;
  actions: Array<QuoteAction & {
    user: { id: string; name: string | null };
  }>;
}

/**
 * Quote with recent actions for list views
 */
export interface QuoteWithRecentActions extends QuoteWithUsers {
  actions: Array<QuoteAction & {
    user: { id: string; name: string | null };
  }>;
}

/**
 * Quote with computed flag status
 */
export interface QuoteWithComputedFlag extends QuoteWithRecentActions {
  isFlagged: boolean;
}

// ============================================
// RE-EXPORT PRISMA ENUMS
// ============================================

export { QuoteStatus, QuoteOutcome, QuoteActionType };
