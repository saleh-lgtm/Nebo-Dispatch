import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
