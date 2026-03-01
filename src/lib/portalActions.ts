"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Get all active portals
 */
export async function getPortals() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const portals = await prisma.portal.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return portals;
}

/**
 * Get all portals (including inactive) for admin management
 */
export async function getAllPortals() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    const portals = await prisma.portal.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
            createdBy: {
                select: { id: true, name: true },
            },
        },
    });

    return portals;
}

/**
 * Create a new portal
 */
export async function createPortal(data: {
    name: string;
    url: string;
    description?: string;
    category?: string;
    icon?: string;
    color?: string;
}) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    // Get max sortOrder
    const maxOrder = await prisma.portal.aggregate({
        _max: { sortOrder: true },
    });

    const portal = await prisma.portal.create({
        data: {
            name: data.name,
            url: data.url,
            description: data.description || null,
            category: data.category || "other",
            icon: data.icon || "Globe",
            color: data.color || "#64748b",
            sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            createdById: session.user.id,
        },
    });

    revalidatePath("/portals");
    return portal;
}

/**
 * Update an existing portal
 */
export async function updatePortal(
    id: string,
    data: {
        name?: string;
        url?: string;
        description?: string;
        category?: string;
        icon?: string;
        color?: string;
        sortOrder?: number;
        isActive?: boolean;
    }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    const portal = await prisma.portal.update({
        where: { id },
        data,
    });

    revalidatePath("/portals");
    return portal;
}

/**
 * Delete a portal (soft delete by setting isActive to false)
 */
export async function deletePortal(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    // Soft delete
    await prisma.portal.update({
        where: { id },
        data: { isActive: false },
    });

    revalidatePath("/portals");
}

/**
 * Permanently delete a portal
 */
export async function permanentlyDeletePortal(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    await prisma.portal.delete({
        where: { id },
    });

    revalidatePath("/portals");
}

/**
 * Seed default portals (one-time migration)
 */
export async function seedDefaultPortals() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    // Check if portals already exist
    const existingCount = await prisma.portal.count();
    if (existingCount > 0) {
        return { message: "Portals already exist", count: existingCount };
    }

    const defaultPortals = [
        { name: "Limo Anywhere", url: "https://limoanywhere.com", description: "Reservation and dispatch management", category: "trips", icon: "Car", color: "#3b82f6" },
        { name: "GroundSpan", url: "https://www.groundspan.com", description: "Ground transportation network", category: "trips", icon: "Globe", color: "#22c55e" },
        { name: "RideScheduler", url: "https://ridescheduler.com", description: "Trip scheduling and management", category: "trips", icon: "Calendar", color: "#8b5cf6" },
        { name: "FaST", url: "https://fasttransportation.com", description: "Farm network coordination", category: "trips", icon: "Car", color: "#f59e0b" },
        { name: "Lasso", url: "https://lassolimo.com", description: "Affiliate network trips", category: "trips", icon: "Users", color: "#ec4899" },
        { name: "RFP Monkey", url: "https://rfpmonkey.com", description: "RFP bidding platform", category: "rfp", icon: "FileText", color: "#06b6d4" },
        { name: "GBTA", url: "https://www.gbta.org", description: "Global Business Travel Association", category: "rfp", icon: "Building2", color: "#64748b" },
        { name: "NLA Connect", url: "https://www.limo.org", description: "National Limousine Association", category: "affiliates", icon: "Users", color: "#0ea5e9" },
        { name: "TLPA", url: "https://www.tlpa.org", description: "Taxicab, Limousine & Paratransit Association", category: "affiliates", icon: "Building2", color: "#14b8a6" },
        { name: "Stripe Dashboard", url: "https://dashboard.stripe.com", description: "Payment processing", category: "accounting", icon: "CreditCard", color: "#6366f1" },
        { name: "QuickBooks", url: "https://qbo.intuit.com", description: "Accounting software", category: "accounting", icon: "FileText", color: "#22c55e" },
        { name: "FlightAware", url: "https://flightaware.com", description: "Real-time flight tracking", category: "travel", icon: "Plane", color: "#0284c7" },
        { name: "Flightradar24", url: "https://www.flightradar24.com", description: "Live flight tracker", category: "travel", icon: "Plane", color: "#f97316" },
    ];

    let sortOrder = 1;
    for (const portal of defaultPortals) {
        await prisma.portal.create({
            data: {
                ...portal,
                sortOrder: sortOrder++,
                createdById: session.user.id,
            },
        });
    }

    revalidatePath("/portals");
    return { message: "Default portals seeded", count: defaultPortals.length };
}
