/**
 * TBR Domain Types
 *
 * Type definitions for TBR Global trip management.
 * These types define the contract between TBR ingestion and internal processing.
 */

import { TbrTripStatus, LaSyncStatus, TbrTrip } from "@prisma/client";

// ============================================
// FILTER TYPES
// ============================================

/**
 * Filters for querying TBR trips
 */
export interface TbrTripFilters {
  status?: TbrTripStatus | "ALL";
  laSyncStatus?: LaSyncStatus | "ALL";
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Paginated trip result
 */
export interface TbrTripResult {
  trips: TbrTrip[];
  total: number;
  hasMore: boolean;
}

// ============================================
// INGESTION TYPES
// ============================================

/**
 * Trip data from n8n scraper/email ingestion
 * This is the raw format received from external sources
 */
export interface IngestedTbrTrip {
  tbrTripId: string;
  status: string; // Raw status text from TBR (mapped to TbrTripStatus)
  passengerName: string;
  passengerPhone?: string;
  passengerEmail?: string;
  passengerCount?: number;
  pickupDatetime: string | Date;
  pickupAddress: string;
  dropoffAddress: string;
  vehicleType?: string;
  flightNumber?: string;
  notes?: string;
  fareAmount?: number;
}

/**
 * Result of processing ingested trips
 */
export interface IngestResult {
  created: number;
  updated: number;
  unchanged: number;
  statusChanges: StatusChange[];
  errors: string[];
}

// ============================================
// STATUS CHANGE TYPES
// ============================================

/**
 * Represents a detected status change for alerting
 */
export interface StatusChange {
  tbrTripId: string;
  tripId: string;
  passengerName: string;
  pickupDatetime: Date;
  pickupAddress: string;
  dropoffAddress: string;
  oldStatus: TbrTripStatus;
  newStatus: TbrTripStatus;
  isPushedToLa: boolean;
  laReservationId?: string;
}

/**
 * Change history entry stored in trip JSON field
 */
export interface ChangeHistoryEntry {
  field: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
}

// ============================================
// LA SYNC TYPES
// ============================================

/**
 * Result of pushing trip to LimoAnywhere
 */
export interface PushResult {
  success: boolean;
  tripId: string;
  laReservationId?: string;
  laConfirmation?: string;
  error?: string;
}

/**
 * LA sync update data
 */
export interface LaSyncUpdate {
  laReservationId: string;
  laConfirmation?: string;
}

// ============================================
// DASHBOARD TYPES
// ============================================

/**
 * Dashboard statistics for TBR trips
 */
export interface TbrDashboardStats {
  total: number;
  byStatus: {
    pending: number;
    confirmed: number;
    modified: number;
    cancelled: number;
  };
  bySyncStatus: {
    notPushed: number;
    pushed: number;
    pushFailed: number;
  };
  upcoming: number;
  needsAction: number;
  lastSync: LastSyncInfo | null;
}

/**
 * Last sync information
 */
export interface LastSyncInfo {
  at: Date;
  success: boolean;
  found: number;
  created: number;
  updated: number;
}

// ============================================
// SYNC LOG TYPES
// ============================================

/**
 * Sync log entry for admin view
 */
export interface TbrSyncLogEntry {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  success: boolean;
  tripsFound: number;
  tripsCreated: number;
  tripsUpdated: number;
  tripsCancelled: number;
  triggerType: string;
  errorMessage: string | null;
}
