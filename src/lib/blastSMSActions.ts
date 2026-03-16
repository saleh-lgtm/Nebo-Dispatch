"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "./auth-helpers";
import { sendBulkSMS } from "./twilioActions";
import { revalidatePath } from "next/cache";
import type { AffiliateType, Prisma } from "@prisma/client";
import { blastFilterSchema, sendBlastSMSSchema } from "./schemas";

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

// ============================================
// ENHANCED BLAST SMS (Combined Sources)
// ============================================

/**
 * Get all available blast recipients (contacts + affiliates) with optional filters
 */
export async function getBlastRecipients(filter?: BlastFilter): Promise<{
    success: boolean;
    data?: {
        recipients: BlastRecipient[];
        contactCount: number;
        affiliateCount: number;
    };
    error?: string;
}> {
    try {
        await requireAuth();

        // Validate filter if provided
        if (filter) {
            const parseResult = blastFilterSchema.safeParse(filter);
            if (!parseResult.success) {
                return { success: false, error: parseResult.error.issues[0]?.message || "Invalid filter" };
            }
        }

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
            success: true,
            data: {
                recipients: results,
                contactCount: results.filter((r) => r.type === "contact").length,
                affiliateCount: results.filter((r) => r.type === "affiliate").length,
            },
        };
    } catch (error) {
        console.error("getBlastRecipients error:", error);
        return { success: false, error: "Failed to get blast recipients" };
    }
}

/**
 * Preview enhanced blast SMS recipients (with manual selection support)
 */
export async function previewEnhancedBlastSMS(
    selectedIds: string[]
): Promise<{
    success: boolean;
    data?: {
        recipients: BlastRecipient[];
        contactCount: number;
        affiliateCount: number;
    };
    error?: string;
}> {
    try {
        await requireAuth();

        if (!selectedIds || selectedIds.length === 0) {
            return { success: true, data: { recipients: [], contactCount: 0, affiliateCount: 0 } };
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
            success: true,
            data: {
                recipients: results,
                contactCount: results.filter((r) => r.type === "contact").length,
                affiliateCount: results.filter((r) => r.type === "affiliate").length,
            },
        };
    } catch (error) {
        console.error("previewEnhancedBlastSMS error:", error);
        return { success: false, error: "Failed to preview blast recipients" };
    }
}

/**
 * Send enhanced blast SMS to manually selected recipients
 */
export async function sendEnhancedBlastSMS(data: {
    selectedIds: string[];
    message: string;
    contactTagIds?: string[];
    affiliateTagIds?: string[];
}): Promise<{ success: boolean; data?: EnhancedBlastResult; error?: string }> {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = sendBlastSMSSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        const trimmedMessage = data.message.trim();

        // Get recipients via preview (validates they exist and have phone numbers)
        const previewResult = await previewEnhancedBlastSMS(data.selectedIds);
        if (!previewResult.success || !previewResult.data) {
            return { success: false, error: previewResult.error || "Failed to get recipients" };
        }

        const { recipients, contactCount, affiliateCount } = previewResult.data;

        if (recipients.length === 0) {
            return { success: false, error: "No valid recipients with phone numbers found" };
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
            success: true,
            data: {
                total: result.total,
                successful: result.successful,
                failed: result.failed,
                contactCount,
                affiliateCount,
            },
        };
    } catch (error) {
        console.error("sendEnhancedBlastSMS error:", error);
        return { success: false, error: "Failed to send blast SMS" };
    }
}

/**
 * Get available tags for blast SMS filtering (both contact and affiliate tags)
 */
export async function getBlastTags() {
    try {
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

        return { success: true, data: { contactTags, affiliateTags } };
    } catch (error) {
        console.error("getBlastTags error:", error);
        return { success: false, error: "Failed to get blast tags" };
    }
}
