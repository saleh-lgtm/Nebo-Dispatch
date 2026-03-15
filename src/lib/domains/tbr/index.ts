/**
 * TBR Domain
 *
 * Unified export for all TBR Global trip management functionality.
 *
 * Usage:
 *   // Import actions (server-side)
 *   import { getTbrTrips, processTbrIngest } from "@/lib/domains/tbr";
 *
 *   // Import types
 *   import type { TbrTripFilters, IngestedTbrTrip } from "@/lib/domains/tbr";
 *
 *   // Import constants
 *   import { TBR_STATUS_LABELS, normalizeVehicleType } from "@/lib/domains/tbr";
 *
 *   // Import service functions (for testing or custom use)
 *   import { mapTbrStatus, isEligibleForPush } from "@/lib/domains/tbr/service";
 */

// ============================================
// TYPE EXPORTS
// ============================================

export type {
  // Filter & Query
  TbrTripFilters,
  TbrTripResult,

  // Ingestion
  IngestedTbrTrip,
  IngestResult,

  // Status Changes
  StatusChange,
  ChangeHistoryEntry,

  // LA Sync
  PushResult,
  LaSyncUpdate,

  // Dashboard
  TbrDashboardStats,
  LastSyncInfo,

  // Logs
  TbrSyncLogEntry,
} from "./types";

// ============================================
// CONSTANT EXPORTS
// ============================================

export {
  // Status config
  TBR_STATUS_LABELS,
  TBR_STATUS_COLORS,
  LA_SYNC_STATUS_LABELS,
  LA_SYNC_STATUS_COLORS,

  // Status mapping
  STATUS_KEYWORDS,

  // Query defaults
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  DEFAULT_FILTERS,

  // Ingestion sources
  DEFAULT_INGEST_SOURCE,
  EMAIL_INGEST_SOURCE,
  MANUAL_ENTRY_SOURCE,

  // Alert config
  ALERT_TRIGGERING_STATUSES,
  PUSHABLE_STATUSES,

  // Vehicle mapping
  VEHICLE_TYPE_MAP,
  normalizeVehicleType,
} from "./constants";

// ============================================
// SERVER ACTION EXPORTS
// ============================================

export {
  // Read operations
  getTbrTrips,
  getTbrTripById,
  getTbrTripByTbrId,
  getTripsReadyToPush,
  getTripsWithAlerts,
  getUnalertedStatusChanges,
  getTbrDashboardStats,
  getTbrSyncLogs,

  // Write operations
  processTbrIngest,
  updateLaReservationId,
  markPushFailed,
  markStatusAlerted,
  archiveTbrTrip,
} from "./actions";

// ============================================
// SERVICE EXPORTS
// ============================================
// NOTE: Service functions (mapTbrStatus, requiresAlert, isEligibleForPush, buildWhereClause)
// are NOT exported from the barrel to prevent client-side bundling of Prisma.
// Import directly from "@/lib/domains/tbr/service" for server-side use only.
