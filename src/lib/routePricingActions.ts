"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";

// ============================================
// TYPES
// ============================================

export interface RoutePriceRow {
    vehicleCode: string;
    zoneFrom: string;
    zoneTo: string;
    rate: number;
}

export interface ImportResult {
    success: boolean;
    rowsImported: number;
    rowsSkipped: number;
    errors: Array<{ row: number; message: string }>;
    durationMs: number;
}

export interface RoutePriceSearchParams {
    zoneFrom?: string;
    zoneTo?: string;
    vehicleCode?: string;
    limit?: number;
}

export interface RoutePriceResult {
    id: string;
    vehicleCode: string;
    zoneFrom: string;
    zoneTo: string;
    rate: number;
}

export interface RoutePricingStats {
    totalRoutes: number;
    vehicleCodes: number;
    uniqueZones: number;
    lastImport: {
        importedAt: Date;
        importedBy: string;
        rowsImported: number;
        fileName: string;
    } | null;
    priceRange: { min: number; max: number };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize zone string for search matching
 * Handles varied formats: "AUS", "Dallas TX 75225", "75001", "DFW Airport TX 75261"
 */
function normalizeZone(zone: string): string {
    return zone
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " "); // Collapse multiple spaces
}

// ============================================
// IMPORT FUNCTIONS (Admin Only)
// ============================================

/**
 * Clear all route prices - call before batch import
 */
export async function clearRoutePrices(): Promise<{ success: boolean; deleted: number }> {
    await requireAdmin();

    const result = await prisma.routePrice.deleteMany({});

    return { success: true, deleted: result.count };
}

/**
 * Import a batch of route prices (for large imports that exceed serverless timeout)
 * Call clearRoutePrices() first, then call this for each batch
 */
export async function importRoutePricesBatch(
    rows: RoutePriceRow[],
    batchNumber: number
): Promise<{ success: boolean; imported: number; errors: Array<{ row: number; message: string }> }> {
    await requireAdmin();

    const errors: Array<{ row: number; message: string }> = [];
    const validRows: Array<{
        vehicleCode: string;
        zoneFrom: string;
        zoneTo: string;
        zoneFromNorm: string;
        zoneToNorm: string;
        rate: number;
    }> = [];

    // Validate and normalize each row
    rows.forEach((row, index) => {
        const rowNum = (batchNumber * 10000) + index + 2; // Approximate Excel row

        if (!row.vehicleCode?.trim()) {
            errors.push({ row: rowNum, message: "Missing vehicle code" });
            return;
        }
        if (!row.zoneFrom?.trim()) {
            errors.push({ row: rowNum, message: "Missing zone from" });
            return;
        }
        if (!row.zoneTo?.trim()) {
            errors.push({ row: rowNum, message: "Missing zone to" });
            return;
        }
        if (typeof row.rate !== "number" || isNaN(row.rate) || row.rate < 0) {
            errors.push({ row: rowNum, message: `Invalid rate: ${row.rate}` });
            return;
        }

        validRows.push({
            vehicleCode: row.vehicleCode.trim().toUpperCase(),
            zoneFrom: row.zoneFrom.trim(),
            zoneTo: row.zoneTo.trim(),
            zoneFromNorm: normalizeZone(row.zoneFrom),
            zoneToNorm: normalizeZone(row.zoneTo),
            rate: row.rate,
        });
    });

    if (validRows.length > 0) {
        await prisma.routePrice.createMany({
            data: validRows,
            skipDuplicates: true,
        });
    }

    return {
        success: true,
        imported: validRows.length,
        errors: errors.slice(0, 20),
    };
}

/**
 * Log the import after all batches complete
 */
