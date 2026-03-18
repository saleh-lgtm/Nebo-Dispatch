"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";
import { ConfirmationStatus } from "@prisma/client";
import {
    completeConfirmationSchema,
    confirmationFiltersSchema,
    confirmationTabDataSchema,
    limitParamSchema,
    daysParamSchema,
} from "@/lib/schemas";

/**
 * Get upcoming confirmations sorted by when call is due
 * Confirmation call should be made 2 hours before pickup (dueAt)
 * Returns next N pending trips, prioritizing those due soonest
 */
export async function getUpcomingConfirmations(limit: number = 10) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const parsed = limitParamSchema.safeParse({ limit });
    const safeLimit = parsed.success ? (parsed.data.limit ?? 10) : 10;

    try {
        const now = new Date();
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const confirmations = await prisma.tripConfirmation.findMany({
            where: {
                status: "PENDING",
                archivedAt: null,
                pickupAt: {
                    gte: now,
                    lte: twentyFourHoursFromNow,
                },
            },
            orderBy: {
                dueAt: "asc",
            },
            take: safeLimit,
            include: {
                completedBy: {
                    select: { id: true, name: true },
                },
            },
        });

        return { success: true as const, data: confirmations };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch upcoming confirmations" };
    }
}

/**
 * Get all pending confirmations for today
 */
export async function getTodayConfirmations() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const confirmations = await prisma.tripConfirmation.findMany({
            where: {
                manifestDate: {
                    gte: today,
                    lt: tomorrow,
                },
                archivedAt: null,
            },
            orderBy: {
                dueAt: "asc",
            },
            include: {
                completedBy: {
                    select: { id: true, name: true },
                },
            },
        });

        return { success: true as const, data: confirmations };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch today's confirmations" };
    }
}

/**
 * Complete or update a trip confirmation status
 * - Admins can edit any trip status
 * - Dispatchers can only complete PENDING trips (with race condition protection)
 */
export async function completeConfirmation(
    confirmationId: string,
    status: ConfirmationStatus,
    notes?: string
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const parsed = completeConfirmationSchema.safeParse({ confirmationId, status, notes });
    if (!parsed.success) {
        return { success: false as const, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );

    try {
        // Fetch confirmation first to calculate minutesBeforeDue and get tripNumber
        const confirmation = await prisma.tripConfirmation.findUnique({
            where: { id: confirmationId },
        });

        if (!confirmation) {
            return { success: false as const, error: "Confirmation not found" };
        }

        const now = new Date();
        const minutesBeforeDue = Math.round(
            (confirmation.dueAt.getTime() - now.getTime()) / (1000 * 60)
        );

        const previousStatus = confirmation.status;

        // Admins can update any status; dispatchers can only complete PENDING trips
        if (isAdmin) {
            // Admin: direct update, can change any status
            await prisma.tripConfirmation.update({
                where: { id: confirmationId },
                data: {
                    status,
                    completedAt: confirmation.completedAt || now,
                    completedById: confirmation.completedById || session.user.id,
                    minutesBeforeDue: confirmation.minutesBeforeDue ?? minutesBeforeDue,
                    notes: notes || confirmation.notes || null,
                    archivedAt: confirmation.archivedAt || now,
                },
            });
        } else {
            // Dispatcher: atomic update, only if still PENDING
            const updateResult = await prisma.tripConfirmation.updateMany({
                where: {
                    id: confirmationId,
                    status: "PENDING",
                },
                data: {
                    status,
                    completedAt: now,
                    completedById: session.user.id,
                    minutesBeforeDue,
                    notes: notes || null,
                    archivedAt: now,
                },
            });

            if (updateResult.count === 0) {
                return { success: false as const, error: "Confirmation already completed by another user" };
            }
        }

        // Fetch the updated record for return
        const updated = await prisma.tripConfirmation.findUnique({
            where: { id: confirmationId },
            include: {
                completedBy: {
                    select: { id: true, name: true },
                },
            },
        });

        // Create audit log
        await createAuditLog(
            session.user.id,
            "UPDATE",
            "TripConfirmation",
            confirmationId,
            {
                tripNumber: confirmation.tripNumber,
                previousStatus,
                newStatus: status,
                minutesBeforeDue,
                editedByAdmin: isAdmin,
            }
        );

        revalidatePath("/dashboard");
        revalidatePath("/admin/confirmations");

        return { success: true as const, data: updated };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to complete confirmation" };
    }
}

/**
 * Get confirmation stats using database aggregations (FAST)
 * Uses COUNT queries instead of fetching all records
 */
export async function getConfirmationStatsOptimized(days: number = 7) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const parsed = daysParamSchema.safeParse({ days });
    const safeDays = parsed.success ? (parsed.data.days ?? 7) : 7;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - safeDays);
        startDate.setHours(0, 0, 0, 0);

        const baseWhere = { createdAt: { gte: startDate } };

        // Run all counts in parallel - much faster than fetching all records
        const [
            total,
            completed,
            pending,
            expired,
            onTime,
            late,
            statusCounts,
        ] = await Promise.all([
            prisma.tripConfirmation.count({ where: baseWhere }),
            prisma.tripConfirmation.count({ where: { ...baseWhere, completedAt: { not: null } } }),
            prisma.tripConfirmation.count({ where: { ...baseWhere, status: "PENDING" } }),
            prisma.tripConfirmation.count({ where: { ...baseWhere, status: "EXPIRED" } }),
            prisma.tripConfirmation.count({ where: { ...baseWhere, minutesBeforeDue: { gt: 0 } } }),
            prisma.tripConfirmation.count({
                where: {
                    ...baseWhere,
                    minutesBeforeDue: { lte: 0 },
                    completedAt: { not: null },
                }
            }),
            prisma.tripConfirmation.groupBy({
                by: ["status"],
                where: baseWhere,
                _count: { status: true },
            }),
        ]);

        // Convert status counts to object
        const byStatus: Record<string, number> = {};
        statusCounts.forEach((s) => {
            byStatus[s.status] = s._count.status;
        });

        return {
            success: true as const,
            data: {
                total,
                completed,
                pending,
                expired,
                onTime,
                late,
                avgLeadTime: 0, // Skip for header stats - not critical
                onTimeRate: total > 0 ? Math.round((onTime / total) * 100) : 0,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
                byStatus,
            },
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch confirmation stats" };
    }
}

