/**
 * Operations Domain
 *
 * Unified export for operational functions: confirmations, routing, engagement.
 *
 * Usage:
 *   import { getUpcomingConfirmations, completeConfirmation } from "@/lib/domains/operations";
 */

// ============================================
// TRIP CONFIRMATIONS (tripConfirmationActions.ts)
// ============================================

export {
  // Confirmation queries
  getUpcomingConfirmations,
  getTodayConfirmations,
  getAllConfirmations,
  getPendingConfirmationCount,
  getConfirmationDispatchers,

  // Confirmation mutations
  completeConfirmation,
  markExpiredConfirmations,

  // Confirmation stats
  getConfirmationStats,
  getConfirmationStatsOptimized,
  getDispatcherConfirmationMetrics,
  getAllDispatcherMetrics,
  getMissedConfirmationReport,
  getDispatcherAccountabilityMetrics,

  // Manifest ingestion
  parseManifestEmail,
  ingestManifestTrips,
} from "../../tripConfirmationActions";

// ============================================
// ROUTE PRICING (routePricingActions.ts)
// ============================================

export {
  // Types
  type RoutePriceRow,
  type ImportResult,
  type RoutePriceSearchParams,
  type RoutePriceResult,
  type RoutePricingStats,

  // Search & lookup
  searchRoutePrices,
  getExactRoutePrice,
  getVehicleCodes,
  getZoneSuggestions,

  // Import (Admin)
  clearRoutePrices,
  importRoutePricesBatch,
  logRoutePriceImport,
  importRoutePrices,

  // Stats (Admin)
  getRoutePricingStats,
  getImportHistory,
} from "../../routePricingActions";

// ============================================
// ENGAGEMENT (engagementActions.ts)
// ============================================

export {
  // Types
  type EngagementAction,
  type DispatcherEngagement,
  type DailyEngagement,
  type EngagementReport,

  // Engagement reports
  getEngagementReport,
  getDailyEngagementTrend,
  getDispatcherEngagement,
} from "../../engagementActions";
