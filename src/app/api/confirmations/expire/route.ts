import { NextRequest, NextResponse } from "next/server";
import { markExpiredConfirmations } from "@/lib/tripConfirmationActions";

/**
 * POST /api/confirmations/expire
 *
 * Cron endpoint to mark expired confirmations and record dispatcher accountability.
 * Should be called every 5 minutes via Vercel Cron, external service, or scheduled task.
 *
 * Authentication: Bearer token matching CRON_SECRET environment variable
 */
export async function POST(request: NextRequest) {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    // Check for valid authorization
    if (cronSecret) {
        const isValidAuth = authHeader === `Bearer ${cronSecret}`;
        const isValidHeader = request.headers.get("x-cron-secret") === cronSecret;

        if (!isValidAuth && !isValidHeader) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
    } else {
        // If no CRON_SECRET is set, only allow localhost in development
        const host = request.headers.get("host") || "";
        const isDev = process.env.NODE_ENV === "development";

        if (!isDev || !host.includes("localhost")) {
            return NextResponse.json(
                { error: "CRON_SECRET not configured" },
                { status: 500 }
            );
        }
    }

    try {
        const result = await markExpiredConfirmations();
        if (!result.success) {
            return NextResponse.json(
                { error: result.error ?? "Failed to process expirations" },
                { status: 500 }
            );
        }
        const data = result.data ?? { count: 0, accountabilityRecords: 0 };

        return NextResponse.json({
            success: true,
            message: `Processed ${data.count} expired confirmations`,
            expired: data.count,
            accountabilityRecords: data.accountabilityRecords,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Failed to mark expired confirmations:", error);
        return NextResponse.json(
            {
                error: "Failed to process expirations",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// GET endpoint for health check / manual trigger in development
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
    const isDev = process.env.NODE_ENV === "development";

    if (!isDev) {
        return NextResponse.json(
            { error: "GET only available in development" },
            { status: 405 }
        );
    }

    // In development, allow GET for easy testing
    try {
        const result = await markExpiredConfirmations();
        if (!result.success) {
            return NextResponse.json(
                { error: result.error ?? "Failed to process expirations" },
                { status: 500 }
            );
        }
        const data = result.data ?? { count: 0, accountabilityRecords: 0 };

        return NextResponse.json({
            success: true,
            message: `Processed ${data.count} expired confirmations`,
            expired: data.count,
            accountabilityRecords: data.accountabilityRecords,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Failed to mark expired confirmations:", error);
        return NextResponse.json(
            {
                error: "Failed to process expirations",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
