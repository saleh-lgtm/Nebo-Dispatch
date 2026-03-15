"use server";

interface GeocodingResult {
    latitude: number;
    longitude: number;
    formattedAddress: string;
}

/**
 * Geocode an address using Google Maps Geocoding API
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        console.warn("GOOGLE_MAPS_API_KEY not configured, skipping geocoding");
        return null;
    }

    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "OK" && data.results.length > 0) {
            const result = data.results[0];
            return {
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng,
                formattedAddress: result.formatted_address,
            };
        }

        console.warn(`Geocoding failed for "${address}": ${data.status}`);
        return null;
    } catch (error) {
        console.error("Geocoding error:", error);
        return null;
    }
}

/**
 * Geocode pickup and dropoff addresses for a trip
 */
export async function geocodeTripAddresses(
    pickupAddress: string,
    dropoffAddress: string
): Promise<{
    pickup: GeocodingResult | null;
    dropoff: GeocodingResult | null;
}> {
    const [pickup, dropoff] = await Promise.all([
        geocodeAddress(pickupAddress),
        geocodeAddress(dropoffAddress),
    ]);

    return { pickup, dropoff };
}