/**
 * Get confirmation stats for a date range (legacy - fetches all records)
 * Use getConfirmationStatsOptimized for faster performance
 */
export async function getConfirmationStats(days: number = 30) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const parsed = daysParamSchema.safeParse({ days });
    const safeDays = parsed.success ? (parsed.data.days ?? 30) : 30;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - safeDays);
        startDate.setHours(0, 0, 0, 0);

        const confirmations = await prisma.tripConfirmation.findMany({
            where: {
                createdAt: { gte: startDate },
            },
            select: {
                id: true,
                status: true,
                completedAt: true,
                completedById: true,
                minutesBeforeDue: true,
                dueAt: true,
                pickupAt: true,
            },
        });

        const total = confirmations.length;
        const completed = confirmations.filter((c) => c.completedAt !== null).length;
        const pending = confirmations.filter((c) => c.status === "PENDING").length;
        const expired = confirmations.filter((c) => c.status === "EXPIRED").length;

        // On-time = completed before dueAt (minutesBeforeDue > 0)
        const onTime = confirmations.filter(
            (c) => c.minutesBeforeDue !== null && c.minutesBeforeDue > 0
        ).length;

        // Late = completed after dueAt but before pickup
        const late = confirmations.filter(
            (c) =>
                c.minutesBeforeDue !== null &&
                c.minutesBeforeDue <= 0 &&
                c.completedAt !== null &&
                c.completedAt < c.pickupAt
        ).length;

        // Average minutes before due (for completed ones)
        const completedWithTime = confirmations.filter(
            (c) => c.minutesBeforeDue !== null
        );
        const avgLeadTime =
            completedWithTime.length > 0
                ? completedWithTime.reduce((sum, c) => sum + (c.minutesBeforeDue || 0), 0) /
                  completedWithTime.length
                : 0;

        // Status breakdown
        const byStatus: Record<string, number> = {};
        confirmations.forEach((c) => {
            byStatus[c.status] = (byStatus[c.status] || 0) + 1;
        });

        return {
            success: true as const,
            data: {
                total,
                completed,
                pending,
                expired,
                onTime,
                late,
                avgLeadTime: Math.round(avgLeadTime),
                onTimeRate: total > 0 ? Math.round((onTime / total) * 100) : 0,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
                byStatus,
            },
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch confirmation stats" };
    }
}

/**
 * Get dispatcher-specific confirmation metrics
 */
export async function getDispatcherConfirmationMetrics(
    userId?: string,
    days: number = 30
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const parsed = daysParamSchema.safeParse({ days });
    const safeDays = parsed.success ? (parsed.data.days ?? 30) : 30;

    // Only admins can view other users' metrics
    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    const targetUserId = isAdmin && userId ? userId : session.user.id;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - safeDays);

        const confirmations = await prisma.tripConfirmation.findMany({
            where: {
                completedById: targetUserId,
                completedAt: { gte: startDate },
            },
            select: {
                status: true,
                minutesBeforeDue: true,
                completedAt: true,
                dueAt: true,
                pickupAt: true,
            },
        });

        const total = confirmations.length;
        const onTime = confirmations.filter(
            (c) => c.minutesBeforeDue !== null && c.minutesBeforeDue > 0
        ).length;
        const late = confirmations.filter(
            (c) =>
                c.minutesBeforeDue !== null &&
                c.minutesBeforeDue <= 0 &&
                c.completedAt !== null &&
                c.completedAt < c.pickupAt
        ).length;

        // Average lead time
        const withLeadTime = confirmations.filter((c) => c.minutesBeforeDue !== null);
        const avgLeadTime =
            withLeadTime.length > 0
                ? withLeadTime.reduce((sum, c) => sum + (c.minutesBeforeDue || 0), 0) /
                  withLeadTime.length
                : 0;

        // Status breakdown
        const byStatus: Record<string, number> = {};
        confirmations.forEach((c) => {
            byStatus[c.status] = (byStatus[c.status] || 0) + 1;
        });

        return {
            success: true as const,
            data: {
                total,
                onTime,
                late,
                onTimeRate: total > 0 ? Math.round((onTime / total) * 100) : 0,
                avgLeadTimeMinutes: Math.round(avgLeadTime),
                byStatus,
            },
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch dispatcher metrics" };
    }
}

/**
 * Get all dispatchers' confirmation metrics for admin view
 */
export async function getAllDispatcherMetrics(days: number = 30) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    if (!isAdmin) {
        return { success: false as const, error: "Admin access required" };
    }

    const parsed = daysParamSchema.safeParse({ days });
    const safeDays = parsed.success ? (parsed.data.days ?? 30) : 30;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - safeDays);

        const confirmations = await prisma.tripConfirmation.findMany({
            where: {
                completedAt: { gte: startDate },
                completedById: { not: null },
            },
            select: {
                completedById: true,
                status: true,
                minutesBeforeDue: true,
                completedBy: {
                    select: { id: true, name: true },
                },
            },
        });

        // Group by dispatcher
        const byDispatcher: Record<
            string,
            {
                id: string;
                name: string;
                total: number;
                onTime: number;
                late: number;
                byStatus: Record<string, number>;
            }
        > = {};

        confirmations.forEach((c) => {
            if (!c.completedById || !c.completedBy) return;

            if (!byDispatcher[c.completedById]) {
                byDispatcher[c.completedById] = {
                    id: c.completedById,
                    name: c.completedBy.name || "Unknown",
                    total: 0,
                    onTime: 0,
                    late: 0,
                    byStatus: {},
                };
            }

            const d = byDispatcher[c.completedById];
            d.total++;
            if (c.minutesBeforeDue !== null && c.minutesBeforeDue > 0) {
                d.onTime++;
            } else if (c.minutesBeforeDue !== null && c.minutesBeforeDue <= 0) {
                d.late++;
            }
            d.byStatus[c.status] = (d.byStatus[c.status] || 0) + 1;
        });

        return {
            success: true as const,
            data: Object.values(byDispatcher)
                .map((d) => ({
                    ...d,
                    onTimeRate: d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0,
                }))
                .sort((a, b) => b.total - a.total),
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch dispatcher metrics" };
    }
}

