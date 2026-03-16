"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "@/lib/auditActions";
import { createContactSchema, updateContactSchema } from "./schemas";
import { z } from "zod";

const idSchema = z.string().min(1, "ID is required");
const tagIdsSchema = z.array(z.string());

/**
 * Get all approved contacts (for dispatchers and above)
 */
export async function getContacts() {
    try {
        await requireAuth();

        const contacts = await prisma.contact.findMany({
            where: {
                isActive: true,
                approvalStatus: "APPROVED"
            },
            orderBy: [{ company: "asc" }, { name: "asc" }],
            include: {
                createdBy: {
                    select: { id: true, name: true },
                },
            },
        });

        return { success: true, data: contacts };
    } catch (error) {
        console.error("getContacts error:", error);
        return { success: false, error: "Failed to get contacts", data: [] };
    }
}

/**
 * Get all contacts including pending (for admins)
 */
export async function getAllContacts() {
    try {
        await requireAdmin();

        const contacts = await prisma.contact.findMany({
            where: { isActive: true },
            orderBy: [{ createdAt: "desc" }],
            include: {
                createdBy: {
                    select: { id: true, name: true },
                },
                approvedBy: {
                    select: { id: true, name: true },
                },
            },
        });

        return { success: true, data: contacts };
    } catch (error) {
        console.error("getAllContacts error:", error);
        return { success: false, error: "Failed to get contacts", data: [] };
    }
}

/**
 * Get pending contacts for approval
 */
export async function getPendingContacts() {
    try {
        await requireAdmin();

        const contacts = await prisma.contact.findMany({
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

        return { success: true, data: contacts };
    } catch (error) {
        console.error("getPendingContacts error:", error);
        return { success: false, error: "Failed to get pending contacts", data: [] };
    }
}

/**
 * Get contacts created by the current user (for dispatcher view)
 */
export async function getMyContacts() {
    try {
        const session = await requireAuth();

        const contacts = await prisma.contact.findMany({
            where: {
                isActive: true,
                createdById: session.user.id
            },
            orderBy: [{ createdAt: "desc" }],
        });

        return { success: true, data: contacts };
    } catch (error) {
        console.error("getMyContacts error:", error);
        return { success: false, error: "Failed to get contacts", data: [] };
    }
}

/**
 * Create a new contact (PENDING status for dispatchers, APPROVED for admins)
 */
export async function createContact(data: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    notes?: string;
}) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = createContactSchema.safeParse(data);
        if (!parseResult.success) {
            const errors = parseResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

        const validData = parseResult.data;
        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");

        const contact = await prisma.contact.create({
            data: {
                name: validData.name,
                email: validData.email || null,
                phone: validData.phone || null,
                company: validData.company || null,
                notes: validData.notes || null,
                createdById: session.user.id,
                approvalStatus: isAdmin ? "APPROVED" : "PENDING",
                approvedById: isAdmin ? session.user.id : null,
                approvedAt: isAdmin ? new Date() : null,
            },
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "Contact",
            contact.id,
            { name: validData.name, company: validData.company, status: isAdmin ? "APPROVED" : "PENDING" }
        );

        revalidatePath("/dispatcher/directory");
        revalidatePath("/admin/approvals");
        return { success: true, data: contact };
    } catch (error) {
        console.error("createContact error:", error);
        return { success: false, error: "Failed to create contact" };
    }
}

/**
 * Update a contact
 */
export async function updateContact(
    id: string,
    data: {
        name?: string;
        email?: string;
        phone?: string;
        company?: string;
        notes?: string;
    }
) {
    try {
        const session = await requireAuth();

        // Validate ID
        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid contact ID" };
        }

        // Validate data
        const dataResult = updateContactSchema.safeParse(data);
        if (!dataResult.success) {
            const errors = dataResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

        const contact = await prisma.contact.findUnique({ where: { id } });
        if (!contact) {
            return { success: false, error: "Contact not found" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        const isOwner = contact.createdById === session.user.id;

        if (!isAdmin && !isOwner) {
            return { success: false, error: "Not authorized to update this contact" };
        }

        const updated = await prisma.contact.update({
            where: { id },
            data: dataResult.data,
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "Contact",
            id,
            { changes: dataResult.data }
        );

        revalidatePath("/dispatcher/directory");
        return { success: true, data: updated };
    } catch (error) {
        console.error("updateContact error:", error);
        return { success: false, error: "Failed to update contact" };
    }
}

/**
 * Delete a contact (soft delete)
 */
export async function deleteContact(id: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid contact ID" };
        }

        const contact = await prisma.contact.findUnique({ where: { id } });
        if (!contact) {
            return { success: false, error: "Contact not found" };
        }

        const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
        const isOwner = contact.createdById === session.user.id;

        if (!isAdmin && !isOwner) {
            return { success: false, error: "Not authorized to delete this contact" };
        }

        await prisma.contact.update({
            where: { id },
            data: { isActive: false },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "Contact",
            id,
            { name: contact.name }
        );

        revalidatePath("/dispatcher/directory");
        revalidatePath("/admin/approvals");
        return { success: true };
    } catch (error) {
        console.error("deleteContact error:", error);
        return { success: false, error: "Failed to delete contact" };
    }
}

/**
 * Approve a contact (admin only)
 */
export async function approveContact(id: string) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid contact ID" };
        }

        const contact = await prisma.contact.update({
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
            "Contact",
            id,
            { action: "APPROVED", name: contact.name }
        );

        revalidatePath("/dispatcher/directory");
        revalidatePath("/admin/approvals");
        return { success: true, data: contact };
    } catch (error) {
        console.error("approveContact error:", error);
        return { success: false, error: "Failed to approve contact" };
    }
}

/**
 * Reject a contact (admin only)
 */
export async function rejectContact(id: string, reason?: string) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid contact ID" };
        }

        const contact = await prisma.contact.update({
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
            "Contact",
            id,
            { action: "REJECTED", name: contact.name, reason }
        );

        revalidatePath("/dispatcher/directory");
        revalidatePath("/admin/approvals");
        return { success: true, data: contact };
    } catch (error) {
        console.error("rejectContact error:", error);
        return { success: false, error: "Failed to reject contact" };
    }
}

