"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { deleteFile } from "./storageActions";
import { STORAGE_BUCKETS } from "./supabase";
import {
    idParamSchema,
    updateAffiliateSchema,
    createAffiliateAttachmentSchema,
} from "./schemas";

// Get all affiliates with optional filter
export async function getAffiliatesWithStatus(
    status?: "all" | "pending" | "approved",
    affiliateType?: "FARM_IN" | "FARM_OUT"
) {
    try {
        await requireAuth();

        const where: { isApproved?: boolean; type?: "FARM_IN" | "FARM_OUT" } = {};

        if (status === "pending") {
            where.isApproved = false;
        } else if (status === "approved") {
            where.isApproved = true;
        }

        if (affiliateType) {
            where.type = affiliateType;
        }

        const affiliates = await prisma.affiliate.findMany({
            where,
            orderBy: [
                { isApproved: "asc" },
                { createdAt: "desc" },
            ],
            include: {
                submittedBy: { select: { id: true, name: true, email: true } },
                pricingGrid: {
                    orderBy: { serviceType: "asc" },
                },
                attachments: {
                    include: {
                        uploadedBy: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        return { success: true, data: affiliates };
    } catch (error) {
        console.error("getAffiliatesWithStatus error:", error);
        return { success: false, error: "Failed to get affiliates", data: [] };
    }
}

// Get pending affiliates count (for admin badge)
export async function getPendingAffiliatesCount(affiliateType?: "FARM_IN" | "FARM_OUT") {
    try {
        await requireAdmin();

        const where: { isApproved: boolean; type?: "FARM_IN" | "FARM_OUT" } = { isApproved: false };
        if (affiliateType) {
            where.type = affiliateType;
        }

        const count = await prisma.affiliate.count({ where });
        return { success: true, data: count };
    } catch (error) {
        console.error("getPendingAffiliatesCount error:", error);
        return { success: false, error: "Failed to get count", data: 0 };
    }
}

// Get pending counts for both types
export async function getPendingAffiliatesCounts() {
    try {
        await requireAdmin();

        const [farmInCount, farmOutCount] = await Promise.all([
            prisma.affiliate.count({ where: { isApproved: false, type: "FARM_IN" } }),
            prisma.affiliate.count({ where: { isApproved: false, type: "FARM_OUT" } }),
        ]);

        return { success: true, data: { farmInCount, farmOutCount } };
    } catch (error) {
        console.error("getPendingAffiliatesCounts error:", error);
        return { success: false, error: "Failed to get counts", data: { farmInCount: 0, farmOutCount: 0 } };
    }
}

// Approve an affiliate (ADMIN/SUPER_ADMIN only)
export async function approveAffiliate(id: string, adminNotes?: string) {
    try {
        const session = await requireAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        const affiliate = await prisma.affiliate.update({
            where: { id: parsed.data.id },
            data: {
                isApproved: true,
            },
        });

        await createAuditLog(
            session.user.id,
            "APPROVE",
            "Affiliate",
            parsed.data.id,
            { name: affiliate.name, adminNotes }
        );

        revalidatePath("/affiliates");
        return { success: true, data: affiliate };
    } catch (error) {
        console.error("approveAffiliate error:", error);
        return { success: false, error: "Failed to approve affiliate" };
    }
}

// Reject/Delete an affiliate (ADMIN/SUPER_ADMIN only)
export async function rejectAffiliate(id: string, reason?: string) {
    try {
        const session = await requireAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        const affiliate = await prisma.affiliate.findUnique({
            where: { id: parsed.data.id },
            select: { name: true },
        });

        await prisma.affiliate.delete({
            where: { id: parsed.data.id },
        });

        await createAuditLog(
            session.user.id,
            "REJECT",
            "Affiliate",
            parsed.data.id,
            { name: affiliate?.name, reason }
        );

        revalidatePath("/affiliates");
        return { success: true };
    } catch (error) {
        console.error("rejectAffiliate error:", error);
        return { success: false, error: "Failed to reject affiliate" };
    }
}

// Update an affiliate (ADMIN/SUPER_ADMIN only)
export async function updateAffiliate(
    id: string,
    data: {
        name?: string;
        email?: string;
        phone?: string;
        state?: string;
        cities?: string[];
        notes?: string;
        cityTransferRate?: string;
    }
) {
    try {
        const session = await requireAdmin();

        const parsedId = idParamSchema.safeParse({ id });
        if (!parsedId.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        const parsed = updateAffiliateSchema.safeParse(data);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const affiliate = await prisma.affiliate.update({
            where: { id: parsedId.data.id },
            data: parsed.data,
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "Affiliate",
            parsedId.data.id,
            { ...parsed.data, cities: parsed.data.cities?.join(", ") }
        );

        revalidatePath("/affiliates");
        return { success: true, data: affiliate };
    } catch (error) {
        console.error("updateAffiliate error:", error);
        return { success: false, error: "Failed to update affiliate" };
    }
}

// Delete an approved affiliate (ADMIN/SUPER_ADMIN only)
export async function deleteAffiliate(id: string) {
    try {
        const session = await requireAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid affiliate ID" };
        }

        const affiliate = await prisma.affiliate.findUnique({
            where: { id: parsed.data.id },
            select: { name: true },
        });

        await prisma.affiliate.delete({
            where: { id: parsed.data.id },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "Affiliate",
            parsed.data.id,
            { name: affiliate?.name }
        );

        revalidatePath("/affiliates");
        return { success: true };
    } catch (error) {
        console.error("deleteAffiliate error:", error);
        return { success: false, error: "Failed to delete affiliate" };
    }
}

// ============================================
// AFFILIATE ATTACHMENTS
// ============================================

// Get attachments for an affiliate
export async function getAffiliateAttachments(affiliateId: string) {
    try {
        await requireAuth();

        const parsed = idParamSchema.safeParse({ id: affiliateId });
        if (!parsed.success) {
            return { success: false, error: "Invalid affiliate ID", data: [] };
        }

        const attachments = await prisma.affiliateAttachment.findMany({
            where: { affiliateId: parsed.data.id },
            include: {
                uploadedBy: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data: attachments };
    } catch (error) {
        console.error("getAffiliateAttachments error:", error);
        return { success: false, error: "Failed to get attachments", data: [] };
    }
}

// Upload a new attachment
export async function uploadAffiliateAttachment(data: {
    affiliateId: string;
    title: string;
    description?: string;
    documentType?: string;
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
}) {
    try {
        const session = await requireAdmin();

        const parsed = createAffiliateAttachmentSchema.safeParse(data);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
        }

        const attachment = await prisma.affiliateAttachment.create({
            data: {
                affiliateId: parsed.data.affiliateId,
                title: parsed.data.title,
                description: parsed.data.description,
                documentType: parsed.data.documentType,
                fileUrl: parsed.data.fileUrl,
                fileName: parsed.data.fileName,
                fileSize: parsed.data.fileSize,
                mimeType: parsed.data.mimeType,
                uploadedById: session.user.id,
            },
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "AffiliateAttachment",
            attachment.id,
            { affiliateId: parsed.data.affiliateId, title: parsed.data.title, fileName: parsed.data.fileName }
        );

        revalidatePath("/affiliates");
        return { success: true, data: attachment };
    } catch (error) {
        console.error("uploadAffiliateAttachment error:", error);
        return { success: false, error: "Failed to upload attachment" };
    }
}

// Delete an attachment
export async function deleteAffiliateAttachment(id: string) {
    try {
        const session = await requireAdmin();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid attachment ID" };
        }

        const attachment = await prisma.affiliateAttachment.findUnique({
            where: { id: parsed.data.id },
        });

        if (!attachment) {
            return { success: false, error: "Attachment not found" };
        }

        // Delete file from storage
        try {
            await deleteFile(STORAGE_BUCKETS.AFFILIATE_ATTACHMENTS, attachment.fileUrl);
        } catch (storageError) {
            console.error("Failed to delete attachment file:", storageError);
        }

        await prisma.affiliateAttachment.delete({
            where: { id: parsed.data.id },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "AffiliateAttachment",
            parsed.data.id,
            { affiliateId: attachment.affiliateId, title: attachment.title }
        );

        revalidatePath("/affiliates");
        return { success: true };
    } catch (error) {
        console.error("deleteAffiliateAttachment error:", error);
        return { success: false, error: "Failed to delete attachment" };
    }
}

// Get affiliate with attachments
export async function getAffiliateWithAttachments(id: string) {
    try {
        await requireAuth();

        const parsed = idParamSchema.safeParse({ id });
        if (!parsed.success) {
            return { success: false, error: "Invalid affiliate ID", data: null };
        }

        const affiliate = await prisma.affiliate.findUnique({
            where: { id: parsed.data.id },
            include: {
                submittedBy: { select: { id: true, name: true, email: true } },
                pricingGrid: { orderBy: { serviceType: "asc" } },
                attachments: {
                    include: {
                        uploadedBy: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        return { success: true, data: affiliate };
    } catch (error) {
        console.error("getAffiliateWithAttachments error:", error);
        return { success: false, error: "Failed to get affiliate", data: null };
    }
}
