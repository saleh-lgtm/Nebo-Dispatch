import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tbr/push-to-la
 *
 * Proxy endpoint to push TBR trips to LimoAnywhere via Zapier webhook.
 * This avoids CORS issues when calling Zapier directly from the browser.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const zapierUrl = process.env.ZAPIER_LA_WEBHOOK_URL || process.env.NEXT_PUBLIC_ZAPIER_LA_WEBHOOK_URL;

        if (!zapierUrl) {
            console.error("Zapier webhook URL not configured");
            return NextResponse.json(
                { error: "Zapier webhook not configured" },
                { status: 500 }
            );
        }

        console.log("Pushing to Zapier:", {
            url: zapierUrl,
            tbrTripId: body.tbrTripId,
            passenger: `${body.firstName} ${body.lastName}`,
        });

        // Forward request to Zapier
        const zapierResponse = await fetch(zapierUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!zapierResponse.ok) {
            const errorText = await zapierResponse.text();
            console.error("Zapier error:", errorText);
            return NextResponse.json(
                { error: `Zapier error: ${zapierResponse.statusText}`, details: errorText },
                { status: zapierResponse.status }
            );
        }

        // Try to parse Zapier response
        let zapierResult = {};
        try {
            zapierResult = await zapierResponse.json();
        } catch {
            // Zapier might return empty response - that's OK
        }

        console.log("Zapier response:", zapierResult);

        // Generate reservation ID if Zapier doesn't return one
        const reservationId =
            (zapierResult as Record<string, string>).reservationId ||
            (zapierResult as Record<string, string>).reservation_id ||
            (zapierResult as Record<string, string>).id ||
            `ZAP-${Date.now().toString().slice(-8)}`;

        const confirmationCode =
            (zapierResult as Record<string, string>).confirmationCode ||
            (zapierResult as Record<string, string>).confirmation_code ||
            `CONF-${body.tbrTripId || "TBR"}`;

        return NextResponse.json({
            success: true,
            reservationId,
            confirmationCode,
            zapierResponse: zapierResult,
        });
    } catch (error) {
        console.error("Push to LA error:", error);
        return NextResponse.json(
            {
                error: "Failed to push to LimoAnywhere",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
