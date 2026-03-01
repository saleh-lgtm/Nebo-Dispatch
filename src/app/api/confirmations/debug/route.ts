import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Debug endpoint to check TripConfirmation table status
 * Only accessible by SUPER_ADMIN
 */
export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    try {
        // Get counts
        const [
            totalCount,
            pendingCount,
            notArchivedCount,
            futurePickupsCount,
            pendingFutureNotArchived,
            recentConfirmations,
            manifestLogs,
        ] = await Promise.all([
            prisma.tripConfirmation.count(),
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
                take: 5,
                orderBy: { createdAt: "desc" },
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
                take: 5,
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
