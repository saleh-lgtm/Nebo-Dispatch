"use server";

/**
 * TBR Domain Server Actions
 *
 * Thin wrapper around service layer that handles:
 * - Authentication/authorization
 * - Audit logging
 * - Cache revalidation
 *
 * All business logic lives in service.ts
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/auditActions";

import * as service from "./service";
import type { TbrTripFilters, IngestedTbrTrip, LaSyncUpdate } from "./types";

// ============================================
// AUTH HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
  if (!isAdmin) {
    throw new Error("Admin access required");
  }
  return session;
}

// ============================================
// READ ACTIONS
// ============================================

/**
 * Get TBR trips with filters
 */
export async function getTbrTrips(filters: TbrTripFilters = {}) {
  await requireAuth();
  return service.queryTrips(filters);
}

/**
 * Get single trip by internal ID
 */
export async function getTbrTripById(id: string) {
  await requireAuth();
  return service.getTripById(id);
}

/**
 * Get single trip by TBR's trip ID
 */
export async function getTbrTripByTbrId(tbrTripId: string) {
  await requireAuth();
  return service.getTripByTbrId(tbrTripId);
}

/**
 * Get trips ready to push to LimoAnywhere
 */
export async function getTripsReadyToPush() {
  await requireAuth();
  return service.getTripsReadyForPush();
}

/**
 * Get trips with alerts (modified/cancelled after LA push)
 */
export async function getTripsWithAlerts() {
  await requireAuth();
  return service.getTripsNeedingAlerts();
}

/**
 * Get trips with unalerted status changes
 */
export async function getUnalertedStatusChanges() {
  return service.getTripsNeedingAlerts();
}

/**
 * Get dashboard stats
 */
export async function getTbrDashboardStats() {
  await requireAuth();
  return service.getDashboardStats();
}

/**
 * Get sync logs (admin only)
 */
export async function getTbrSyncLogs(limit: number = 20) {
  await requireAdmin();
  return service.getSyncLogs(limit);
}

// ============================================
// WRITE ACTIONS
// ============================================

/**
 * Process incoming trips from n8n/email
 * Called from API routes, no session required (uses API key auth)
 */
export async function processTbrIngest(
  trips: IngestedTbrTrip[],
  source: string = "n8n-scraper"
) {
  const result = await service.processIngest(trips, source);
  revalidatePath("/tbr-trips");
  return result;
}

/**
 * Update trip with LA reservation ID after push
 */
export async function updateLaReservationId(
  tripId: string,
  laReservationId: string,
  laConfirmation?: string
) {
  const session = await requireAuth();

  const updated = await service.markAsPushed(tripId, laReservationId, laConfirmation);

  await createAuditLog(session.user.id, "UPDATE", "TbrTrip", tripId, {
    action: "push_to_la",
    laReservationId,
    laConfirmation,
  });

  revalidatePath("/tbr-trips");
  return updated;
}

/**
 * Mark push as failed
 */
export async function markPushFailed(tripId: string, errorMessage: string) {
  const session = await requireAuth();

  const updated = await service.markPushAsFailed(tripId, errorMessage);

  await createAuditLog(session.user.id, "UPDATE", "TbrTrip", tripId, {
    action: "push_failed",
    error: errorMessage,
  });

  revalidatePath("/tbr-trips");
  return updated;
}

/**
 * Mark status change as alerted
 */
export async function markStatusAlerted(tripId: string) {
  await requireAuth();
  await service.markAsAlerted(tripId);
  revalidatePath("/tbr-trips");
}

/**
 * Archive a trip (admin only)
 */
export async function archiveTbrTrip(tripId: string) {
  const session = await requireAdmin();

  const updated = await service.archiveTrip(tripId);

  await createAuditLog(session.user.id, "DELETE", "TbrTrip", tripId, {
    action: "archive",
  });

  revalidatePath("/tbr-trips");
  return updated;
}
