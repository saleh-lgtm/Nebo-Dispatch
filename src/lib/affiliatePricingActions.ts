"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAccounting } from "./auth-helpers";
import { revalidatePath } from "next/cache";

// Standard service types for pricing grid
export const SERVICE_TYPES = [
    "Airport Transfer",
    "Hourly Service",
    "Point to Point",
    "City Tour",
    "Long Distance",
    "Event Service",
    "Corporate Account",
    "Wedding",
    "Custom",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

interface PricingInput {
    affiliateId: string;
    serviceType: string;
    flatRate: number;
    notes?: string;
}

// Get pricing grid for an affiliate (ACCOUNTING/ADMIN/SUPER_ADMIN)
export async function getAffiliatePricing(affiliateId: string) {
    await requireAccounting();

    const pricing = await prisma.affiliatePricing.findMany({
        where: { affiliateId },
        orderBy: { serviceType: "asc" },
    });

    return pricing;
}

// Add or update a pricing entry (ADMIN/SUPER_ADMIN only)
export async function upsertAffiliatePricing(data: PricingInput) {
    await requireAdmin();

    // Verify affiliate exists and is FARM_IN
    const affiliate = await prisma.affiliate.findUnique({
        where: { id: data.affiliateId },
        select: { type: true },
    });

    if (!affiliate) {
        throw new Error("Affiliate not found");
    }

    if (affiliate.type !== "FARM_IN") {
        throw new Error("Pricing grid is only available for FARM_IN affiliates");
    }

    const pricing = await prisma.affiliatePricing.upsert({
        where: {
            affiliateId_serviceType: {
                affiliateId: data.affiliateId,
                serviceType: data.serviceType,
            },
        },
        update: {
            flatRate: data.flatRate,
            notes: data.notes,
        },
        create: {
            affiliateId: data.affiliateId,
            serviceType: data.serviceType,
            flatRate: data.flatRate,
            notes: data.notes,
        },
    });

    revalidatePath("/affiliates");
    return pricing;
}

// Delete a pricing entry (ADMIN/SUPER_ADMIN only)
export async function deleteAffiliatePricing(pricingId: string) {
    await requireAdmin();

    await prisma.affiliatePricing.delete({
        where: { id: pricingId },
    });

    revalidatePath("/affiliates");
    return { success: true };
}

// Bulk update pricing for an affiliate (ADMIN/SUPER_ADMIN only)
export async function bulkUpdatePricing(
    affiliateId: string,
    pricingEntries: Array<{ serviceType: string; flatRate: number; notes?: string }>
) {
    await requireAdmin();

    // Verify affiliate exists and is FARM_IN
    const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
        select: { type: true },
    });

    if (!affiliate) {
        throw new Error("Affiliate not found");
    }

    if (affiliate.type !== "FARM_IN") {
        throw new Error("Pricing grid is only available for FARM_IN affiliates");
    }

    // Use a transaction to update all entries
    const results = await prisma.$transaction(
        pricingEntries.map((entry) =>
            prisma.affiliatePricing.upsert({
                where: {
                    affiliateId_serviceType: {
                        affiliateId,
                        serviceType: entry.serviceType,
                    },
                },
                update: {
                    flatRate: entry.flatRate,
                    notes: entry.notes,
                },
                create: {
                    affiliateId,
                    serviceType: entry.serviceType,
                    flatRate: entry.flatRate,
                    notes: entry.notes,
                },
            })
        )
    );

    revalidatePath("/affiliates");
    return results;
}

// Get all FARM_IN affiliates with their pricing (for accounting dashboard)
export async function getFarmInAffiliatesWithPricing() {
    await requireAccounting();

    const affiliates = await prisma.affiliate.findMany({
        where: { type: "FARM_IN" },
        include: {
            pricingGrid: {
                orderBy: { serviceType: "asc" },
            },
        },
        orderBy: { name: "asc" },
    });

    return affiliates;
}

// Copy pricing from one affiliate to another (ADMIN/SUPER_ADMIN only)
export async function copyPricingFromAffiliate(sourceAffiliateId: string, targetAffiliateId: string) {
    await requireAdmin();

    // Verify both affiliates exist and are FARM_IN
    const [source, target] = await Promise.all([
        prisma.affiliate.findUnique({
            where: { id: sourceAffiliateId },
            include: { pricingGrid: true },
        }),
        prisma.affiliate.findUnique({
            where: { id: targetAffiliateId },
            select: { type: true },
        }),
    ]);

    if (!source || !target) {
        throw new Error("Affiliate not found");
    }

    if (source.type !== "FARM_IN" || target.type !== "FARM_IN") {
        throw new Error("Pricing grid is only available for FARM_IN affiliates");
    }

    // Copy pricing entries
    const results = await prisma.$transaction(
        source.pricingGrid.map((entry) =>
            prisma.affiliatePricing.upsert({
                where: {
                    affiliateId_serviceType: {
                        affiliateId: targetAffiliateId,
                        serviceType: entry.serviceType,
                    },
                },
                update: {
                    flatRate: entry.flatRate,
                    notes: entry.notes,
                },
                create: {
                    affiliateId: targetAffiliateId,
                    serviceType: entry.serviceType,
                    flatRate: entry.flatRate,
                    notes: entry.notes,
                },
            })
        )
    );

    revalidatePath("/affiliates");
    return results;
}
