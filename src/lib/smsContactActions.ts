"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "./auth-helpers";
import { updateSMSContactSchema, searchQuerySchema } from "./schemas";
import { z } from "zod";

// Format phone number to E.164
function formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (phone.startsWith("+")) return phone;
    return `+1${digits}`;
}

const phoneSchema = z.string().min(10, "Invalid phone number");

// Get or create a contact for a phone number
export async function getOrCreateContact(phoneNumber: string) {
    try {
        await requireAuth();

        const phoneResult = phoneSchema.safeParse(phoneNumber);
        if (!phoneResult.success) {
            return { success: false, error: "Invalid phone number" };
        }

        const normalizedPhone = formatPhoneNumber(phoneNumber);

        // Check if contact exists
        let contact = await prisma.sMSContact.findUnique({
            where: { phoneNumber: normalizedPhone },
            include: {
                affiliate: { select: { id: true, name: true, email: true } },
                quote: { select: { id: true, clientName: true, clientEmail: true } },
            },
        });

        if (!contact) {
            // Try to auto-link to existing entities by phone number
            const affiliate = await prisma.affiliate.findFirst({
                where: { phone: normalizedPhone },
            });

            const quote = await prisma.quote.findFirst({
                where: { clientPhone: normalizedPhone },
                orderBy: { createdAt: "desc" },
            });

            // Create the contact
            contact = await prisma.sMSContact.create({
                data: {
                    phoneNumber: normalizedPhone,
                    name: affiliate?.name || quote?.clientName || null,
                    affiliateId: affiliate?.id || null,
                    quoteId: !affiliate && quote ? quote.id : null,
                },
                include: {
                    affiliate: { select: { id: true, name: true, email: true } },
                    quote: { select: { id: true, clientName: true, clientEmail: true } },
                },
            });
        }

        return { success: true, data: contact };
    } catch (error) {
        console.error("getOrCreateContact error:", error);
        return { success: false, error: "Failed to get or create contact" };
    }
}

// Get contact by phone number
export async function getContactByPhone(phoneNumber: string) {
    try {
        await requireAuth();

        const phoneResult = phoneSchema.safeParse(phoneNumber);
        if (!phoneResult.success) {
            return { success: false, error: "Invalid phone number" };
        }

        const normalizedPhone = formatPhoneNumber(phoneNumber);

        const contact = await prisma.sMSContact.findUnique({
            where: { phoneNumber: normalizedPhone },
            include: {
                affiliate: { select: { id: true, name: true, email: true, phone: true, state: true } },
                quote: { select: { id: true, clientName: true, clientEmail: true, clientPhone: true, status: true } },
            },
        });

        return { success: true, data: contact };
    } catch (error) {
        console.error("getContactByPhone error:", error);
        return { success: false, error: "Failed to get contact" };
    }
}

// Update contact details
export async function updateContact(
    phoneNumber: string,
    data: {
        name?: string;
        customLabel?: string;
        notes?: string;
    }
) {
    try {
        await requireAuth();

        const phoneResult = phoneSchema.safeParse(phoneNumber);
        if (!phoneResult.success) {
            return { success: false, error: "Invalid phone number" };
        }

        const dataResult = updateSMSContactSchema.safeParse(data);
        if (!dataResult.success) {
            return { success: false, error: "Invalid contact data" };
        }

        const normalizedPhone = formatPhoneNumber(phoneNumber);

        const contact = await prisma.sMSContact.upsert({
            where: { phoneNumber: normalizedPhone },
            create: {
                phoneNumber: normalizedPhone,
                ...dataResult.data,
            },
            update: dataResult.data,
            include: {
                affiliate: { select: { id: true, name: true, email: true } },
                quote: { select: { id: true, clientName: true, clientEmail: true } },
            },
        });

        return { success: true, data: contact };
    } catch (error) {
        console.error("updateContact error:", error);
        return { success: false, error: "Failed to update contact" };
    }
}

// Link contact to an affiliate
export async function linkContactToAffiliate(phoneNumber: string, affiliateId: string) {
    try {
        await requireAuth();

        const phoneResult = phoneSchema.safeParse(phoneNumber);
        if (!phoneResult.success) {
            return { success: false, error: "Invalid phone number" };
        }

        if (!affiliateId || affiliateId.length === 0) {
            return { success: false, error: "Affiliate ID is required" };
        }

        const normalizedPhone = formatPhoneNumber(phoneNumber);

        const affiliate = await prisma.affiliate.findUnique({
            where: { id: affiliateId },
            select: { name: true },
        });

        if (!affiliate) {
            return { success: false, error: "Affiliate not found" };
        }

        const contact = await prisma.sMSContact.upsert({
            where: { phoneNumber: normalizedPhone },
            create: {
                phoneNumber: normalizedPhone,
                affiliateId,
                name: affiliate.name,
            },
            update: {
                affiliateId,
                quoteId: null, // Clear quote link when linking to affiliate
                name: affiliate.name,
            },
            include: {
                affiliate: { select: { id: true, name: true, email: true } },
            },
        });

        return { success: true, data: contact };
    } catch (error) {
        console.error("linkContactToAffiliate error:", error);
        return { success: false, error: "Failed to link contact to affiliate" };
    }
}

