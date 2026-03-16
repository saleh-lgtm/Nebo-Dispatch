"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";

/**
 * Get all affiliate tags with assignment counts (available to all authenticated users)
 */
export async function getAffiliateTags() {
    await requireAuth();

    const tags = await prisma.affiliateTag.findMany({
        orderBy: { name: "asc" },
        include: {
            _count: { select: { assignments: true } },
            createdBy: { select: { id: true, name: true } },
        },
    });

    return tags;
}

/**
 * Get a single affiliate tag by ID
 */
export async function getAffiliateTag(id: string) {
    await requireAuth();

    const tag = await prisma.affiliateTag.findUnique({
        where: { id },
        include: {
            _count: { select: { assignments: true } },
            createdBy: { select: { id: true, name: true } },
        },
    });

    return tag;
}

/**
 * Create a new affiliate tag (admin only)
 */
export async function createAffiliateTag(data: {
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
    const existing = await prisma.affiliateTag.findUnique({
        where: { name: trimmedName },
    });
    if (existing) {
        throw new Error("A tag with this name already exists");
    }

    const tag = await prisma.affiliateTag.create({
        data: {
            name: trimmedName,
            color: data.color || "#3B82F6",
            description: data.description?.trim() || null,
            createdById: session.user.id,
        },
    });

    revalidatePath("/admin/affiliates");
    revalidatePath("/admin/sms");
    return tag;
}

/**
 * Update an affiliate tag (admin only)
 */
export async function updateAffiliateTag(
    id: string,
    data: { name?: string; color?: string; description?: string }
) {
    await requireAdmin();

    const tag = await prisma.affiliateTag.findUnique({ where: { id } });
    if (!tag) {
        throw new Error("Tag not found");
    }

    // If name is being updated, check for duplicates
    if (data.name) {
        const trimmedName = data.name.trim();
        if (trimmedName !== tag.name) {
            const existing = await prisma.affiliateTag.findUnique({
                where: { name: trimmedName },
            });
            if (existing) {
                throw new Error("A tag with this name already exists");
            }
            data.name = trimmedName;
        }
    }

    const updated = await prisma.affiliateTag.update({
        where: { id },
        data: {
            ...(data.name && { name: data.name }),
            ...(data.color && { color: data.color }),
            ...(data.description !== undefined && {
                description: data.description?.trim() || null,
            }),
        },
    });

    revalidatePath("/admin/affiliates");
    revalidatePath("/admin/sms");
    return updated;
}

/**
 * Delete an affiliate tag (admin only)
 */
export async function deleteAffiliateTag(id: string) {
    await requireAdmin();

    const tag = await prisma.affiliateTag.findUnique({ where: { id } });
    if (!tag) {
        throw new Error("Tag not found");
    }

    // Cascade delete will remove all assignments
    await prisma.affiliateTag.delete({ where: { id } });

    revalidatePath("/admin/affiliates");
    revalidatePath("/admin/sms");
}

/**
 * Assign tags to an affiliate (admin only)
 * Replaces all existing tag assignments
 */
export async function assignTagsToAffiliate(affiliateId: string, tagIds: string[]) {
    const session = await requireAdmin();

    // Verify affiliate exists
    const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!affiliate) {
        throw new Error("Affiliate not found");
    }

    // Remove existing assignments
    await prisma.affiliateTagAssignment.deleteMany({
        where: { affiliateId },
    });

    // Create new assignments
    if (tagIds.length > 0) {
        await prisma.affiliateTagAssignment.createMany({
            data: tagIds.map((tagId) => ({
                affiliateId,
                tagId,
                assignedById: session.user.id,
            })),
        });
    }

    revalidatePath("/admin/affiliates");
    revalidatePath("/admin/sms");
}

/**
 * Add a single tag to an affiliate
 */
export async function addTagToAffiliate(affiliateId: string, tagId: string) {
    const session = await requireAdmin();

    // Check if assignment already exists
    const existing = await prisma.affiliateTagAssignment.findUnique({
        where: { affiliateId_tagId: { affiliateId, tagId } },
    });
    if (existing) {
        return existing;
    }

    const assignment = await prisma.affiliateTagAssignment.create({
        data: {
            affiliateId,
            tagId,
            assignedById: session.user.id,
        },
    });

    revalidatePath("/admin/affiliates");
    revalidatePath("/admin/sms");
    return assignment;
}

/**
 * Remove a tag from an affiliate
 */
export async function removeTagFromAffiliate(affiliateId: string, tagId: string) {
    await requireAdmin();

    await prisma.affiliateTagAssignment.deleteMany({
        where: { affiliateId, tagId },
    });

    revalidatePath("/admin/affiliates");
    revalidatePath("/admin/sms");
}

/**
 * Get affiliates filtered by tag IDs (for blast SMS preview)
 */
export async function getAffiliatesByTags(tagIds: string[]) {
    await requireAdmin();

    if (tagIds.length === 0) return [];

    const affiliates = await prisma.affiliate.findMany({
        where: {
            isActive: true,
            isApproved: true,
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

    return affiliates;
}