/**
 * Get detailed report of missed confirmations with accountability
 * Shows expired confirmations and which dispatchers were on duty
 */
export async function getMissedConfirmationReport(days: number = 30) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    if (!isAdmin) {
        return { success: false as const, error: "Admin access required" };
    }

    const parsed = daysParamSchema.safeParse({ days });
    const safeDays = parsed.success ? (parsed.data.days ?? 30) : 30;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - safeDays);

        const missedConfirmations = await prisma.tripConfirmation.findMany({
            where: {
                status: "EXPIRED",
                archivedAt: { gte: startDate },
            },
            include: {
                accountableDispatchers: {
                    include: {
                        dispatcher: { select: { id: true, name: true, role: true } },
                        shift: { select: { clockIn: true, clockOut: true } },
                    },
                },
            },
            orderBy: { archivedAt: "desc" },
        });

        return {
            success: true as const,
            data: missedConfirmations.map((conf) => ({
                id: conf.id,
                tripNumber: conf.tripNumber,
                passengerName: conf.passengerName,
                driverName: conf.driverName,
                dueAt: conf.dueAt,
                pickupAt: conf.pickupAt,
                expiredAt: conf.archivedAt,
                onDutyDispatchers: conf.accountableDispatchers.map((a) => ({
                    id: a.dispatcher.id,
                    name: a.dispatcher.name,
                    role: a.dispatcher.role,
                    shiftStart: a.shift.clockIn,
                    shiftEnd: a.shift.clockOut,
                })),
            })),
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch missed confirmation report" };
    }
}

/**
 * Get accountability metrics per dispatcher
 * Includes DISPATCHER and ADMIN roles, excludes SUPER_ADMIN
 */
export async function getDispatcherAccountabilityMetrics(days: number = 30) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    if (!isAdmin) {
        return { success: false as const, error: "Admin access required" };
    }

    const parsed = daysParamSchema.safeParse({ days });
    const safeDays = parsed.success ? (parsed.data.days ?? 30) : 30;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - safeDays);

        // Get missed confirmation counts per dispatcher
        const accountabilityRecords =
            await prisma.missedConfirmationAccountability.groupBy({
                by: ["dispatcherId"],
                _count: { confirmationId: true },
                where: {
                    createdAt: { gte: startDate },
                    dispatcher: {
                        role: { in: ["DISPATCHER", "ADMIN"] },
                    },
                },
            });

        // Get dispatcher info and their confirmation completions
        const dispatchers = await prisma.user.findMany({
            where: {
                role: { in: ["DISPATCHER", "ADMIN"] },
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                role: true,
                shifts: {
                    where: { clockIn: { gte: startDate } },
                    select: { id: true },
                },
                confirmationsCompleted: {
                    where: { completedAt: { gte: startDate } },
                    select: { id: true, minutesBeforeDue: true },
                },
            },
        });

        return {
            success: true as const,
            data: dispatchers
                .map((d) => {
                    const missedCount =
                        accountabilityRecords.find((a) => a.dispatcherId === d.id)
                            ?._count.confirmationId || 0;

                    const completedCount = d.confirmationsCompleted.length;
                    const onTimeCount = d.confirmationsCompleted.filter(
                        (c) => c.minutesBeforeDue !== null && c.minutesBeforeDue > 0
                    ).length;

                    return {
                        id: d.id,
                        name: d.name || "Unknown",
                        role: d.role,
                        totalShifts: d.shifts.length,
                        confirmationsCompleted: completedCount,
                        confirmationsOnTime: onTimeCount,
                        confirmationsMissedWhileOnDuty: missedCount,
                        accountabilityRate:
                            completedCount + missedCount > 0
                                ? Math.round(
                                      (completedCount / (completedCount + missedCount)) * 100
                                  )
                                : 100,
                    };
                })
                .sort(
                    (a, b) =>
                        b.confirmationsMissedWhileOnDuty - a.confirmationsMissedWhileOnDuty
                ),
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch accountability metrics" };
    }
}

/**
 * Mark expired confirmations and record dispatcher accountability
 * This is called by a cron job or API route
 * Records which dispatchers were on duty when confirmations expired
 */
