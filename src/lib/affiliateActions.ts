"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { deleteFile } from "./storageActions";
import { STORAGE_BUCKETS } from "./supabase";

// Get all affiliates with optional filter
export async function getAffiliatesWithStatus(
    status?: "all" | "pending" | "approved",
    affiliateType?: "FARM_IN" | "FARM_OUT"
) {
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

    return await prisma.affiliate.findMany({
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
}

// Get pending affiliates count (for admin badge)
export async function getPendingAffiliatesCount(affiliateType?: "FARM_IN" | "FARM_OUT") {
    await requireAdmin();

    const where: { isApproved: boolean; type?: "FARM_IN" | "FARM_OUT" } = { isApproved: false };
    if (affiliateType) {
        where.type = affiliateType;
    }

    return await prisma.affiliate.count({ where });
}

// Get pending counts for both types
export async function getPendingAffiliatesCounts() {
    await requireAdmin();

    const [farmInCount, farmOutCount] = await Promise.all([
        prisma.affiliate.count({ where: { isApproved: false, type: "FARM_IN" } }),
        prisma.affiliate.count({ where: { isApproved: false, type: "FARM_OUT" } }),
    ]);

    return { farmInCount, farmOutCount };
}

// Approve an affiliate (ADMIN/SUPER_ADMIN only)
export async function approveAffiliate(id: string, adminNotes?: string) {
    const session = await requireAdmin();

    const affiliate = await prisma.affiliate.update({
        where: { id },
        data: {
            isApproved: true,
        },
    });

    await createAuditLog(
        session.user.id,
        "APPROVE",
        "Affiliate",
        id,
        { name: affiliate.name, adminNotes }
    );

    revalidatePath("/affiliates");
    return affiliate;
}

// Reject/Delete an affiliate (ADMIN/SUPER_ADMIN only)
export async function rejectAffiliate(id: string, reason?: string) {
    const session = await requireAdmin();

    const affiliate = await prisma.affiliate.findUnique({
        where: { id },
        select: { name: true },
    });

    await prisma.affiliate.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "REJECT",
        "Affiliate",
        id,
        { name: affiliate?.name, reason }
    );

    revalidatePath("/affiliates");
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
    const session = await requireAdmin();

    const affiliate = await prisma.affiliate.update({
        where: { id },
        data,
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "Affiliate",
        id,
        { ...data, cities: data.cities?.join(", ") }
    );

    revalidatePath("/affiliates");
    return affiliate;
}

// Delete an approved affiliate (ADMIN/SUPER_ADMIN only)
export async function deleteAffiliate(id: string) {
    const session = await requireAdmin();

    const affiliate = await prisma.affiliate.findUnique({
        where: { id },
        select: { name: true },
    });

    await prisma.affiliate.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "Affiliate",
        id,
        { name: affiliate?.name }
    );

    revalidatePath("/affiliates");
}

// ============================================
// AFFILIATE ATTACHMENTS
// ============================================

export interface CreateAttachmentData {
    affiliateId: string;
    title: string;
    description?: string;
    documentType?: string;
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
}

// Get attachments for an affiliate
export async function getAffiliateAttachments(affiliateId: string) {
    await requireAuth();

    return await prisma.affiliateAttachment.findMany({
        where: { affiliateId },
        include: {
            uploadedBy: {
                select: { id: true, name: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });
}

// Upload a new attachment
export async function uploadAffiliateAttachment(data: CreateAttachmentData) {
    const session = await requireAdmin();

    const attachment = await prisma.affiliateAttachment.create({
        data: {
            affiliateId: data.affiliateId,
            title: data.title,
            description: data.description,
            documentType: data.documentType,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            uploadedById: session.user.id,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "AffiliateAttachment",
        attachment.id,
        { affiliateId: data.affiliateId, title: data.title, fileName: data.fileName }
    );

    revalidatePath("/affiliates");
    return attachment;
}

// Delete an attachment
export async function deleteAffiliateAttachment(id: string) {
    const session = await requireAdmin();

    const attachment = await prisma.affiliateAttachment.findUnique({
        where: { id },
    });

    if (!attachment) {
        throw new Error("Attachment not found");
    }

    // Delete file from storage
    try {
        await deleteFile(STORAGE_BUCKETS.AFFILIATE_ATTACHMENTS, attachment.fileUrl);
    } catch (error) {
        console.error("Failed to delete attachment file:", error);
    }

    await prisma.affiliateAttachment.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "AffiliateAttachment",
        id,
        { affiliateId: attachment.affiliateId, title: attachment.title }
    );

    revalidatePath("/affiliates");
}

// Get affiliate with attachments
export async function getAffiliateWithAttachments(id: string) {
    await requireAuth();

    return await prisma.affiliate.findUnique({
        where: { id },
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
}
