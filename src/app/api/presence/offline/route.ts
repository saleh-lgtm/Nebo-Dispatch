import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({}).strict().optional();

/**
 * POST /api/presence/offline
 * Marks the current user as offline.
 * Body must be empty or an empty object — no extra fields accepted.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Validate body — reject unexpected fields
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const body = await request.json();
            const parsed = bodySchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json(
                    { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
                    { status: 400 }
                );
            }
        }

        await prisma.userPresence.upsert({
            where: { userId: session.user.id },
            update: {
                isOnline: false,
                lastSeenAt: new Date(),
            },
            create: {
                userId: session.user.id,
                isOnline: false,
                lastSeenAt: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Presence update error:", error);
        return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
    }
}
