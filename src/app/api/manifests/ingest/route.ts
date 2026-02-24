import { NextRequest, NextResponse } from "next/server";
import {
    parseManifestEmail,
    ingestManifestTrips,
} from "@/lib/tripConfirmationActions";

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (entry.count >= RATE_LIMIT) {
        return false;
    }

    entry.count++;
    return true;
}

export async function POST(request: NextRequest) {
    // Get client IP for rate limiting
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("cf-connecting-ip") ||
        "unknown";

    // Check rate limit
    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { error: "Rate limit exceeded. Max 100 requests per hour." },
            { status: 429 }
        );
    }

    // Verify secret API key
    const manifestSecret = process.env.MANIFEST_INGEST_SECRET;
    if (!manifestSecret) {
        console.error("MANIFEST_INGEST_SECRET not configured");
        return NextResponse.json(
            { error: "Server configuration error" },
            { status: 500 }
        );
    }

    const providedSecret = request.headers.get("x-manifest-secret");
    if (!providedSecret || providedSecret !== manifestSecret) {
        // Log unauthorized attempt
        console.warn(`Unauthorized manifest ingest attempt from IP: ${ip}`);
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    // Validate request body
    let body: { from?: string; subject?: string; body: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    if (!body.body || typeof body.body !== "string") {
        return NextResponse.json(
            { error: "Missing or invalid 'body' field" },
            { status: 400 }
        );
    }

    try {
        // Parse the manifest email
        const trips = parseManifestEmail(body.body);

        if (trips.length === 0) {
            return NextResponse.json(
                {
                    success: true,
                    message: "No trips found in manifest",
                    extracted: 0,
                    created: 0,
                    duplicate: 0,
                },
                { status: 200 }
            );
        }

        // Ingest the trips
        const result = await ingestManifestTrips(
            trips,
            body.body,
            body.from,
            body.subject
        );

        console.log(
            `Manifest ingested: ${result.created} created, ${result.duplicate} duplicates, ${result.errors.length} errors`
        );

        return NextResponse.json(
            {
                success: true,
                message: `Processed ${trips.length} trips`,
                ...result,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Manifest ingestion error:", error);
        return NextResponse.json(
            {
                error: "Failed to process manifest",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// Reject other methods
export async function GET() {
    return NextResponse.json(
        { error: "Method not allowed" },
        { status: 405 }
    );
}