export async function logRoutePriceImport(
    fileName: string,
    fileSize: number,
    rowsImported: number,
    rowsSkipped: number,
    durationMs: number,
    errors: Array<{ row: number; message: string }>
): Promise<void> {
    const session = await requireAdmin();

    await prisma.routePriceImport.create({
        data: {
            importedById: session.user.id,
            fileName,
            fileSize,
            rowsImported,
            rowsSkipped,
            errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
            durationMs,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "RoutePrice",
        undefined,
        {
            action: "bulk_import",
            rowsImported,
            rowsSkipped,
            fileName,
        }
    );

    revalidatePath("/admin/pricing");
}

/**
 * Import route prices from parsed Excel data (for smaller imports < 10K rows)
 */
export async function importRoutePrices(
    rows: RoutePriceRow[],
    fileName: string,
    fileSize: number
): Promise<ImportResult> {
    const session = await requireAdmin();
    const startTime = Date.now();

    const errors: Array<{ row: number; message: string }> = [];
    const validRows: Array<{
        vehicleCode: string;
        zoneFrom: string;
        zoneTo: string;
        zoneFromNorm: string;
        zoneToNorm: string;
        rate: number;
    }> = [];

    rows.forEach((row, index) => {
        const rowNum = index + 2;

        if (!row.vehicleCode?.trim()) {
            errors.push({ row: rowNum, message: "Missing vehicle code" });
            return;
        }
        if (!row.zoneFrom?.trim()) {
            errors.push({ row: rowNum, message: "Missing zone from" });
            return;
        }
        if (!row.zoneTo?.trim()) {
            errors.push({ row: rowNum, message: "Missing zone to" });
            return;
        }
        if (typeof row.rate !== "number" || isNaN(row.rate) || row.rate < 0) {
            errors.push({ row: rowNum, message: `Invalid rate: ${row.rate}` });
            return;
        }

        validRows.push({
            vehicleCode: row.vehicleCode.trim().toUpperCase(),
            zoneFrom: row.zoneFrom.trim(),
            zoneTo: row.zoneTo.trim(),
            zoneFromNorm: normalizeZone(row.zoneFrom),
            zoneToNorm: normalizeZone(row.zoneTo),
            rate: row.rate,
        });
    });

    if (validRows.length === 0) {
        return {
            success: false,
            rowsImported: 0,
            rowsSkipped: rows.length,
            errors,
            durationMs: Date.now() - startTime,
        };
    }

    // Delete and insert
    await prisma.routePrice.deleteMany({});
    await prisma.routePrice.createMany({
        data: validRows,
        skipDuplicates: true,
    });

    // Log
    await prisma.routePriceImport.create({
        data: {
            importedById: session.user.id,
            fileName,
            fileSize,
            rowsImported: validRows.length,
            rowsSkipped: errors.length,
            errors: errors.length > 0 ? JSON.stringify(errors.slice(0, 100)) : null,
            durationMs: Date.now() - startTime,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "RoutePrice",
        undefined,
        {
            action: "bulk_import",
            rowsImported: validRows.length,
            rowsSkipped: errors.length,
            fileName,
        }
    );

    revalidatePath("/admin/pricing");

    return {
        success: true,
        rowsImported: validRows.length,
        rowsSkipped: errors.length,
        errors: errors.slice(0, 100),
        durationMs: Date.now() - startTime,
    };
}

// ============================================
// LOOKUP FUNCTIONS (All Authenticated Users)
// ============================================

/**
 * Search route prices with fuzzy zone matching
 * Supports partial matches for dispatcher convenience
 */
export async function searchRoutePrices(
    params: RoutePriceSearchParams
): Promise<RoutePriceResult[]> {
    await requireAuth();

    const { zoneFrom, zoneTo, vehicleCode, limit = 50 } = params;

    // Build WHERE clause
    const where: {
        zoneFromNorm?: { contains: string; mode: "insensitive" };
        zoneToNorm?: { contains: string; mode: "insensitive" };
        vehicleCode?: string;
    } = {};

    if (zoneFrom && zoneFrom.trim()) {
        const normalizedFrom = normalizeZone(zoneFrom);
        where.zoneFromNorm = { contains: normalizedFrom, mode: "insensitive" };
    }

    if (zoneTo && zoneTo.trim()) {
        const normalizedTo = normalizeZone(zoneTo);
        where.zoneToNorm = { contains: normalizedTo, mode: "insensitive" };
    }

    if (vehicleCode && vehicleCode.trim()) {
        where.vehicleCode = vehicleCode.toUpperCase();
    }

    const results = await prisma.routePrice.findMany({
        where,
        select: {
            id: true,
            vehicleCode: true,
            zoneFrom: true,
            zoneTo: true,
            rate: true,
        },
        orderBy: [{ rate: "asc" }], // Cheapest first
        take: Math.min(limit, 100), // Cap at 100 results
    });

    return results;
}

/**
 * Get exact route price match
 * For when dispatcher knows exact zones
 */
export async function getExactRoutePrice(
    vehicleCode: string,
    zoneFrom: string,
    zoneTo: string
): Promise<RoutePriceResult | null> {
    await requireAuth();

    const result = await prisma.routePrice.findUnique({
        where: {
            vehicleCode_zoneFrom_zoneTo: {
                vehicleCode: vehicleCode.toUpperCase(),
                zoneFrom: zoneFrom.trim(),
                zoneTo: zoneTo.trim(),
            },
        },
        select: {
            id: true,
            vehicleCode: true,
            zoneFrom: true,
            zoneTo: true,
            rate: true,
        },
    });

    return result;
}

/**
 * Get distinct vehicle codes for filter dropdown
 */
export async function getVehicleCodes(): Promise<string[]> {
    await requireAuth();

    const results = await prisma.routePrice.findMany({
        distinct: ["vehicleCode"],
        select: { vehicleCode: true },
        orderBy: { vehicleCode: "asc" },
    });

    return results.map((r) => r.vehicleCode);
}

/**
 * Get zone suggestions for autocomplete
 * Returns both from and to zones matching input
 */
export async function getZoneSuggestions(
    query: string,
    type: "from" | "to",
    limit: number = 20
): Promise<string[]> {
    await requireAuth();

    if (!query || query.length < 2) return [];

    const normalizedQuery = normalizeZone(query);

    if (type === "from") {
        const results = await prisma.routePrice.findMany({
            where: {
                zoneFromNorm: { contains: normalizedQuery, mode: "insensitive" },
            },
            distinct: ["zoneFrom"],
            select: { zoneFrom: true },
            take: limit,
        });
        return results.map((r) => r.zoneFrom);
    } else {
        const results = await prisma.routePrice.findMany({
            where: {
                zoneToNorm: { contains: normalizedQuery, mode: "insensitive" },
            },
            distinct: ["zoneTo"],
            select: { zoneTo: true },
            take: limit,
        });
        return results.map((r) => r.zoneTo);
    }
}

// ============================================
// STATS FUNCTIONS (Admin Only)
// ============================================

/**
 * Get pricing statistics for admin dashboard
 */
export async function getRoutePricingStats(): Promise<RoutePricingStats> {
    await requireAdmin();

    const [totalRoutes, vehicleCodesResult, lastImportResult, priceStats] = await Promise.all([
        prisma.routePrice.count(),
        prisma.routePrice.findMany({
            distinct: ["vehicleCode"],
            select: { vehicleCode: true },
        }),
        prisma.routePriceImport.findFirst({
            orderBy: { importedAt: "desc" },
            include: {
                importedBy: { select: { name: true } },
            },
        }),
        prisma.routePrice.aggregate({
            _min: { rate: true },
            _max: { rate: true },
        }),
    ]);

    // Unique zones (both from and to)
    const [fromZones, toZones] = await Promise.all([
        prisma.routePrice.findMany({ distinct: ["zoneFrom"], select: { zoneFrom: true } }),
        prisma.routePrice.findMany({ distinct: ["zoneTo"], select: { zoneTo: true } }),
    ]);
    const allZones = new Set([
        ...fromZones.map((z) => z.zoneFrom),
        ...toZones.map((z) => z.zoneTo),
    ]);

    return {
        totalRoutes,
        vehicleCodes: vehicleCodesResult.length,
        uniqueZones: allZones.size,
        lastImport: lastImportResult
            ? {
                  importedAt: lastImportResult.importedAt,
                  importedBy: lastImportResult.importedBy.name || "Unknown",
                  rowsImported: lastImportResult.rowsImported,
                  fileName: lastImportResult.fileName,
              }
            : null,
        priceRange: {
            min: priceStats._min.rate || 0,
            max: priceStats._max.rate || 0,
        },
    };
}

/**
 * Get import history
 */
export async function getImportHistory(limit: number = 10) {
    await requireAdmin();

    return prisma.routePriceImport.findMany({
        include: {
            importedBy: { select: { id: true, name: true } },
        },
        orderBy: { importedAt: "desc" },
        take: limit,
    });
}