export async function markExpiredConfirmations() {
    try {
        const now = new Date();

        // Find confirmations that should be expired
        const toExpire = await prisma.tripConfirmation.findMany({
            where: {
                status: "PENDING",
                pickupAt: { lt: now },
                archivedAt: null,
            },
            select: {
                id: true,
                dueAt: true,
                pickupAt: true,
                tripNumber: true,
                passengerName: true,
            },
        });

        if (toExpire.length === 0) {
            return { success: true as const, data: { count: 0, accountabilityRecords: 0 } };
        }

        // OPTIMIZATION: Fetch ALL active shifts once instead of per confirmation
        // Find the date range that covers all confirmation windows
        const earliestDue = new Date(Math.min(...toExpire.map(c => c.dueAt.getTime())));
        const latestPickup = new Date(Math.max(...toExpire.map(c => c.pickupAt.getTime())));

        const activeShifts = await prisma.shift.findMany({
            where: {
                // Shift started before the latest pickup
                clockIn: { lte: latestPickup },
                OR: [
                    { clockOut: null }, // Still active
                    { clockOut: { gte: earliestDue } }, // Ended after earliest due time
                ],
                // Only include DISPATCHER and ADMIN roles (exclude SUPER_ADMIN)
                user: {
                    role: { in: ["DISPATCHER", "ADMIN"] },
                    isActive: true,
                },
            },
            select: {
                id: true,
                userId: true,
                clockIn: true,
                clockOut: true, // Need this to check overlap per confirmation
            },
        });

        // Build all accountability records in memory
        const accountabilityData: Array<{
            confirmationId: string;
            dispatcherId: string;
            shiftId: string;
            shiftStartedAt: Date;
            confirmationDueAt: Date;
            confirmationExpiredAt: Date;
        }> = [];

        for (const confirmation of toExpire) {
            for (const shift of activeShifts) {
                // Check if this shift was active during this specific confirmation window
                const shiftWasActive =
                    shift.clockIn <= confirmation.pickupAt &&
                    (!shift.clockOut || shift.clockOut >= confirmation.dueAt);

                if (shiftWasActive) {
                    accountabilityData.push({
                        confirmationId: confirmation.id,
                        dispatcherId: shift.userId,
                        shiftId: shift.id,
                        shiftStartedAt: shift.clockIn,
                        confirmationDueAt: confirmation.dueAt,
                        confirmationExpiredAt: now,
                    });
                }
            }
        }

        // OPTIMIZATION: Create all accountability records in parallel
        let accountabilityRecords = 0;
        if (accountabilityData.length > 0) {
            const createPromises = accountabilityData.map(data =>
                prisma.missedConfirmationAccountability.create({ data }).catch(() => null)
            );
            const results = await Promise.all(createPromises);
            accountabilityRecords = results.filter(r => r !== null).length;
        }

        // Deduct accountability points (1 per missed confirmation per dispatcher, floor at 0)
        if (accountabilityData.length > 0) {
            const deductionsByDispatcher = new Map<string, number>();
            for (const record of accountabilityData) {
                deductionsByDispatcher.set(
                    record.dispatcherId,
                    (deductionsByDispatcher.get(record.dispatcherId) || 0) + 1
                );
            }

            for (const [dispatcherId, points] of deductionsByDispatcher) {
                const user = await prisma.user.findUnique({
                    where: { id: dispatcherId },
                    select: { accountabilityScore: true },
                });
                const currentScore = user?.accountabilityScore ?? 100;
                const newScore = Math.max(0, currentScore - points);
                await prisma.user.update({
                    where: { id: dispatcherId },
                    data: { accountabilityScore: newScore },
                });
            }

            // Create MISSED_CONFIRMATION notification per dispatcher per missed trip
            const tripMap = new Map(toExpire.map(c => [c.id, c]));
            for (const record of accountabilityData) {
                const trip = tripMap.get(record.confirmationId);
                if (!trip) continue;

                await prisma.notification.create({
                    data: {
                        userId: record.dispatcherId,
                        type: "MISSED_CONFIRMATION",
                        title: "Missed Confirmation",
                        message: `Missed confirmation: Trip #${trip.tripNumber} for ${trip.passengerName} — -1 point`,
                        entityType: "TripConfirmation",
                        entityId: record.confirmationId,
                        actionUrl: "/admin/confirmations",
                    },
                });
            }
        }

        // OPTIMIZATION: Update all confirmations in a single query
        await prisma.tripConfirmation.updateMany({
            where: {
                id: { in: toExpire.map(c => c.id) },
            },
            data: {
                status: "EXPIRED",
                archivedAt: now,
            },
        });

        return { success: true as const, data: { count: toExpire.length, accountabilityRecords } };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to mark expired confirmations" };
    }
}

/**
 * Strip HTML tags and convert to plain text
 * Also handles quoted-printable encoding from email
 */
function htmlToPlainText(html: string): string {
    let text = html;

    // Handle quoted-printable encoding (common in email)
    // =3D is "=" , =\n is soft line break
    text = text.replace(/=3D/g, "=");
    text = text.replace(/=\r?\n/g, ""); // Remove soft line breaks
    text = text.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );

    // Handle escaped newlines from n8n/JSON
    text = text.replace(/\\n/g, "\n");
    text = text.replace(/\\r/g, "");
    text = text.replace(/\\t/g, "\t");

    // Replace <br> and </div> with newlines
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/div>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<\/tr>/gi, "\n");
    text = text.replace(/<\/td>/gi, " ");
    text = text.replace(/<\/th>/gi, " ");

    // Remove style, script, and head content entirely
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&apos;/g, "'");
    text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

    // Normalize whitespace
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n[ \t]+/g, "\n");
    text = text.replace(/[ \t]+\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
}

/**
 * Check if a date falls within Daylight Saving Time for America/Chicago
 * DST starts 2nd Sunday of March, ends 1st Sunday of November
 */
function isDaylightSavingTime(date: Date): boolean {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // DST is roughly March through November
    if (month < 2 || month > 10) return false; // Jan, Feb, Dec = standard time
    if (month > 2 && month < 10) return true;  // Apr-Oct = DST

    // March: DST starts 2nd Sunday
    if (month === 2) {
        const marchFirst = new Date(year, 2, 1);
        const dayOfWeek = marchFirst.getDay();
        const secondSunday = 8 + (7 - dayOfWeek) % 7;
        return day >= secondSunday;
    }

    // November: DST ends 1st Sunday
    if (month === 10) {
        const novFirst = new Date(year, 10, 1);
        const dayOfWeek = novFirst.getDay();
        const firstSunday = 1 + (7 - dayOfWeek) % 7;
        return day < firstSunday;
    }

    return false;
}

