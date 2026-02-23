"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "./auth-helpers";

// Format phone number to E.164
function formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (phone.startsWith("+")) return phone;
    return `+1${digits}`;
}

// Get or create a contact for a phone number
export async function getOrCreateContact(phoneNumber: string) {
    await requireAuth();

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

    return contact;
}

// Get contact by phone number
export async function getContactByPhone(phoneNumber: string) {
    await requireAuth();

    const normalizedPhone = formatPhoneNumber(phoneNumber);

    return prisma.sMSContact.findUnique({
        where: { phoneNumber: normalizedPhone },
        include: {
            affiliate: { select: { id: true, name: true, email: true, phone: true, state: true } },
            quote: { select: { id: true, clientName: true, clientEmail: true, clientPhone: true, status: true } },
        },
    });
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
    await requireAuth();

    const normalizedPhone = formatPhoneNumber(phoneNumber);

    return prisma.sMSContact.upsert({
        where: { phoneNumber: normalizedPhone },
        create: {
            phoneNumber: normalizedPhone,
            ...data,
        },
        update: data,
        include: {
            affiliate: { select: { id: true, name: true, email: true } },
            quote: { select: { id: true, clientName: true, clientEmail: true } },
        },
    });
}

// Link contact to an affiliate
export async function linkContactToAffiliate(phoneNumber: string, affiliateId: string) {
    await requireAuth();

    const normalizedPhone = formatPhoneNumber(phoneNumber);

    const affiliate = await prisma.affiliate.findUnique({
        where: { id: affiliateId },
        select: { name: true },
    });

    return prisma.sMSContact.upsert({
        where: { phoneNumber: normalizedPhone },
        create: {
            phoneNumber: normalizedPhone,
            affiliateId,
            name: affiliate?.name,
        },
        update: {
            affiliateId,
            quoteId: null, // Clear quote link when linking to affiliate
            name: affiliate?.name,
        },
        include: {
            affiliate: { select: { id: true, name: true, email: true } },
        },
    });
}

// Link contact to a quote
export async function linkContactToQuote(phoneNumber: string, quoteId: string) {
    await requireAuth();

    const normalizedPhone = formatPhoneNumber(phoneNumber);

    const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { clientName: true },
    });

    return prisma.sMSContact.upsert({
        where: { phoneNumber: normalizedPhone },
        create: {
            phoneNumber: normalizedPhone,
            quoteId,
            name: quote?.clientName,
        },
        update: {
            quoteId,
            affiliateId: null, // Clear affiliate link when linking to quote
            name: quote?.clientName,
        },
        include: {
            quote: { select: { id: true, clientName: true, clientEmail: true } },
        },
    });
}

// Remove entity linking (make it a custom contact)
export async function unlinkContact(phoneNumber: string) {
    await requireAuth();

    const normalizedPhone = formatPhoneNumber(phoneNumber);

    return prisma.sMSContact.update({
        where: { phoneNumber: normalizedPhone },
        data: {
            affiliateId: null,
            quoteId: null,
        },
    });
}

// Search affiliates for linking
export async function searchAffiliatesForLinking(query: string) {
    await requireAuth();

    return prisma.affiliate.findMany({
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
}

// Search quotes for linking
export async function searchQuotesForLinking(query: string) {
    await requireAuth();

    return prisma.quote.findMany({
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
}

// Get all contacts with pagination
export async function getContacts(options?: {
    limit?: number;
    offset?: number;
    search?: string;
}) {
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

    return { contacts, total };
}
