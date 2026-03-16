"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { sendBulkSMS } from "./twilioActions";
import { revalidatePath } from "next/cache";
import type { AffiliateType, Prisma } from "@prisma/client";

// ============================================
// TYPES FOR UNIFIED BLAST SMS
// ============================================

export interface BlastRecipient {
    id: string;
    prefixedId: string; // "contact_xxx" or "affiliate_xxx"
    name: string;
    phone: string | null;
    company: string | null;
    type: "contact" | "affiliate";
    affiliateType?: AffiliateType;
    tags: Array<{ id: string; name: string; color: string }>;
}

export interface BlastFilter {
    // Source filtering
    sources?: ("contacts" | "affiliates")[];
    // Tag filtering
    contactTagIds?: string[];
    affiliateTagIds?: string[];
    // Affiliate-specific filters
    affiliateTypes?: AffiliateType[];
    // Search
    searchQuery?: string;
    // Individual selection (overrides filters)
    selectedRecipientIds?: string[]; // Format: "contact_xxx" or "affiliate_xxx"
}

export interface EnhancedBlastResult {
    total: number;
    successful: number;
    failed: number;
    contactCount: number;
    affiliateCount: number;
}

/**
 * Preview blast SMS recipients without sending
 */
export async function previewBlastSMS(tagIds: string[]) {
    await requireAuth();

    if (tagIds.length === 0) {
        return { recipientCount: 0, recipients: [] };
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
        select: {
            id: true,
            name: true,
            phone: true,
            company: true,
            tags: {
                include: {
                    tag: { select: { id: true, name: true, color: true } },
                },
            },
        },
        orderBy: { name: "asc" },
    });

    return {
        recipientCount: contacts.length,
        recipients: contacts,
    };
}

/**
 * Send blast SMS to contacts with selected tags
 */
export async function sendBlastSMS(data: { tagIds: string[]; message: string }) {
    const session = await requireAuth();

    // Validate input
    const trimmedMessage = data.message.trim();
    if (!trimmedMessage) {
        throw new Error("Message is required");
    }

    if (trimmedMessage.length > 1600) {
        throw new Error("Message is too long (max 1600 characters)");
    }

    if (data.tagIds.length === 0) {
        throw new Error("At least one tag must be selected");
    }

    // Get contacts with valid phone numbers
    const contacts = await prisma.contact.findMany({
        where: {
            isActive: true,
            approvalStatus: "APPROVED",
            phone: { not: null },
            tags: {
                some: { tagId: { in: data.tagIds } },
            },
        },
        select: { id: true, phone: true, name: true },
    });

    if (contacts.length === 0) {
        throw new Error("No contacts with phone numbers found for selected tags");
    }

    // Prepare recipients for bulk send
    const recipients = contacts
        .filter((c) => c.phone)
        .map((c) => ({
            phone: c.phone!,
            message: trimmedMessage,
        }));

    // Send via existing sendBulkSMS infrastructure
    const result = await sendBulkSMS(recipients);

    // Log the blast campaign
    await prisma.blastSMSLog.create({
        data: {
            message: trimmedMessage,
            tagIds: data.tagIds,
            recipientCount: recipients.length,
            successCount: result.successful,
            failCount: result.failed,
            sentById: session.user.id,
        },
    });

    revalidatePath("/admin/sms");

    return {
        ...result,
        message: trimmedMessage,
        tagIds: data.tagIds,
    };
}

/**
 * Get blast SMS campaign history
 */
export async function getBlastSMSHistory(options?: {
    limit?: number;
    offset?: number;
}) {
    await requireAdmin();

    const { limit = 20, offset = 0 } = options || {};

    const [logs, total] = await Promise.all([
        prisma.blastSMSLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
            include: {
                sentBy: { select: { id: true, name: true } },
            },
        }),
        prisma.blastSMSLog.count(),
    ]);

    // Fetch tag names for display (both contact and affiliate tags)
    const allContactTagIds = [...new Set(logs.flatMap((log) => log.tagIds))];
    const allAffiliateTagIds = [...new Set(logs.flatMap((log) => log.affiliateTagIds))];

    const [contactTags, affiliateTags] = await Promise.all([
        prisma.contactTag.findMany({
            where: { id: { in: allContactTagIds } },
            select: { id: true, name: true, color: true },
        }),
        prisma.affiliateTag.findMany({
            where: { id: { in: allAffiliateTagIds } },
            select: { id: true, name: true, color: true },
        }),
    ]);

    const contactTagMap = new Map(contactTags.map((t) => [t.id, t]));
    const affiliateTagMap = new Map(affiliateTags.map((t) => [t.id, t]));

    const logsWithTags = logs.map((log) => ({
        ...log,
        tags: log.tagIds.map((id) => contactTagMap.get(id)).filter(Boolean),
        affiliateTags: log.affiliateTagIds.map((id) => affiliateTagMap.get(id)).filter(Boolean),
    }));

    return { logs: logsWithTags, total };
}

