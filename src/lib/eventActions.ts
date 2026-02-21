"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { EventType } from "@prisma/client";

export interface CreateEventData {
    title: string;
    description?: string;
    eventDate: Date;
    endDate?: Date;
    eventType?: EventType;
    location?: string;
    notes?: string;
    expectedVolume?: string;
    staffingNotes?: string;
}

/**
 * Create a new event (Admin only)
 */
export async function createEvent(data: CreateEventData) {
    const session = await requireAdmin();

    const event = await prisma.event.create({
        data: {
            title: data.title,
            description: data.description,
            eventDate: data.eventDate,
            endDate: data.endDate,
            eventType: data.eventType || "GENERAL",
            location: data.location,
            notes: data.notes,
            expectedVolume: data.expectedVolume,
            staffingNotes: data.staffingNotes,
            createdById: session.user.id,
        },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "Event",
        event.id,
        { title: data.title, eventType: data.eventType || "GENERAL" }
    );

    revalidatePath("/dashboard");
    return event;
}

/**
 * Get upcoming events (all authenticated users)
 */
export async function getUpcomingEvents(limit: number = 10) {
    await requireAuth();

    const now = new Date();

    return prisma.event.findMany({
        where: {
            eventDate: { gte: now },
        },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: { eventDate: "asc" },
        take: limit,
    });
}

/**
 * Get all events with optional filters (all authenticated users)
 */
export async function getAllEvents(options?: {
    eventType?: EventType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}) {
    await requireAuth();

    const where: Record<string, unknown> = {};

    if (options?.eventType) {
        where.eventType = options.eventType;
    }

    if (options?.startDate || options?.endDate) {
        where.eventDate = {};
        if (options?.startDate) {
            (where.eventDate as Record<string, Date>).gte = options.startDate;
        }
        if (options?.endDate) {
            (where.eventDate as Record<string, Date>).lte = options.endDate;
        }
    }

    return prisma.event.findMany({
        where,
        include: {
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: { eventDate: "asc" },
        take: options?.limit,
    });
}

/**
 * Update an event (Admin only)
 */
export async function updateEvent(eventId: string, data: Partial<CreateEventData>) {
    const session = await requireAdmin();

    const event = await prisma.event.update({
        where: { id: eventId },
        data: {
            ...data,
            updatedAt: new Date(),
        },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "Event",
        eventId,
        data as Record<string, unknown>
    );

    revalidatePath("/dashboard");
    return event;
}

/**
 * Delete an event (Admin only)
 */
export async function deleteEvent(eventId: string) {
    const session = await requireAdmin();

    // Get event title for audit log
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true },
    });

    await prisma.event.delete({
        where: { id: eventId },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "Event",
        eventId,
        { title: event?.title }
    );

    revalidatePath("/dashboard");
    return { success: true };
}
