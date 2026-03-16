"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";
import { idParamSchema, upsertVehicleMappingSchema, toggleMappingSchema } from "./schemas";
import { z } from "zod";

// Schema for tbrVehicleType lookup
const vehicleTypeQuerySchema = z.object({
    tbrVehicleType: z.string().max(100),
});

// Default vehicle mappings (TBR vehicle type → LimoAnywhere vehicle type)
const DEFAULT_MAPPINGS: Array<{ tbrVehicleType: string; laVehicleType: string }> = [
    { tbrVehicleType: "Executive Sedan", laVehicleType: "Sedan" },
    { tbrVehicleType: "Sedan", laVehicleType: "Sedan" },
    { tbrVehicleType: "Premium Sedan", laVehicleType: "Sedan" },
    { tbrVehicleType: "Business Sedan", laVehicleType: "Sedan" },
    { tbrVehicleType: "Luxury Sedan", laVehicleType: "Sedan" },
    { tbrVehicleType: "SUV", laVehicleType: "SUV" },
    { tbrVehicleType: "Executive SUV", laVehicleType: "SUV" },
    { tbrVehicleType: "Luxury SUV", laVehicleType: "SUV" },
    { tbrVehicleType: "Premium SUV", laVehicleType: "SUV" },
    { tbrVehicleType: "Full Size SUV", laVehicleType: "SUV" },
    { tbrVehicleType: "Van", laVehicleType: "Van" },
    { tbrVehicleType: "Executive Van", laVehicleType: "Sprinter Van" },
    { tbrVehicleType: "Sprinter", laVehicleType: "Sprinter Van" },
    { tbrVehicleType: "Sprinter Van", laVehicleType: "Sprinter Van" },
    { tbrVehicleType: "Mercedes Sprinter", laVehicleType: "Sprinter Van" },
    { tbrVehicleType: "Passenger Van", laVehicleType: "Van" },
    { tbrVehicleType: "Stretch Limousine", laVehicleType: "Stretch Limo" },
    { tbrVehicleType: "Stretch Limo", laVehicleType: "Stretch Limo" },
    { tbrVehicleType: "Limousine", laVehicleType: "Stretch Limo" },
    { tbrVehicleType: "Party Bus", laVehicleType: "Party Bus" },
    { tbrVehicleType: "Mini Bus", laVehicleType: "Mini Bus" },
    { tbrVehicleType: "Mini Coach", laVehicleType: "Mini Bus" },
    { tbrVehicleType: "Motor Coach", laVehicleType: "Coach" },
    { tbrVehicleType: "Coach Bus", laVehicleType: "Coach" },
    { tbrVehicleType: "Charter Bus", laVehicleType: "Coach" },
];

/**
 * Get all vehicle type mappings
 */
export async function getVehicleMappings() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const mappings = await prisma.tbrVehicleMapping.findMany({
            orderBy: { tbrVehicleType: "asc" },
        });

        return { success: true, data: mappings };
    } catch (error) {
        console.error("getVehicleMappings error:", error);
        return { success: false, error: "Failed to get vehicle mappings" };
    }
}

/**
 * Get active vehicle type mappings only
 */
export async function getActiveVehicleMappings() {
    try {
        const mappings = await prisma.tbrVehicleMapping.findMany({
            where: { isActive: true },
            orderBy: { tbrVehicleType: "asc" },
        });

        return { success: true, data: mappings };
    } catch (error) {
        console.error("getActiveVehicleMappings error:", error);
        return { success: false, error: "Failed to get active vehicle mappings" };
    }
}

/**
 * Get LimoAnywhere vehicle type for a TBR vehicle type
 * Falls back to the TBR type if no mapping exists
 */
export async function getVehicleMapping(tbrVehicleType: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        // Validate input
        const parseResult = vehicleTypeQuerySchema.safeParse({ tbrVehicleType });
        if (!parseResult.success) {
            return { success: true, data: "Sedan" }; // Default fallback for invalid input
        }

        if (!tbrVehicleType) {
            return { success: true, data: "Sedan" }; // Default fallback
        }

        // Try exact match first
        const mapping = await prisma.tbrVehicleMapping.findUnique({
            where: { tbrVehicleType },
        });

        if (mapping && mapping.isActive) {
            return { success: true, data: mapping.laVehicleType };
        }

        // Try case-insensitive match
        const mappings = await prisma.tbrVehicleMapping.findMany({
            where: { isActive: true },
        });

        const lowerTbr = tbrVehicleType.toLowerCase().trim();
        const matched = mappings.find(
            (m) => m.tbrVehicleType.toLowerCase().trim() === lowerTbr
        );

        if (matched) {
            return { success: true, data: matched.laVehicleType };
        }

        // Try partial match (contains)
        const partial = mappings.find((m) =>
            lowerTbr.includes(m.tbrVehicleType.toLowerCase()) ||
            m.tbrVehicleType.toLowerCase().includes(lowerTbr)
        );

        if (partial) {
            return { success: true, data: partial.laVehicleType };
        }

        // Return original if no match
        return { success: true, data: tbrVehicleType };
    } catch (error) {
        console.error("getVehicleMapping error:", error);
        return { success: false, error: "Failed to get vehicle mapping" };
    }
}