/**
 * Get blast SMS statistics
 */
export async function getBlastSMSStats() {
    await requireAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [todayBlasts, monthBlasts, totalRecipients, totalSuccess, totalFailed] =
        await Promise.all([
            prisma.blastSMSLog.count({
                where: { createdAt: { gte: today } },
            }),
            prisma.blastSMSLog.count({
                where: { createdAt: { gte: thisMonth } },
            }),
            prisma.blastSMSLog.aggregate({
                _sum: { recipientCount: true },
                where: { createdAt: { gte: thisMonth } },
            }),
            prisma.blastSMSLog.aggregate({
                _sum: { successCount: true },
                where: { createdAt: { gte: thisMonth } },
            }),
            prisma.blastSMSLog.aggregate({
                _sum: { failCount: true },
                where: { createdAt: { gte: thisMonth } },
            }),
        ]);

    return {
        todayBlasts,
        monthBlasts,
        totalRecipients: totalRecipients._sum.recipientCount || 0,
        totalSuccess: totalSuccess._sum.successCount || 0,
        totalFailed: totalFailed._sum.failCount || 0,
    };
}

// ============================================
// ENHANCED BLAST SMS (Combined Sources)
// ============================================

/**
 * Get all available blast recipients (contacts + affiliates) with optional filters
 */
