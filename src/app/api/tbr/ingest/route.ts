import { NextRequest, NextResponse } from "next/server";
import { processTbrIngest, type IngestedTbrTrip } from "@/lib/domains/tbr";
import { sendSMS } from "@/lib/twilioActions";

// Simple in-memory rate limiter
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimiter.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimiter.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
        return true;
    }

    if (entry.count >= RATE_LIMIT) {
        return false;
    }

    entry.count++;
    return true;
}

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimiter.entries()) {
        if (now > entry.resetAt) {
            rateLimiter.delete(ip);
        }
    }
}, 5 * 60 * 1000); // Every 5 minutes

/**
 * POST /api/tbr/ingest
 *
 * Endpoint for n8n scraper to send scraped TBR trips.
 *
 * Authentication:
 * - Header: x-tbr-ingest-secret matching TBR_INGEST_SECRET env var
 * - OR Basic Auth with username "tbr" and password matching TBR_INGEST_SECRET
 *
 * Request Body:
 * {
 *   trips: IngestedTbrTrip[],
 *   source?: string  // "n8n-scraper", "manual", etc.
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   created: number,
 *   updated: number,
 *   unchanged: number,
 *   statusChanges: StatusChange[],
 *   errors: string[]
 * }
 */
export async function POST(request: NextRequest) {
    // Rate limiting by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ||
               request.headers.get("x-real-ip") ||
               "unknown";

    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { error: "Rate limit exceeded. Try again later." },
            { status: 429 }
        );
    }

    // Authentication
    const ingestSecret = process.env.TBR_INGEST_SECRET;

    if (!ingestSecret) {
        console.error("TBR_INGEST_SECRET not configured");
        return NextResponse.json(
            { error: "Server configuration error" },
            { status: 500 }
        );
    }

    // Check for header auth
    const headerSecret = request.headers.get("x-tbr-ingest-secret");

    // Check for Basic Auth
    const authHeader = request.headers.get("authorization");
    let basicAuthValid = false;
    if (authHeader?.startsWith("Basic ")) {
        try {
            const base64Credentials = authHeader.slice(6);
            const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
            const [username, password] = credentials.split(":");
            basicAuthValid = username === "tbr" && password === ingestSecret;
        } catch {
            // Invalid base64
        }
    }

    // Validate authentication
    if (headerSecret !== ingestSecret && !basicAuthValid) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();

        // Validate request body
        if (!body.trips || !Array.isArray(body.trips)) {
            return NextResponse.json(
                { error: "Invalid request: trips array required" },
                { status: 400 }
            );
        }

        // Validate each trip has required fields
        const trips: IngestedTbrTrip[] = [];
        const validationErrors: string[] = [];

        for (let i = 0; i < body.trips.length; i++) {
            const trip = body.trips[i];

            if (!trip.tbrTripId) {
                validationErrors.push(`Trip ${i}: missing tbrTripId`);
                continue;
            }
            if (!trip.passengerName) {
                validationErrors.push(`Trip ${i} (${trip.tbrTripId}): missing passengerName`);
                continue;
            }
            if (!trip.pickupDatetime) {
                validationErrors.push(`Trip ${i} (${trip.tbrTripId}): missing pickupDatetime`);
                continue;
            }
            if (!trip.pickupAddress) {
                validationErrors.push(`Trip ${i} (${trip.tbrTripId}): missing pickupAddress`);
                continue;
            }
            if (!trip.dropoffAddress) {
                validationErrors.push(`Trip ${i} (${trip.tbrTripId}): missing dropoffAddress`);
                continue;
            }

            trips.push({
                tbrTripId: trip.tbrTripId,
                status: trip.status || "Pending",
                passengerName: trip.passengerName,
                passengerPhone: trip.passengerPhone,
                passengerEmail: trip.passengerEmail,
                passengerCount: trip.passengerCount || 1,
                pickupDatetime: trip.pickupDatetime,
                pickupAddress: trip.pickupAddress,
                dropoffAddress: trip.dropoffAddress,
                vehicleType: trip.vehicleType,
                flightNumber: trip.flightNumber,
                notes: trip.notes || trip.specialNotes,
                fareAmount: trip.fareAmount,
            });
        }

        if (trips.length === 0) {
            return NextResponse.json(
                {
                    error: "No valid trips to process",
                    validationErrors,
                },
                { status: 400 }
            );
        }

        // Process the trips
        const source = body.source || "n8n-scraper";
        const result = await processTbrIngest(trips, source);

        // Send SMS alerts for status changes on pushed trips
        const alertsToSend = result.statusChanges.filter((c) => c.isPushedToLa);
        const dispatchPhone = process.env.TWILIO_TO; // Dispatch phone number

        for (const change of alertsToSend) {
            if (dispatchPhone) {
                try {
                    const message = `⚠️ TBR Trip ${change.tbrTripId} Status Changed\n` +
                        `Passenger: ${change.passengerName}\n` +
                        `Date: ${new Date(change.pickupDatetime).toLocaleString()}\n` +
                        `${change.oldStatus} → ${change.newStatus}\n` +
                        `LA Res: ${change.laReservationId || "N/A"}\n` +
                        `Action Required: Update in LimoAnywhere`;

                    await sendSMS(dispatchPhone, message);
                } catch (smsError) {
                    console.error("Failed to send SMS alert:", smsError);
                }
            }
        }

        return NextResponse.json({
            success: true,
            created: result.created,
            updated: result.updated,
            unchanged: result.unchanged,
            statusChanges: result.statusChanges.length,
            alertsSent: alertsToSend.length,
            errors: [...validationErrors, ...result.errors],
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("TBR ingest error:", error);
        return NextResponse.json(
            {
                error: "Failed to process trips",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/tbr/ingest
 *
 * Health check endpoint (development only)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
    const isDev = process.env.NODE_ENV === "development";

    if (!isDev) {
        return NextResponse.json(
            { error: "GET only available in development" },
            { status: 405 }
        );
    }

    return NextResponse.json({
        status: "ok",
        endpoint: "/api/tbr/ingest",
        method: "POST",
        auth: "x-tbr-ingest-secret header or Basic Auth (tbr:secret)",
        body: {
            trips: "IngestedTbrTrip[]",
            source: "string (optional)",
        },
    });
}
