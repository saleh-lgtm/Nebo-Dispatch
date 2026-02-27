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

// Normalize different email webhook formats to our standard format
function normalizeEmailPayload(data: Record<string, unknown>): {
    body: string;
    from?: string;
    subject?: string;
} | null {
    // CloudMailin format: { plain, html, from, to, subject, headers, ... }
    if (data.plain || data.html) {
        return {
            body: (data.plain as string) || (data.html as string) || "",
            from: data.from as string | undefined,
            subject: data.subject as string | undefined,
        };
    }

    // Zapier/standard format: { body, from, subject }
    if (data.body && typeof data.body === "string") {
        return {
            body: data.body,
            from: data.from as string | undefined,
            subject: data.subject as string | undefined,
        };
    }

    // SendGrid Inbound Parse format
    if (data.text || data.Text) {
        return {
            body: (data.text as string) || (data.Text as string) || "",
            from: (data.from as string) || (data.From as string) || undefined,
            subject: (data.subject as string) || (data.Subject as string) || undefined,
        };
    }

    return null;
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

    // Verify authentication (supports multiple methods)
    const manifestSecret = process.env.MANIFEST_INGEST_SECRET;
    if (!manifestSecret) {
        console.error("MANIFEST_INGEST_SECRET not configured");
        return NextResponse.json(
            { error: "Server configuration error" },
            { status: 500 }
        );
    }

    let isAuthenticated = false;

    // Method 1: Basic Auth (CloudMailin recommended)
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Basic ")) {
        try {
            const base64 = authHeader.slice(6);
            const decoded = atob(base64);
            const [username, password] = decoded.split(":");
            // Username: "manifest", Password: the secret
            if (username === "manifest" && password === manifestSecret) {
                isAuthenticated = true;
            }
        } catch {
            // Invalid base64, continue to other methods
        }
    }

    // Method 2: x-manifest-secret header
    if (!isAuthenticated) {
        const headerSecret = request.headers.get("x-manifest-secret");
        if (headerSecret === manifestSecret) {
            isAuthenticated = true;
        }
    }

    // SECURITY: URL parameter authentication REMOVED - secrets in URLs are logged
    // in server logs, browser history, and proxy logs. Use Basic Auth or headers only.

    if (!isAuthenticated) {
        console.warn(`Unauthorized manifest ingest attempt from IP: ${ip}`);
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    // Parse request body (supports JSON and form-data)
    let rawData: Record<string, unknown>;
    const contentType = request.headers.get("content-type") || "";

    try {
        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            rawData = Object.fromEntries(formData.entries());
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
            const text = await request.text();
            rawData = Object.fromEntries(new URLSearchParams(text));
        } else {
            rawData = await request.json();
        }
    } catch {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 }
        );
    }

    // Normalize to standard format
    const payload = normalizeEmailPayload(rawData);
    if (!payload || !payload.body) {
        return NextResponse.json(
            { error: "Missing email body content" },
            { status: 400 }
        );
    }

    try {
        // Parse the manifest email
        const trips = await parseManifestEmail(payload.body);

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
            payload.body,
            payload.from,
            payload.subject
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
