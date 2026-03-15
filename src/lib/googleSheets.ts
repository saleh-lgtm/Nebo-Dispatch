"use server";

import { google } from "googleapis";

/**
 * Add a trip to Google Sheets for Zapier to pick up
 */
export async function addTripToGoogleSheet(tripData: {
    tbrTripId: string;
    neboTripId: string;
    firstName: string;
    lastName: string;
    passengerPhone: string;
    passengerEmail: string;
    pickupDatetime: string;
    pickupAddress: string;
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    dropoffAddress: string;
    dropoffLatitude?: number | null;
    dropoffLongitude?: number | null;
    vehicleType: string;
    passengerCount: number;
    flightNumber?: string;
    specialNotes?: string;
    fareAmount?: string;
}): Promise<{ success: boolean; rowNumber?: number; error?: string }> {
    try {
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
        const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;

        if (!spreadsheetId || !credentials) {
            console.error("Google Sheets not configured");
            return { success: false, error: "Google Sheets not configured" };
        }

        // Parse credentials JSON
        const creds = JSON.parse(credentials);

        // Create auth client
        const auth = new google.auth.GoogleAuth({
            credentials: creds,
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        // Format the row data - match columns to what Zapier/LA needs
        const rowData = [
            new Date().toISOString(),           // A: Timestamp
            tripData.tbrTripId,                  // B: TBR Trip ID
            tripData.neboTripId,                 // C: Nebo Trip ID
            tripData.firstName,                  // D: First Name
            tripData.lastName,                   // E: Last Name
            tripData.passengerPhone,             // F: Phone (E.164)
            tripData.passengerEmail || "",       // G: Email
            tripData.pickupDatetime,             // H: Pickup Date/Time
            tripData.pickupAddress,              // I: Pickup Address
            tripData.pickupLatitude || "",       // J: Pickup Lat
            tripData.pickupLongitude || "",      // K: Pickup Lng
            tripData.dropoffAddress,             // L: Dropoff Address
            tripData.dropoffLatitude || "",      // M: Dropoff Lat
            tripData.dropoffLongitude || "",     // N: Dropoff Lng
            tripData.vehicleType || "",          // O: Vehicle Type
            tripData.passengerCount || 1,        // P: Passenger Count
            tripData.flightNumber || "",         // Q: Flight Number
            tripData.specialNotes || "",         // R: Notes
            tripData.fareAmount || "",           // S: Fare
            "30019",                             // T: Billing Contact ID
            "Scott",                             // U: Billing First Name
            "Mezzetti",                          // V: Billing Last Name
            "TBR Global",                        // W: Company Name
            "PENDING",                           // X: Status (Zapier will update)
            "",                                  // Y: LA Reservation ID (Zapier fills)
        ];

        // Append row to sheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: "Sheet1!A:Y",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [rowData],
            },
        });

        const updatedRange = response.data.updates?.updatedRange || "";
        const rowMatch = updatedRange.match(/\d+$/);
        const rowNumber = rowMatch ? parseInt(rowMatch[0]) : undefined;

        console.log(`Trip added to Google Sheet row ${rowNumber}`);

        return { success: true, rowNumber };
    } catch (error) {
        console.error("Google Sheets error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Check if Google Sheets is configured
 */
export async function isGoogleSheetsConfigured(): Promise<boolean> {
    return !!(
        process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
        process.env.GOOGLE_SHEETS_CREDENTIALS
    );
}
