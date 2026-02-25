"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";
import { ConfirmationStatus } from "@prisma/client";

/**
 * Get upcoming confirmations due within the next 3 hours
 * Returns trips sorted by most urgent first
 */
export async function getUpcomingConfirmations(limit: number = 10) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const confirmations = await prisma.tripConfirmation.findMany({
        where: {
            status: "PENDING",
            archivedAt: null,
            dueAt: {
                lte: threeHoursLater,
            },
            pickupAt: {
                gte: now, // Don't show past pickups
            },
        },
        orderBy: {
            dueAt: "asc", // Most urgent first
        },
        take: limit,
        include: {
            completedBy: {
                select: { id: true, name: true },
            },
        },
    });

    return confirmations;
}

/**
 * Get all pending confirmations for today
 */
export async function getTodayConfirmations() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const confirmations = await prisma.tripConfirmation.findMany({
        where: {
            manifestDate: {
                gte: today,
                lt: tomorrow,
            },
            archivedAt: null,
        },
        orderBy: {
            dueAt: "asc",
        },
        include: {
            completedBy: {
                select: { id: true, name: true },
            },
        },
    });

    return confirmations;
}

/**
 * Complete a trip confirmation
 */
export async function completeConfirmation(
    confirmationId: string,
    status: ConfirmationStatus,
    notes?: string
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const confirmation = await prisma.tripConfirmation.findUnique({
        where: { id: confirmationId },
    });

    if (!confirmation) {
        throw new Error("Confirmation not found");
    }

    if (confirmation.status !== "PENDING") {
        throw new Error("Confirmation already completed");
    }

    const now = new Date();
    const minutesBeforeDue = Math.round(
        (confirmation.dueAt.getTime() - now.getTime()) / (1000 * 60)
    );

    const updated = await prisma.tripConfirmation.update({
        where: { id: confirmationId },
        data: {
            status,
            completedAt: now,
            completedById: session.user.id,
            minutesBeforeDue,
            notes: notes || null,
            archivedAt: now, // Archive immediately on completion
        },
        include: {
            completedBy: {
                select: { id: true, name: true },
            },
        },
    });

    // Create audit log
    await createAuditLog(
        session.user.id,
        "UPDATE",
        "TripConfirmation",
        confirmationId,
        {
            tripNumber: confirmation.tripNumber,
            status,
            minutesBeforeDue,
        }
    );

    revalidatePath("/dashboard");

    return updated;
}

/**
 * Get confirmation stats for a date range
 */
export async function getConfirmationStats(days: number = 30) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const confirmations = await prisma.tripConfirmation.findMany({
        where: {
            createdAt: { gte: startDate },
        },
        select: {
            id: true,
            status: true,
            completedAt: true,
            completedById: true,
            minutesBeforeDue: true,
            dueAt: true,
            pickupAt: true,
        },
    });

    const total = confirmations.length;
    const completed = confirmations.filter((c) => c.completedAt !== null).length;
    const pending = confirmations.filter((c) => c.status === "PENDING").length;
    const expired = confirmations.filter((c) => c.status === "EXPIRED").length;

    // On-time = completed before dueAt (minutesBeforeDue > 0)
    const onTime = confirmations.filter(
        (c) => c.minutesBeforeDue !== null && c.minutesBeforeDue > 0
    ).length;

    // Late = completed after dueAt but before pickup
    const late = confirmations.filter(
        (c) =>
            c.minutesBeforeDue !== null &&
            c.minutesBeforeDue <= 0 &&
            c.completedAt !== null &&
            c.completedAt < c.pickupAt
    ).length;

    // Average minutes before due (for completed ones)
    const completedWithTime = confirmations.filter(
        (c) => c.minutesBeforeDue !== null
    );
    const avgLeadTime =
        completedWithTime.length > 0
            ? completedWithTime.reduce((sum, c) => sum + (c.minutesBeforeDue || 0), 0) /
              completedWithTime.length
            : 0;

    // Status breakdown
    const byStatus: Record<string, number> = {};
    confirmations.forEach((c) => {
        byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });

    return {
        total,
        completed,
        pending,
        expired,
        onTime,
        late,
        avgLeadTime: Math.round(avgLeadTime),
        onTimeRate: total > 0 ? Math.round((onTime / total) * 100) : 0,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        byStatus,
    };
}

/**
 * Get dispatcher-specific confirmation metrics
 */
