"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "./auth-helpers";
import { calendarUserIdSchema, calendarTokenSchema } from "./schemas";
import crypto from "crypto";

// Company timezone for display
const COMPANY_TIMEZONE = "America/Chicago";

/**
 * Format a Date to iCal date-time format (YYYYMMDDTHHMMSSZ)
 */
function formatICalDateTime(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Escape special characters for iCal text fields
 */
function escapeICalText(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n");
}

/**
 * Calculate shift duration from start/end hours
 */
function getShiftDuration(startHour: number, endHour: number): number {
    if (endHour > startHour) return endHour - startHour;
    return 24 - startHour + endHour; // Overnight shift
}

/**
 * Create a Date object from a date and hour (in Central Time)
 * Hours are integers 0-23 representing Central Time
 */
function createDateWithHour(date: Date, hour: number): Date {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    return d;
}

/**
 * Generate a unique calendar subscription token for a user
 * This token is used to authenticate calendar subscriptions without requiring login
 */
export async function generateCalendarToken(userId: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        await requireAuth();

        const parseResult = calendarUserIdSchema.safeParse({ userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID" };
        }

        const hash = crypto
            .createHmac("sha256", process.env.NEXTAUTH_SECRET || "calendar-secret")
            .update(userId)
            .digest("hex");

        return { success: true, data: hash.substring(0, 32) };
    } catch (error) {
        console.error("generateCalendarToken error:", error);
        return { success: false, error: "Failed to generate calendar token" };
    }
}

/**
 * Verify a calendar token and return the associated userId
 */
export async function verifyCalendarToken(token: string, userId: string): Promise<{ success: boolean; data?: boolean; error?: string }> {
    try {
        const parseResult = calendarTokenSchema.safeParse({ token, userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid token or user ID" };
        }

        const expectedToken = crypto
            .createHmac("sha256", process.env.NEXTAUTH_SECRET || "calendar-secret")
            .update(userId)
            .digest("hex")
            .substring(0, 32);

        return { success: true, data: token === expectedToken };
    } catch (error) {
        console.error("verifyCalendarToken error:", error);
        return { success: false, error: "Failed to verify calendar token" };
    }
}

/**
 * Generate an iCal feed for a user's published schedules
 */
export async function generateICalFeed(userId: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        const parseResult = calendarUserIdSchema.safeParse({ userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID" };
        }

        // Get user info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Get all future published schedules for this user
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const schedules = await prisma.schedule.findMany({
            where: {
                userId,
                isPublished: true,
                date: { gte: today }, // Include today and future shifts
            },
            orderBy: [{ date: "asc" }, { startHour: "asc" }],
        });

        // Build iCal content
        const lines: string[] = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Nebo Dispatch//Schedule//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            `X-WR-CALNAME:${escapeICalText(user.name || "Dispatch")} Schedule`,
            "X-WR-TIMEZONE:America/Chicago",
            // Timezone definition for America/Chicago
            "BEGIN:VTIMEZONE",
            "TZID:America/Chicago",
            "BEGIN:STANDARD",
            "DTSTART:20071104T020000",
            "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
            "TZOFFSETFROM:-0500",
            "TZOFFSETTO:-0600",
            "TZNAME:CST",
            "END:STANDARD",
            "BEGIN:DAYLIGHT",
            "DTSTART:20070311T020000",
            "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
            "TZOFFSETFROM:-0600",
            "TZOFFSETTO:-0500",
            "TZNAME:CDT",
            "END:DAYLIGHT",
            "END:VTIMEZONE",
        ];

        // Add each schedule as an event
        for (const schedule of schedules) {
            const startDate = createDateWithHour(schedule.date, schedule.startHour);
            // For overnight shifts, end date is next day
            const isOvernight = schedule.endHour <= schedule.startHour && schedule.endHour !== schedule.startHour;
            const endDate = isOvernight
                ? createDateWithHour(new Date(schedule.date.getTime() + 24 * 60 * 60 * 1000), schedule.endHour)
                : createDateWithHour(schedule.date, schedule.endHour);
            const duration = getShiftDuration(schedule.startHour, schedule.endHour);

            // Format dates for local timezone display
            const startStr = startDate.toLocaleString("en-US", { timeZone: COMPANY_TIMEZONE });

            lines.push(
                "BEGIN:VEVENT",
                `UID:${schedule.id}@nebodispatch.com`,
                `DTSTAMP:${formatICalDateTime(new Date())}`,
                `DTSTART:${formatICalDateTime(startDate)}`,
                `DTEND:${formatICalDateTime(endDate)}`,
                `SUMMARY:Dispatch Shift (${duration}h)`,
                `DESCRIPTION:${escapeICalText(`Nebo Dispatch shift starting at ${startStr}`)}`,
                "CATEGORIES:WORK,DISPATCH",
                "STATUS:CONFIRMED",
                "END:VEVENT"
            );
        }

        lines.push("END:VCALENDAR");

        return { success: true, data: lines.join("\r\n") };
    } catch (error) {
        console.error("generateICalFeed error:", error);
        return { success: false, error: "Failed to generate calendar feed" };
    }
}

/**
 * Get the calendar subscription URL for a user
 */
export async function getCalendarSubscriptionUrl(userId: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        const tokenResult = await generateCalendarToken(userId);
        if (!tokenResult.success || !tokenResult.data) {
            return { success: false, error: tokenResult.error || "Failed to generate token" };
        }

        // Build the webcal URL (webcal:// opens in calendar apps)
        const baseUrl = process.env.NEXTAUTH_URL || "https://nebo-dispatch.vercel.app";
        const url = new URL(`/api/calendar/${userId}`, baseUrl);
        url.searchParams.set("token", tokenResult.data);

        return { success: true, data: url.toString().replace(/^https?:\/\//, "webcal://") };
    } catch (error) {
        console.error("getCalendarSubscriptionUrl error:", error);
        return { success: false, error: "Failed to get calendar URL" };
    }
}

/**
 * Get the calendar download URL (for one-time .ics download)
 */
export async function getCalendarDownloadUrl(userId: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        const tokenResult = await generateCalendarToken(userId);
        if (!tokenResult.success || !tokenResult.data) {
            return { success: false, error: tokenResult.error || "Failed to generate token" };
        }

        const baseUrl = process.env.NEXTAUTH_URL || "https://nebo-dispatch.vercel.app";
        const url = new URL(`/api/calendar/${userId}`, baseUrl);
        url.searchParams.set("token", tokenResult.data);
        url.searchParams.set("download", "true");

        return { success: true, data: url.toString() };
    } catch (error) {
        console.error("getCalendarDownloadUrl error:", error);
        return { success: false, error: "Failed to get calendar download URL" };
    }
}
