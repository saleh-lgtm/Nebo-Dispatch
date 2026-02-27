"use server";

import prisma from "@/lib/prisma";
import { requireSuperAdmin } from "./auth-helpers";

export type AuditAction =
    | "CREATE"
    | "UPDATE"
    | "DELETE"
    | "LOGIN"
    | "LOGOUT"
    | "APPROVE"
    | "REJECT"
    | "REVIEW"
    | "CLOCK_IN"
    | "CLOCK_OUT"
    | "PASSWORD_CHANGE"
    | "PASSWORD_RESET"
    | "ROLE_CHANGE"
    | "FOLLOW_UP"
    | "CONVERT"
    | "UPDATE_STATUS"
    | "ASSIGN"
    | "CANCEL"
    | "ACCEPT"
    | "ACTIVATE"
    | "DEACTIVATE";

export type AuditEntity =
    | "User"
    | "Schedule"
    | "ShiftReport"
    | "Affiliate"
    | "GlobalNote"
    | "ShiftNote"
    | "SchedulingRequest"
    | "Shift"
    | "Quote"
    | "TimeOffRequest"
    | "ShiftSwapRequest"
    | "Event"
    | "AdminTask"
    | "AdminTaskCompletion"
    | "SOP"
    | "AccountingFlag"
    | "BillingReview"
    | "AffiliatePricing"
    | "SMS"
    | "RetailLead"
    | "FleetVehicle"
    | "VehiclePermit"
    | "VehicleInsurance"
    | "VehicleRegistration"
    | "VehicleDocument"
    | "AffiliateAttachment"
    | "NetworkPartner"
    | "PartnerAttachment"
    | "DriverVehicle"
    | "SchedulePreferences"
    | "VehicleAssignment"
    | "TripConfirmation";

/**
 * Create an audit log entry
 */
export async function createAuditLog(
    userId: string,
    action: AuditAction,
    entity: AuditEntity,
    entityId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string
) {
    return await prisma.auditLog.create({
        data: {
            userId,
            action,
            entity,
            entityId,
            details: details ? (details as object) : undefined,
            ipAddress,
        },
    });
}

/**
 * Get audit logs with filtering (SUPER_ADMIN only)
 */
export async function getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    entity?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}) {
    await requireSuperAdmin();

    const where: Record<string, unknown> = {};

    if (filters?.userId) {
        where.userId = filters.userId;
    }
    if (filters?.action) {
        where.action = filters.action;
    }
    if (filters?.entity) {
        where.entity = filters.entity;
    }
    if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) {
            (where.createdAt as Record<string, Date>).gte = filters.startDate;
        }
        if (filters.endDate) {
            (where.createdAt as Record<string, Date>).lte = filters.endDate;
        }
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: filters?.limit ?? 50,
            skip: filters?.offset ?? 0,
        }),
        prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
}

/**
 * Get audit log summary stats (SUPER_ADMIN only)
 */
export async function getAuditStats(days: number = 30) {
    await requireSuperAdmin();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await prisma.auditLog.findMany({
        where: {
            createdAt: { gte: startDate },
        },
        select: {
            action: true,
            entity: true,
            createdAt: true,
        },
    });

    // Group by action
    const byAction: Record<string, number> = {};
    // Group by entity
    const byEntity: Record<string, number> = {};
    // Group by day
    const byDay: Record<string, number> = {};

    for (const log of logs) {
        byAction[log.action] = (byAction[log.action] || 0) + 1;
        byEntity[log.entity] = (byEntity[log.entity] || 0) + 1;

        const day = log.createdAt.toISOString().split("T")[0];
        byDay[day] = (byDay[day] || 0) + 1;
    }

    return {
        total: logs.length,
        byAction,
        byEntity,
        byDay,
    };
}
