"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";

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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const mappings = await prisma.tbrVehicleMapping.findMany({
        orderBy: { tbrVehicleType: "asc" },
    });

    return mappings;
}

/**
 * Get active vehicle type mappings only
 */
export async function getActiveVehicleMappings() {
    const mappings = await prisma.tbrVehicleMapping.findMany({
        where: { isActive: true },
        orderBy: { tbrVehicleType: "asc" },
    });

    return mappings;
}

/**
 * Get LimoAnywhere vehicle type for a TBR vehicle type
 * Falls back to the TBR type if no mapping exists
 */
export async function getVehicleMapping(tbrVehicleType: string): Promise<string> {
    if (!tbrVehicleType) return "Sedan"; // Default fallback

    // Try exact match first
    const mapping = await prisma.tbrVehicleMapping.findUnique({
        where: { tbrVehicleType },
    });

    if (mapping && mapping.isActive) {
        return mapping.laVehicleType;
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
        return matched.laVehicleType;
    }

    // Try partial match (contains)
    const partial = mappings.find((m) =>
        lowerTbr.includes(m.tbrVehicleType.toLowerCase()) ||
        m.tbrVehicleType.toLowerCase().includes(lowerTbr)
    );

    if (partial) {
        return partial.laVehicleType;
    }

    // Return original if no match
    return tbrVehicleType;
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
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

    return mapping;
}

/**
 * Delete a vehicle type mapping
 */
export async function deleteVehicleMapping(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
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

    return mapping;
}

/**
 * Toggle a vehicle type mapping's active status
 */
export async function toggleVehicleMapping(id: string, isActive: boolean) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
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

    return mapping;
}

/**
 * Seed default vehicle mappings
 * Only creates mappings that don't already exist
 */
export async function seedDefaultMappings() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
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

    return { created, skipped, total: DEFAULT_MAPPINGS.length };
}

/**
 * Get unique LimoAnywhere vehicle types from existing mappings
 * Useful for dropdown options
 */
export async function getLaVehicleTypes(): Promise<string[]> {
    const mappings = await prisma.tbrVehicleMapping.findMany({
        where: { isActive: true },
        select: { laVehicleType: true },
        distinct: ["laVehicleType"],
    });

    return mappings.map((m) => m.laVehicleType).sort();
}
