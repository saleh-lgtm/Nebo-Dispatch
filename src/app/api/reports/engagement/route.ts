import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getEngagementReport,
    getDailyEngagementTrend,
    getDispatcherEngagement,
} from "@/lib/engagementActions";

/**
 * GET /api/reports/engagement
 *
 * Get dispatcher engagement metrics. Requires admin role.
 *
 * Query Parameters:
 * - days: Number of days to analyze (default: 7)
 * - type: "full" | "trend" | "dispatcher" (default: "trend")
 * - userId: Required when type="dispatcher"
 */
export async function GET(request: NextRequest) {
    // Verify authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check admin role
    const isAdmin =
        session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    if (!isAdmin) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get("days") || "7", 10);
        const type = searchParams.get("type") || "trend";
        const userId = searchParams.get("userId");

        // Validate days parameter
        if (isNaN(days) || days < 1 || days > 90) {
            return NextResponse.json(
                { error: "Days must be between 1 and 90" },
                { status: 400 }
            );
        }

        let data;

        switch (type) {
            case "full":
                // Full engagement report with all details
                data = await getEngagementReport(days);
                break;

            case "dispatcher":
                // Single dispatcher engagement
                if (!userId) {
                    return NextResponse.json(
                        { error: "userId is required for dispatcher type" },
                        { status: 400 }
                    );
                }
                data = await getDispatcherEngagement(userId, days);
                break;

            case "trend":
            default:
                // Daily trend data for charts
                data = await getDailyEngagementTrend(days);
                break;
        }

        return NextResponse.json({
            success: true,
            data,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Failed to fetch engagement data:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch engagement data",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
