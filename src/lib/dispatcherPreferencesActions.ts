"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { dispatcherPreferencesSchema, blackoutDateSchema, idParamSchema } from "./schemas";

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
export async function getMyPreferences(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const session = await requireAuth();

        const preferences = await prisma.dispatcherPreferences.findUnique({
            where: { userId: session.user.id },
        });

        return { success: true, data: preferences };
    } catch (error) {
        console.error("getMyPreferences error:", error);
        return { success: false, error: "Failed to get preferences" };
    }
}

/**
 * Get dispatcher preferences by user ID (admin only)
 */
export async function getDispatcherPreferences(userId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = idParamSchema.safeParse({ id: userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID" };
        }

        const preferences = await prisma.dispatcherPreferences.findUnique({
            where: { userId },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        return { success: true, data: preferences };
    } catch (error) {
        console.error("getDispatcherPreferences error:", error);
        return { success: false, error: "Failed to get dispatcher preferences" };
    }
}

/**
 * Get all dispatchers with their preferences (admin only)
 */
export async function getAllDispatcherPreferences(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
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

        return { success: true, data: dispatchers };
    } catch (error) {
        console.error("getAllDispatcherPreferences error:", error);
        return { success: false, error: "Failed to get all dispatcher preferences" };
    }
}

/**
 * Create or update the current user's dispatcher preferences
 */
export async function upsertMyPreferences(data: Partial<DispatcherPreferencesData>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const session = await requireAuth();

        // Validate input with Zod
        const parseResult = dispatcherPreferencesSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

        // Additional validation for hour constraints
        if (data.minHoursWeek && data.maxHoursWeek && data.minHoursWeek > data.maxHoursWeek) {
            return { success: false, error: "Minimum hours cannot exceed maximum hours" };
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

        return { success: true, data: preferences };
    } catch (error) {
        console.error("upsertMyPreferences error:", error);
        return { success: false, error: "Failed to update preferences" };
    }
}

/**
 * Update dispatcher preferences (admin only - for any dispatcher)
 */
export async function updateDispatcherPreferences(
    userId: string,
    data: Partial<DispatcherPreferencesData>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
        const session = await requireAdmin();

        // Validate userId
        const userIdResult = idParamSchema.safeParse({ id: userId });
        if (!userIdResult.success) {
            return { success: false, error: "Invalid user ID" };
        }

        // Validate data
        const dataResult = dispatcherPreferencesSchema.safeParse(data);
        if (!dataResult.success) {
            return { success: false, error: dataResult.error.issues[0]?.message || "Invalid input" };
        }

        // Verify target user exists and is a dispatcher
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });

        if (!targetUser) {
            return { success: false, error: "User not found" };
        }

        if (targetUser.role !== "DISPATCHER") {
            return { success: false, error: "Can only set preferences for dispatchers" };
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

        return { success: true, data: preferences };
    } catch (error) {
        console.error("updateDispatcherPreferences error:", error);
        return { success: false, error: "Failed to update dispatcher preferences" };
    }
}

/**
 * Delete dispatcher preferences
 */
export async function deleteMyPreferences(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
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
    } catch (error) {
        console.error("deleteMyPreferences error:", error);
        return { success: false, error: "Failed to delete preferences" };
    }
}

/**
 * Add a blackout date to preferences
 */
export async function addBlackoutDate(date: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const session = await requireAuth();

        // Validate date format with Zod
        const parseResult = blackoutDateSchema.safeParse({ date });
        if (!parseResult.success) {
            return { success: false, error: "Invalid date format. Use YYYY-MM-DD" };
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
    } catch (error) {
        console.error("addBlackoutDate error:", error);
        return { success: false, error: "Failed to add blackout date" };
    }
}

/**
 * Remove a blackout date from preferences
 */
export async function removeBlackoutDate(date: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const session = await requireAuth();

        // Validate date format with Zod
        const parseResult = blackoutDateSchema.safeParse({ date });
        if (!parseResult.success) {
            return { success: false, error: "Invalid date format. Use YYYY-MM-DD" };
        }

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
    } catch (error) {
        console.error("removeBlackoutDate error:", error);
        return { success: false, error: "Failed to remove blackout date" };
    }
}
