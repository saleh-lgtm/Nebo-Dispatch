"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/auditActions";

/**
 * Get all approved contacts (for dispatchers and above)
 */
export async function getContacts() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

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

    return contacts;
}

/**
 * Get all contacts including pending (for admins)
 */
export async function getAllContacts() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

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

    return contacts;
}

/**
 * Get pending contacts for approval
 */
export async function getPendingContacts() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

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

    return contacts;
}

/**
 * Get contacts created by the current user (for dispatcher view)
 */
export async function getMyContacts() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const contacts = await prisma.contact.findMany({
        where: {
            isActive: true,
            createdById: session.user.id
        },
        orderBy: [{ createdAt: "desc" }],
    });

    return contacts;
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");

    const contact = await prisma.contact.create({
        data: {
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            company: data.company || null,
            notes: data.notes || null,
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
        { name: data.name, company: data.company, status: isAdmin ? "APPROVED" : "PENDING" }
    );

    revalidatePath("/dispatcher/directory");
    revalidatePath("/admin/approvals");
    return contact;
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) {
        throw new Error("Contact not found");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    const isOwner = contact.createdById === session.user.id;

    if (!isAdmin && !isOwner) {
        throw new Error("Not authorized to update this contact");
    }

    const updated = await prisma.contact.update({
        where: { id },
        data,
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "Contact",
        id,
        { changes: data }
    );

    revalidatePath("/dispatcher/directory");
    return updated;
}

/**
 * Delete a contact (soft delete)
 */
export async function deleteContact(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) {
        throw new Error("Contact not found");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    const isOwner = contact.createdById === session.user.id;

    if (!isAdmin && !isOwner) {
        throw new Error("Not authorized to delete this contact");
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
}

/**
 * Approve a contact (admin only)
 */
export async function approveContact(id: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
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
    return contact;
}

/**
 * Reject a contact (admin only)
 */
export async function rejectContact(id: string, reason?: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");
    if (!isAdmin) {
        throw new Error("Admin access required");
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
    return contact;
}
