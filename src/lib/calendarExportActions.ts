"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "./auth-helpers";
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
 * Generate a unique calendar subscription token for a user
 * This token is used to authenticate calendar subscriptions without requiring login
 */
export async function generateCalendarToken(userId: string): Promise<string> {
    await requireAuth();

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");

    // Store token in user record (you may need to add this field to the schema)
    // For now, we'll use a deterministic hash of userId + a secret
    // In production, store this in the database
    const hash = crypto
        .createHmac("sha256", process.env.NEXTAUTH_SECRET || "calendar-secret")
        .update(userId)
        .digest("hex");

    return hash.substring(0, 32);
}

/**
 * Verify a calendar token and return the associated userId
 */
export async function verifyCalendarToken(token: string, userId: string): Promise<boolean> {
    const expectedToken = crypto
        .createHmac("sha256", process.env.NEXTAUTH_SECRET || "calendar-secret")
        .update(userId)
        .digest("hex")
        .substring(0, 32);

    return token === expectedToken;
}

/**
 * Generate an iCal feed for a user's published schedules
 */
export async function generateICalFeed(userId: string): Promise<string> {
    // Get user info
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
    });

    if (!user) {
        throw new Error("User not found");
    }

    // Get all future published schedules for this user
    const now = new Date();
    const schedules = await prisma.schedule.findMany({
        where: {
            userId,
            isPublished: true,
            shiftEnd: { gte: now }, // Include currently active and future shifts
        },
        orderBy: { shiftStart: "asc" },
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
        const startDate = new Date(schedule.shiftStart);
        const endDate = new Date(schedule.shiftEnd);
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));

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

    return lines.join("\r\n");
}

/**
 * Get the calendar subscription URL for a user
 */
export async function getCalendarSubscriptionUrl(userId: string): Promise<string> {
    const token = await generateCalendarToken(userId);

    // Build the webcal URL (webcal:// opens in calendar apps)
    const baseUrl = process.env.NEXTAUTH_URL || "https://nebo-dispatch.vercel.app";
    const url = new URL(`/api/calendar/${userId}`, baseUrl);
    url.searchParams.set("token", token);

    return url.toString().replace(/^https?:\/\//, "webcal://");
}

/**
 * Get the calendar download URL (for one-time .ics download)
 */
export async function getCalendarDownloadUrl(userId: string): Promise<string> {
    const token = await generateCalendarToken(userId);

    const baseUrl = process.env.NEXTAUTH_URL || "https://nebo-dispatch.vercel.app";
    const url = new URL(`/api/calendar/${userId}`, baseUrl);
    url.searchParams.set("token", token);
    url.searchParams.set("download", "true");

    return url.toString();
}