/**
 * Create or update a vehicle type mapping
 */
export async function upsertVehicleMapping(data: {
    id?: string;
    tbrVehicleType: string;
    laVehicleType: string;
    laVehicleId?: string;
    notes?: string;
    isActive?: boolean;
}) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        // Validate input
        const parseResult = upsertVehicleMappingSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const { id, tbrVehicleType, laVehicleType, laVehicleId, notes, isActive = true } = data;

        let mapping;

        if (id) {
            // Update existing
            mapping = await prisma.tbrVehicleMapping.update({
                where: { id },
                data: {
                    tbrVehicleType: tbrVehicleType.trim(),
                    laVehicleType: laVehicleType.trim(),
                    laVehicleId: laVehicleId?.trim() || null,
                    notes: notes?.trim() || null,
                    isActive,
                },
            });

            await createAuditLog(
                session.user.id,
                "UPDATE",
                "TbrVehicleMapping",
                id,
                { tbrVehicleType, laVehicleType }
            );
        } else {
            // Create new
            mapping = await prisma.tbrVehicleMapping.create({
                data: {
                    tbrVehicleType: tbrVehicleType.trim(),
                    laVehicleType: laVehicleType.trim(),
                    laVehicleId: laVehicleId?.trim() || null,
                    notes: notes?.trim() || null,
                    isActive,
                },
            });

            await createAuditLog(
                session.user.id,
                "CREATE",
                "TbrVehicleMapping",
                mapping.id,
                { tbrVehicleType, laVehicleType }
            );
        }

        revalidatePath("/admin/tbr-settings");

        return { success: true, data: mapping };
    } catch (error) {
        console.error("upsertVehicleMapping error:", error);
        return { success: false, error: "Failed to upsert vehicle mapping" };
    }
}

/**
 * Delete a vehicle type mapping
 */
export async function deleteVehicleMapping(id: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Validate input
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid mapping ID" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        const mapping = await prisma.tbrVehicleMapping.delete({
            where: { id },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "TbrVehicleMapping",
            id,
            { tbrVehicleType: mapping.tbrVehicleType }
        );

        revalidatePath("/admin/tbr-settings");

        return { success: true, data: mapping };
    } catch (error) {
        console.error("deleteVehicleMapping error:", error);
        return { success: false, error: "Failed to delete vehicle mapping" };
    }
}

/**
 * Toggle a vehicle type mapping's active status
 */
export async function toggleVehicleMapping(id: string, isActive: boolean) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Validate input
        const parseResult = toggleMappingSchema.safeParse({ id, isActive });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        const mapping = await prisma.tbrVehicleMapping.update({
            where: { id },
            data: { isActive },
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "TbrVehicleMapping",
            id,
            { action: isActive ? "activate" : "deactivate" }
        );

        revalidatePath("/admin/tbr-settings");

        return { success: true, data: mapping };
    } catch (error) {
        console.error("toggleVehicleMapping error:", error);
        return { success: false, error: "Failed to toggle vehicle mapping" };
    }
}

/**
 * Seed default vehicle mappings
 * Only creates mappings that don't already exist
 */
export async function seedDefaultMappings() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        let created = 0;
        let skipped = 0;

        for (const mapping of DEFAULT_MAPPINGS) {
            const existing = await prisma.tbrVehicleMapping.findUnique({
                where: { tbrVehicleType: mapping.tbrVehicleType },
            });

            if (!existing) {
                await prisma.tbrVehicleMapping.create({
                    data: mapping,
                });
                created++;
            } else {
                skipped++;
            }
        }

        await createAuditLog(
            session.user.id,
            "CREATE",
            "TbrVehicleMapping",
            "seed",
            { created, skipped }
        );

        revalidatePath("/admin/tbr-settings");

        return { success: true, data: { created, skipped, total: DEFAULT_MAPPINGS.length } };
    } catch (error) {
        console.error("seedDefaultMappings error:", error);
        return { success: false, error: "Failed to seed default mappings" };
    }
}

/**
 * Get unique LimoAnywhere vehicle types from existing mappings
 * Useful for dropdown options
 */
export async function getLaVehicleTypes(): Promise<{ success: boolean; data?: string[]; error?: string }> {
    try {
        const mappings = await prisma.tbrVehicleMapping.findMany({
            where: { isActive: true },
            select: { laVehicleType: true },
            distinct: ["laVehicleType"],
        });

        return { success: true, data: mappings.map((m) => m.laVehicleType).sort() };
    } catch (error) {
        console.error("getLaVehicleTypes error:", error);
        return { success: false, error: "Failed to get LA vehicle types" };
    }
}
