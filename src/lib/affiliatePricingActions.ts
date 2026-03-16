"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAccounting } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import {
    pricingInputSchema,
    routePriceInputSchema,
    bulkPricingSchema,
    bulkRoutePricesSchema,
    copyPricingSchema,
    affiliateIdParamSchema,
    idParamSchema,
} from "./schemas";

interface PricingInput {
    affiliateId: string;
    serviceType: string;
    flatRate: number;
    notes?: string;
}

// Get pricing grid for an affiliate (ACCOUNTING/ADMIN/SUPER_ADMIN)
export async function getAffiliatePricing(affiliateId: string) {
    try {
        await requireAccounting();

        // Validate input
        const parseResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid affiliate ID", data: [] };
        }

        const pricing = await prisma.affiliatePricing.findMany({
            where: { affiliateId },
            orderBy: { serviceType: "asc" },
        });

        return { success: true, data: pricing };
    } catch (error) {
        console.error("getAffiliatePricing error:", error);
        return { success: false, error: "Failed to get affiliate pricing", data: [] };
    }
}

// Add or update a pricing entry (ADMIN/SUPER_ADMIN only)
export async function upsertAffiliatePricing(data: PricingInput) {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = pricingInputSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // Verify affiliate exists and is FARM_IN
        const affiliate = await prisma.affiliate.findUnique({
            where: { id: data.affiliateId },
            select: { type: true },
        });

        if (!affiliate) {
            return { success: false, error: "Affiliate not found" };
        }

        if (affiliate.type !== "FARM_IN") {
            return { success: false, error: "Pricing grid is only available for FARM_IN affiliates" };
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
        return { success: true, data: pricing };
    } catch (error) {
        console.error("upsertAffiliatePricing error:", error);
        return { success: false, error: "Failed to update pricing" };
    }
}

// Delete a pricing entry (ADMIN/SUPER_ADMIN only)
export async function deleteAffiliatePricing(pricingId: string) {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = idParamSchema.safeParse({ id: pricingId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid pricing ID" };
        }

        await prisma.affiliatePricing.delete({
            where: { id: pricingId },
        });

        revalidatePath("/affiliates");
        return { success: true };
    } catch (error) {
        console.error("deleteAffiliatePricing error:", error);
        return { success: false, error: "Failed to delete pricing" };
    }
}

// Bulk update pricing for an affiliate (ADMIN/SUPER_ADMIN only)
export async function bulkUpdatePricing(
    affiliateId: string,
    pricingEntries: Array<{ serviceType: string; flatRate: number; notes?: string }>
) {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = bulkPricingSchema.safeParse({ affiliateId, entries: pricingEntries });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // Verify affiliate exists and is FARM_IN
        const affiliate = await prisma.affiliate.findUnique({
            where: { id: affiliateId },
            select: { type: true },
        });

        if (!affiliate) {
            return { success: false, error: "Affiliate not found" };
        }

        if (affiliate.type !== "FARM_IN") {
            return { success: false, error: "Pricing grid is only available for FARM_IN affiliates" };
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
        return { success: true, data: results };
    } catch (error) {
        console.error("bulkUpdatePricing error:", error);
        return { success: false, error: "Failed to bulk update pricing" };
    }
}

// Get all FARM_IN affiliates with their pricing (for accounting dashboard)
export async function getFarmInAffiliatesWithPricing() {
    try {
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

        return { success: true, data: affiliates };
    } catch (error) {
        console.error("getFarmInAffiliatesWithPricing error:", error);
        return { success: false, error: "Failed to get affiliates with pricing", data: [] };
    }
}

// Copy pricing from one affiliate to another (ADMIN/SUPER_ADMIN only)
export async function copyPricingFromAffiliate(sourceAffiliateId: string, targetAffiliateId: string) {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = copyPricingSchema.safeParse({ sourceAffiliateId, targetAffiliateId });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
            return { success: false, error: "Affiliate not found" };
        }

        if (source.type !== "FARM_IN" || target.type !== "FARM_IN") {
            return { success: false, error: "Pricing grid is only available for FARM_IN affiliates" };
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
        return { success: true, data: results };
    } catch (error) {
        console.error("copyPricingFromAffiliate error:", error);
        return { success: false, error: "Failed to copy pricing" };
    }
}

// ============================================
// ROUTE-BASED PRICING
// ============================================

interface RoutePriceInput {
    affiliateId: string;
    pickupLocation: string;
    dropoffLocation: string;
    vehicleType?: string;
    price: number;
    notes?: string;
}

