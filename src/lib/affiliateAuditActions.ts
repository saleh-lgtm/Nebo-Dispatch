"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { auditConfigSchema, updateAuditConfigSchema, idParamSchema, affiliateIdParamSchema } from "./schemas";

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
export async function getAffiliateAuditConfigs(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        await requireAdmin();

        const configs = await prisma.affiliateAuditConfig.findMany({
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

        return { success: true, data: configs };
    } catch (error) {
        console.error("getAffiliateAuditConfigs error:", error);
        return { success: false, error: "Failed to get audit configurations" };
    }
}

/**
 * Get affiliates available for audit (not yet configured)
 */
export async function getAvailableAffiliatesForAudit(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        await requireAdmin();

        const configuredIds = await prisma.affiliateAuditConfig.findMany({
            where: { isActive: true },
            select: { affiliateId: true },
        });

        const excludeIds = configuredIds.map((c) => c.affiliateId);

        const affiliates = await prisma.affiliate.findMany({
            where: {
                isActive: true,
                isApproved: true,
                type: { in: ["FARM_IN", "FARM_OUT"] }, // Only farm affiliates
                id: { notIn: excludeIds },
            },
            select: { id: true, name: true, type: true },
            orderBy: { name: "asc" },
        });

        return { success: true, data: affiliates };
    } catch (error) {
        console.error("getAvailableAffiliatesForAudit error:", error);
        return { success: false, error: "Failed to get available affiliates" };
    }
}

/**
 * Add affiliate to audit list
 */
export async function addAffiliateToAuditList(data: AuditConfigInput): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = auditConfigSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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

        return { success: true, data: config };
    } catch (error) {
        console.error("addAffiliateToAuditList error:", error);
        return { success: false, error: "Failed to add affiliate to audit list" };
    }
}

/**
 * Update audit configuration
 */
export async function updateAffiliateAuditConfig(
    id: string,
    data: Partial<AuditConfigInput>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const session = await requireAdmin();

        // Validate id
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid config ID" };
        }

        // Validate data
        const dataResult = updateAuditConfigSchema.safeParse(data);
        if (!dataResult.success) {
            return { success: false, error: dataResult.error.issues[0]?.message || "Invalid input" };
        }

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

        return { success: true, data: config };
    } catch (error) {
        console.error("updateAffiliateAuditConfig error:", error);
        return { success: false, error: "Failed to update audit configuration" };
    }
}

/**
 * Remove affiliate from audit list (soft delete)
 */
export async function removeAffiliateFromAuditList(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireAdmin();

        // Validate id
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid config ID" };
        }

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

        return { success: true };
    } catch (error) {
        console.error("removeAffiliateFromAuditList error:", error);
        return { success: false, error: "Failed to remove affiliate from audit list" };
    }
}

/**
 * Reactivate a previously removed audit config
 */
export async function reactivateAffiliateAuditConfig(affiliateId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const session = await requireAdmin();

        // Validate affiliateId
        const parseResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

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

        return { success: true, data: config };
    } catch (error) {
        console.error("reactivateAffiliateAuditConfig error:", error);
        return { success: false, error: "Failed to reactivate audit configuration" };
    }
}

// ========================================
// Dispatcher Actions (Shift Report)
// ========================================

/**
 * Get affiliates to audit for current shift
 * Called when loading shift report form
 */
export async function getAffiliatesForShiftAudit(): Promise<{ success: boolean; data?: AffiliateAuditEntry[]; error?: string }> {
    try {
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
        const entries = configs.map((config) => ({
            affiliateId: config.affiliate.id,
            affiliateName: config.affiliate.name,
            portalTripCount: null,
            laTripCount: null,
            hasDiscrepancy: false,
            notes: "",
        }));

        return { success: true, data: entries };
    } catch (error) {
        console.error("getAffiliatesForShiftAudit error:", error);
        return { success: false, error: "Failed to get affiliates for shift audit" };
    }
}

/**
 * Get audit stats for admin dashboard
 */
export async function getAffiliateAuditStats(): Promise<{ success: boolean; data?: { total: number; byFrequency: Record<string, number> }; error?: string }> {
    try {
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

        const frequencyMap = byFrequency.reduce(
            (acc, item) => {
                acc[item.auditFrequency] = item._count;
                return acc;
            },
            {} as Record<string, number>
        );

        return {
            success: true,
            data: {
                total,
                byFrequency: frequencyMap,
            },
        };
    } catch (error) {
        console.error("getAffiliateAuditStats error:", error);
        return { success: false, error: "Failed to get audit stats" };
    }
}
