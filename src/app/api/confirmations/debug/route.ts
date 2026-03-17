import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ConfirmationStatus } from "@prisma/client";

const confirmationStatuses = Object.values(ConfirmationStatus) as [string, ...string[]];

const querySchema = z.object({
    take: z.coerce.number().int().min(1).max(50).optional().default(5),
    status: z.enum(confirmationStatuses).optional(),
});

/**
 * Debug endpoint to check TripConfirmation table status
 * Only accessible by SUPER_ADMIN
 *
 * Query params:
 *   take — number of recent records to return (1–50, default 5)
 *   status — filter by confirmation status
 */
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid query parameters", details: parsed.error.flatten().fieldErrors },
            { status: 400 }
        );
    }

    const { take, status } = parsed.data;
    const now = new Date();

    try {
        const statusFilter = status ? { status: status as ConfirmationStatus } : {};

        const [
            totalCount,
            pendingCount,
            notArchivedCount,
            futurePickupsCount,
            pendingFutureNotArchived,
            recentConfirmations,
            manifestLogs,
        ] = await Promise.all([
            prisma.tripConfirmation.count({ where: statusFilter }),
            prisma.tripConfirmation.count({ where: { status: "PENDING" } }),
            prisma.tripConfirmation.count({ where: { archivedAt: null } }),
            prisma.tripConfirmation.count({ where: { pickupAt: { gte: now } } }),
            prisma.tripConfirmation.count({
                where: {
                    status: "PENDING",
                    archivedAt: null,
                    pickupAt: { gte: now },
                },
            }),
            prisma.tripConfirmation.findMany({
                take,
                orderBy: { createdAt: "desc" },
                where: statusFilter,
                select: {
                    id: true,
                    tripNumber: true,
                    status: true,
                    pickupAt: true,
                    dueAt: true,
                    archivedAt: true,
                    createdAt: true,
                    passengerName: true,
                },
            }),
            prisma.manifestLog.findMany({
                take,
                orderBy: { receivedAt: "desc" },
                select: {
                    id: true,
                    fromEmail: true,
                    subject: true,
                    tripsExtracted: true,
                    tripsCreated: true,
                    tripsDuplicate: true,
                    receivedAt: true,
                },
            }),
        ]);

        return NextResponse.json({
            currentTime: now.toISOString(),
            counts: {
                total: totalCount,
                pending: pendingCount,
                notArchived: notArchivedCount,
                futurePickups: futurePickupsCount,
                pendingFutureNotArchived,
            },
            explanation: {
                dashboardShows: "status=PENDING AND archivedAt=null AND pickupAt >= now",
                count: pendingFutureNotArchived,
            },
            recentConfirmations,
            recentManifestLogs: manifestLogs,
        });
    } catch (error) {
        console.error("Debug query error:", error);
        return NextResponse.json(
            { error: "Database query failed", details: String(error) },
            { status: 500 }
        );
    }
}
