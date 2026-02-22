"use server";

import prisma from "@/lib/prisma";
import { requireAccounting, requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { AccountingFlagStatus } from "@prisma/client";

interface FlagReservationInput {
    shiftReportId: string;
    reservationType: "accepted" | "modified" | "cancelled";
    reservationId: string;
    reservationNotes?: string;
    flagReason?: string;
}

// Create accounting flag for a reservation (called during shift report submission)
export async function flagReservationForAccounting(data: FlagReservationInput) {
    const session = await requireAuth();

    const flag = await prisma.accountingFlag.create({
        data: {
            shiftReportId: data.shiftReportId,
            reservationType: data.reservationType,
            reservationId: data.reservationId,
            reservationNotes: data.reservationNotes,
            flagReason: data.flagReason,
            flaggedById: session.user.id,
            status: "PENDING",
        },
    });

    revalidatePath("/accounting");
    return flag;
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
    const session = await requireAuth();

    const createdFlags = await prisma.accountingFlag.createMany({
        data: flags.map((flag) => ({
            shiftReportId,
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
    return createdFlags;
}

// Get flagged reservations with filters (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function getFlaggedReservations(options?: {
    status?: AccountingFlagStatus;
    limit?: number;
    offset?: number;
}) {
    await requireAccounting();

    const where: Record<string, unknown> = {};
    if (options?.status) {
        where.status = options.status;
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
            take: options?.limit || 50,
            skip: options?.offset || 0,
        }),
        prisma.accountingFlag.count({ where }),
    ]);

    return { flags, total };
}

// Get pending flags count for badge display
export async function getFlaggedReservationsCount() {
    await requireAccounting();

    const count = await prisma.accountingFlag.count({
        where: { status: "PENDING" },
    });

    return count;
}

// Start reviewing a flag (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function startAccountingReview(flagId: string) {
    const session = await requireAccounting();

    const flag = await prisma.accountingFlag.update({
        where: { id: flagId },
        data: {
            status: "IN_REVIEW",
            reviewedById: session.user.id,
        },
    });

    revalidatePath("/accounting");
    return flag;
}

// Resolve an accounting flag (ACCOUNTING/ADMIN/SUPER_ADMIN only)
export async function resolveAccountingFlag(
    flagId: string,
    resolution: string,
    accountingNotes?: string
) {
    const session = await requireAccounting();

    const flag = await prisma.accountingFlag.update({
        where: { id: flagId },
        data: {
            status: "RESOLVED",
            resolution,
            accountingNotes,
            reviewedById: session.user.id,
            reviewedAt: new Date(),
        },
    });

    revalidatePath("/accounting");
    return flag;
}

// Update accounting notes on a flag
export async function updateAccountingNotes(flagId: string, notes: string) {
    await requireAccounting();

    const flag = await prisma.accountingFlag.update({
        where: { id: flagId },
        data: { accountingNotes: notes },
    });

    revalidatePath("/accounting");
    return flag;
}

// Get accounting dashboard statistics
export async function getAccountingStats() {
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
        pending,
        inReview,
        resolved,
        total: pending + inReview + resolved,
        recentFlags,
    };
}

// Get a single flag by ID
export async function getAccountingFlag(flagId: string) {
    await requireAccounting();

    const flag = await prisma.accountingFlag.findUnique({
        where: { id: flagId },
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

    return flag;
}

// Get flags for a specific shift report
export async function getReportFlags(shiftReportId: string) {
    await requireAccounting();

    const flags = await prisma.accountingFlag.findMany({
        where: { shiftReportId },
        include: {
            flaggedBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return flags;
}