// Get all route prices for an affiliate
export async function getAffiliateRoutePricing(affiliateId: string) {
    try {
        await requireAccounting();

        // Validate input
        const parseResult = affiliateIdParamSchema.safeParse({ affiliateId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid affiliate ID", data: [] };
        }

        const routePricing = await prisma.affiliateRoutePrice.findMany({
            where: { affiliateId },
            orderBy: [{ pickupLocation: "asc" }, { dropoffLocation: "asc" }],
        });

        return { success: true, data: routePricing };
    } catch (error) {
        console.error("getAffiliateRoutePricing error:", error);
        return { success: false, error: "Failed to get route pricing", data: [] };
    }
}

// Add or update a route price entry (ADMIN/SUPER_ADMIN only)
export async function upsertAffiliateRoutePrice(data: RoutePriceInput) {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = routePriceInputSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // Verify affiliate exists and is FARM_IN
        const affiliate = await prisma.affiliate.findUnique({
            where: { id: data.affiliateId },
            select: { type: true },
        });

        if (!affiliate) {
            return { success: false, error: "Affiliate not found" };
        }

        if (affiliate.type !== "FARM_IN") {
            return { success: false, error: "Route pricing is only available for FARM_IN affiliates" };
        }

        // Use empty string for vehicleType when not specified (required for unique constraint)
        const vehicleTypeValue = data.vehicleType || "";

        const routePrice = await prisma.affiliateRoutePrice.upsert({
            where: {
                affiliateId_pickupLocation_dropoffLocation_vehicleType: {
                    affiliateId: data.affiliateId,
                    pickupLocation: data.pickupLocation,
                    dropoffLocation: data.dropoffLocation,
                    vehicleType: vehicleTypeValue,
                },
            },
            update: {
                price: data.price,
                notes: data.notes,
            },
            create: {
                affiliateId: data.affiliateId,
                pickupLocation: data.pickupLocation,
                dropoffLocation: data.dropoffLocation,
                vehicleType: vehicleTypeValue || null,
                price: data.price,
                notes: data.notes,
            },
        });

        revalidatePath("/affiliates");
        revalidatePath("/accounting");
        return { success: true, data: routePrice };
    } catch (error) {
        console.error("upsertAffiliateRoutePrice error:", error);
        return { success: false, error: "Failed to update route price" };
    }
}

// Delete a route price entry (ADMIN/SUPER_ADMIN only)
export async function deleteAffiliateRoutePrice(routePriceId: string) {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = idParamSchema.safeParse({ id: routePriceId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid route price ID" };
        }

        await prisma.affiliateRoutePrice.delete({
            where: { id: routePriceId },
        });

        revalidatePath("/affiliates");
        revalidatePath("/accounting");
        return { success: true };
    } catch (error) {
        console.error("deleteAffiliateRoutePrice error:", error);
        return { success: false, error: "Failed to delete route price" };
    }
}

// Get all FARM_IN affiliates with both flat rates AND route pricing
export async function getFarmInAffiliatesWithAllPricing() {
    try {
        await requireAccounting();

        const affiliates = await prisma.affiliate.findMany({
            where: { type: "FARM_IN", isActive: true },
            include: {
                pricingGrid: {
                    orderBy: { serviceType: "asc" },
                },
                routePricing: {
                    orderBy: [{ pickupLocation: "asc" }, { dropoffLocation: "asc" }],
                },
            },
            orderBy: { name: "asc" },
        });

        return { success: true, data: affiliates };
    } catch (error) {
        console.error("getFarmInAffiliatesWithAllPricing error:", error);
        return { success: false, error: "Failed to get affiliates with all pricing", data: [] };
    }
}

// Bulk add route prices (ADMIN/SUPER_ADMIN only)
export async function bulkAddRoutePrices(
    affiliateId: string,
    routes: Array<{ pickupLocation: string; dropoffLocation: string; vehicleType?: string; price: number; notes?: string }>
) {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = bulkRoutePricesSchema.safeParse({ affiliateId, routes });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // Verify affiliate exists and is FARM_IN
        const affiliate = await prisma.affiliate.findUnique({
            where: { id: affiliateId },
            select: { type: true },
        });

        if (!affiliate) {
            return { success: false, error: "Affiliate not found" };
        }

        if (affiliate.type !== "FARM_IN") {
            return { success: false, error: "Route pricing is only available for FARM_IN affiliates" };
        }

        // Use a transaction to add all entries
        const results = await prisma.$transaction(
            routes.map((route) => {
                const vehicleTypeValue = route.vehicleType || "";
                return prisma.affiliateRoutePrice.upsert({
                    where: {
                        affiliateId_pickupLocation_dropoffLocation_vehicleType: {
                            affiliateId,
                            pickupLocation: route.pickupLocation,
                            dropoffLocation: route.dropoffLocation,
                            vehicleType: vehicleTypeValue,
                        },
                    },
                    update: {
                        price: route.price,
                        notes: route.notes,
                    },
                    create: {
                        affiliateId,
                        pickupLocation: route.pickupLocation,
                        dropoffLocation: route.dropoffLocation,
                        vehicleType: vehicleTypeValue || null,
                        price: route.price,
                        notes: route.notes,
                    },
                });
            })
        );

        revalidatePath("/affiliates");
        revalidatePath("/accounting");
        return { success: true, data: results };
    } catch (error) {
        console.error("bulkAddRoutePrices error:", error);
        return { success: false, error: "Failed to bulk add route prices" };
    }
}