/**
 * Get all approved contacts with their tags
 */
export async function getContactsWithTags() {
    try {
        await requireAuth();

        const contacts = await prisma.contact.findMany({
            where: {
                isActive: true,
                approvalStatus: "APPROVED",
            },
            orderBy: [{ company: "asc" }, { name: "asc" }],
            include: {
                createdBy: { select: { id: true, name: true } },
                tags: {
                    include: {
                        tag: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });

        return { success: true, data: contacts };
    } catch (error) {
        console.error("getContactsWithTags error:", error);
        return { success: false, error: "Failed to get contacts", data: [] };
    }
}

/**
 * Get all contacts with tags (admin - includes pending)
 */
export async function getAllContactsWithTags() {
    try {
        await requireAdmin();

        const contacts = await prisma.contact.findMany({
            where: { isActive: true },
            orderBy: [{ createdAt: "desc" }],
            include: {
                createdBy: { select: { id: true, name: true } },
                approvedBy: { select: { id: true, name: true } },
                tags: {
                    include: {
                        tag: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });

        return { success: true, data: contacts };
    } catch (error) {
        console.error("getAllContactsWithTags error:", error);
        return { success: false, error: "Failed to get contacts", data: [] };
    }
}

/**
 * Filter contacts by tag IDs
 */
export async function getContactsByTagFilter(tagIds: string[]) {
    try {
        await requireAuth();

        const tagResult = tagIdsSchema.safeParse(tagIds);
        if (!tagResult.success) {
            return { success: false, error: "Invalid tag IDs", data: [] };
        }

        const where: {
            isActive: boolean;
            approvalStatus: "APPROVED";
            tags?: { some: { tagId: { in: string[] } } };
        } = {
            isActive: true,
            approvalStatus: "APPROVED",
        };

        if (tagIds.length > 0) {
            where.tags = {
                some: { tagId: { in: tagIds } },
            };
        }

        const contacts = await prisma.contact.findMany({
            where,
            orderBy: [{ company: "asc" }, { name: "asc" }],
            include: {
                createdBy: { select: { id: true, name: true } },
                tags: {
                    include: {
                        tag: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });

        return { success: true, data: contacts };
    } catch (error) {
        console.error("getContactsByTagFilter error:", error);
        return { success: false, error: "Failed to filter contacts", data: [] };
    }
}
