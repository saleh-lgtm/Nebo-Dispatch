/**
 * TBR Domain Service
 *
 * Pure business logic for TBR trip processing.
 * This layer is framework-agnostic and can be tested in isolation.
 *
 * Responsibilities:
 * - Status mapping and normalization
 * - Change detection
 * - Business rule validation
 * - Data transformation
 */

import { TbrTripStatus, TbrTrip, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  IngestedTbrTrip,
  IngestResult,
  StatusChange,
  ChangeHistoryEntry,
  TbrTripFilters,
  TbrTripResult,
  TbrDashboardStats,
} from "./types";
import {
  STATUS_KEYWORDS,
  ALERT_TRIGGERING_STATUSES,
  PUSHABLE_STATUSES,
  DEFAULT_INGEST_SOURCE,
} from "./constants";

// ============================================
// STATUS MAPPING
// ============================================

/**
 * Map raw status string from TBR to internal enum
 * Uses keyword matching with fallback to PENDING
 */
export function mapTbrStatus(rawStatus: string): TbrTripStatus {
  const normalized = rawStatus.toLowerCase().trim();

  for (const { keywords, status } of STATUS_KEYWORDS) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return status;
    }
  }

  return "PENDING";
}

/**
 * Check if status change requires alert
 */
export function requiresAlert(
  oldStatus: TbrTripStatus,
  newStatus: TbrTripStatus,
  isPushedToLa: boolean
): boolean {
  if (!isPushedToLa) return false;
  if (oldStatus === newStatus) return false;
  return ALERT_TRIGGERING_STATUSES.includes(newStatus);
}

/**
 * Check if trip is eligible for LA push
 */
export function isEligibleForPush(trip: TbrTrip): boolean {
  if (trip.archivedAt) return false;
  if (trip.laSyncStatus !== "NOT_PUSHED") return false;
  if (!PUSHABLE_STATUSES.includes(trip.tbrStatus)) return false;
  if (trip.pickupDatetime < new Date()) return false;
  return true;
}

// ============================================
// QUERY BUILDING
// ============================================

/**
 * Build Prisma where clause from filters
 */