/**
 * Parse manifest email and extract trips
 * Supports LimoAnywhere manifest format
 */
export async function parseManifestEmail(emailBody: string): Promise<{
    success: boolean;
    data?: Array<{
        tripNumber: string;
        reservationNumber?: string;
        pickupAt: Date;
        passengerName: string;
        driverName: string;
        accountName?: string;
        accountNumber?: string;
    }>;
    error?: string;
}> {
    try {
    const trips: Array<{
        tripNumber: string;
        reservationNumber?: string;
        pickupAt: Date;
        passengerName: string;
        driverName: string;
        accountName?: string;
        accountNumber?: string;
    }> = [];

    // Convert HTML to plain text if needed
    let plainText = emailBody;
    if (emailBody.includes("<html") || emailBody.includes("<div") || emailBody.includes("<table")) {
        plainText = htmlToPlainText(emailBody);
    }

    // Debug: log first 500 chars to help troubleshoot
    console.log("[parseManifestEmail] Plain text preview:", plainText.substring(0, 500));

    // Split email into trip sections
    // LimoAnywhere format: MM/DD/YYYY  -  Pick Up At:HH:MM AM/PM
    // Handle variable spacing around dash and colon
    const sections = plainText.split(/(?=\d{2}\/\d{2}\/\d{4}\s+-\s+Pick Up At:)/gi);

    console.log("[parseManifestEmail] Found", sections.length, "potential sections");

    for (const section of sections) {
        if (!section.trim()) continue;

        // Extract date and time from LimoAnywhere format
        // Format: "03/01/2026  -  Pick Up At:07:20 AM    Arrive At:07:05 AM"
        const dateTimeMatch = section.match(
            /(\d{2}\/\d{2}\/\d{4})\s+-\s+Pick Up At:(\d{1,2}:\d{2}\s*(?:AM|PM))/i
        );
        if (!dateTimeMatch) {
            // Try alternate format with space after colon
            const altMatch = section.match(
                /(\d{2}\/\d{2}\/\d{4})\s*-\s*Pick Up At:\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i
            );
            if (!altMatch) continue;
            // Use alternate match
            const [, dateStr, timeStr] = altMatch;
            processTrip(section, dateStr, timeStr);
            continue;
        }

        const [, dateStr, timeStr] = dateTimeMatch;
        processTrip(section, dateStr, timeStr);
    }

    function processTrip(section: string, dateStr: string, timeStr: string) {
        // Extract trip number - appears on its own line after the date/time line
        // Look for a 4-6 digit number at the start of a line
        const tripNumberMatch = section.match(/\n\s*(\d{4,6})\s*\n/);
        if (!tripNumberMatch) {
            console.log("[parseManifestEmail] No trip number found in section");
            return;
        }

        const tripNumber = tripNumberMatch[1];

        // Skip if trip number looks like a year (2020-2030)
        const tripNumInt = parseInt(tripNumber, 10);
        if (tripNumInt >= 2020 && tripNumInt <= 2030) return;

        // Parse date and time
        const [month, day, year] = dateStr.split("/").map(Number);
        const timeParts = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!timeParts) return;

        let hours = parseInt(timeParts[1], 10);
        const minutes = parseInt(timeParts[2], 10);
        const period = timeParts[3].toUpperCase();

        if (period === "PM" && hours !== 12) {
            hours += 12;
        } else if (period === "AM" && hours === 12) {
            hours = 0;
        }

        // Create date in CST/CDT (America/Chicago) timezone
        const tempDate = new Date(year, month - 1, day);
        const isDST = isDaylightSavingTime(tempDate);
        const cstOffset = isDST ? 5 : 6; // hours to add to get UTC

        // Create UTC date by adding the CST offset
        const pickupAt = new Date(Date.UTC(year, month - 1, day, hours + cstOffset, minutes));

        // Extract passenger name - LimoAnywhere format has "Passenger" on one line, name on next
        let passengerName = "Unknown Passenger";
        const passengerMatch = section.match(/Passenger\s*\n\s*([A-Za-z][A-Za-z\s'-]*[A-Za-z])/i);
        if (passengerMatch) {
            // Take first 2-3 words as name
            const nameParts = passengerMatch[1].trim().split(/\s+/).slice(0, 3);
            passengerName = nameParts.join(" ");
        } else {
            // Try alternate format: "Passenger:" followed by name
            const altPassengerMatch = section.match(/Passenger:?\s+([A-Za-z][A-Za-z\s'-]*[A-Za-z])/i);
            if (altPassengerMatch) {
                const nameParts = altPassengerMatch[1].trim().split(/\s+/).slice(0, 3);
                passengerName = nameParts.join(" ");
            }
        }

        // Extract driver name - LimoAnywhere format has "Driver Info" on one line, name on next
        let driverName = "Unknown Driver";
        const driverMatch = section.match(/Driver Info\s*\n\s*([A-Za-z][A-Za-z0-9\s'-]*[A-Za-z0-9])/i);
        if (driverMatch) {
            const nameParts = driverMatch[1].trim().split(/\s+/).slice(0, 3);
            driverName = nameParts.join(" ");
        } else {
            // Try alternate format
            const altDriverMatch = section.match(/Driver Info:?\s+([A-Za-z][A-Za-z0-9\s'-]*)/i);
            if (altDriverMatch) {
                const nameParts = altDriverMatch[1].trim().split(/\s+/).slice(0, 3);
                driverName = nameParts.join(" ");
            }
        }

        // Extract account name - LimoAnywhere format has "Account" on one line, code on next
        let accountName: string | undefined;
        const accountMatch = section.match(/Account\s*\n\s*([A-Za-z0-9][\w-]*)/i);
        if (accountMatch) {
            accountName = accountMatch[1].trim();
        } else {
            // Try alternate format
            const altAccountMatch = section.match(/Account[:\s]+([A-Za-z0-9][\w-]*)/i);
            if (altAccountMatch) {
                accountName = altAccountMatch[1].trim();
            }
        }

        // Extract account number
        let accountNumber: string | undefined;
        const accountNumMatch = section.match(/(?:Account\s*#|Acct\s*#|Account\s+Number)[:\s]*(\d+)/i);
        if (accountNumMatch) {
            accountNumber = accountNumMatch[1].trim();
        }

        // Extract reservation number
        let reservationNumber: string | undefined;
        const resNumMatch = section.match(/(?:Res(?:ervation)?\s*#|Confirmation\s*#|Booking\s*#)[:\s]*([A-Za-z0-9-]+)/i);
        if (resNumMatch) {
            reservationNumber = resNumMatch[1].trim();
        }

        console.log("[parseManifestEmail] Parsed trip:", {
            tripNumber,
            pickupAt: pickupAt.toISOString(),
            passengerName,
            driverName,
            accountName,
        });

        trips.push({
            tripNumber,
            reservationNumber,
            pickupAt,
            passengerName,
            driverName,
            accountName,
            accountNumber,
        });
    }

    console.log("[parseManifestEmail] Total trips parsed:", trips.length);
    return { success: true as const, data: trips };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to parse manifest email" };
    }
}

/**
 * Ingest trips from parsed manifest
 * Called from the API endpoint
 */
export async function ingestManifestTrips(
    trips: Array<{
        tripNumber: string;
        reservationNumber?: string;
        pickupAt: Date;
        passengerName: string;
        driverName: string;
        accountName?: string;
        accountNumber?: string;
    }>,
    sourceEmail?: string,
    fromEmail?: string,
    subject?: string
) {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let created = 0;
        let duplicate = 0;
        const errors: string[] = [];

        for (const trip of trips) {
            try {
                // Calculate dueAt (2 hours before pickup)
                const dueAt = new Date(trip.pickupAt.getTime() - 2 * 60 * 60 * 1000);

                // Skip if pickup is in the past
                if (trip.pickupAt < now) {
                    continue;
                }

                // Atomic upsert — prevents race conditions and cross-day duplicates
                const result = await prisma.tripConfirmation.upsert({
                    where: {
                        tripNumber_pickupAt: {
                            tripNumber: trip.tripNumber,
                            pickupAt: trip.pickupAt,
                        },
                    },
                    create: {
                        tripNumber: trip.tripNumber,
                        reservationNumber: trip.reservationNumber,
                        pickupAt: trip.pickupAt,
                        dueAt,
                        passengerName: trip.passengerName,
                        driverName: trip.driverName,
                        accountName: trip.accountName,
                        accountNumber: trip.accountNumber,
                        manifestDate: today,
                        sourceEmail: sourceEmail,
                    },
                    update: {
                        // Refresh fields that may change between manifests
                        driverName: trip.driverName,
                        reservationNumber: trip.reservationNumber,
                        accountName: trip.accountName,
                        accountNumber: trip.accountNumber,
                        dueAt,
                        manifestDate: today,
                        sourceEmail: sourceEmail,
                    },
                });

                // If createdAt matches now (within 1s), it was newly created
                if (Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000) {
                    created++;
                } else {
                    duplicate++;
                }
            } catch (error) {
                errors.push(
                    `Trip ${trip.tripNumber}: ${error instanceof Error ? error.message : "Unknown error"}`
                );
            }
        }

        // Log the manifest ingestion
        await prisma.manifestLog.create({
            data: {
                fromEmail: fromEmail,
                subject: subject,
                tripsExtracted: trips.length,
                tripsCreated: created,
                tripsDuplicate: duplicate,
                rawContent: sourceEmail,
                parseErrors: errors.length > 0 ? errors.join("\n") : null,
            },
        });

        return {
            success: true as const,
            data: {
                extracted: trips.length,
                created,
                duplicate,
                errors,
            },
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to ingest manifest trips" };
    }
}

/**
 * One-time cleanup: archive duplicate TripConfirmation records.
 * Keeps the most recent record (by createdAt) for each tripNumber,
 * soft-deletes older duplicates by setting archivedAt.
 * Admin only. Returns count of archived duplicates.
 */
export async function cleanupDuplicateConfirmations(dryRun: boolean = true) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
        return { success: false as const, error: "Admin access required" };
    }

    try {
        // Find tripNumbers that have multiple non-archived records
        const duplicates = await prisma.$queryRaw<
            Array<{ tripNumber: string; cnt: bigint }>
        >`
            SELECT "tripNumber", COUNT(*) as cnt
            FROM "TripConfirmation"
            WHERE "archivedAt" IS NULL
            GROUP BY "tripNumber"
            HAVING COUNT(*) > 1
        `;

        if (duplicates.length === 0) {
            return { success: true as const, data: { duplicateGroups: 0, archived: 0, dryRun } };
        }

        const tripNumbers = duplicates.map(d => d.tripNumber);
        let archivedCount = 0;

        if (!dryRun) {
            const now = new Date();
            for (const tripNumber of tripNumbers) {
                // Find all non-archived records for this tripNumber, ordered newest first
                const records = await prisma.tripConfirmation.findMany({
                    where: { tripNumber, archivedAt: null },
                    orderBy: { createdAt: "desc" },
                });

                // Keep the first (newest), archive the rest
                const toArchive = records.slice(1).map(r => r.id);
                if (toArchive.length > 0) {
                    await prisma.tripConfirmation.updateMany({
                        where: { id: { in: toArchive } },
                        data: { archivedAt: now },
                    });
                    archivedCount += toArchive.length;
                }
            }

            await createAuditLog(
                session.user.id,
                "UPDATE",
                "TripConfirmation",
                "bulk-dedup",
                { action: "cleanup_duplicates", archivedCount, duplicateGroups: duplicates.length }
            );
        }

        return {
            success: true as const,
            data: {
                duplicateGroups: duplicates.length,
                archived: dryRun ? duplicates.reduce((sum, d) => sum + (Number(d.cnt) - 1), 0) : archivedCount,
                dryRun,
            },
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to cleanup duplicates" };
    }
}

/**
 * Get pending confirmation count for dashboard badge
 */
export async function getPendingConfirmationCount() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: true as const, data: 0 };
    }

    try {
        const now = new Date();

        const count = await prisma.tripConfirmation.count({
            where: {
                status: "PENDING",
                archivedAt: null,
                pickupAt: {
                    gte: now,
                },
            },
        });

        return { success: true as const, data: count };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch pending confirmation count" };
    }
}

/**
 * Get confirmations created or updated since a given timestamp.
 * Used for auto-refresh polling — returns new trips AND status changes.
 * Each record includes an `_isUpdate` flag so the client can distinguish
 * new trips from status updates made by other dispatchers.
 */
export async function getNewConfirmationsSince(since: Date) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    // Role check — only admin roles can view confirmations
    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    if (!isAdmin) {
        return { success: false as const, error: "Admin access required" };
    }

    // Validate input
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
        return { success: false as const, error: "Invalid date parameter" };
    }

    try {
        const includeOpts = {
            completedBy: {
                select: { id: true, name: true },
            },
        };

        // Fetch new trips AND recently updated trips in parallel
        const [newTrips, updatedTrips] = await Promise.all([
            prisma.tripConfirmation.findMany({
                where: { createdAt: { gt: sinceDate } },
                orderBy: { dueAt: "asc" },
                include: includeOpts,
                take: 50,
            }),
            prisma.tripConfirmation.findMany({
                where: {
                    updatedAt: { gt: sinceDate },
                    // Exclude newly created — they're already in newTrips
                    createdAt: { lte: sinceDate },
                },
                orderBy: { updatedAt: "desc" },
                include: includeOpts,
                take: 50,
            }),
        ]);

        return {
            success: true as const,
            data: {
                newTrips,
                updatedTrips,
                timestamp: new Date(),
            },
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch new confirmations" };
    }
}

/**
 * Get a single confirmation by ID with completedBy info.
 * Used to fetch real status after a race condition.
 */
export async function getConfirmationById(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    try {
        const confirmation = await prisma.tripConfirmation.findUnique({
            where: { id },
            include: {
                completedBy: {
                    select: { id: true, name: true },
                },
            },
        });

        if (!confirmation) {
            return { success: false as const, error: "Confirmation not found" };
        }

        return { success: true as const, data: confirmation };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch confirmation" };
    }
}

/**
 * Get all confirmations with optional filters for admin view
 * Shows ALL trips (pending, completed, expired) with full details
 * OPTIMIZED: Uses database-level pagination instead of fetching all records
 */
export async function getAllConfirmations(options?: {
    status?: ConfirmationStatus | "ALL";
    dateFrom?: Date;
    dateTo?: Date;
    dispatcherId?: string;
    search?: string;
    limit?: number;
    offset?: number;
}) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    if (!isAdmin) {
        return { success: false as const, error: "Admin access required" };
    }

    const parsed = confirmationFiltersSchema.safeParse(options ?? {});
    if (!parsed.success) {
        return { success: false as const, error: parsed.error.issues[0]?.message || "Invalid filter options" };
    }

    try {
        const {
            status = "ALL",
            dateFrom,
            dateTo,
            dispatcherId,
            search,
            limit = 100,
            offset = 0,
        } = options || {};

        // Build where clause
        const where: Record<string, unknown> = {};

        if (status && status !== "ALL") {
            where.status = status;
        }

        if (dateFrom || dateTo) {
            where.pickupAt = {};
            if (dateFrom) {
                (where.pickupAt as Record<string, Date>).gte = dateFrom;
            }
            if (dateTo) {
                (where.pickupAt as Record<string, Date>).lte = dateTo;
            }
        }

        if (dispatcherId) {
            where.completedById = dispatcherId;
        }

        if (search) {
            where.OR = [
                { tripNumber: { contains: search, mode: "insensitive" } },
                { passengerName: { contains: search, mode: "insensitive" } },
                { driverName: { contains: search, mode: "insensitive" } },
                { accountName: { contains: search, mode: "insensitive" } },
            ];
        }

        const includeOpts = {
            completedBy: {
                select: { id: true, name: true },
            },
        };

        // Simplified query: single findMany with pagination + one count
        // Sort by pickupAt descending to show most recent/upcoming first
        const [confirmations, total] = await Promise.all([
            prisma.tripConfirmation.findMany({
                where,
                orderBy: { pickupAt: "desc" },
                skip: offset,
                take: limit,
                include: includeOpts,
            }),
            prisma.tripConfirmation.count({ where }),
        ]);

        return {
            success: true as const,
            data: {
                confirmations,
                total,
                hasMore: offset + confirmations.length < total,
                upcomingCount: 0, // Deprecated - remove client usage
                pastCount: 0,     // Deprecated - remove client usage
            },
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch confirmations" };
    }
}

/**
 * Get unique dispatchers who have completed confirmations
 * For filter dropdown
 */
export async function getConfirmationDispatchers() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    try {
        const dispatchers = await prisma.user.findMany({
            where: {
                confirmationsCompleted: {
                    some: {},
                },
            },
            select: {
                id: true,
                name: true,
                _count: {
                    select: { confirmationsCompleted: true },
                },
            },
            orderBy: {
                confirmationsCompleted: {
                    _count: "desc",
                },
            },
        });

        return {
            success: true as const,
            data: dispatchers.map((d) => ({
                id: d.id,
                name: d.name || "Unknown",
                count: d._count.confirmationsCompleted,
            })),
        };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch confirmation dispatchers" };
    }
}

/**
 * Lazy load data for confirmation tabs
 * Fetches data on-demand when tab is selected
 */
export async function getConfirmationTabData(tab: "overview" | "dispatchers" | "accountability", days: number = 7) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return { success: false as const, error: "Unauthorized" };
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    if (!isAdmin) {
        return { success: false as const, error: "Admin access required" };
    }

    const parsed = confirmationTabDataSchema.safeParse({ tab, days });
    if (!parsed.success) {
        return { success: false as const, error: parsed.error.issues[0]?.message || "Invalid tab or days parameter" };
    }

    try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    if (tab === "overview") {
        // Get today's confirmations for the overview tab
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayConfirmations = await prisma.tripConfirmation.findMany({
            where: {
                manifestDate: { gte: today, lt: tomorrow },
                archivedAt: null,
            },
            orderBy: { dueAt: "asc" },
            include: {
                completedBy: { select: { id: true, name: true } },
            },
        });

        return { success: true as const, data: { todayConfirmations } };
    }

    if (tab === "dispatchers") {
        // Get dispatcher metrics
        const confirmations = await prisma.tripConfirmation.findMany({
            where: {
                completedAt: { gte: startDate },
                completedById: { not: null },
            },
            select: {
                completedById: true,
                status: true,
                minutesBeforeDue: true,
                completedBy: { select: { id: true, name: true } },
            },
        });

        const byDispatcher: Record<string, {
            id: string;
            name: string;
            total: number;
            onTime: number;
            late: number;
            byStatus: Record<string, number>;
        }> = {};

        confirmations.forEach((c) => {
            if (!c.completedById || !c.completedBy) return;
            if (!byDispatcher[c.completedById]) {
                byDispatcher[c.completedById] = {
                    id: c.completedById,
                    name: c.completedBy.name || "Unknown",
                    total: 0,
                    onTime: 0,
                    late: 0,
                    byStatus: {},
                };
            }
            const d = byDispatcher[c.completedById];
            d.total++;
            if (c.minutesBeforeDue !== null && c.minutesBeforeDue > 0) {
                d.onTime++;
            } else if (c.minutesBeforeDue !== null && c.minutesBeforeDue <= 0) {
                d.late++;
            }
            d.byStatus[c.status] = (d.byStatus[c.status] || 0) + 1;
        });

        const dispatcherMetrics = Object.values(byDispatcher)
            .map((d) => ({
                ...d,
                onTimeRate: d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0,
            }))
            .sort((a, b) => b.total - a.total);

        return { success: true as const, data: { dispatcherMetrics } };
    }

    if (tab === "accountability") {
        // Get accountability metrics and missed confirmations
        const [accountabilityRecords, dispatchers, missedConfirmations] = await Promise.all([
            prisma.missedConfirmationAccountability.groupBy({
                by: ["dispatcherId"],
                _count: { confirmationId: true },
                where: {
                    createdAt: { gte: startDate },
                    dispatcher: { role: { in: ["DISPATCHER", "ADMIN"] } },
                },
            }),
            prisma.user.findMany({
                where: { role: { in: ["DISPATCHER", "ADMIN"] }, isActive: true },
                select: {
                    id: true,
                    name: true,
                    role: true,
                    shifts: { where: { clockIn: { gte: startDate } }, select: { id: true } },
                    confirmationsCompleted: {
                        where: { completedAt: { gte: startDate } },
                        select: { id: true, minutesBeforeDue: true },
                    },
                },
            }),
            prisma.tripConfirmation.findMany({
                where: { status: "EXPIRED", archivedAt: { gte: startDate } },
                include: {
                    accountableDispatchers: {
                        include: {
                            dispatcher: { select: { id: true, name: true, role: true } },
                            shift: { select: { clockIn: true, clockOut: true } },
                        },
                    },
                },
                orderBy: { archivedAt: "desc" },
                take: 50, // Limit for performance
            }),
        ]);

        const accountabilityMetrics = dispatchers.map((d) => {
            const missedCount = accountabilityRecords.find((a) => a.dispatcherId === d.id)?._count.confirmationId || 0;
            const completedCount = d.confirmationsCompleted.length;
            const onTimeCount = d.confirmationsCompleted.filter(
                (c) => c.minutesBeforeDue !== null && c.minutesBeforeDue > 0
            ).length;

            return {
                id: d.id,
                name: d.name || "Unknown",
                role: d.role,
                totalShifts: d.shifts.length,
                confirmationsCompleted: completedCount,
                confirmationsOnTime: onTimeCount,
                confirmationsMissedWhileOnDuty: missedCount,
                accountabilityRate: completedCount + missedCount > 0
                    ? Math.round((completedCount / (completedCount + missedCount)) * 100)
                    : 100,
            };
        }).sort((a, b) => b.confirmationsMissedWhileOnDuty - a.confirmationsMissedWhileOnDuty);

        const missedReport = missedConfirmations.map((conf) => ({
            id: conf.id,
            tripNumber: conf.tripNumber,
            passengerName: conf.passengerName,
            driverName: conf.driverName,
            dueAt: conf.dueAt,
            pickupAt: conf.pickupAt,
            expiredAt: conf.archivedAt,
            onDutyDispatchers: conf.accountableDispatchers.map((a) => ({
                id: a.dispatcher.id,
                name: a.dispatcher.name,
                role: a.dispatcher.role,
                shiftStart: a.shift.clockIn,
                shiftEnd: a.shift.clockOut,
            })),
        }));

        return { success: true as const, data: { accountabilityMetrics, missedConfirmations: missedReport } };
    }

    return { success: true as const, data: {} };
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "Failed to fetch confirmation tab data" };
    }
}