// Link contact to a quote
export async function linkContactToQuote(phoneNumber: string, quoteId: string) {
    try {
        await requireAuth();

        const phoneResult = phoneSchema.safeParse(phoneNumber);
        if (!phoneResult.success) {
            return { success: false, error: "Invalid phone number" };
        }

        if (!quoteId || quoteId.length === 0) {
            return { success: false, error: "Quote ID is required" };
        }

        const normalizedPhone = formatPhoneNumber(phoneNumber);

        const quote = await prisma.quote.findUnique({
            where: { id: quoteId },
            select: { clientName: true },
        });

        if (!quote) {
            return { success: false, error: "Quote not found" };
        }

        const contact = await prisma.sMSContact.upsert({
            where: { phoneNumber: normalizedPhone },
            create: {
                phoneNumber: normalizedPhone,
                quoteId,
                name: quote.clientName,
            },
            update: {
                quoteId,
                affiliateId: null, // Clear affiliate link when linking to quote
                name: quote.clientName,
            },
            include: {
                quote: { select: { id: true, clientName: true, clientEmail: true } },
            },
        });

        return { success: true, data: contact };
    } catch (error) {
        console.error("linkContactToQuote error:", error);
        return { success: false, error: "Failed to link contact to quote" };
    }
}

// Remove entity linking (make it a custom contact)
export async function unlinkContact(phoneNumber: string) {
    try {
        await requireAuth();

        const phoneResult = phoneSchema.safeParse(phoneNumber);
        if (!phoneResult.success) {
            return { success: false, error: "Invalid phone number" };
        }

        const normalizedPhone = formatPhoneNumber(phoneNumber);

        const contact = await prisma.sMSContact.update({
            where: { phoneNumber: normalizedPhone },
            data: {
                affiliateId: null,
                quoteId: null,
            },
        });

        return { success: true, data: contact };
    } catch (error) {
        console.error("unlinkContact error:", error);
        return { success: false, error: "Failed to unlink contact" };
    }
}

// Search affiliates for linking
export async function searchAffiliatesForLinking(query: string) {
    try {
        await requireAuth();

        const queryResult = searchQuerySchema.safeParse({ query });
        if (!queryResult.success) {
            return { success: false, error: "Search query is required", data: [] };
        }

        const affiliates = await prisma.affiliate.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                    { phone: { contains: query } },
                ],
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                type: true,
            },
            take: 10,
        });

        return { success: true, data: affiliates };
    } catch (error) {
        console.error("searchAffiliatesForLinking error:", error);
        return { success: false, error: "Failed to search affiliates", data: [] };
    }
}

// Search quotes for linking
export async function searchQuotesForLinking(query: string) {
    try {
        await requireAuth();

        const queryResult = searchQuerySchema.safeParse({ query });
        if (!queryResult.success) {
            return { success: false, error: "Search query is required", data: [] };
        }

        const quotes = await prisma.quote.findMany({
            where: {
                OR: [
                    { clientName: { contains: query, mode: "insensitive" } },
                    { clientEmail: { contains: query, mode: "insensitive" } },
                    { clientPhone: { contains: query } },
                ],
            },
            select: {
                id: true,
                clientName: true,
                clientEmail: true,
                clientPhone: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        return { success: true, data: quotes };
    } catch (error) {
        console.error("searchQuotesForLinking error:", error);
        return { success: false, error: "Failed to search quotes", data: [] };
    }
}

// Get all contacts with pagination
export async function getContacts(options?: {
    limit?: number;
    offset?: number;
    search?: string;
}) {
    try {
        await requireAuth();

        const { limit = 50, offset = 0, search } = options || {};

        const where = search
            ? {
                OR: [
                    { phoneNumber: { contains: search } },
                    { name: { contains: search, mode: "insensitive" as const } },
                    { customLabel: { contains: search, mode: "insensitive" as const } },
                ],
            }
            : {};

        const [contacts, total] = await Promise.all([
            prisma.sMSContact.findMany({
                where,
                include: {
                    affiliate: { select: { id: true, name: true } },
                    quote: { select: { id: true, clientName: true } },
                    _count: { select: { messages: true } },
                },
                orderBy: { updatedAt: "desc" },
                take: limit,
                skip: offset,
            }),
            prisma.sMSContact.count({ where }),
        ]);

        return { success: true, data: { contacts, total } };
    } catch (error) {
        console.error("getContacts error:", error);
        return { success: false, error: "Failed to get contacts", data: { contacts: [], total: 0 } };
    }
}
