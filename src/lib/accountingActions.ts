"use server";

import prisma from "@/lib/prisma";
import { requireAccounting, requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { AccountingFlagStatus } from "@prisma/client";
import {
    flagReservationSchema,
    createAccountingFlagsSchema,
    getFlaggedReservationsSchema,
    resolveAccountingFlagSchema,
    idParamSchema,
} from "./schemas";

// Create accounting flag for a reservation (called during shift report submission)
export async function flagReservationForAccounting(data: {
    shiftReportId: string;
    reservationType: "accepted" | "modified" | "cancelled";
    reservationId: string;
    reservationNotes?: string;
    flagReason?: string;
}) {
    try {
        const session = await requireAuth();

        const parsed = flagReservationSchema.safeParse(data);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const flag = await prisma.accountingFlag.create({
            data: {
                shiftReportId: parsed.data.shiftReportId,
                reservationType: parsed.data.reservationType,
                reservationId: parsed.data.reservationId,
                reservationNotes: parsed.data.reservationNotes,
                flagReason: parsed.data.flagReason,
                flaggedById: session.user.id,
                status: "PENDING",
            },
        });

        revalidatePath("/accounting");
        return { success: true, data: flag };
    } catch (error) {
        console.error("flagReservationForAccounting error:", error);
        return { success: false, error: "Failed to create accounting flag" };
    }
}

// Create multiple flags at once (for batch creation during shift report)
export async function createAccountingFlags(
    shiftReportId: string,
    flags: Array<{
        reservationType: "accepted" | "modified" | "cancelled";
        reservationId: string;
        reservationNotes?: string;
        flagReason?: string;
    }>
) {
    try {
        const session = await requireAuth();

        const parsed = createAccountingFlagsSchema.safeParse({ shiftReportId, flags });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const createdFlags = await prisma.accountingFlag.createMany({
            data: parsed.data.flags.map((flag) => ({
                shiftReportId: parsed.data.shiftReportId,
                reservationType: flag.reservationType,
                reservationId: flag.reservationId,
                reservationNotes: flag.reservationNotes,
                flagReason: flag.flagReason,
                flaggedById: session.user.id,
                status: "PENDING" as AccountingFlagStatus,
            })),
            skipDuplicates: true,
        });

        revalidatePath("/accounting");
        return { success: true, data: createdFlags };
    } catch (error) {
        console.error("createAccountingFlags error:", error);
        return { success: false, error: "Failed to create accounting flags" };
    }
}

// Get flagged reservations with filters (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function getFlaggedReservations(options?: {
    status?: AccountingFlagStatus;
    limit?: number;
    offset?: number;
}) {
    try {
        await requireAccounting();

        const parsed = getFlaggedReservationsSchema.safeParse(options || {});
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input", data: { flags: [], total: 0 } };
        }

        const where: Record<string, unknown> = {};
        if (parsed.data.status) {
            where.status = parsed.data.status;
        }

        const [flags, total] = await Promise.all([
            prisma.accountingFlag.findMany({
                where,
                include: {
                    shiftReport: {
                        include: {
                            user: { select: { id: true, name: true, email: true } },
                            shift: { select: { clockIn: true, clockOut: true } },
                        },
                    },
                    flaggedBy: { select: { id: true, name: true } },
                    reviewedBy: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: parsed.data.limit || 50,
                skip: parsed.data.offset || 0,
            }),
            prisma.accountingFlag.count({ where }),
        ]);

        return { success: true, data: { flags, total } };
    } catch (error) {
        console.error("getFlaggedReservations error:", error);
        return { success: false, error: "Failed to get flagged reservations", data: { flags: [], total: 0 } };
    }
}

// Get pending flags count for badge display
export async function getFlaggedReservationsCount() {
    try {
        await requireAccounting();

        const count = await prisma.accountingFlag.count({
            where: { status: "PENDING" },
        });

        return { success: true, data: count };
    } catch (error) {
        console.error("getFlaggedReservationsCount error:", error);
        return { success: false, error: "Failed to get count", data: 0 };
    }
}

