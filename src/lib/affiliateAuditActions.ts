"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// ========================================
// Types
// ========================================

export interface AuditConfigInput {
    affiliateId: string;
    auditFrequency?: "EVERY_SHIFT" | "DAILY" | "WEEKLY";
    priority?: number;
    notes?: string;
}

export interface AffiliateAuditEntry {
    affiliateId: string;
    affiliateName: string;
    portalTripCount: number | null;
    laTripCount: number | null;
    hasDiscrepancy: boolean;
    notes: string;
    auditedAt?: string;
}

// ========================================
// Admin Configuration Actions
// ========================================

/**
 * Get all audit configurations with affiliate details
 */
export async function getAffiliateAuditConfigs() {
    await requireAdmin();

    return prisma.affiliateAuditConfig.findMany({
        where: { isActive: true },
        include: {
            affiliate: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    isActive: true,
                },
            },
        },
        orderBy: [{ priority: "desc" }, { affiliate: { name: "asc" } }],
    });
}

/**
 * Get affiliates available for audit (not yet configured)
 */
export async function getAvailableAffiliatesForAudit() {
    await requireAdmin();

    const configuredIds = await prisma.affiliateAuditConfig.findMany({
        where: { isActive: true },
        select: { affiliateId: true },
    });

    const excludeIds = configuredIds.map((c) => c.affiliateId);

    return prisma.affiliate.findMany({
        where: {
            isActive: true,
            isApproved: true,
            type: { in: ["FARM_IN", "FARM_OUT"] }, // Only farm affiliates
            id: { notIn: excludeIds },
        },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
    });
}

/**
 * Add affiliate to audit list
 */
export async function addAffiliateToAuditList(data: AuditConfigInput) {
    const session = await requireAdmin();

    const config = await prisma.affiliateAuditConfig.create({
        data: {
            affiliateId: data.affiliateId,
            auditFrequency: data.auditFrequency || "EVERY_SHIFT",
            priority: data.priority || 0,
            notes: data.notes,
        },
        include: {
            affiliate: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    isActive: true,
                },
            },
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "AffiliateAuditConfig",
        config.id,
        { affiliateId: data.affiliateId, affiliateName: config.affiliate.name }
    );

    revalidatePath("/admin/affiliate-audit");
    return config;
}

/**
 * Update audit configuration
 */
export async function updateAffiliateAuditConfig(
    id: string,
    data: Partial<AuditConfigInput>
) {
    const session = await requireAdmin();

    const config = await prisma.affiliateAuditConfig.update({
        where: { id },
        data: {
            auditFrequency: data.auditFrequency,
            priority: data.priority,
            notes: data.notes,
        },
        include: {
            affiliate: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    isActive: true,
                },
            },
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "AffiliateAuditConfig",
        id,
        data
    );

    revalidatePath("/admin/affiliate-audit");
    return config;
}

/**
 * Remove affiliate from audit list (soft delete)
 */
export async function removeAffiliateFromAuditList(id: string) {
    const session = await requireAdmin();

    const config = await prisma.affiliateAuditConfig.update({
        where: { id },
        data: { isActive: false },
        include: {
            affiliate: {
                select: { name: true },
            },
        },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "AffiliateAuditConfig",
        id,
        { affiliateName: config.affiliate.name }
    );

    revalidatePath("/admin/affiliate-audit");
}

/**
 * Reactivate a previously removed audit config
 */
export async function reactivateAffiliateAuditConfig(affiliateId: string) {
    const session = await requireAdmin();

    const config = await prisma.affiliateAuditConfig.update({
        where: { affiliateId },
        data: { isActive: true },
        include: {
            affiliate: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    isActive: true,
                },
            },
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "AffiliateAuditConfig",
        config.id,
        { action: "reactivate", affiliateName: config.affiliate.name }
    );

    revalidatePath("/admin/affiliate-audit");
    return config;
}

// ========================================
// Dispatcher Actions (Shift Report)
// ========================================

/**
 * Get affiliates to audit for current shift
 * Called when loading shift report form
 */
export async function getAffiliatesForShiftAudit(): Promise<AffiliateAuditEntry[]> {
    await requireAuth();

    const configs = await prisma.affiliateAuditConfig.findMany({
        where: {
            isActive: true,
            affiliate: { isActive: true, isApproved: true },
        },
        include: {
            affiliate: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                },
            },
        },
        orderBy: [{ priority: "desc" }, { affiliate: { name: "asc" } }],
    });

    // Return initialized audit entries
    return configs.map((config) => ({
        affiliateId: config.affiliate.id,
        affiliateName: config.affiliate.name,
        portalTripCount: null,
        laTripCount: null,
        hasDiscrepancy: false,
        notes: "",
    }));
}

/**
 * Get audit stats for admin dashboard
 */
export async function getAffiliateAuditStats() {
    await requireAdmin();

    const [total, byFrequency] = await Promise.all([
        prisma.affiliateAuditConfig.count({
            where: { isActive: true },
        }),
        prisma.affiliateAuditConfig.groupBy({
            by: ["auditFrequency"],
            where: { isActive: true },
            _count: true,
        }),
    ]);

    return {
        total,
        byFrequency: byFrequency.reduce(
            (acc, item) => {
                acc[item.auditFrequency] = item._count;
                return acc;
            },
            {} as Record<string, number>
        ),
    };
}
