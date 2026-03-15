import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { geocodeTripAddresses } from "@/lib/geocoding";

/**
 * POST /api/tbr/push-to-la
 *
 * Proxy endpoint to push TBR trips to LimoAnywhere via Zapier webhook.
 * - Checks for duplicates (already pushed trips)
 * - Geocodes pickup and dropoff addresses
 * - Forwards to Zapier with lat/lng
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

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

        const zapierUrl = process.env.ZAPIER_LA_WEBHOOK_URL || process.env.NEXT_PUBLIC_ZAPIER_LA_WEBHOOK_URL;

        if (!zapierUrl) {
            console.error("Zapier webhook URL not configured");
            return NextResponse.json(
                { error: "Zapier webhook not configured" },
                { status: 500 }
            );
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

        // Prepare payload with geocoded data
        const zapierPayload = {
            ...body,
            pickupLatitude,
            pickupLongitude,
            dropoffLatitude,
            dropoffLongitude,
        };

        console.log("Pushing to Zapier:", {
            url: zapierUrl,
            tbrTripId: body.tbrTripId,
            passenger: `${body.firstName} ${body.lastName}`,
            pickupCoords: pickupLatitude ? `${pickupLatitude}, ${pickupLongitude}` : "N/A",
            dropoffCoords: dropoffLatitude ? `${dropoffLatitude}, ${dropoffLongitude}` : "N/A",
        });

        // Forward request to Zapier
        const zapierResponse = await fetch(zapierUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(zapierPayload),
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
        let zapierResult: Record<string, unknown> = {};
        try {
            zapierResult = await zapierResponse.json();
        } catch {
            // Zapier might return empty response - that's OK
        }

        console.log("Zapier response:", zapierResult);

        // Generate reservation ID if Zapier doesn't return one
        const reservationId =
            (zapierResult.reservationId as string) ||
            (zapierResult.reservation_id as string) ||
            (zapierResult.id as string) ||
            `ZAP-${Date.now().toString().slice(-8)}`;

        const confirmationCode =
            (zapierResult.confirmationCode as string) ||
            (zapierResult.confirmation_code as string) ||
            `CONF-${body.tbrTripId || "TBR"}`;

        return NextResponse.json({
            success: true,
            reservationId,
            confirmationCode,
            geocoded: {
                pickup: pickupLatitude ? { lat: pickupLatitude, lng: pickupLongitude } : null,
                dropoff: dropoffLatitude ? { lat: dropoffLatitude, lng: dropoffLongitude } : null,
            },
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