// Start reviewing a flag (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function startAccountingReview(flagId: string) {
    try {
        const session = await requireAccounting();

        const parsed = idParamSchema.safeParse({ id: flagId });
        if (!parsed.success) {
            return { success: false, error: "Invalid flag ID" };
        }

        const flag = await prisma.accountingFlag.update({
            where: { id: parsed.data.id },
            data: {
                status: "IN_REVIEW",
                reviewedById: session.user.id,
            },
        });

        revalidatePath("/accounting");
        return { success: true, data: flag };
    } catch (error) {
        console.error("startAccountingReview error:", error);
        return { success: false, error: "Failed to start review" };
    }
}

// Resolve an accounting flag (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function resolveAccountingFlag(
    flagId: string,
    resolution: string,
    accountingNotes?: string
) {
    try {
        const session = await requireAccounting();

        const parsed = resolveAccountingFlagSchema.safeParse({ flagId, resolution, accountingNotes });
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const flag = await prisma.accountingFlag.update({
            where: { id: parsed.data.flagId },
            data: {
                status: "RESOLVED",
                resolution: parsed.data.resolution,
                accountingNotes: parsed.data.accountingNotes,
                reviewedById: session.user.id,
                reviewedAt: new Date(),
            },
        });

        revalidatePath("/accounting");
        return { success: true, data: flag };
    } catch (error) {
        console.error("resolveAccountingFlag error:", error);
        return { success: false, error: "Failed to resolve flag" };
    }
}

// Update accounting notes on a flag
export async function updateAccountingNotes(flagId: string, notes: string) {
    try {
        await requireAccounting();

        const parsed = idParamSchema.safeParse({ id: flagId });
        if (!parsed.success) {
            return { success: false, error: "Invalid flag ID" };
        }

        const flag = await prisma.accountingFlag.update({
            where: { id: parsed.data.id },
            data: { accountingNotes: notes },
        });

        revalidatePath("/accounting");
        return { success: true, data: flag };
    } catch (error) {
        console.error("updateAccountingNotes error:", error);
        return { success: false, error: "Failed to update notes" };
    }
}

// Get accounting dashboard statistics
export async function getAccountingStats() {
    try {
        await requireAccounting();

        const [pending, inReview, resolved, recentFlags] = await Promise.all([
            prisma.accountingFlag.count({ where: { status: "PENDING" } }),
            prisma.accountingFlag.count({ where: { status: "IN_REVIEW" } }),
            prisma.accountingFlag.count({ where: { status: "RESOLVED" } }),
            prisma.accountingFlag.findMany({
                where: { status: "PENDING" },
                include: {
                    shiftReport: {
                        include: {
                            user: { select: { id: true, name: true } },
                        },
                    },
                    flaggedBy: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
        ]);

        return {
            success: true,
            data: {
                pending,
                inReview,
                resolved,
                total: pending + inReview + resolved,
                recentFlags,
            },
        };
    } catch (error) {
        console.error("getAccountingStats error:", error);
        return {
            success: false,
            error: "Failed to get accounting stats",
            data: { pending: 0, inReview: 0, resolved: 0, total: 0, recentFlags: [] },
        };
    }
}

// Get a single flag by ID
export async function getAccountingFlag(flagId: string) {
    try {
        await requireAccounting();

        const parsed = idParamSchema.safeParse({ id: flagId });
        if (!parsed.success) {
            return { success: false, error: "Invalid flag ID", data: null };
        }

        const flag = await prisma.accountingFlag.findUnique({
            where: { id: parsed.data.id },
            include: {
                shiftReport: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        shift: { select: { clockIn: true, clockOut: true, totalHours: true } },
                    },
                },
                flaggedBy: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } },
            },
        });

        return { success: true, data: flag };
    } catch (error) {
        console.error("getAccountingFlag error:", error);
        return { success: false, error: "Failed to get flag", data: null };
    }
}

// Get flags for a specific shift report
export async function getReportFlags(shiftReportId: string) {
    try {
        await requireAccounting();

        const parsed = idParamSchema.safeParse({ id: shiftReportId });
        if (!parsed.success) {
            return { success: false, error: "Invalid shift report ID", data: [] };
        }

        const flags = await prisma.accountingFlag.findMany({
            where: { shiftReportId: parsed.data.id },
            include: {
                flaggedBy: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data: flags };
    } catch (error) {
        console.error("getReportFlags error:", error);
        return { success: false, error: "Failed to get report flags", data: [] };
    }
}
