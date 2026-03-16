import { NextRequest, NextResponse } from "next/server";
import { generateICalFeed, verifyCalendarToken } from "@/lib/calendarExportActions";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const searchParams = request.nextUrl.searchParams;
        const token = searchParams.get("token");
        const download = searchParams.get("download") === "true";

        if (!token) {
            return NextResponse.json(
                { error: "Missing token" },
                { status: 401 }
            );
        }

        // Verify the token
        const isValid = await verifyCalendarToken(token, userId);
        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid token" },
                { status: 401 }
            );
        }

        // Generate the iCal feed
        const icalContent = await generateICalFeed(userId);

        // Return as iCal file
        const headers: HeadersInit = {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        };

        if (download) {
            headers["Content-Disposition"] = `attachment; filename="nebo-schedule.ics"`;
        }

        return new NextResponse(icalContent, { headers });
    } catch (error) {
        console.error("Calendar generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate calendar" },
            { status: 500 }
        );
    }
}
