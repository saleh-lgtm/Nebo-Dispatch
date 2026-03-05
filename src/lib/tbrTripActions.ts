"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";
import { TbrTripStatus, LaSyncStatus } from "@prisma/client";

// Types for TBR trip filters
export interface TbrTripFilters {
    status?: TbrTripStatus | "ALL";
    laSyncStatus?: LaSyncStatus | "ALL";
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    limit?: number;
    offset?: number;
}

// Type for ingested trip data from n8n scraper
export interface IngestedTbrTrip {
    tbrTripId: string;
    status: string; // Raw status text from TBR
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

// Type for status change detection
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

// Type for push result
export interface PushResult {
    success: boolean;
    tripId: string;
    laReservationId?: string;
    error?: string;
}

/**
 * Get TBR trips with optional filters
 * Returns paginated results sorted by pickup datetime
 */
export async function getTbrTrips(filters: TbrTripFilters = {}) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const {
        status = "ALL",
        laSyncStatus = "ALL",
        dateFrom,
        dateTo,
        search,
        limit = 50,
        offset = 0,
    } = filters;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
        archivedAt: null,
    };

    if (status && status !== "ALL") {
        where.tbrStatus = status;
    }

    if (laSyncStatus && laSyncStatus !== "ALL") {
        where.laSyncStatus = laSyncStatus;
    }

    if (dateFrom || dateTo) {
        where.pickupDatetime = {};
        if (dateFrom) {
            where.pickupDatetime.gte = dateFrom;
        }
        if (dateTo) {
            where.pickupDatetime.lte = dateTo;
        }
    }

    if (search) {
        where.OR = [
            { tbrTripId: { contains: search, mode: "insensitive" } },
            { passengerName: { contains: search, mode: "insensitive" } },
            { pickupAddress: { contains: search, mode: "insensitive" } },
            { dropoffAddress: { contains: search, mode: "insensitive" } },
        ];
    }

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
 * Get a single TBR trip by ID
 */
export async function getTbrTripById(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const trip = await prisma.tbrTrip.findUnique({
        where: { id },
    });

    return trip;
}

/**
 * Get a TBR trip by TBR's trip ID
 */
export async function getTbrTripByTbrId(tbrTripId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const trip = await prisma.tbrTrip.findUnique({
        where: { tbrTripId },
    });

    return trip;
}

/**
 * Map raw status string to TbrTripStatus enum
 */
function mapTbrStatus(rawStatus: string): TbrTripStatus {
    const normalized = rawStatus.toLowerCase().trim();

    if (normalized.includes("cancel")) return "CANCELLED";
    if (normalized.includes("modif") || normalized.includes("change")) return "MODIFIED";
    if (normalized.includes("confirm") || normalized.includes("accept")) return "CONFIRMED";
    return "PENDING";
}

/**
 * Process incoming TBR trips from n8n scraper
 * Performs upsert logic and detects status changes
 * Called from /api/tbr/ingest
 */
