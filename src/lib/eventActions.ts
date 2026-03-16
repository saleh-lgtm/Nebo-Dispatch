"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { createEventSchema, updateEventSchema } from "./schemas";
import { EventType } from "@prisma/client";
import { z } from "zod";

const idSchema = z.string().min(1, "ID is required");

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
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = createEventSchema.safeParse(data);
        if (!parseResult.success) {
            const errors = parseResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

        const validData = parseResult.data;

        const event = await prisma.event.create({
            data: {
                title: validData.title,
                description: validData.description,
                eventDate: validData.eventDate,
                endDate: validData.endDate,
                eventType: validData.eventType || "GENERAL",
                location: validData.location,
                notes: validData.notes,
                expectedVolume: validData.expectedVolume,
                staffingNotes: validData.staffingNotes,
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
            { title: validData.title, eventType: validData.eventType || "GENERAL" }
        );

        revalidatePath("/dashboard");
        return { success: true, data: event };
    } catch (error) {
        console.error("createEvent error:", error);
        return { success: false, error: "Failed to create event" };
    }
}

/**
 * Get upcoming events (all authenticated users)
 */
export async function getUpcomingEvents(limit: number = 10) {
    try {
        await requireAuth();

        const now = new Date();

        const events = await prisma.event.findMany({
            where: {
                eventDate: { gte: now },
            },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { eventDate: "asc" },
            take: limit,
        });

        return { success: true, data: events };
    } catch (error) {
        console.error("getUpcomingEvents error:", error);
        return { success: false, error: "Failed to get events", data: [] };
    }
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
    try {
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

        const events = await prisma.event.findMany({
            where,
            include: {
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { eventDate: "asc" },
            take: options?.limit,
        });

        return { success: true, data: events };
    } catch (error) {
        console.error("getAllEvents error:", error);
        return { success: false, error: "Failed to get events", data: [] };
    }
}

/**
 * Update an event (Admin only)
 */
export async function updateEvent(eventId: string, data: Partial<CreateEventData>) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const idResult = idSchema.safeParse(eventId);
        if (!idResult.success) {
            return { success: false, error: "Invalid event ID" };
        }

        // Validate data
        const dataResult = updateEventSchema.safeParse(data);
        if (!dataResult.success) {
            const errors = dataResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

        const event = await prisma.event.update({
            where: { id: eventId },
            data: {
                ...dataResult.data,
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
            dataResult.data as Record<string, unknown>
        );

        revalidatePath("/dashboard");
        return { success: true, data: event };
    } catch (error) {
        console.error("updateEvent error:", error);
        return { success: false, error: "Failed to update event" };
    }
}

/**
 * Delete an event (Admin only)
 */
export async function deleteEvent(eventId: string) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const idResult = idSchema.safeParse(eventId);
        if (!idResult.success) {
            return { success: false, error: "Invalid event ID" };
        }

        // Get event title for audit log
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { title: true },
        });

        if (!event) {
            return { success: false, error: "Event not found" };
        }

        await prisma.event.delete({
            where: { id: eventId },
        });

        await createAuditLog(
            session.user.id,
            "DELETE",
            "Event",
            eventId,
            { title: event.title }
        );

        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("deleteEvent error:", error);
        return { success: false, error: "Failed to delete event" };
    }
}
