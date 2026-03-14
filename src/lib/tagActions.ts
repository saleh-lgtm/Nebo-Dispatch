"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";

/**
 * Get all tags with assignment counts (available to all authenticated users)
 */
export async function getTags() {
    await requireAuth();

    const tags = await prisma.contactTag.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: { select: { assignments: true } },
            createdBy: { select: { id: true, name: true } },
        },
    });

    return tags;
}

/**
 * Get a single tag by ID
 */
export async function getTag(id: string) {
    await requireAuth();

    const tag = await prisma.contactTag.findUnique({
        where: { id },
        include: {
            _count: { select: { assignments: true } },
            createdBy: { select: { id: true, name: true } },
        },
    });

    return tag;
}

/**
 * Create a new tag (admin only)
 */
export async function createTag(data: {
    name: string;
    color?: string;
    description?: string;
}) {
    const session = await requireAdmin();

    // Validate name
    const trimmedName = data.name.trim();
    if (!trimmedName) {
        throw new Error("Tag name is required");
    }

    if (trimmedName.length > 50) {
        throw new Error("Tag name must be 50 characters or less");
    }

    // Check for duplicate
    const existing = await prisma.contactTag.findUnique({
        where: { name: trimmedName },
    });
    if (existing) {
        throw new Error("A tag with this name already exists");
    }

    const tag = await prisma.contactTag.create({
        data: {
            name: trimmedName,
            color: data.color || "#3B82F6",
            description: data.description?.trim() || null,
            createdById: session.user.id,
        },
    });

    revalidatePath("/admin/contacts");
    revalidatePath("/dispatcher/directory");
    return tag;
}

/**
 * Update a tag (admin only)
 */
export async function updateTag(
    id: string,
    data: { name?: string; color?: string; description?: string }
) {
    await requireAdmin();

    const tag = await prisma.contactTag.findUnique({ where: { id } });
    if (!tag) {
        throw new Error("Tag not found");
    }

    // If name is being updated, check for duplicates
    if (data.name) {
        const trimmedName = data.name.trim();
        if (trimmedName !== tag.name) {
            const existing = await prisma.contactTag.findUnique({
                where: { name: trimmedName },
            });
            if (existing) {
                throw new Error("A tag with this name already exists");
            }
            data.name = trimmedName;
        }
    }

    const updated = await prisma.contactTag.update({
        where: { id },
        data: {
            ...(data.name && { name: data.name }),
            ...(data.color && { color: data.color }),
            ...(data.description !== undefined && {
                description: data.description?.trim() || null,
            }),
        },
    });

    revalidatePath("/admin/contacts");
    revalidatePath("/dispatcher/directory");
    return updated;
}

/**
 * Delete a tag (admin only)
 */
export async function deleteTag(id: string) {
    await requireAdmin();

    const tag = await prisma.contactTag.findUnique({ where: { id } });
    if (!tag) {
        throw new Error("Tag not found");
    }

    // Cascade delete will remove all assignments
    await prisma.contactTag.delete({ where: { id } });

    revalidatePath("/admin/contacts");
    revalidatePath("/dispatcher/directory");
}

/**
 * Assign tags to a contact (admin only)
 * Replaces all existing tag assignments
 */
export async function assignTagsToContact(contactId: string, tagIds: string[]) {
    const session = await requireAdmin();

    // Verify contact exists
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) {
        throw new Error("Contact not found");
    }

    // Remove existing assignments
    await prisma.contactTagAssignment.deleteMany({
        where: { contactId },
    });

    // Create new assignments
    if (tagIds.length > 0) {
        await prisma.contactTagAssignment.createMany({
            data: tagIds.map((tagId) => ({
                contactId,
                tagId,
                assignedById: session.user.id,
            })),
        });
    }

    revalidatePath("/admin/contacts");
    revalidatePath("/dispatcher/directory");
}

/**
 * Add a single tag to a contact
 */
export async function addTagToContact(contactId: string, tagId: string) {
    const session = await requireAdmin();

    // Check if assignment already exists
    const existing = await prisma.contactTagAssignment.findUnique({
        where: { contactId_tagId: { contactId, tagId } },
    });
    if (existing) {
        return existing;
    }

    const assignment = await prisma.contactTagAssignment.create({
        data: {
            contactId,
            tagId,
            assignedById: session.user.id,
        },
    });

    revalidatePath("/admin/contacts");
    revalidatePath("/dispatcher/directory");
    return assignment;
}

/**
 * Remove a tag from a contact
 */
export async function removeTagFromContact(contactId: string, tagId: string) {
    await requireAdmin();

    await prisma.contactTagAssignment.deleteMany({
        where: { contactId, tagId },
    });

    revalidatePath("/admin/contacts");
    revalidatePath("/dispatcher/directory");
}

/**
 * Get contacts filtered by tag IDs (for blast SMS preview)
 */
export async function getContactsByTags(tagIds: string[]) {
    await requireAdmin();

    if (tagIds.length === 0) return [];

    const contacts = await prisma.contact.findMany({
        where: {
            isActive: true,
            approvalStatus: "APPROVED",
            phone: { not: null },
            tags: {
                some: { tagId: { in: tagIds } },
            },
        },
        include: {
            tags: {
                include: {
                    tag: { select: { id: true, name: true, color: true } },
                },
            },
        },
        orderBy: { name: "asc" },
    });

    return contacts;
}
