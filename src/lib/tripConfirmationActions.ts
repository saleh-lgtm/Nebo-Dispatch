"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "./auditActions";
import { revalidatePath } from "next/cache";
import { ConfirmationStatus } from "@prisma/client";

/**
 * Get upcoming confirmations sorted by when call is due
 * Confirmation call should be made 2 hours before pickup (dueAt)
 * Returns next N pending trips, prioritizing those due soonest
 */
export async function getUpcomingConfirmations(limit: number = 6) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const now = new Date();

    const confirmations = await prisma.tripConfirmation.findMany({
        where: {
            status: "PENDING",
            archivedAt: null,
            pickupAt: {
                gte: now, // Don't show past pickups
            },
        },
        orderBy: {
            dueAt: "asc", // Calls due soonest first (2 hours before pickup)
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
 * Get detailed report of missed confirmations with accountability
 * Shows expired confirmations and which dispatchers were on duty
 */
export async function getMissedConfirmationReport(days: number = 30) {
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

    const missedConfirmations = await prisma.tripConfirmation.findMany({
        where: {
            status: "EXPIRED",
            archivedAt: { gte: startDate },
        },
        include: {
            accountableDispatchers: {
                include: {
                    dispatcher: { select: { id: true, name: true, role: true } },
                    shift: { select: { clockIn: true, clockOut: true } },
                },
            },
        },
        orderBy: { archivedAt: "desc" },
    });

    return missedConfirmations.map((conf) => ({
        id: conf.id,
        tripNumber: conf.tripNumber,
        passengerName: conf.passengerName,
        driverName: conf.driverName,
        dueAt: conf.dueAt,
        pickupAt: conf.pickupAt,
        expiredAt: conf.archivedAt,
        onDutyDispatchers: conf.accountableDispatchers.map((a) => ({
            id: a.dispatcher.id,
            name: a.dispatcher.name,
            role: a.dispatcher.role,
            shiftStart: a.shift.clockIn,
            shiftEnd: a.shift.clockOut,
        })),
    }));
}

/**
 * Get accountability metrics per dispatcher
 * Includes DISPATCHER and ADMIN roles, excludes SUPER_ADMIN
 */
export async function getDispatcherAccountabilityMetrics(days: number = 30) {
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

    // Get missed confirmation counts per dispatcher
    const accountabilityRecords =
        await prisma.missedConfirmationAccountability.groupBy({
            by: ["dispatcherId"],
            _count: { confirmationId: true },
            where: {
                createdAt: { gte: startDate },
                dispatcher: {
                    role: { in: ["DISPATCHER", "ADMIN"] },
                },
            },
        });

    // Get dispatcher info and their confirmation completions
    const dispatchers = await prisma.user.findMany({
        where: {
            role: { in: ["DISPATCHER", "ADMIN"] },
            isActive: true,
        },
        select: {
            id: true,
            name: true,
            role: true,
            shifts: {
                where: { clockIn: { gte: startDate } },
                select: { id: true },
            },
            confirmationsCompleted: {
                where: { completedAt: { gte: startDate } },
                select: { id: true, minutesBeforeDue: true },
            },
        },
    });

    return dispatchers
        .map((d) => {
            const missedCount =
                accountabilityRecords.find((a) => a.dispatcherId === d.id)
                    ?._count.confirmationId || 0;

            const completedCount = d.confirmationsCompleted.length;
            const onTimeCount = d.confirmationsCompleted.filter(
                (c) => c.minutesBeforeDue !== null && c.minutesBeforeDue > 0
            ).length;

            return {
                id: d.id,
                name: d.name || "Unknown",
                role: d.role,
                totalShifts: d.shifts.length,
                confirmationsCompleted: completedCount,
                confirmationsOnTime: onTimeCount,
                confirmationsMissedWhileOnDuty: missedCount,
                accountabilityRate:
                    completedCount + missedCount > 0
                        ? Math.round(
                              (completedCount / (completedCount + missedCount)) * 100
                          )
                        : 100,
            };
        })
        .sort(
            (a, b) =>
                b.confirmationsMissedWhileOnDuty - a.confirmationsMissedWhileOnDuty
        );
}

/**
 * Mark expired confirmations and record dispatcher accountability
 * This is called by a cron job or API route
 * Records which dispatchers were on duty when confirmations expired
 */
export async function markExpiredConfirmations() {
    const now = new Date();

    // Find confirmations that should be expired
    const toExpire = await prisma.tripConfirmation.findMany({
        where: {
            status: "PENDING",
            pickupAt: { lt: now },
            archivedAt: null,
        },
        select: {
            id: true,
            dueAt: true,
            pickupAt: true,
        },
    });

    if (toExpire.length === 0) {
        return { count: 0, accountabilityRecords: 0 };
    }

    let accountabilityRecords = 0;

    for (const confirmation of toExpire) {
        // Find all shifts that were active during the confirmation window
        // Window: from dueAt (2 hours before pickup) to pickupAt
        const activeShifts = await prisma.shift.findMany({
            where: {
                // Shift must have been active during the confirmation window
                clockIn: { lte: confirmation.pickupAt },
                OR: [
                    { clockOut: null }, // Still active
                    { clockOut: { gte: confirmation.dueAt } }, // Ended after due time
                ],
                // Only include DISPATCHER and ADMIN roles (exclude SUPER_ADMIN)
                user: {
                    role: { in: ["DISPATCHER", "ADMIN"] },
                    isActive: true,
                },
            },
            select: {
                id: true,
                userId: true,
                clockIn: true,
            },
        });

        // Create accountability records for each dispatcher on duty
        for (const shift of activeShifts) {
            try {
                await prisma.missedConfirmationAccountability.create({
                    data: {
                        confirmationId: confirmation.id,
                        dispatcherId: shift.userId,
                        shiftId: shift.id,
                        shiftStartedAt: shift.clockIn,
                        confirmationDueAt: confirmation.dueAt,
                        confirmationExpiredAt: now,
                    },
                });
                accountabilityRecords++;
            } catch {
                // Unique constraint violation - already recorded, skip
            }
        }

        // Update confirmation status to EXPIRED
        await prisma.tripConfirmation.update({
            where: { id: confirmation.id },
            data: {
                status: "EXPIRED",
                archivedAt: now,
            },
        });
    }

    return { count: toExpire.length, accountabilityRecords };
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
 * Check if a date falls within Daylight Saving Time for America/Chicago
 * DST starts 2nd Sunday of March, ends 1st Sunday of November
 */
function isDaylightSavingTime(date: Date): boolean {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // DST is roughly March through November
    if (month < 2 || month > 10) return false; // Jan, Feb, Dec = standard time
    if (month > 2 && month < 10) return true;  // Apr-Oct = DST

    // March: DST starts 2nd Sunday
    if (month === 2) {
        const marchFirst = new Date(year, 2, 1);
        const dayOfWeek = marchFirst.getDay();
        const secondSunday = 8 + (7 - dayOfWeek) % 7;
        return day >= secondSunday;
    }

    // November: DST ends 1st Sunday
    if (month === 10) {
        const novFirst = new Date(year, 10, 1);
        const dayOfWeek = novFirst.getDay();
        const firstSunday = 1 + (7 - dayOfWeek) % 7;
        return day < firstSunday;
    }

    return false;
}

/**
 * Parse manifest email and extract trips
 */
export async function parseManifestEmail(emailBody: string): Promise<Array<{
    tripNumber: string;
    pickupAt: Date;
    passengerName: string;
    driverName: string;
    accountName?: string;
}>> {
    const trips: Array<{
        tripNumber: string;
        pickupAt: Date;
        passengerName: string;
        driverName: string;
        accountName?: string;
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

        // Create date in CST/CDT (America/Chicago) timezone
        // Determine if date is in DST (roughly March-November)
        // DST: UTC-5, Standard: UTC-6
        const tempDate = new Date(year, month - 1, day);
        const isDST = isDaylightSavingTime(tempDate);
        const cstOffset = isDST ? 5 : 6; // hours to add to get UTC

        // Create UTC date by adding the CST offset
        const pickupAt = new Date(Date.UTC(year, month - 1, day, hours + cstOffset, minutes));

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

        // Extract account name - look for "Account" or "Account:" followed by account code
        let accountName: string | undefined;
        const accountMatch = section.match(/Account[:\s]+([A-Za-z0-9][\w-]*)/i);
        if (accountMatch) {
            accountName = accountMatch[1].trim();
        }

        trips.push({
            tripNumber,
            pickupAt,
            passengerName,
            driverName,
            accountName,
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
        accountName?: string;
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
                    accountName: trip.accountName,
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

    const count = await prisma.tripConfirmation.count({
        where: {
            status: "PENDING",
            archivedAt: null,
            pickupAt: {
                gte: now,
            },
        },
    });

    return count;
}
