"use server";

import prisma from "@/lib/prisma";
import { AffiliateType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { deleteFile } from "./storageActions";
import { STORAGE_BUCKETS } from "./supabase";

// ============================================
// TYPES
// ============================================

export type PartnerType = AffiliateType;

export interface CreatePartnerData {
    name: string;
    email: string;
    phone?: string;
    type: PartnerType;
    // Farm In/Out fields
    state?: string;
    cities?: string[];
    notes?: string;
    cityTransferRate?: string;
    // IOS fields
    market?: string;
    // House Chauffeur fields
    employeeId?: string;
}

export interface UpdatePartnerData {
    name?: string;
    email?: string;
    phone?: string;
    state?: string;
    cities?: string[];
    notes?: string;
    cityTransferRate?: string;
    market?: string;
    employeeId?: string;
    isActive?: boolean;
}

// ============================================
// FORMAT HELPERS
// ============================================

function formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (phone.startsWith("+")) return phone;
    return `+1${digits}`;
}

// ============================================
// NETWORK PARTNER CRUD
// ============================================

// Get all network partners with filters
export async function getNetworkPartners(options?: {
    type?: PartnerType | PartnerType[];
    status?: "all" | "pending" | "approved";
    search?: string;
    isActive?: boolean;
}) {
    await requireAuth();

    const { type, status, search, isActive } = options || {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    // Filter by type
    if (type) {
        if (Array.isArray(type)) {
            where.type = { in: type };
        } else {
            where.type = type;
        }
    }

    // Filter by approval status
    if (status === "pending") {
        where.isApproved = false;
    } else if (status === "approved") {
        where.isApproved = true;
    }

    // Filter by active status
    if (isActive !== undefined) {
        where.isActive = isActive;
    }

    // Search filter
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { state: { contains: search, mode: "insensitive" } },
            { market: { contains: search, mode: "insensitive" } },
            { employeeId: { contains: search, mode: "insensitive" } },
        ];
    }

    return await prisma.affiliate.findMany({
        where,
        orderBy: [
            { isApproved: "asc" },
            { createdAt: "desc" },
        ],
        include: {
            submittedBy: { select: { id: true, name: true, email: true } },
            pricingGrid: { orderBy: { serviceType: "asc" } },
            attachments: {
                include: { uploadedBy: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            },
            vehicleInfo: true,
            schedulePrefs: true,
            vehicleAssignments: {
                include: {
                    vehicle: { select: { id: true, name: true, make: true, model: true, licensePlate: true } },
                },
            },
            smsContacts: { select: { id: true, phoneNumber: true } },
        },
    });
}

// Get pending counts by type
export async function getPendingPartnerCounts() {
    await requireAdmin();

    const [farmInCount, farmOutCount, iosCount, houseChauffeurCount] = await Promise.all([
        prisma.affiliate.count({ where: { isApproved: false, type: "FARM_IN" } }),
        prisma.affiliate.count({ where: { isApproved: false, type: "FARM_OUT" } }),
        prisma.affiliate.count({ where: { isApproved: false, type: "IOS" } }),
        prisma.affiliate.count({ where: { isApproved: false, type: "HOUSE_CHAUFFEUR" } }),
    ]);

    return { farmInCount, farmOutCount, iosCount, houseChauffeurCount };
}

// Create a new network partner
export async function createNetworkPartner(data: CreatePartnerData & { submittedById: string }) {
    await requireAuth();

    const partner = await prisma.affiliate.create({
        data: {
            name: data.name,
            email: data.email,
            phone: data.phone,
            type: data.type,
            state: data.state,
            cities: data.cities || [],
            notes: data.notes,
            cityTransferRate: data.cityTransferRate,
            market: data.market,
            employeeId: data.employeeId,
            submittedById: data.submittedById,
            isApproved: false,
            isActive: true,
        },
    });

    // Auto-create SMS contact if phone provided
    if (data.phone) {
        const normalizedPhone = formatPhoneNumber(data.phone);
        await prisma.sMSContact.upsert({
            where: { phoneNumber: normalizedPhone },
            create: {
                phoneNumber: normalizedPhone,
                affiliateId: partner.id,
                name: data.name,
            },
            update: {
                affiliateId: partner.id,
                name: data.name,
            },
        });
    }

    await createAuditLog(
        data.submittedById,
        "CREATE",
        "NetworkPartner",
        partner.id,
        { name: data.name, type: data.type }
    );

    revalidatePath("/network");
    return partner;
}

// Update a network partner
export async function updateNetworkPartner(id: string, data: UpdatePartnerData) {
    const session = await requireAdmin();

    const partner = await prisma.affiliate.update({
        where: { id },
        data,
    });

    // Update SMS contact if phone changed
    if (data.phone) {
        const normalizedPhone = formatPhoneNumber(data.phone);
        await prisma.sMSContact.upsert({
            where: { phoneNumber: normalizedPhone },
            create: {
                phoneNumber: normalizedPhone,
                affiliateId: id,
                name: data.name || partner.name,
            },
            update: {
                affiliateId: id,
                name: data.name || partner.name,
            },
        });
    }

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "NetworkPartner",
        id,
        { ...data }
    );

    revalidatePath("/network");
    revalidatePath("/affiliates"); // For backwards compatibility
    return partner;
}

