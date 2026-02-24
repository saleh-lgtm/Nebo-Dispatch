import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Debug endpoint to check SMS logs - REMOVE IN PRODUCTION
export async function GET() {
    try {
        const count = await prisma.sMSLog.count();
        const recentMessages = await prisma.sMSLog.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                direction: true,
                to: true,
                from: true,
                status: true,
                createdAt: true,
                messageSid: true,
            },
        });

        return NextResponse.json({
            totalMessages: count,
            recentMessages,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Database error", details: String(error) },
            { status: 500 }
        );
    }
}
