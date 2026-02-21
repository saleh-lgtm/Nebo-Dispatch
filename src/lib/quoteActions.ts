"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { QuoteStatus } from "@prisma/client";

export interface CreateQuoteData {
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    serviceType: string;
    pickupDate?: Date;
    pickupLocation?: string;
    dropoffLocation?: string;
    estimatedAmount?: number;
    notes?: string;
}

export async function createQuote(data: CreateQuoteData) {
    const session = await requireAuth();

    const quote = await prisma.quote.create({
        data: {
            ...data,
            createdById: session.user.id,
            assignedToId: session.user.id, // Initially assigned to creator
            nextFollowUp: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default: follow up in 24h
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "Quote",
        quote.id,
        { clientName: data.clientName, serviceType: data.serviceType }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function getQuotes(options?: {
    status?: QuoteStatus[];
    assignedToId?: string;
    limit?: number;
}) {
    await requireAuth();

    return prisma.quote.findMany({
        where: {
            status: options?.status ? { in: options.status } : undefined,
            assignedToId: options?.assignedToId,
        },
        include: {
            createdBy: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } },
        },
        orderBy: [
            { nextFollowUp: "asc" },
            { createdAt: "desc" },
        ],
        take: options?.limit,
    });
}

export async function getPendingQuotes() {
    await requireAuth();

    return prisma.quote.findMany({
        where: {
            status: { in: ["PENDING", "FOLLOWING_UP"] },
        },
        include: {
            createdBy: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { nextFollowUp: "asc" },
    });
}

export async function recordFollowUp(
    quoteId: string,
    notes: string,
    nextFollowUpDate?: Date
) {
    const session = await requireAuth();

    const quote = await prisma.quote.update({
        where: { id: quoteId },
        data: {
            followUpCount: { increment: 1 },
            lastFollowUp: new Date(),
            nextFollowUp: nextFollowUpDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
            followUpNotes: notes,
            status: "FOLLOWING_UP",
        },
    });

    await createAuditLog(
        session.user.id,
        "FOLLOW_UP",
        "Quote",
        quoteId,
        { notes, followUpCount: quote.followUpCount }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function convertQuote(quoteId: string, reservationId?: string) {
    const session = await requireAuth();

    const quote = await prisma.quote.update({
        where: { id: quoteId },
        data: {
            status: "CONVERTED",
            convertedAt: new Date(),
            reservationId,
        },
    });

    await createAuditLog(
        session.user.id,
        "CONVERT",
        "Quote",
        quoteId,
        { reservationId }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function updateQuoteStatus(quoteId: string, status: QuoteStatus) {
    const session = await requireAuth();

    const quote = await prisma.quote.update({
        where: { id: quoteId },
        data: { status },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE_STATUS",
        "Quote",
        quoteId,
        { status }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function assignQuote(quoteId: string, userId: string) {
    const session = await requireAuth();

    const quote = await prisma.quote.update({
        where: { id: quoteId },
        data: { assignedToId: userId },
    });

    await createAuditLog(
        session.user.id,
        "ASSIGN",
        "Quote",
        quoteId,
        { assignedTo: userId }
    );

    revalidatePath("/dashboard");
    return quote;
}

export async function getQuoteStats() {
    await requireAuth();

    const [pending, followingUp, converted, lost] = await Promise.all([
        prisma.quote.count({ where: { status: "PENDING" } }),
        prisma.quote.count({ where: { status: "FOLLOWING_UP" } }),
        prisma.quote.count({ where: { status: "CONVERTED" } }),
        prisma.quote.count({ where: { status: "LOST" } }),
    ]);

    return { pending, followingUp, converted, lost };
}
