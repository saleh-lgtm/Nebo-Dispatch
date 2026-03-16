"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { createTagSchema, updateTagSchema, tagAssignmentSchema, tagContactSchema, tagIdsSchema, idParamSchema } from "./schemas";

/**
 * Get all tags with assignment counts (available to all authenticated users)
 */
export async function getTags(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        await requireAuth();

        const tags = await prisma.contactTag.findMany({
            orderBy: { name: "asc" },
            include: {
                _count: { select: { assignments: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });

        return { success: true, data: tags };
    } catch (error) {
        console.error("getTags error:", error);
        return { success: false, error: "Failed to get tags" };
    }
}

/**
 * Get a single tag by ID
 */
export async function getTag(id: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        await requireAuth();

        // Validate input
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid tag ID" };
        }

        const tag = await prisma.contactTag.findUnique({
            where: { id },
            include: {
                _count: { select: { assignments: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });

        return { success: true, data: tag };
    } catch (error) {
        console.error("getTag error:", error);
        return { success: false, error: "Failed to get tag" };
    }
}

/**
 * Create a new tag (admin only)
 */
export async function createTag(data: {
    name: string;
    color?: string;
    description?: string;
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = createTagSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const trimmedName = data.name.trim();

        // Check for duplicate
        const existing = await prisma.contactTag.findUnique({
            where: { name: trimmedName },
        });
        if (existing) {
            return { success: false, error: "A tag with this name already exists" };
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

        return { success: true, data: tag };
    } catch (error) {
        console.error("createTag error:", error);
        return { success: false, error: "Failed to create tag" };
    }
}

/**
 * Update a tag (admin only)
 */
export async function updateTag(
    id: string,
    data: { name?: string; color?: string; description?: string }
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        await requireAdmin();

        // Validate id
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid tag ID" };
        }

        // Validate data
        const dataResult = updateTagSchema.safeParse(data);
        if (!dataResult.success) {
            return { success: false, error: dataResult.error.issues[0]?.message || "Invalid input" };
        }

        const tag = await prisma.contactTag.findUnique({ where: { id } });
        if (!tag) {
            return { success: false, error: "Tag not found" };
        }

        // If name is being updated, check for duplicates
        if (data.name) {
            const trimmedName = data.name.trim();
            if (trimmedName !== tag.name) {
                const existing = await prisma.contactTag.findUnique({
                    where: { name: trimmedName },
                });
                if (existing) {
                    return { success: false, error: "A tag with this name already exists" };
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

        return { success: true, data: updated };
    } catch (error) {
        console.error("updateTag error:", error);
        return { success: false, error: "Failed to update tag" };
    }
}

/**
 * Delete a tag (admin only)
 */
export async function deleteTag(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        // Validate id
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid tag ID" };
        }

        const tag = await prisma.contactTag.findUnique({ where: { id } });
        if (!tag) {
            return { success: false, error: "Tag not found" };
        }

        // Cascade delete will remove all assignments
        await prisma.contactTag.delete({ where: { id } });

        revalidatePath("/admin/contacts");
        revalidatePath("/dispatcher/directory");

        return { success: true };
    } catch (error) {
        console.error("deleteTag error:", error);
        return { success: false, error: "Failed to delete tag" };
    }
}

/**
 * Assign tags to a contact (admin only)
 * Replaces all existing tag assignments
 */
export async function assignTagsToContact(contactId: string, tagIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = tagAssignmentSchema.safeParse({ contactId, tagIds });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // Verify contact exists
        const contact = await prisma.contact.findUnique({ where: { id: contactId } });
        if (!contact) {
            return { success: false, error: "Contact not found" };
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

        return { success: true };
    } catch (error) {
        console.error("assignTagsToContact error:", error);
        return { success: false, error: "Failed to assign tags to contact" };
    }
}

/**
 * Add a single tag to a contact
 */
export async function addTagToContact(contactId: string, tagId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = tagContactSchema.safeParse({ contactId, tagId });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // Check if assignment already exists
        const existing = await prisma.contactTagAssignment.findUnique({
            where: { contactId_tagId: { contactId, tagId } },
        });
        if (existing) {
            return { success: true, data: existing };
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

        return { success: true, data: assignment };
    } catch (error) {
        console.error("addTagToContact error:", error);
        return { success: false, error: "Failed to add tag to contact" };
    }
}

/**
 * Remove a tag from a contact
 */
export async function removeTagFromContact(contactId: string, tagId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = tagContactSchema.safeParse({ contactId, tagId });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        await prisma.contactTagAssignment.deleteMany({
            where: { contactId, tagId },
        });

        revalidatePath("/admin/contacts");
        revalidatePath("/dispatcher/directory");

        return { success: true };
    } catch (error) {
        console.error("removeTagFromContact error:", error);
        return { success: false, error: "Failed to remove tag from contact" };
    }
}

/**
 * Get contacts filtered by tag IDs (for blast SMS preview)
 */
export async function getContactsByTags(tagIds: string[]): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = tagIdsSchema.safeParse({ tagIds });
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        if (tagIds.length === 0) {
            return { success: true, data: [] };
        }

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

        return { success: true, data: contacts };
    } catch (error) {
        console.error("getContactsByTags error:", error);
        return { success: false, error: "Failed to get contacts by tags" };
    }
}
