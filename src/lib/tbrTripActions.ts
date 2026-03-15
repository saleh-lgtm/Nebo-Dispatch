"use server";

/**
 * TBR Trip Actions - Legacy Re-exports
 *
 * @deprecated Import from "@/lib/domains/tbr" instead.
 *
 * This file re-exports from the new domain structure for backward compatibility.
 * Will be removed in a future version.
 */

// Re-export all actions
export {
  getTbrTrips,
  getTbrTripById,
  getTbrTripByTbrId,
  getTripsReadyToPush,
  getTripsWithAlerts,
  getUnalertedStatusChanges,
  getTbrDashboardStats,
  getTbrSyncLogs,
  processTbrIngest,
  updateLaReservationId,
  markPushFailed,
  markStatusAlerted,
  archiveTbrTrip,
} from "./domains/tbr/actions";

// Re-export types
export type {
  TbrTripFilters,
  TbrTripResult,
  IngestedTbrTrip,
  IngestResult,
  StatusChange,
  ChangeHistoryEntry,
  PushResult,
  LaSyncUpdate,
  TbrDashboardStats,
  LastSyncInfo,
  TbrSyncLogEntry,
} from "./domains/tbr/types";

// Re-export constants
export {
  TBR_STATUS_LABELS,
  TBR_STATUS_COLORS,
  LA_SYNC_STATUS_LABELS,
  LA_SYNC_STATUS_COLORS,
  normalizeVehicleType,
} from "./domains/tbr/constants";
