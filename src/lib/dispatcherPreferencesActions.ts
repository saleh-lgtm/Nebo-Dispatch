"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Types for dispatcher preferences
export interface DispatcherPreferencesData {
    preferredDays: string[];
    preferredShifts: string[];
    maxHoursWeek: number | null;
    minHoursWeek: number | null;
    notes: string | null;
    blackoutDates: string[];
}

// Valid day and shift options
export const VALID_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const VALID_SHIFTS = ["Morning", "Evening", "Night", "Overnight"];

/**
 * Get the current user's dispatcher preferences
 */
export async function getMyPreferences() {
    const session = await requireAuth();

    const preferences = await prisma.dispatcherPreferences.findUnique({
        where: { userId: session.user.id },
    });

    return preferences;
}

/**
 * Get dispatcher preferences by user ID (admin only)
 */
export async function getDispatcherPreferences(userId: string) {
    await requireAdmin();

    const preferences = await prisma.dispatcherPreferences.findUnique({
        where: { userId },
        include: {
            user: {
                select: { id: true, name: true, email: true },
            },
        },
    });

    return preferences;
}

/**
 * Get all dispatchers with their preferences (admin only)
 */
export async function getAllDispatcherPreferences() {
    await requireAdmin();

    const dispatchers = await prisma.user.findMany({
        where: { role: "DISPATCHER", isActive: true },
        select: {
            id: true,
            name: true,
            email: true,
            dispatcherPreferences: true,
        },
        orderBy: { name: "asc" },
    });

    return dispatchers;
}

/**
 * Create or update the current user's dispatcher preferences
 */
export async function upsertMyPreferences(data: Partial<DispatcherPreferencesData>) {
    const session = await requireAuth();

    // Validate days
    if (data.preferredDays) {
        const invalidDays = data.preferredDays.filter(d => !VALID_DAYS.includes(d));
        if (invalidDays.length > 0) {
            throw new Error(`Invalid days: ${invalidDays.join(", ")}`);
        }
    }

    // Validate shifts
    if (data.preferredShifts) {
        const invalidShifts = data.preferredShifts.filter(s => !VALID_SHIFTS.includes(s));
        if (invalidShifts.length > 0) {
            throw new Error(`Invalid shifts: ${invalidShifts.join(", ")}`);
        }
    }

    // Validate hour constraints
    if (data.minHoursWeek !== undefined && data.minHoursWeek !== null) {
        if (data.minHoursWeek < 0 || data.minHoursWeek > 168) {
            throw new Error("Minimum hours must be between 0 and 168");
        }
    }

    if (data.maxHoursWeek !== undefined && data.maxHoursWeek !== null) {
        if (data.maxHoursWeek < 0 || data.maxHoursWeek > 168) {
            throw new Error("Maximum hours must be between 0 and 168");
        }
    }

    if (data.minHoursWeek && data.maxHoursWeek && data.minHoursWeek > data.maxHoursWeek) {
        throw new Error("Minimum hours cannot exceed maximum hours");
    }

    const preferences = await prisma.dispatcherPreferences.upsert({
        where: { userId: session.user.id },
        create: {
            userId: session.user.id,
            preferredDays: data.preferredDays || [],
            preferredShifts: data.preferredShifts || [],
            maxHoursWeek: data.maxHoursWeek ?? null,
            minHoursWeek: data.minHoursWeek ?? null,
            notes: data.notes ?? null,
            blackoutDates: data.blackoutDates || [],
        },
        update: {
            preferredDays: data.preferredDays,
            preferredShifts: data.preferredShifts,
            maxHoursWeek: data.maxHoursWeek,
            minHoursWeek: data.minHoursWeek,
            notes: data.notes,
            blackoutDates: data.blackoutDates,
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "DispatcherPreferences",
        preferences.id,
        data
    );

    revalidatePath("/schedule");

    return { success: true, preferences };
}

/**
 * Update dispatcher preferences (admin only - for any dispatcher)
 */
export async function updateDispatcherPreferences(
    userId: string,
    data: Partial<DispatcherPreferencesData>
) {
    const session = await requireAdmin();

    // Verify target user exists and is a dispatcher
    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
    });

    if (!targetUser) {
        throw new Error("User not found");
    }

    if (targetUser.role !== "DISPATCHER") {
        throw new Error("Can only set preferences for dispatchers");
    }

    const preferences = await prisma.dispatcherPreferences.upsert({
        where: { userId },
        create: {
            userId,
            preferredDays: data.preferredDays || [],
            preferredShifts: data.preferredShifts || [],
            maxHoursWeek: data.maxHoursWeek ?? null,
            minHoursWeek: data.minHoursWeek ?? null,
            notes: data.notes ?? null,
            blackoutDates: data.blackoutDates || [],
        },
        update: {
            preferredDays: data.preferredDays,
            preferredShifts: data.preferredShifts,
            maxHoursWeek: data.maxHoursWeek,
            minHoursWeek: data.minHoursWeek,
            notes: data.notes,
            blackoutDates: data.blackoutDates,
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "DispatcherPreferences",
        preferences.id,
        { targetUserId: userId, ...data }
    );

    revalidatePath("/schedule");
    revalidatePath("/admin/scheduler");

    return { success: true, preferences };
}

/**
 * Delete dispatcher preferences
 */
export async function deleteMyPreferences() {
    const session = await requireAuth();

    const existing = await prisma.dispatcherPreferences.findUnique({
        where: { userId: session.user.id },
    });

    if (!existing) {
        return { success: true, message: "No preferences to delete" };
    }

    await prisma.dispatcherPreferences.delete({
        where: { userId: session.user.id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "DispatcherPreferences",
        existing.id
    );

    revalidatePath("/schedule");

    return { success: true };
}

/**
 * Add a blackout date to preferences
 */
export async function addBlackoutDate(date: string) {
    const session = await requireAuth();

    // Validate date format (ISO date string)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }

    const preferences = await prisma.dispatcherPreferences.findUnique({
        where: { userId: session.user.id },
    });

    const currentDates = preferences?.blackoutDates || [];

    if (currentDates.includes(date)) {
        return { success: true, message: "Date already in blackout list" };
    }

    const updatedDates = [...currentDates, date].sort();

    await prisma.dispatcherPreferences.upsert({
        where: { userId: session.user.id },
        create: {
            userId: session.user.id,
            blackoutDates: updatedDates,
        },
        update: {
            blackoutDates: updatedDates,
        },
    });

    revalidatePath("/schedule");

    return { success: true };
}

/**
 * Remove a blackout date from preferences
 */
export async function removeBlackoutDate(date: string) {
    const session = await requireAuth();

    const preferences = await prisma.dispatcherPreferences.findUnique({
        where: { userId: session.user.id },
    });

    if (!preferences) {
        return { success: true, message: "No preferences found" };
    }

    const updatedDates = preferences.blackoutDates.filter(d => d !== date);

    await prisma.dispatcherPreferences.update({
        where: { userId: session.user.id },
        data: { blackoutDates: updatedDates },
    });

    revalidatePath("/schedule");

    return { success: true };
}