export async function getBlastRecipients(filter?: BlastFilter): Promise<{
    recipients: BlastRecipient[];
    contactCount: number;
    affiliateCount: number;
}> {
    await requireAuth();

    const sources = filter?.sources || ["contacts", "affiliates"];
    const searchQuery = filter?.searchQuery?.toLowerCase().trim();
    const results: BlastRecipient[] = [];

    // Fetch contacts if included
    if (sources.includes("contacts")) {
        const contactWhere: Prisma.ContactWhereInput = {
            isActive: true,
            approvalStatus: "APPROVED",
            phone: { not: null },
        };

        // Apply tag filter
        if (filter?.contactTagIds && filter.contactTagIds.length > 0) {
            contactWhere.tags = {
                some: { tagId: { in: filter.contactTagIds } },
            };
        }

        // Apply search filter
        if (searchQuery) {
            contactWhere.OR = [
                { name: { contains: searchQuery, mode: "insensitive" } },
                { company: { contains: searchQuery, mode: "insensitive" } },
                { phone: { contains: searchQuery } },
            ];
        }

        const contacts = await prisma.contact.findMany({
            where: contactWhere,
            select: {
                id: true,
                name: true,
                phone: true,
                company: true,
                tags: {
                    include: {
                        tag: { select: { id: true, name: true, color: true } },
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        for (const contact of contacts) {
            results.push({
                id: contact.id,
                prefixedId: `contact_${contact.id}`,
                name: contact.name,
                phone: contact.phone,
                company: contact.company,
                type: "contact",
                tags: contact.tags.map((t) => t.tag),
            });
        }
    }

    // Fetch affiliates if included
    if (sources.includes("affiliates")) {
        const affiliateWhere: Prisma.AffiliateWhereInput = {
            isActive: true,
            isApproved: true,
            phone: { not: null },
        };

        // Apply affiliate type filter
        if (filter?.affiliateTypes && filter.affiliateTypes.length > 0) {
            affiliateWhere.type = { in: filter.affiliateTypes };
        }

        // Apply tag filter
        if (filter?.affiliateTagIds && filter.affiliateTagIds.length > 0) {
            affiliateWhere.tags = {
                some: { tagId: { in: filter.affiliateTagIds } },
            };
        }

        // Apply search filter
        if (searchQuery) {
            affiliateWhere.OR = [
                { name: { contains: searchQuery, mode: "insensitive" } },
                { email: { contains: searchQuery, mode: "insensitive" } },
                { phone: { contains: searchQuery } },
            ];
        }

        const affiliates = await prisma.affiliate.findMany({
            where: affiliateWhere,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                type: true,
                tags: {
                    include: {
                        tag: { select: { id: true, name: true, color: true } },
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        for (const affiliate of affiliates) {
            results.push({
                id: affiliate.id,
                prefixedId: `affiliate_${affiliate.id}`,
                name: affiliate.name,
                phone: affiliate.phone,
                company: affiliate.email, // Use email as secondary info
                type: "affiliate",
                affiliateType: affiliate.type,
                tags: affiliate.tags.map((t) => t.tag),
            });
        }
    }

    // Sort combined results by name
    results.sort((a, b) => a.name.localeCompare(b.name));

    return {
        recipients: results,
        contactCount: results.filter((r) => r.type === "contact").length,
        affiliateCount: results.filter((r) => r.type === "affiliate").length,
    };
}

/**
 * Preview enhanced blast SMS recipients (with manual selection support)
 */
export async function previewEnhancedBlastSMS(
    selectedIds: string[]
): Promise<{
    recipients: BlastRecipient[];
    contactCount: number;
    affiliateCount: number;
}> {
    await requireAuth();

    if (selectedIds.length === 0) {
        return { recipients: [], contactCount: 0, affiliateCount: 0 };
    }

    // Parse selected IDs into contacts and affiliates
    const contactIds: string[] = [];
    const affiliateIds: string[] = [];

    for (const id of selectedIds) {
        if (id.startsWith("contact_")) {
            contactIds.push(id.replace("contact_", ""));
        } else if (id.startsWith("affiliate_")) {
            affiliateIds.push(id.replace("affiliate_", ""));
        }
    }

    const results: BlastRecipient[] = [];

    // Fetch selected contacts
    if (contactIds.length > 0) {
        const contacts = await prisma.contact.findMany({
            where: {
                id: { in: contactIds },
                isActive: true,
                approvalStatus: "APPROVED",
                phone: { not: null },
            },
            select: {
                id: true,
                name: true,
                phone: true,
                company: true,
                tags: {
                    include: {
                        tag: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });

        for (const contact of contacts) {
            results.push({
                id: contact.id,
                prefixedId: `contact_${contact.id}`,
                name: contact.name,
                phone: contact.phone,
                company: contact.company,
                type: "contact",
                tags: contact.tags.map((t) => t.tag),
            });
        }
    }

    // Fetch selected affiliates
    if (affiliateIds.length > 0) {
        const affiliates = await prisma.affiliate.findMany({
            where: {
                id: { in: affiliateIds },
                isActive: true,
                isApproved: true,
                phone: { not: null },
            },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                type: true,
                tags: {
                    include: {
                        tag: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });

        for (const affiliate of affiliates) {
            results.push({
                id: affiliate.id,
                prefixedId: `affiliate_${affiliate.id}`,
                name: affiliate.name,
                phone: affiliate.phone,
                company: affiliate.email,
                type: "affiliate",
                affiliateType: affiliate.type,
                tags: affiliate.tags.map((t) => t.tag),
            });
        }
    }

    return {
        recipients: results,
        contactCount: results.filter((r) => r.type === "contact").length,
        affiliateCount: results.filter((r) => r.type === "affiliate").length,
    };
}

/**
 * Send enhanced blast SMS to manually selected recipients
 */
export async function sendEnhancedBlastSMS(data: {
    selectedIds: string[];
    message: string;
    contactTagIds?: string[];
    affiliateTagIds?: string[];
}): Promise<EnhancedBlastResult> {
    const session = await requireAuth();

    // Validate message
    const trimmedMessage = data.message.trim();
    if (!trimmedMessage) {
        throw new Error("Message is required");
    }

    if (trimmedMessage.length > 1600) {
        throw new Error("Message is too long (max 1600 characters)");
    }

    if (data.selectedIds.length === 0) {
        throw new Error("At least one recipient must be selected");
    }

    // Get recipients via preview (validates they exist and have phone numbers)
    const { recipients, contactCount, affiliateCount } = await previewEnhancedBlastSMS(
        data.selectedIds
    );

    if (recipients.length === 0) {
        throw new Error("No valid recipients with phone numbers found");
    }

    // Prepare recipients for bulk send
    const smsRecipients = recipients
        .filter((r) => r.phone)
        .map((r) => ({
            phone: r.phone!,
            message: trimmedMessage,
        }));

    // Send via existing sendBulkSMS infrastructure
    const result = await sendBulkSMS(smsRecipients);

    // Log the blast campaign with enhanced tracking
    await prisma.blastSMSLog.create({
        data: {
            message: trimmedMessage,
            tagIds: data.contactTagIds || [],
            affiliateTagIds: data.affiliateTagIds || [],
            recipientCount: smsRecipients.length,
            successCount: result.successful,
            failCount: result.failed,
            contactCount,
            affiliateCount,
            sentById: session.user.id,
        },
    });

    revalidatePath("/admin/sms");

    return {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        contactCount,
        affiliateCount,
    };
}

/**
 * Get available tags for blast SMS filtering (both contact and affiliate tags)
 */
export async function getBlastTags() {
    await requireAuth();

    const [contactTags, affiliateTags] = await Promise.all([
        prisma.contactTag.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                color: true,
                _count: { select: { assignments: true } },
            },
        }),
        prisma.affiliateTag.findMany({
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                color: true,
                _count: { select: { assignments: true } },
            },
        }),
    ]);

    return { contactTags, affiliateTags };
}
