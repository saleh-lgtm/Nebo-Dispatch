import { NextRequest, NextResponse } from "next/server";
import { getTbrDashboardStats, getTbrSyncLogs } from "@/lib/tbrTripActions";

/**
 * POST /api/tbr/sync
 *
 * Manual sync trigger endpoint.
 * In production, this would trigger the n8n workflow.
 * For now, it just returns the current status and can be used
 * to trigger a webhook to n8n if configured.
 *
 * Authentication: CRON_SECRET (same as other cron endpoints)
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
        // Get current stats
        const stats = await getTbrDashboardStats();

        // Get recent sync logs
        const recentLogs = await getTbrSyncLogs(5);

        // If N8N_TBR_SYNC_WEBHOOK_URL is configured, trigger the n8n workflow
        const n8nWebhookUrl = process.env.N8N_TBR_SYNC_WEBHOOK_URL;
        let n8nTriggered = false;
        let n8nError = null;

        if (n8nWebhookUrl) {
            try {
                const response = await fetch(n8nWebhookUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        trigger: "manual",
                        timestamp: new Date().toISOString(),
                    }),
                });

                n8nTriggered = response.ok;
                if (!response.ok) {
                    n8nError = `n8n returned ${response.status}`;
                }
            } catch (error) {
                n8nError = error instanceof Error ? error.message : "Failed to trigger n8n";
            }
        }

        return NextResponse.json({
            success: true,
            message: n8nTriggered
                ? "Sync triggered successfully"
                : "Status retrieved (n8n webhook not configured)",
            stats,
            recentLogs,
            n8nTriggered,
            n8nError,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("TBR sync error:", error);
        return NextResponse.json(
            {
                error: "Failed to process sync",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/tbr/sync
 *
 * Get current sync status and stats.
 * Available in development for testing.
 */
export async function GET(request: NextRequest) {
    // Verify cron secret for production
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const isDev = process.env.NODE_ENV === "development";

    if (cronSecret && !isDev) {
        const isValidAuth = authHeader === `Bearer ${cronSecret}`;
        const isValidHeader = request.headers.get("x-cron-secret") === cronSecret;

        if (!isValidAuth && !isValidHeader) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
    }

    try {
        const stats = await getTbrDashboardStats();
        const recentLogs = await getTbrSyncLogs(10);

        return NextResponse.json({
            status: "ok",
            stats,
            recentLogs,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("TBR sync status error:", error);
        return NextResponse.json(
            {
                error: "Failed to get sync status",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