export async function processTbrIngest(
    trips: IngestedTbrTrip[],
    source: string = "n8n-scraper"
): Promise<{
    created: number;
    updated: number;
    unchanged: number;
    statusChanges: StatusChange[];
    errors: string[];
}> {
    const now = new Date();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const statusChanges: StatusChange[] = [];
    const errors: string[] = [];

    for (const incomingTrip of trips) {
        try {
            // Parse pickup datetime if string
            const pickupDatetime =
                typeof incomingTrip.pickupDatetime === "string"
                    ? new Date(incomingTrip.pickupDatetime)
                    : incomingTrip.pickupDatetime;

            // Map raw status to enum
            const newStatus = mapTbrStatus(incomingTrip.status);

            // Check for existing trip
            const existing = await prisma.tbrTrip.findUnique({
                where: { tbrTripId: incomingTrip.tbrTripId },
            });

            if (existing) {
                // Check for status change
                const statusChanged = existing.tbrStatus !== newStatus;

                if (statusChanged) {
                    // Record status change
                    statusChanges.push({
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
                    });

                    // Update change history
                    const changeHistory = (existing.changeHistory as Array<{
                        field: string;
                        oldValue: string;
                        newValue: string;
                        changedAt: string;
                    }>) || [];
                    changeHistory.push({
                        field: "tbrStatus",
                        oldValue: existing.tbrStatus,
                        newValue: newStatus,
                        changedAt: now.toISOString(),
                    });

                    // Update trip with new status
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
                            changeHistory,
                            statusAlerted: false, // Reset so new alert is sent
                        },
                    });
                    updated++;
                } else {
                    // Update other fields but status unchanged
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
                        updated++;
                    } else {
                        // Just update lastSyncedAt
                        await prisma.tbrTrip.update({
                            where: { id: existing.id },
                            data: { lastSyncedAt: now },
                        });
                        unchanged++;
                    }
                }
            } else {
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
                created++;
            }
        } catch (error) {
            errors.push(
                `Trip ${incomingTrip.tbrTripId}: ${error instanceof Error ? error.message : "Unknown error"}`
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

    revalidatePath("/tbr-trips");

    return { created, updated, unchanged, statusChanges, errors };
}

/**
 * Mark a status change as alerted
 * Call this after sending SMS/notification for a status change
 */
export async function markStatusAlerted(tripId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    await prisma.tbrTrip.update({
        where: { id: tripId },
        data: { statusAlerted: true },
    });

    revalidatePath("/tbr-trips");
}

/**
 * Get trips with unalerted status changes that are pushed to LA
 * Used to send alerts for status changes on trips already in LimoAnywhere
 */
export async function getUnalertedStatusChanges() {
    const trips = await prisma.tbrTrip.findMany({
        where: {
            statusAlerted: false,
            laSyncStatus: "PUSHED",
            tbrStatus: { in: ["MODIFIED", "CANCELLED"] },
            archivedAt: null,
        },
        orderBy: { updatedAt: "desc" },
    });

    return trips;
}

/**
 * Update trip with LimoAnywhere reservation ID after successful push
 */
export async function updateLaReservationId(
    tripId: string,
    laReservationId: string,
    laConfirmation?: string
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const updated = await prisma.tbrTrip.update({
        where: { id: tripId },
        data: {
            laReservationId,
            laConfirmation,
            laSyncStatus: "PUSHED",
            pushedAt: new Date(),
            pushError: null,
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "TbrTrip",
        tripId,
        {
            action: "push_to_la",
            laReservationId,
            laConfirmation,
        }
    );

    revalidatePath("/tbr-trips");

    return updated;
}

/**
 * Mark a push as failed
 */
export async function markPushFailed(tripId: string, errorMessage: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const updated = await prisma.tbrTrip.update({
        where: { id: tripId },
        data: {
            laSyncStatus: "PUSH_FAILED",
            pushError: errorMessage,
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "TbrTrip",
        tripId,
        {
            action: "push_failed",
            error: errorMessage,
        }
    );

    revalidatePath("/tbr-trips");

    return updated;
}

/**
 * Archive a TBR trip (soft delete)
 */
export async function archiveTbrTrip(tripId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    const updated = await prisma.tbrTrip.update({
        where: { id: tripId },
        data: { archivedAt: new Date() },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "TbrTrip",
        tripId,
        { action: "archive" }
    );

    revalidatePath("/tbr-trips");

    return updated;
}

/**
 * Get dashboard stats for TBR trips
 */
export async function getTbrDashboardStats() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

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
    ]);

    // Get last sync info
    const lastSync = await prisma.tbrSyncLog.findFirst({
        orderBy: { startedAt: "desc" },
        select: {
            startedAt: true,
            success: true,
            tripsFound: true,
            tripsCreated: true,
            tripsUpdated: true,
        },
    });

    return {
        total,
        byStatus: {
            pending,
            confirmed,
            modified,
            cancelled,
        },
        bySyncStatus: {
            notPushed,
            pushed,
            pushFailed,
        },
        upcoming,
        needsAction: notPushed + modified, // Trips that need attention
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
 * Get sync logs for admin view
 */
export async function getTbrSyncLogs(limit: number = 20) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    const logs = await prisma.tbrSyncLog.findMany({
        orderBy: { startedAt: "desc" },
        take: limit,
    });

    return logs;
}

/**
 * Get trips ready to push to LimoAnywhere
 * These are confirmed trips that haven't been pushed yet
 */
export async function getTripsReadyToPush() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const now = new Date();

    const trips = await prisma.tbrTrip.findMany({
        where: {
            archivedAt: null,
            laSyncStatus: "NOT_PUSHED",
            tbrStatus: { in: ["PENDING", "CONFIRMED"] },
            pickupDatetime: { gte: now },
        },
        orderBy: { pickupDatetime: "asc" },
    });

    return trips;
}

/**
 * Get trips with alerts (modified/cancelled after push to LA)
 */
export async function getTripsWithAlerts() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const trips = await prisma.tbrTrip.findMany({
        where: {
            archivedAt: null,
            laSyncStatus: "PUSHED",
            tbrStatus: { in: ["MODIFIED", "CANCELLED"] },
        },
        orderBy: { updatedAt: "desc" },
    });

    return trips;
}
