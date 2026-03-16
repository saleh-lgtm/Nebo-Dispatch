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
        const verifyResult = await verifyCalendarToken(token, userId);
        if (!verifyResult.success || !verifyResult.data) {
            return NextResponse.json(
                { error: "Invalid token" },
                { status: 401 }
            );
        }

        // Generate the iCal feed
        const feedResult = await generateICalFeed(userId);
        if (!feedResult.success || !feedResult.data) {
            return NextResponse.json(
                { error: feedResult.error || "Failed to generate calendar" },
                { status: 500 }
            );
        }

        // Return as iCal file
        const headers: HeadersInit = {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        };

        if (download) {
            headers["Content-Disposition"] = `attachment; filename="nebo-schedule.ics"`;
        }

        return new NextResponse(feedResult.data, { headers });
    } catch (error) {
        console.error("Calendar generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate calendar" },
            { status: 500 }
        );
    }
}