export async function getDispatcherConfirmationMetrics(
    userId?: string,
    days: number = 30
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    // Only admins can view other users' metrics
    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    const targetUserId = isAdmin && userId ? userId : session.user.id;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const confirmations = await prisma.tripConfirmation.findMany({
        where: {
            completedById: targetUserId,
            completedAt: { gte: startDate },
        },
        select: {
            status: true,
            minutesBeforeDue: true,
            completedAt: true,
            dueAt: true,
            pickupAt: true,
        },
    });

    const total = confirmations.length;
    const onTime = confirmations.filter(
        (c) => c.minutesBeforeDue !== null && c.minutesBeforeDue > 0
    ).length;
    const late = confirmations.filter(
        (c) =>
            c.minutesBeforeDue !== null &&
            c.minutesBeforeDue <= 0 &&
            c.completedAt !== null &&
            c.completedAt < c.pickupAt
    ).length;

    // Average lead time
    const withLeadTime = confirmations.filter((c) => c.minutesBeforeDue !== null);
    const avgLeadTime =
        withLeadTime.length > 0
            ? withLeadTime.reduce((sum, c) => sum + (c.minutesBeforeDue || 0), 0) /
              withLeadTime.length
            : 0;

    // Status breakdown
    const byStatus: Record<string, number> = {};
    confirmations.forEach((c) => {
        byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    });

    return {
        total,
        onTime,
        late,
        onTimeRate: total > 0 ? Math.round((onTime / total) * 100) : 0,
        avgLeadTimeMinutes: Math.round(avgLeadTime),
        byStatus,
    };
}

/**
 * Get all dispatchers' confirmation metrics for admin view
 */
