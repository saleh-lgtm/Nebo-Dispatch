/**
 * TBR Domain Constants
 *
 * Configuration values, mappings, and constants for TBR trip processing.
 */

import { TbrTripStatus, LaSyncStatus } from "@prisma/client";

// ============================================
// STATUS CONFIGURATION
// ============================================

/**
 * Human-readable labels for TBR trip statuses
 */
export const TBR_STATUS_LABELS: Record<TbrTripStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  MODIFIED: "Modified",
  CANCELLED: "Cancelled",
};

/**
 * Status colors for UI display
 */
export const TBR_STATUS_COLORS: Record<TbrTripStatus, string> = {
  PENDING: "#f59e0b",    // amber
  CONFIRMED: "#10b981",  // green
  MODIFIED: "#3b82f6",   // blue
  CANCELLED: "#ef4444",  // red
};

/**
 * Human-readable labels for LA sync statuses
 */
export const LA_SYNC_STATUS_LABELS: Record<LaSyncStatus, string> = {
  NOT_PUSHED: "Not Pushed",
  PUSHED: "Pushed to LA",
  PUSH_FAILED: "Push Failed",
};

/**
 * LA sync status colors for UI display
 */
export const LA_SYNC_STATUS_COLORS: Record<LaSyncStatus, string> = {
  NOT_PUSHED: "#6b7280",  // gray
  PUSHED: "#10b981",      // green
  PUSH_FAILED: "#ef4444", // red
};

// ============================================
// STATUS MAPPING
// ============================================

/**
 * Keywords for mapping raw TBR status text to enum values
 * Order matters - first match wins
 */
export const STATUS_KEYWORDS: Array<{
  keywords: string[];
  status: TbrTripStatus;
}> = [
  { keywords: ["cancel"], status: "CANCELLED" },
  { keywords: ["modif", "change", "update", "amend"], status: "MODIFIED" },
  { keywords: ["confirm", "accept", "approve", "book"], status: "CONFIRMED" },
  // Default fallback handled in mapTbrStatus
];

// ============================================
// QUERY DEFAULTS
// ============================================

/**
 * Default pagination values
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/**
 * Default filters
 */
export const DEFAULT_FILTERS = {
  status: "ALL" as const,
  laSyncStatus: "ALL" as const,
  limit: DEFAULT_PAGE_SIZE,
  offset: 0,
};

// ============================================
// INGESTION CONFIG
// ============================================

/**
 * Default source identifier for ingested trips
 */
export const DEFAULT_INGEST_SOURCE = "n8n-scraper";

/**
 * Email ingestion source identifier
 */
export const EMAIL_INGEST_SOURCE = "email-worker";

/**
 * Manual entry source identifier
 */
export const MANUAL_ENTRY_SOURCE = "manual";

// ============================================
// ALERT CONFIGURATION
// ============================================

/**
 * Statuses that trigger alerts when changed after LA push
 */
export const ALERT_TRIGGERING_STATUSES: TbrTripStatus[] = ["MODIFIED", "CANCELLED"];

/**
 * Statuses eligible for pushing to LA
 */
export const PUSHABLE_STATUSES: TbrTripStatus[] = ["PENDING", "CONFIRMED"];

// ============================================
// VEHICLE TYPE MAPPING
// ============================================

/**
 * Standard vehicle type mappings
 * Maps various TBR vehicle names to internal standard types
 */
export const VEHICLE_TYPE_MAP: Record<string, string> = {
  // Sedans
  sedan: "Sedan",
  "standard sedan": "Sedan",
  "executive sedan": "Executive Sedan",
  "luxury sedan": "Executive Sedan",

  // SUVs
  suv: "SUV",
  "standard suv": "SUV",
  "executive suv": "Executive SUV",
  "luxury suv": "Executive SUV",
  "suburban": "SUV",

  // Vans
  van: "Passenger Van",
  "passenger van": "Passenger Van",
  "sprinter": "Sprinter Van",
  "sprinter van": "Sprinter Van",
  "mercedes sprinter": "Sprinter Van",

  // Stretch
  "stretch limo": "Stretch Limo",
  limo: "Stretch Limo",
  limousine: "Stretch Limo",

  // Buses
  bus: "Mini Bus",
  "mini bus": "Mini Bus",
  minibus: "Mini Bus",
  "coach bus": "Coach Bus",
  coach: "Coach Bus",
};

/**
 * Normalize vehicle type string to standard format
 */
export function normalizeVehicleType(raw: string | undefined | null): string {
  if (!raw) return "Sedan";
  const normalized = raw.toLowerCase().trim();
  return VEHICLE_TYPE_MAP[normalized] || raw;
}