export function buildWhereClause(filters: TbrTripFilters): Prisma.TbrTripWhereInput {
  const where: Prisma.TbrTripWhereInput = {
    archivedAt: null,
  };

  if (filters.status && filters.status !== "ALL") {
    where.tbrStatus = filters.status;
  }

  if (filters.laSyncStatus && filters.laSyncStatus !== "ALL") {
    where.laSyncStatus = filters.laSyncStatus;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.pickupDatetime = {};
    if (filters.dateFrom) {
      where.pickupDatetime.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.pickupDatetime.lte = filters.dateTo;
    }
  }

  if (filters.search) {
    where.OR = [
      { tbrTripId: { contains: filters.search, mode: "insensitive" } },
      { passengerName: { contains: filters.search, mode: "insensitive" } },
      { pickupAddress: { contains: filters.search, mode: "insensitive" } },
      { dropoffAddress: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

// ============================================
// TRIP QUERIES
// ============================================

/**
 * Query trips with filters and pagination
 */
export async function queryTrips(filters: TbrTripFilters = {}): Promise<TbrTripResult> {
  const { limit = 50, offset = 0 } = filters;
  const where = buildWhereClause(filters);

  const [trips, total] = await Promise.all([
    prisma.tbrTrip.findMany({
      where,
      orderBy: { pickupDatetime: "asc" },
      skip: offset,
      take: limit,
    }),
    prisma.tbrTrip.count({ where }),
  ]);

  return {
    trips,
    total,
    hasMore: offset + trips.length < total,
  };
}

/**
 * Get single trip by internal ID
 */
export async function getTripById(id: string): Promise<TbrTrip | null> {
  return prisma.tbrTrip.findUnique({ where: { id } });
}

/**
 * Get single trip by TBR's external ID
 */
export async function getTripByTbrId(tbrTripId: string): Promise<TbrTrip | null> {
  return prisma.tbrTrip.findUnique({ where: { tbrTripId } });
}

/**
 * Get trips ready to push to LimoAnywhere
 */
export async function getTripsReadyForPush(): Promise<TbrTrip[]> {
  const now = new Date();

  return prisma.tbrTrip.findMany({
    where: {
      archivedAt: null,
      laSyncStatus: "NOT_PUSHED",
      tbrStatus: { in: PUSHABLE_STATUSES },
      pickupDatetime: { gte: now },
    },
    orderBy: { pickupDatetime: "asc" },
  });
}

/**
 * Get trips with status changes requiring alerts
 */
export async function getTripsNeedingAlerts(): Promise<TbrTrip[]> {
  return prisma.tbrTrip.findMany({
    where: {
      archivedAt: null,
      laSyncStatus: "PUSHED",
      tbrStatus: { in: ALERT_TRIGGERING_STATUSES },
      statusAlerted: false,
    },
    orderBy: { updatedAt: "desc" },
  });
}

// ============================================
// TRIP INGESTION
// ============================================

/**
 * Process a single ingested trip
 * Returns created/updated status and any status change
 */
async function processOneTrip(
  incomingTrip: IngestedTbrTrip,
  now: Date
): Promise<{
  action: "created" | "updated" | "unchanged";
  statusChange?: StatusChange;
}> {
  const pickupDatetime =
    typeof incomingTrip.pickupDatetime === "string"
      ? new Date(incomingTrip.pickupDatetime)
      : incomingTrip.pickupDatetime;

  const newStatus = mapTbrStatus(incomingTrip.status);
  const existing = await getTripByTbrId(incomingTrip.tbrTripId);

  if (!existing) {
    // Create new trip
    await prisma.tbrTrip.create({
      data: {
        tbrTripId: incomingTrip.tbrTripId,
        tbrStatus: newStatus,
        tbrStatusText: incomingTrip.status,
        passengerName: incomingTrip.passengerName,
        passengerPhone: incomingTrip.passengerPhone,
        passengerEmail: incomingTrip.passengerEmail,
        passengerCount: incomingTrip.passengerCount || 1,
        pickupDatetime,
        pickupAddress: incomingTrip.pickupAddress,
        dropoffAddress: incomingTrip.dropoffAddress,
        vehicleType: incomingTrip.vehicleType,
        flightNumber: incomingTrip.flightNumber,
        specialNotes: incomingTrip.notes,
        fareAmount: incomingTrip.fareAmount,
        lastSyncedAt: now,
      },
    });
    return { action: "created" };
  }

  // Check for status change
  const statusChanged = existing.tbrStatus !== newStatus;
  let statusChange: StatusChange | undefined;

  if (statusChanged) {
    statusChange = {
      tbrTripId: incomingTrip.tbrTripId,
      tripId: existing.id,
      passengerName: existing.passengerName,
      pickupDatetime: existing.pickupDatetime,
      pickupAddress: existing.pickupAddress,
      dropoffAddress: existing.dropoffAddress,
      oldStatus: existing.tbrStatus,
      newStatus,
      isPushedToLa: existing.laSyncStatus === "PUSHED",
      laReservationId: existing.laReservationId || undefined,
    };

    // Build change history
    const existingHistory = (existing.changeHistory as unknown as ChangeHistoryEntry[]) || [];
    const changeHistory: ChangeHistoryEntry[] = [
      ...existingHistory,
      {
        field: "tbrStatus",
        oldValue: existing.tbrStatus,
        newValue: newStatus,
        changedAt: now.toISOString(),
      },
    ];

    await prisma.tbrTrip.update({
      where: { id: existing.id },
      data: {
        tbrStatus: newStatus,
        tbrStatusText: incomingTrip.status,
        passengerName: incomingTrip.passengerName,
        passengerPhone: incomingTrip.passengerPhone,
        passengerEmail: incomingTrip.passengerEmail,
        passengerCount: incomingTrip.passengerCount || 1,
        pickupDatetime,
        pickupAddress: incomingTrip.pickupAddress,
        dropoffAddress: incomingTrip.dropoffAddress,
        vehicleType: incomingTrip.vehicleType,
        flightNumber: incomingTrip.flightNumber,
        specialNotes: incomingTrip.notes,
        fareAmount: incomingTrip.fareAmount,
        lastSyncedAt: now,
        syncVersion: { increment: 1 },
        changeHistory: changeHistory as unknown as Prisma.InputJsonValue,
        statusAlerted: false,
      },
    });

    return { action: "updated", statusChange };
  }

  // Check for other field changes
  const fieldsChanged =
    existing.passengerName !== incomingTrip.passengerName ||
    existing.pickupAddress !== incomingTrip.pickupAddress ||
    existing.dropoffAddress !== incomingTrip.dropoffAddress ||
    existing.vehicleType !== incomingTrip.vehicleType ||
    existing.fareAmount !== incomingTrip.fareAmount;

  if (fieldsChanged) {
    await prisma.tbrTrip.update({
      where: { id: existing.id },
      data: {
        passengerName: incomingTrip.passengerName,
        passengerPhone: incomingTrip.passengerPhone,
        passengerEmail: incomingTrip.passengerEmail,
        passengerCount: incomingTrip.passengerCount || 1,
        pickupDatetime,
        pickupAddress: incomingTrip.pickupAddress,
        dropoffAddress: incomingTrip.dropoffAddress,
        vehicleType: incomingTrip.vehicleType,
        flightNumber: incomingTrip.flightNumber,
        specialNotes: incomingTrip.notes,
        fareAmount: incomingTrip.fareAmount,
        lastSyncedAt: now,
        syncVersion: { increment: 1 },
      },
    });
    return { action: "updated" };
  }

  // Just update sync timestamp
  await prisma.tbrTrip.update({
    where: { id: existing.id },
    data: { lastSyncedAt: now },
  });

  return { action: "unchanged" };
}

/**
 * Process batch of incoming trips
 * Core ingestion logic with upsert and change detection
 */
export async function processIngest(
  trips: IngestedTbrTrip[],
  source: string = DEFAULT_INGEST_SOURCE
): Promise<IngestResult> {
  const now = new Date();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const statusChanges: StatusChange[] = [];
  const errors: string[] = [];

  for (const trip of trips) {
    try {
      const result = await processOneTrip(trip, now);

      switch (result.action) {
        case "created":
          created++;
          break;
        case "updated":
          updated++;
          break;
        case "unchanged":
          unchanged++;
          break;
      }

      if (result.statusChange) {
        statusChanges.push(result.statusChange);
      }
    } catch (error) {
      errors.push(
        `Trip ${trip.tbrTripId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Log the sync
  await prisma.tbrSyncLog.create({
    data: {
      startedAt: now,
      completedAt: new Date(),
      success: errors.length === 0,
      tripsFound: trips.length,
      tripsCreated: created,
      tripsUpdated: updated,
      tripsCancelled: statusChanges.filter((c) => c.newStatus === "CANCELLED").length,
      triggerType: source,
      errorMessage: errors.length > 0 ? errors.join("\n") : null,
    },
  });

  return { created, updated, unchanged, statusChanges, errors };
}

// ============================================
// LA SYNC OPERATIONS
// ============================================

/**
 * Update trip after successful LA push
 */
export async function markAsPushed(
  tripId: string,
  laReservationId: string,
  laConfirmation?: string
): Promise<TbrTrip> {
  return prisma.tbrTrip.update({
    where: { id: tripId },
    data: {
      laReservationId,
      laConfirmation,
      laSyncStatus: "PUSHED",
      pushedAt: new Date(),
      pushError: null,
    },
  });
}

/**
 * Mark trip push as failed
 */
export async function markPushAsFailed(
  tripId: string,
  errorMessage: string
): Promise<TbrTrip> {
  return prisma.tbrTrip.update({
    where: { id: tripId },
    data: {
      laSyncStatus: "PUSH_FAILED",
      pushError: errorMessage,
    },
  });
}

/**
 * Mark status change as alerted
 */
export async function markAsAlerted(tripId: string): Promise<void> {
  await prisma.tbrTrip.update({
    where: { id: tripId },
    data: { statusAlerted: true },
  });
}

// ============================================
// ARCHIVE OPERATIONS
// ============================================

/**
 * Soft delete a trip
 */
export async function archiveTrip(tripId: string): Promise<TbrTrip> {
  return prisma.tbrTrip.update({
    where: { id: tripId },
    data: { archivedAt: new Date() },
  });
}

// ============================================
// DASHBOARD & STATS
// ============================================

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<TbrDashboardStats> {
  const now = new Date();

  const [
    total,
    pending,
    confirmed,
    modified,
    cancelled,
    notPushed,
    pushed,
    pushFailed,
    upcoming,
    lastSync,
  ] = await Promise.all([
    prisma.tbrTrip.count({ where: { archivedAt: null } }),
    prisma.tbrTrip.count({ where: { archivedAt: null, tbrStatus: "PENDING" } }),
    prisma.tbrTrip.count({ where: { archivedAt: null, tbrStatus: "CONFIRMED" } }),
    prisma.tbrTrip.count({ where: { archivedAt: null, tbrStatus: "MODIFIED" } }),
    prisma.tbrTrip.count({ where: { archivedAt: null, tbrStatus: "CANCELLED" } }),
    prisma.tbrTrip.count({ where: { archivedAt: null, laSyncStatus: "NOT_PUSHED" } }),
    prisma.tbrTrip.count({ where: { archivedAt: null, laSyncStatus: "PUSHED" } }),
    prisma.tbrTrip.count({ where: { archivedAt: null, laSyncStatus: "PUSH_FAILED" } }),
    prisma.tbrTrip.count({
      where: {
        archivedAt: null,
        pickupDatetime: { gte: now },
        tbrStatus: { not: "CANCELLED" },
      },
    }),
    prisma.tbrSyncLog.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        startedAt: true,
        success: true,
        tripsFound: true,
        tripsCreated: true,
        tripsUpdated: true,
      },
    }),
  ]);

  return {
    total,
    byStatus: { pending, confirmed, modified, cancelled },
    bySyncStatus: { notPushed, pushed, pushFailed },
    upcoming,
    needsAction: notPushed + modified,
    lastSync: lastSync
      ? {
          at: lastSync.startedAt,
          success: lastSync.success,
          found: lastSync.tripsFound,
          created: lastSync.tripsCreated,
          updated: lastSync.tripsUpdated,
        }
      : null,
  };
}

/**
 * Get sync logs
 */
export async function getSyncLogs(limit: number = 20) {
  return prisma.tbrSyncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}
