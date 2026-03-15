import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { geocodeTripAddresses } from "@/lib/geocoding";
import { addTripToGoogleSheet } from "@/lib/googleSheets";

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX)
 */
function formatPhoneE164(phone: string | null | undefined): string {
    if (!phone) return "";

    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");

    // If it starts with 1 and has 11 digits, add +
    if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
    }

    // If it has 10 digits, assume US and add +1
    if (digits.length === 10) {
        return `+1${digits}`;
    }

    // If it already has + at the start, keep it
    if (phone.startsWith("+")) {
        return `+${digits}`;
    }

    // Return as-is with + prefix if we have digits
    return digits.length > 0 ? `+${digits}` : "";
}

/**
 * POST /api/tbr/push-to-la
 *
 * Push TBR trips to LimoAnywhere via Google Sheets (for Zapier trigger)
 * - Checks for duplicates (already pushed trips)
 * - Geocodes pickup and dropoff addresses
 * - Formats phone to E.164
 * - Adds row to Google Sheet → Zapier picks up → Creates LA reservation
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

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
                    pickupLatitude: true,
                    pickupLongitude: true,
                    dropoffLatitude: true,
                    dropoffLongitude: true,
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
                    { status: 409 } // Conflict
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
                console.log(`Pickup geocoded: ${pickupLatitude}, ${pickupLongitude}`);
            }

            if (geocoded.dropoff) {
                dropoffLatitude = geocoded.dropoff.latitude;
                dropoffLongitude = geocoded.dropoff.longitude;
                console.log(`Dropoff geocoded: ${dropoffLatitude}, ${dropoffLongitude}`);
            }

            // Store geocoded coordinates in database
            if (body.neboTripId) {
                await prisma.tbrTrip.update({
                    where: { id: body.neboTripId },
                    data: {
                        pickupLatitude,
                        pickupLongitude,
                        dropoffLatitude,
                        dropoffLongitude,
                    },
                });
            }
        }

        // Try Google Sheets first (free Zapier trigger)
        const googleSheetsConfigured = !!(
            process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
            process.env.GOOGLE_SHEETS_CREDENTIALS
        );

        if (googleSheetsConfigured) {
            console.log("Using Google Sheets integration...");

            const sheetResult = await addTripToGoogleSheet({
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
            });

            if (!sheetResult.success) {
                return NextResponse.json(
                    { error: "Failed to add to Google Sheet", details: sheetResult.error },
                    { status: 500 }
                );
            }

            // Generate confirmation based on sheet row
            const reservationId = `SHEET-${sheetResult.rowNumber || Date.now().toString().slice(-6)}`;
            const confirmationCode = `CONF-${body.tbrTripId}`;

            console.log(`Trip added to Google Sheet row ${sheetResult.rowNumber}`);

            return NextResponse.json({
                success: true,
                method: "google_sheets",
                reservationId,
                confirmationCode,
                sheetRow: sheetResult.rowNumber,
                geocoded: {
                    pickup: pickupLatitude ? { lat: pickupLatitude, lng: pickupLongitude } : null,
                    dropoff: dropoffLatitude ? { lat: dropoffLatitude, lng: dropoffLongitude } : null,
                },
                message: "Trip added to Google Sheet. Zapier will create the LA reservation.",
            });
        }

        // Fall back to direct Zapier webhook if configured
        const zapierUrl = process.env.ZAPIER_LA_WEBHOOK_URL || process.env.NEXT_PUBLIC_ZAPIER_LA_WEBHOOK_URL;

        if (zapierUrl) {
            console.log("Using direct Zapier webhook...");

            const zapierPayload = {
                ...body,
                passengerPhone: formattedPhone,
                pickupLatitude,
                pickupLongitude,
                dropoffLatitude,
                dropoffLongitude,
            };

            const zapierResponse = await fetch(zapierUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(zapierPayload),
            });

            if (!zapierResponse.ok) {
                const errorText = await zapierResponse.text();
                return NextResponse.json(
                    { error: `Zapier error: ${zapierResponse.statusText}`, details: errorText },
                    { status: zapierResponse.status }
                );
            }

            let zapierResult: Record<string, unknown> = {};
            try {
                zapierResult = await zapierResponse.json();
            } catch {
                // Empty response is OK
            }

            const reservationId =
                (zapierResult.reservationId as string) ||
                (zapierResult.reservation_id as string) ||
                `ZAP-${Date.now().toString().slice(-8)}`;

            const confirmationCode =
                (zapierResult.confirmationCode as string) ||
                `CONF-${body.tbrTripId}`;

            return NextResponse.json({
                success: true,
                method: "zapier_webhook",
                reservationId,
                confirmationCode,
                geocoded: {
                    pickup: pickupLatitude ? { lat: pickupLatitude, lng: pickupLongitude } : null,
                    dropoff: dropoffLatitude ? { lat: dropoffLatitude, lng: dropoffLongitude } : null,
                },
            });
        }

        // No integration configured
        return NextResponse.json(
            { error: "No LimoAnywhere integration configured. Set up Google Sheets or Zapier webhook." },
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
