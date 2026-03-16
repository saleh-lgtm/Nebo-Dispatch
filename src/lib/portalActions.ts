"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/auditActions";
import { createPortalSchema, updatePortalSchema, idParamSchema, rejectPortalSchema } from "./schemas";

/**
 * Get all active and approved portals
 */
export async function getPortals() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const portals = await prisma.portal.findMany({
            where: {
                isActive: true,
                approvalStatus: "APPROVED"
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });

        return { success: true, data: portals };
    } catch (error) {
        console.error("getPortals error:", error);
        return { success: false, error: "Failed to get portals" };
    }
}

/**
 * Get pending portals for approval (admin only)
 */
export async function getPendingPortals() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        const portals = await prisma.portal.findMany({
            where: {
                isActive: true,
                approvalStatus: "PENDING"
            },
            orderBy: [{ createdAt: "asc" }],
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        return { success: true, data: portals };
    } catch (error) {
        console.error("getPendingPortals error:", error);
        return { success: false, error: "Failed to get pending portals" };
    }
}

/**
 * Get portals created by the current user (for dispatcher view)
 */
export async function getMyPortals() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const portals = await prisma.portal.findMany({
            where: {
                isActive: true,
                createdById: session.user.id
            },
            orderBy: [{ createdAt: "desc" }],
        });

        return { success: true, data: portals };
    } catch (error) {
        console.error("getMyPortals error:", error);
        return { success: false, error: "Failed to get your portals" };
    }
}

/**
 * Get all portals (including inactive) for admin management
 */
export async function getAllPortals() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        const portals = await prisma.portal.findMany({
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: {
                createdBy: {
                    select: { id: true, name: true },
                },
                approvedBy: {
                    select: { id: true, name: true },
                },
            },
        });

        return { success: true, data: portals };
    } catch (error) {
        console.error("getAllPortals error:", error);
        return { success: false, error: "Failed to get all portals" };
    }
}

/**
 * Create a new portal (PENDING status for dispatchers, APPROVED for admins)
 */
export async function createPortal(data: {
    name: string;
    url: string;
    description?: string;
    category?: string;
    icon?: string;
    color?: string;
}) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Validate input
        const parseResult = createPortalSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");

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
                approvalStatus: isAdmin ? "APPROVED" : "PENDING",
                approvedById: isAdmin ? session.user.id : null,
                approvedAt: isAdmin ? new Date() : null,
            },
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "Portal",
            portal.id,
            { name: data.name, url: data.url, status: isAdmin ? "APPROVED" : "PENDING" }
        );

        revalidatePath("/portals");
        revalidatePath("/dispatcher/directory");
        revalidatePath("/admin/approvals");
        return { success: true, data: portal };
    } catch (error) {
        console.error("createPortal error:", error);
        return { success: false, error: "Failed to create portal" };
    }
}

/**
 * Update an existing portal (admins can update any, dispatchers can update their own)
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
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid portal ID" };
        }

        // Validate data
        const dataResult = updatePortalSchema.safeParse(data);
        if (!dataResult.success) {
            return { success: false, error: dataResult.error.issues[0]?.message || "Invalid input" };
        }

        const existing = await prisma.portal.findUnique({ where: { id } });
        if (!existing) {
            return { success: false, error: "Portal not found" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        const isOwner = existing.createdById === session.user.id;

        if (!isAdmin && !isOwner) {
            return { success: false, error: "Not authorized to update this portal" };
        }

        const portal = await prisma.portal.update({
            where: { id },
            data,
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "Portal",
            id,
            { changes: data }
        );

        revalidatePath("/portals");
        revalidatePath("/dispatcher/directory");
        return { success: true, data: portal };
    } catch (error) {
        console.error("updatePortal error:", error);
        return { success: false, error: "Failed to update portal" };
    }
}

/**
 * Delete a portal (soft delete - admins can delete any, dispatchers can delete their own)
 */
export async function deletePortal(id: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid portal ID" };
        }

        const portal = await prisma.portal.findUnique({ where: { id } });
        if (!portal) {
            return { success: false, error: "Portal not found" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        const isOwner = portal.createdById === session.user.id;

        if (!isAdmin && !isOwner) {
            return { success: false, error: "Not authorized to delete this portal" };
        }

        // Soft delete
        await prisma.portal.update({
            where: { id },
            data: { isActive: false },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "Portal",
            id,
            { name: portal.name }
        );

        revalidatePath("/portals");
        revalidatePath("/dispatcher/directory");
        revalidatePath("/admin/approvals");
        return { success: true };
    } catch (error) {
        console.error("deletePortal error:", error);
        return { success: false, error: "Failed to delete portal" };
    }
}

/**
 * Permanently delete a portal
 */
export async function permanentlyDeletePortal(id: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid portal ID" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        await prisma.portal.delete({
            where: { id },
        });

        revalidatePath("/portals");
        return { success: true };
    } catch (error) {
        console.error("permanentlyDeletePortal error:", error);
        return { success: false, error: "Failed to permanently delete portal" };
    }
}

/**
 * Seed default portals (one-time migration)
 */
export async function seedDefaultPortals() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        // Check if portals already exist
        const existingCount = await prisma.portal.count();
        if (existingCount > 0) {
            return { success: true, data: { message: "Portals already exist", count: existingCount } };
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
        return { success: true, data: { message: "Default portals seeded", count: defaultPortals.length } };
    } catch (error) {
        console.error("seedDefaultPortals error:", error);
        return { success: false, error: "Failed to seed default portals" };
    }
}

/**
 * Approve a portal (admin only)
 */
export async function approvePortal(id: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid portal ID" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        const portal = await prisma.portal.update({
            where: { id },
            data: {
                approvalStatus: "APPROVED",
                approvedById: session.user.id,
                approvedAt: new Date(),
                rejectionReason: null,
            },
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "Portal",
            id,
            { action: "APPROVED", name: portal.name }
        );

        revalidatePath("/portals");
        revalidatePath("/dispatcher/directory");
        revalidatePath("/admin/approvals");
        return { success: true, data: portal };
    } catch (error) {
        console.error("approvePortal error:", error);
        return { success: false, error: "Failed to approve portal" };
    }
}

/**
 * Reject a portal (admin only)
 */
export async function rejectPortal(id: string, reason?: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return { success: false, error: "Unauthorized" };
        }

        // Validate input
        const parseResult = rejectPortalSchema.safeParse({ id, reason });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        if (!isAdmin) {
            return { success: false, error: "Admin access required" };
        }

        const portal = await prisma.portal.update({
            where: { id },
            data: {
                approvalStatus: "REJECTED",
                approvedById: session.user.id,
                approvedAt: new Date(),
                rejectionReason: reason || null,
            },
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "Portal",
            id,
            { action: "REJECTED", name: portal.name, reason }
        );

        revalidatePath("/portals");
        revalidatePath("/dispatcher/directory");
        revalidatePath("/admin/approvals");
        return { success: true, data: portal };
    } catch (error) {
        console.error("rejectPortal error:", error);
        return { success: false, error: "Failed to reject portal" };
    }
}