// Approve a partner
export async function approveNetworkPartner(id: string, adminNotes?: string) {
    const session = await requireAdmin();

    const partner = await prisma.affiliate.update({
        where: { id },
        data: { isApproved: true },
    });

    await createAuditLog(
        session.user.id,
        "APPROVE",
        "NetworkPartner",
        id,
        { name: partner.name, type: partner.type, adminNotes }
    );

    revalidatePath("/network");
    revalidatePath("/affiliates");
    return partner;
}

// Reject/Delete a partner
export async function rejectNetworkPartner(id: string, reason?: string) {
    const session = await requireAdmin();

    const partner = await prisma.affiliate.findUnique({
        where: { id },
        select: { name: true, type: true },
    });

    await prisma.affiliate.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "REJECT",
        "NetworkPartner",
        id,
        { name: partner?.name, type: partner?.type, reason }
    );

    revalidatePath("/network");
    revalidatePath("/affiliates");
}

// Delete a partner
export async function deleteNetworkPartner(id: string) {
    const session = await requireAdmin();

    const partner = await prisma.affiliate.findUnique({
        where: { id },
        select: { name: true, type: true },
    });

    await prisma.affiliate.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "NetworkPartner",
        id,
        { name: partner?.name, type: partner?.type }
    );

    revalidatePath("/network");
    revalidatePath("/affiliates");
}

// Toggle partner active status
export async function togglePartnerActive(id: string) {
    const session = await requireAdmin();

    const partner = await prisma.affiliate.findUnique({
        where: { id },
        select: { isActive: true, name: true },
    });

    if (!partner) throw new Error("Partner not found");

    const updated = await prisma.affiliate.update({
        where: { id },
        data: { isActive: !partner.isActive },
    });

    await createAuditLog(
        session.user.id,
        updated.isActive ? "ACTIVATE" : "DEACTIVATE",
        "NetworkPartner",
        id,
        { name: partner.name }
    );

    revalidatePath("/network");
    return updated;
}

// ============================================
// CONTACT BOOK FUNCTIONS
// ============================================

// Get all network contacts (unified view across all partner types)
export async function getAllNetworkContacts(options?: {
    search?: string;
    type?: PartnerType | PartnerType[];
    limit?: number;
    offset?: number;
}) {
    await requireAuth();

    const { search, type, limit = 50, offset = 0 } = options || {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
        phone: { not: null },
    };

    if (type) {
        if (Array.isArray(type)) {
            where.type = { in: type };
        } else {
            where.type = type;
        }
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { market: { contains: search, mode: "insensitive" } },
        ];
    }

    const [contacts, total] = await Promise.all([
        prisma.affiliate.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                type: true,
                market: true,
                state: true,
                isApproved: true,
                isActive: true,
                smsContacts: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        _count: { select: { messages: true } },
                    },
                },
            },
            orderBy: { name: "asc" },
            take: limit,
            skip: offset,
        }),
        prisma.affiliate.count({ where }),
    ]);

    // Get last message info for each contact
    const contactsWithLastMessage = await Promise.all(
        contacts.map(async (contact) => {
            if (!contact.phone) return { ...contact, lastMessage: null };

            const normalizedPhone = formatPhoneNumber(contact.phone);
            const lastMessage = await prisma.sMSLog.findFirst({
                where: { conversationPhone: normalizedPhone },
                orderBy: { createdAt: "desc" },
                select: {
                    message: true,
                    createdAt: true,
                    direction: true,
                    status: true,
                },
            });

            return { ...contact, lastMessage };
        })
    );

    return { contacts: contactsWithLastMessage, total };
}

// ============================================
// ATTACHMENT FUNCTIONS (Extended)
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

export async function getPartnerAttachments(partnerId: string) {
    await requireAuth();

    return await prisma.affiliateAttachment.findMany({
        where: { affiliateId: partnerId },
        include: {
            uploadedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}

export async function uploadPartnerAttachment(data: CreateAttachmentData) {
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
        "PartnerAttachment",
        attachment.id,
        { partnerId: data.affiliateId, title: data.title }
    );

    revalidatePath("/network");
    return attachment;
}

export async function deletePartnerAttachment(id: string) {
    const session = await requireAdmin();

    const attachment = await prisma.affiliateAttachment.findUnique({
        where: { id },
    });

    if (!attachment) throw new Error("Attachment not found");

    try {
        await deleteFile(STORAGE_BUCKETS.AFFILIATE_ATTACHMENTS, attachment.fileUrl);
    } catch (error) {
        console.error("Failed to delete attachment file:", error);
    }

    await prisma.affiliateAttachment.delete({ where: { id } });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "PartnerAttachment",
        id,
        { partnerId: attachment.affiliateId, title: attachment.title }
    );

    revalidatePath("/network");
}

// ============================================
// GET PARTNER WITH ALL RELATIONS
// ============================================

export async function getPartnerById(id: string) {
    await requireAuth();

    return await prisma.affiliate.findUnique({
        where: { id },
        include: {
            submittedBy: { select: { id: true, name: true, email: true } },
            pricingGrid: { orderBy: { serviceType: "asc" } },
            attachments: {
                include: { uploadedBy: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            },
            vehicleInfo: true,
            schedulePrefs: true,
            vehicleAssignments: {
                include: {
                    vehicle: {
                        select: {
                            id: true,
                            name: true,
                            make: true,
                            model: true,
                            year: true,
                            licensePlate: true,
                            type: true,
                        },
                    },
                },
            },
            smsContacts: {
                select: {
                    id: true,
                    phoneNumber: true,
                    _count: { select: { messages: true } },
                },
            },
        },
    });
}
