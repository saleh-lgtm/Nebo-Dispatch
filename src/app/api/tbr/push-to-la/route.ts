import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { geocodeTripAddresses } from "@/lib/geocoding";

/**
 * Zod schema for push-to-la request body
 */
const pushToLaSchema = z.object({
    tbrTripId: z.string().min(1, "tbrTripId is required"),
    neboTripId: z.string().optional(),
    firstName: z.string().min(1, "firstName is required"),
    lastName: z.string().min(1, "lastName is required"),
    passengerPhone: z.string().optional(),
    passengerEmail: z.string().email().optional().or(z.literal("")),
    pickupDatetime: z.string().min(1, "pickupDatetime is required"),
    pickupAddress: z.string().min(1, "pickupAddress is required"),
    dropoffAddress: z.string().min(1, "dropoffAddress is required"),
    vehicleType: z.string().optional(),
    passengerCount: z.number().int().positive().optional().default(1),
    flightNumber: z.string().optional(),
    specialNotes: z.string().optional(),
    fareAmount: z.union([z.string(), z.number()]).optional(),
});

type PushToLaInput = z.infer<typeof pushToLaSchema>;

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 */
function formatPhoneE164(phone: string | null | undefined): string {
    if (!phone) return "";

    const digits = phone.replace(/\D/g, "");

    if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
    }
    if (digits.length === 10) {
        return `+1${digits}`;
    }
    if (phone.startsWith("+")) {
        return `+${digits}`;
    }
    return digits.length > 0 ? `+${digits}` : "";
}

/**
 * POST /api/tbr/push-to-la
 *
 * Push TBR trips to Google Sheet via Apps Script
 *
 * Authentication (any one of):
 * 1. NextAuth session cookie (for browser calls from logged-in users)
 * 2. Header: x-tbr-ingest-secret matching TBR_INGEST_SECRET env var
 * 3. Basic Auth with username "tbr" and password matching TBR_INGEST_SECRET
 */
export async function POST(request: NextRequest) {
    // 1. Session-based auth (browser calls from logged-in users)
    const session = await getServerSession(authOptions);
    const sessionValid = !!session?.user;

    // 2 & 3. Secret-based auth (external/automated callers)
    let secretValid = false;
    const ingestSecret = process.env.TBR_INGEST_SECRET;

    if (ingestSecret) {
        // Check for header auth
        const headerSecret = request.headers.get("x-tbr-ingest-secret");
        if (headerSecret === ingestSecret) {
            secretValid = true;
        }

        // Check for Basic Auth
        const authHeader = request.headers.get("authorization");
        if (!secretValid && authHeader?.startsWith("Basic ")) {
            try {
                const base64Credentials = authHeader.slice(6);
                const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
                const [username, password] = credentials.split(":");
                secretValid = username === "tbr" && password === ingestSecret;
            } catch {
                // Invalid base64
            }
        }
    }

    // Validate authentication — must pass at least one method
    if (!sessionValid && !secretValid) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const rawBody = await request.json();

        // Validate request body with Zod
        const parseResult = pushToLaSchema.safeParse(rawBody);
        if (!parseResult.success) {
            return NextResponse.json(
                {
                    error: "Invalid request body",
                    details: parseResult.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const body: PushToLaInput = parseResult.data;

        // Format phone number to E.164
        const formattedPhone = formatPhoneE164(body.passengerPhone);

        // Check if trip exists and hasn't been pushed already
        if (body.neboTripId) {
            const existingTrip = await prisma.tbrTrip.findUnique({
                where: { id: body.neboTripId },
                select: {
                    id: true,
                    laSyncStatus: true,
                    laReservationId: true,
                    laConfirmation: true,
                },
            });

            if (!existingTrip) {
                return NextResponse.json(
                    { error: "Trip not found" },
                    { status: 404 }
                );
            }

            // Prevent duplicate pushes
            if (existingTrip.laSyncStatus === "PUSHED" && existingTrip.laReservationId) {
                return NextResponse.json(
                    {
                        error: "Trip already pushed to LimoAnywhere",
                        reservationId: existingTrip.laReservationId,
                        confirmationCode: existingTrip.laConfirmation,
                    },
                    { status: 409 }
                );
            }
        }

        // Geocode addresses
        let pickupLatitude: number | null = null;
        let pickupLongitude: number | null = null;
        let dropoffLatitude: number | null = null;
        let dropoffLongitude: number | null = null;

        if (body.pickupAddress || body.dropoffAddress) {
            console.log("Geocoding addresses...");
            const geocoded = await geocodeTripAddresses(
                body.pickupAddress || "",
                body.dropoffAddress || ""
            );

            if (geocoded.pickup) {
                pickupLatitude = geocoded.pickup.latitude;
                pickupLongitude = geocoded.pickup.longitude;
            }
            if (geocoded.dropoff) {
                dropoffLatitude = geocoded.dropoff.latitude;
                dropoffLongitude = geocoded.dropoff.longitude;
            }

            // Store geocoded coordinates in database
            if (body.neboTripId) {
                await prisma.tbrTrip.update({
                    where: { id: body.neboTripId },
                    data: { pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude },
                });
            }
        }

        // Use Google Apps Script to add to sheet
        const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        const appsScriptSecret = process.env.GOOGLE_APPS_SCRIPT_SECRET || "nebo-tbr-2026-secure-key";

        if (appsScriptUrl) {
            console.log("Using Google Apps Script...");

            const payload = {
                secretKey: appsScriptSecret,
                tbrTripId: body.tbrTripId,
                neboTripId: body.neboTripId,
                firstName: body.firstName,
                lastName: body.lastName,
                passengerPhone: formattedPhone,
                passengerEmail: body.passengerEmail || "",
                pickupDatetime: body.pickupDatetime,
                pickupAddress: body.pickupAddress,
                pickupLatitude,
                pickupLongitude,
                dropoffAddress: body.dropoffAddress,
                dropoffLatitude,
                dropoffLongitude,
                vehicleType: body.vehicleType || "",
                passengerCount: body.passengerCount || 1,
                flightNumber: body.flightNumber || "",
                specialNotes: body.specialNotes || "",
                fareAmount: body.fareAmount || "",
            };

            const response = await fetch(appsScriptUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!result.success) {
                console.error("Apps Script error:", result.error);
                return NextResponse.json(
                    { error: "Failed to add to Google Sheet", details: result.error },
                    { status: 500 }
                );
            }

            const reservationId = `SHEET-${result.row || Date.now().toString().slice(-6)}`;
            const confirmationCode = `CONF-${body.tbrTripId}`;

            console.log(`Trip added to Google Sheet row ${result.row}`);

            return NextResponse.json({
                success: true,
                method: "google_apps_script",
                reservationId,
                confirmationCode,
                sheetRow: result.row,
                geocoded: {
                    pickup: pickupLatitude ? { lat: pickupLatitude, lng: pickupLongitude } : null,
                    dropoff: dropoffLatitude ? { lat: dropoffLatitude, lng: dropoffLongitude } : null,
                },
                message: "Trip added to Google Sheet. Zapier will create the LA reservation.",
            });
        }

        // No integration configured
        return NextResponse.json(
            { error: "No LimoAnywhere integration configured. Set GOOGLE_APPS_SCRIPT_URL." },
            { status: 500 }
        );
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
