"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import prisma from "@/lib/prisma";
import CommunicationsHub from "./CommunicationsHub";

export default async function CommunicationsPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // Fetch all data in parallel for maximum performance
    const [
        partners,
        conversations,
        stats,
        pendingCounts,
    ] = await Promise.all([
        // Partners with SMS contact info
        prisma.affiliate.findMany({
            where: isAdmin ? {} : { isApproved: true },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                type: true,
                state: true,
                market: true,
                cities: true,
                isApproved: true,
                isActive: true,
                notes: true,
                employeeId: true,
                createdAt: true,
                smsContacts: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        _count: { select: { messages: true } },
                    },
                },
            },
            orderBy: { name: "asc" },
        }),
        // Recent conversations with last message
        prisma.$queryRaw`
            SELECT
                sl."conversationPhone" as phone,
                sl.message as "lastMessage",
                sl."createdAt" as "lastMessageAt",
                sl.direction,
                sl.status,
                (SELECT COUNT(*) FROM "SMSLog" WHERE "conversationPhone" = sl."conversationPhone" AND direction = 'INBOUND' AND status != 'read') as "unreadCount",
                sc.name as "contactName",
                sc."affiliateId",
                a.name as "partnerName",
                a.type as "partnerType"
            FROM "SMSLog" sl
            LEFT JOIN "SMSContact" sc ON sl."conversationPhone" = sc."phoneNumber"
            LEFT JOIN "Affiliate" a ON sc."affiliateId" = a.id
            WHERE sl."createdAt" = (
                SELECT MAX("createdAt") FROM "SMSLog" WHERE "conversationPhone" = sl."conversationPhone"
            )
            ORDER BY sl."createdAt" DESC
            LIMIT 100
        ` as Promise<Array<{
            phone: string;
            lastMessage: string;
            lastMessageAt: Date;
            direction: string;
            status: string;
            unreadCount: bigint;
            contactName: string | null;
            affiliateId: string | null;
            partnerName: string | null;
            partnerType: string | null;
        }>>,
        // Stats
        Promise.all([
            prisma.sMSLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
            prisma.sMSLog.count({ where: { createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) } } }),
            prisma.sMSLog.count({ where: { status: "failed" } }),
            prisma.affiliate.count({ where: { phone: { not: null } } }),
            prisma.sMSLog.count({ where: { direction: "INBOUND", createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
        ]),
        // Pending counts for admin
        isAdmin ? prisma.affiliate.groupBy({
            by: ["type"],
            where: { isApproved: false },
            _count: true,
        }) : Promise.resolve([]),
    ]);

    // Transform stats
    const [todayMessages, weekMessages, failedMessages, totalContacts, todayInbound] = stats;

    // Transform pending counts
    const pendingByType = (pendingCounts as Array<{ type: string; _count: number }>).reduce(
        (acc, item) => ({ ...acc, [item.type]: item._count }),
        {} as Record<string, number>
    );

    return (
        <CommunicationsHub
            initialPartners={partners}
            initialConversations={conversations.map(c => ({
                ...c,
                unreadCount: Number(c.unreadCount),
            }))}
            stats={{
                todayMessages,
                weekMessages,
                failedMessages,
                totalContacts,
                todayInbound,
                responseRate: todayInbound > 0 ? Math.round(((todayMessages - todayInbound) / todayInbound) * 100) : 100,
            }}
            pendingCounts={pendingByType}
            session={{
                user: {
                    id: session.user.id,
                    name: session.user.name,
                    email: session.user.email,
                    role: session.user.role,
                },
            }}
            isAdmin={isAdmin}
        />
    );
}
