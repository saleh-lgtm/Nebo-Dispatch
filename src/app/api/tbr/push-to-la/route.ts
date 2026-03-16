import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { geocodeTripAddresses } from "@/lib/geocoding";

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
