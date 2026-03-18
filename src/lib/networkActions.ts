"use server";

import prisma from "@/lib/prisma";
import { AffiliateType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { deleteFile } from "./storageActions";
import { STORAGE_BUCKETS } from "./supabase";
import {
    createNetworkPartnerSchema,
    updateNetworkPartnerSchema,
    createQuickContactSchema,
    createPartnerAttachmentSchema,
    idParamSchema,
} from "@/lib/schemas";

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

    const where: Prisma.AffiliateWhereInput = {};

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

    try {
        const result = await prisma.affiliate.findMany({
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
        return { success: true, data: result };
    } catch (error) {
        console.error("getNetworkPartners error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// Get pending counts by type
export async function getPendingPartnerCounts() {
    await requireAdmin();

    try {
        const [farmInCount, farmOutCount, iosCount, houseChauffeurCount] = await Promise.all([
            prisma.affiliate.count({ where: { isApproved: false, type: "FARM_IN" } }),
            prisma.affiliate.count({ where: { isApproved: false, type: "FARM_OUT" } }),
            prisma.affiliate.count({ where: { isApproved: false, type: "IOS" } }),
            prisma.affiliate.count({ where: { isApproved: false, type: "HOUSE_CHAUFFEUR" } }),
        ]);
        return { success: true, data: { farmInCount, farmOutCount, iosCount, houseChauffeurCount } };
    } catch (error) {
        console.error("getPendingPartnerCounts error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// Create a new network partner
export async function createNetworkPartner(data: CreatePartnerData & { submittedById: string }) {
    await requireAuth();

    const parsed = createNetworkPartnerSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    try {
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
        return { success: true, data: partner };
    } catch (error) {
        console.error("createNetworkPartner error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// Update a network partner
export async function updateNetworkPartner(id: string, data: UpdatePartnerData) {
    const session = await requireAdmin();

    const idParsed = idParamSchema.safeParse({ id });
    if (!idParsed.success) {
        return { success: false, error: idParsed.error.issues[0]?.message || "Invalid ID" };
    }

    const parsed = updateNetworkPartnerSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    try {
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
        return { success: true, data: partner };
    } catch (error) {
        console.error("updateNetworkPartner error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// Approve a partner
export async function approveNetworkPartner(id: string, adminNotes?: string) {
    const session = await requireAdmin();

    try {
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
        return { success: true, data: partner };
    } catch (error) {
        console.error("approveNetworkPartner error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// Reject/Delete a partner
export async function rejectNetworkPartner(id: string, reason?: string) {
    const session = await requireAdmin();

    try {
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
        return { success: true };
    } catch (error) {
        console.error("rejectNetworkPartner error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// Delete a partner
export async function deleteNetworkPartner(id: string) {
    const session = await requireAdmin();

    try {
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
        return { success: true };
    } catch (error) {
        console.error("deleteNetworkPartner error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// Toggle partner active status
export async function togglePartnerActive(id: string) {
    const session = await requireAdmin();

    try {
        const partner = await prisma.affiliate.findUnique({
            where: { id },
            select: { isActive: true, name: true },
        });

        if (!partner) return { success: false, error: "Partner not found" };

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
        return { success: true, data: updated };
    } catch (error) {
        console.error("togglePartnerActive error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
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

    const where: Prisma.AffiliateWhereInput = {
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

    try {
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

        return { success: true, data: { contacts: contactsWithLastMessage, total } };
    } catch (error) {
        console.error("getAllNetworkContacts error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
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

    try {
        const result = await prisma.affiliateAttachment.findMany({
            where: { affiliateId: partnerId },
            include: {
                uploadedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        return { success: true, data: result };
    } catch (error) {
        console.error("getPartnerAttachments error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

export async function uploadPartnerAttachment(data: CreateAttachmentData) {
    const session = await requireAdmin();

    const parsed = createPartnerAttachmentSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    try {
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
        return { success: true, data: attachment };
    } catch (error) {
        console.error("uploadPartnerAttachment error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

export async function deletePartnerAttachment(id: string) {
    const session = await requireAdmin();

    try {
        const attachment = await prisma.affiliateAttachment.findUnique({
            where: { id },
        });

        if (!attachment) return { success: false, error: "Attachment not found" };

        const deleteResult = await deleteFile(STORAGE_BUCKETS.AFFILIATE_ATTACHMENTS, attachment.fileUrl);
        if (!deleteResult.success) {
            console.error("Failed to delete attachment file:", deleteResult.error);
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
        return { success: true };
    } catch (error) {
        console.error("deletePartnerAttachment error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// ============================================
// QUICK CONTACT (Contact-Only Entry)
// ============================================

export interface CreateQuickContactData {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
}

// Create a contact-only entry (auto-approved, no partner details needed)
export async function createQuickContact(data: CreateQuickContactData) {
    const session = await requireAuth();

    const parsed = createQuickContactSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    try {
        const normalizedPhone = formatPhoneNumber(data.phone);

        // Check if this phone already exists as a contact
        const existingContact = await prisma.sMSContact.findUnique({
            where: { phoneNumber: normalizedPhone },
            include: { affiliate: { select: { id: true, name: true } } },
        });

        if (existingContact?.affiliate) {
            return { success: false, error: `This phone number is already linked to ${existingContact.affiliate.name}` };
        }

        // Create affiliate as contact-only (auto-approved)
        const contact = await prisma.affiliate.create({
            data: {
                name: data.name,
                email: data.email || `${normalizedPhone.replace(/\D/g, "")}@contact.local`,
                phone: data.phone,
                type: "FARM_OUT", // Default type for contacts
                isContactOnly: true,
                isApproved: true, // Auto-approve contacts
                isActive: true,
                notes: data.notes,
                submittedById: session.user.id,
            },
        });

        // Create SMS contact link
        await prisma.sMSContact.upsert({
            where: { phoneNumber: normalizedPhone },
            create: {
                phoneNumber: normalizedPhone,
                affiliateId: contact.id,
                name: data.name,
            },
            update: {
                affiliateId: contact.id,
                name: data.name,
            },
        });

        await createAuditLog(
            session.user.id,
            "CREATE",
            "Affiliate",
            contact.id,
            { name: data.name, phone: data.phone, isContactOnly: true }
        );

        revalidatePath("/network");
        revalidatePath("/sms");
        return { success: true, data: contact };
    } catch (error) {
        console.error("createQuickContact error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}

// ============================================
// GET PARTNER WITH ALL RELATIONS
// ============================================

export async function getPartnerById(id: string) {
    await requireAuth();

    try {
        const result = await prisma.affiliate.findUnique({
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
        return { success: true, data: result };
    } catch (error) {
        console.error("getPartnerById error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Operation failed" };
    }
}