export async function getAllDispatcherMetrics(days: number = 30) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );
    if (!isAdmin) {
        throw new Error("Admin access required");
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const confirmations = await prisma.tripConfirmation.findMany({
        where: {
            completedAt: { gte: startDate },
            completedById: { not: null },
        },
        select: {
            completedById: true,
            status: true,
            minutesBeforeDue: true,
            completedBy: {
                select: { id: true, name: true },
            },
        },
    });

    // Group by dispatcher
    const byDispatcher: Record<
        string,
        {
            id: string;
            name: string;
            total: number;
            onTime: number;
            late: number;
            byStatus: Record<string, number>;
        }
    > = {};

    confirmations.forEach((c) => {
        if (!c.completedById || !c.completedBy) return;

        if (!byDispatcher[c.completedById]) {
            byDispatcher[c.completedById] = {
                id: c.completedById,
                name: c.completedBy.name || "Unknown",
                total: 0,
                onTime: 0,
                late: 0,
                byStatus: {},
            };
        }

        const d = byDispatcher[c.completedById];
        d.total++;
        if (c.minutesBeforeDue !== null && c.minutesBeforeDue > 0) {
            d.onTime++;
        } else if (c.minutesBeforeDue !== null && c.minutesBeforeDue <= 0) {
            d.late++;
        }
        d.byStatus[c.status] = (d.byStatus[c.status] || 0) + 1;
    });

    return Object.values(byDispatcher)
        .map((d) => ({
            ...d,
            onTimeRate: d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Mark expired confirmations (run periodically via cron)
 * This is called by a cron job or API route
 */
export async function markExpiredConfirmations() {
    const now = new Date();

    const expired = await prisma.tripConfirmation.updateMany({
        where: {
            status: "PENDING",
            pickupAt: { lt: now }, // Pickup time has passed
            archivedAt: null,
        },
        data: {
            status: "EXPIRED",
            archivedAt: now,
        },
    });

    return expired.count;
}

/**
 * Strip HTML tags and convert to plain text
 */
function htmlToPlainText(html: string): string {
    // Replace <br> and </div> with newlines
    let text = html.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/div>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<\/tr>/gi, "\n");
    text = text.replace(/<\/td>/gi, " ");

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n[ \t]+/g, "\n");
    text = text.replace(/[ \t]+\n/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
}

/**
 * Parse manifest email and extract trips
 */
export async function parseManifestEmail(emailBody: string): Promise<Array<{
    tripNumber: string;
    pickupAt: Date;
    passengerName: string;
    driverName: string;
}>> {
    const trips: Array<{
        tripNumber: string;
        pickupAt: Date;
        passengerName: string;
        driverName: string;
    }> = [];

    // Convert HTML to plain text if needed
    let plainText = emailBody;
    if (emailBody.includes("<html") || emailBody.includes("<div") || emailBody.includes("<table")) {
        plainText = htmlToPlainText(emailBody);
    }

    // Split email into trip sections
    // Each trip starts with date pattern: MM/DD/YYYY - Pick Up At:HH:MM AM/PM
    const sections = plainText.split(/(?=\d{2}\/\d{2}\/\d{4}\s*-?\s*Pick Up At:)/gi);

    for (const section of sections) {
        if (!section.trim()) continue;

        // Extract date and time - handle various formats
        const dateTimeMatch = section.match(
            /(\d{2}\/\d{2}\/\d{4})\s*-?\s*Pick Up At:\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i
        );
        if (!dateTimeMatch) continue;

        const [fullMatch, dateStr, timeStr] = dateTimeMatch;

        // Extract trip number - appears after the datetime line
        // Skip the date part and look for a 4-6 digit number that's NOT part of a date
        const afterDateTime = section.substring(section.indexOf(fullMatch) + fullMatch.length);
        const tripNumberMatch = afterDateTime.match(/^\s*(?:\S+\s+)*?(\d{4,6})\b/);
        if (!tripNumberMatch) continue;

        const tripNumber = tripNumberMatch[1];

        // Skip if trip number looks like a year (2020-2030)
        const tripNumInt = parseInt(tripNumber, 10);
        if (tripNumInt >= 2020 && tripNumInt <= 2030) continue;

        // Parse date and time
        const [month, day, year] = dateStr.split("/").map(Number);
        const timeParts = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!timeParts) continue;

        let hours = parseInt(timeParts[1], 10);
        const minutes = parseInt(timeParts[2], 10);
        const period = timeParts[3].toUpperCase();

        if (period === "PM" && hours !== 12) {
            hours += 12;
        } else if (period === "AM" && hours === 12) {
            hours = 0;
        }

        const pickupAt = new Date(year, month - 1, day, hours, minutes);

        // Extract passenger name - look for "Passenger" section followed by a name
        let passengerName = "Unknown Passenger";
        const passengerMatch = section.match(/Passenger\s+([A-Za-z][A-Za-z\s]*[A-Za-z])/i);
        if (passengerMatch) {
            // Take only first two words (first + last name)
            const nameParts = passengerMatch[1].trim().split(/\s+/).slice(0, 3);
            passengerName = nameParts.join(" ");
        }

        // Extract driver name - look for "Driver Info" section
        let driverName = "Unknown Driver";
        const driverMatch = section.match(/Driver Info\s+([A-Za-z][A-Za-z0-9\s]*[A-Za-z0-9])/i);
        if (driverMatch) {
            // Take only first two words (first + last name)
            const nameParts = driverMatch[1].trim().split(/\s+/).slice(0, 3);
            driverName = nameParts.join(" ");
        }

        trips.push({
            tripNumber,
            pickupAt,
            passengerName,
            driverName,
        });
    }

    return trips;
}

/**
 * Ingest trips from parsed manifest
 * Called from the API endpoint
 */
export async function ingestManifestTrips(
    trips: Array<{
        tripNumber: string;
        pickupAt: Date;
        passengerName: string;
        driverName: string;
    }>,
    sourceEmail?: string,
    fromEmail?: string,
    subject?: string
) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let created = 0;
    let duplicate = 0;
    const errors: string[] = [];

    for (const trip of trips) {
        try {
            // Calculate dueAt (2 hours before pickup)
            const dueAt = new Date(trip.pickupAt.getTime() - 2 * 60 * 60 * 1000);

            // Skip if pickup is in the past
            if (trip.pickupAt < now) {
                continue;
            }

            // Check for duplicate
            const existing = await prisma.tripConfirmation.findFirst({
                where: {
                    tripNumber: trip.tripNumber,
                    manifestDate: today,
                },
            });

            if (existing) {
                duplicate++;
                continue;
            }

            // Create new confirmation
            await prisma.tripConfirmation.create({
                data: {
                    tripNumber: trip.tripNumber,
                    pickupAt: trip.pickupAt,
                    dueAt,
                    passengerName: trip.passengerName,
                    driverName: trip.driverName,
                    manifestDate: today,
                    sourceEmail: sourceEmail,
                },
            });

            created++;
        } catch (error) {
            errors.push(
                `Trip ${trip.tripNumber}: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }

    // Log the manifest ingestion
    await prisma.manifestLog.create({
        data: {
            fromEmail: fromEmail,
            subject: subject,
            tripsExtracted: trips.length,
            tripsCreated: created,
            tripsDuplicate: duplicate,
            rawContent: sourceEmail,
            parseErrors: errors.length > 0 ? errors.join("\n") : null,
        },
    });

    return {
        extracted: trips.length,
        created,
        duplicate,
        errors,
    };
}

/**
 * Get pending confirmation count for dashboard badge
 */
export async function getPendingConfirmationCount() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return 0;
    }

    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const count = await prisma.tripConfirmation.count({
        where: {
            status: "PENDING",
            archivedAt: null,
            dueAt: {
                lte: threeHoursLater,
            },
            pickupAt: {
                gte: now,
            },
        },
    });

    return count;
}
