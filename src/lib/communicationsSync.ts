"use server";

import prisma from "@/lib/prisma";
import { requireAuth } from "./auth-helpers";

/**
 * COMMUNICATIONS SYNC SERVICE
 *
 * This service provides optimized, unified access to Partners, Phone Book, and SMS data.
 * It uses database-level optimizations to reduce N+1 queries and improve performance.
 */

// ============================================
// PHONE NUMBER NORMALIZATION
// ============================================

/**
 * Single source of truth for phone number normalization.
 * Always converts to E.164 format: +1XXXXXXXXXX
 */
export function normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (phone.startsWith("+")) return phone;
    return `+1${digits}`;
}

// ============================================
// UNIFIED CONTACT QUERIES
// ============================================

export interface UnifiedContact {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    type: string;
    isPartner: boolean;
    isApproved: boolean;
    isActive: boolean;
    partnerId: string | null;
    lastMessage: string | null;
    lastMessageAt: Date | null;
    unreadCount: number;
    totalMessages: number;
}

/**
 * Get all contacts with their SMS stats in a single optimized query.
 * This replaces the N+1 pattern in getAllNetworkContacts.
 */
export async function getUnifiedContacts(options?: {
    search?: string;
    type?: string;
    limit?: number;
    offset?: number;
}): Promise<{ contacts: UnifiedContact[]; total: number }> {
    await requireAuth();

    const { search, type, limit = 100, offset = 0 } = options || {};

    // Build dynamic WHERE clause parts
    const whereParts: string[] = ["a.phone IS NOT NULL"];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (type && type !== "all") {
        whereParts.push(`a.type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
    }

    if (search) {
        whereParts.push(`(
            a.name ILIKE $${paramIndex} OR
            a.email ILIKE $${paramIndex} OR
            a.phone LIKE $${paramIndex + 1} OR
            a.market ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`, `%${search}%`);
        paramIndex += 2;
    }

    params.push(limit, offset);

    const whereClause = whereParts.join(" AND ");

    // Single optimized query with all data
    const contacts = await prisma.$queryRawUnsafe<UnifiedContact[]>(`
        WITH contact_stats AS (
            SELECT
                sc."affiliateId",
                sc."phoneNumber",
                COUNT(sl.id) as "totalMessages",
                COUNT(CASE WHEN sl.direction = 'INBOUND' AND sl.status != 'read' THEN 1 END) as "unreadCount",
                MAX(sl."createdAt") as "lastMessageAt"
            FROM "SMSContact" sc
            LEFT JOIN "SMSLog" sl ON sl."conversationPhone" = sc."phoneNumber"
            GROUP BY sc."affiliateId", sc."phoneNumber"
        ),
        last_messages AS (
            SELECT DISTINCT ON ("conversationPhone")
                "conversationPhone",
                message as "lastMessage"
            FROM "SMSLog"
            ORDER BY "conversationPhone", "createdAt" DESC
        )
        SELECT
            a.id,
            a.name,
            a.phone,
            a.email,
            a.type,
            true as "isPartner",
            a."isApproved",
            a."isActive",
            a.id as "partnerId",
            lm."lastMessage",
            cs."lastMessageAt",
            COALESCE(cs."unreadCount", 0)::int as "unreadCount",
            COALESCE(cs."totalMessages", 0)::int as "totalMessages"
        FROM "Affiliate" a
        LEFT JOIN contact_stats cs ON cs."affiliateId" = a.id
        LEFT JOIN last_messages lm ON lm."conversationPhone" = (
            SELECT "phoneNumber" FROM "SMSContact" WHERE "affiliateId" = a.id LIMIT 1
        )
        WHERE ${whereClause}
        ORDER BY cs."lastMessageAt" DESC NULLS LAST, a.name ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, ...params);

    // Count query
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
        SELECT COUNT(*) as count
        FROM "Affiliate" a
        WHERE ${whereClause}
    `, ...params.slice(0, -2));

    return {
        contacts,
        total: Number(countResult[0].count),
    };
}

// ============================================
// REAL-TIME CONVERSATION DATA
// ============================================

export interface ConversationWithMessages {
    phone: string;
    contactName: string | null;
    partnerName: string | null;
    partnerType: string | null;
    partnerId: string | null;
    messages: Array<{
        id: string;
        message: string;
        direction: "INBOUND" | "OUTBOUND";
        status: string;
        createdAt: Date;
    }>;
    stats: {
        totalMessages: number;
        unreadCount: number;
        lastMessageAt: Date | null;
    };
}

/**
 * Get conversation with all messages and contact info in one query.
 */
export async function getConversationWithContext(
    phone: string,
    options?: { limit?: number }
): Promise<ConversationWithMessages | null> {
    await requireAuth();

    const normalizedPhone = normalizePhoneNumber(phone);
    const limit = options?.limit || 100;

    // Get contact info
    const contact = await prisma.sMSContact.findUnique({
        where: { phoneNumber: normalizedPhone },
        include: {
            affiliate: {
                select: { id: true, name: true, type: true },
            },
        },
    });

    // Get messages with stats in parallel
    const [messages, stats] = await Promise.all([
        prisma.sMSLog.findMany({
            where: { conversationPhone: normalizedPhone },
            orderBy: { createdAt: "asc" },
            take: limit,
            select: {
                id: true,
                message: true,
                direction: true,
                status: true,
                createdAt: true,
            },
        }),
        prisma.sMSLog.aggregate({
            where: { conversationPhone: normalizedPhone },
            _count: true,
            _max: { createdAt: true },
        }),
    ]);

    const unreadCount = await prisma.sMSLog.count({
        where: {
            conversationPhone: normalizedPhone,
            direction: "INBOUND",
            status: { not: "read" },
        },
    });

    return {
        phone: normalizedPhone,
        contactName: contact?.name || null,
        partnerName: contact?.affiliate?.name || null,
        partnerType: contact?.affiliate?.type || null,
        partnerId: contact?.affiliateId || null,
        messages: messages.map(m => ({
            ...m,
            direction: m.direction as "INBOUND" | "OUTBOUND",
        })),
        stats: {
            totalMessages: stats._count,
            unreadCount,
            lastMessageAt: stats._max.createdAt,
        },
    };
}

// ============================================
// SYNC OPERATIONS
// ============================================

/**
 * Sync partner phone changes to SMS contacts.
 * Call this after updating a partner's phone number.
 */
export async function syncPartnerToSMSContact(partnerId: string): Promise<void> {
    await requireAuth();

    const partner = await prisma.affiliate.findUnique({
        where: { id: partnerId },
        select: { name: true, phone: true },
    });

    if (!partner || !partner.phone) return;

    const normalizedPhone = normalizePhoneNumber(partner.phone);

    await prisma.sMSContact.upsert({
        where: { phoneNumber: normalizedPhone },
        create: {
            phoneNumber: normalizedPhone,
            affiliateId: partnerId,
            name: partner.name,
        },
        update: {
            affiliateId: partnerId,
            name: partner.name,
        },
    });
}

/**
 * Clean up orphaned SMS contacts (contacts without valid affiliates).
 * Run periodically or after bulk deletions.
 */
export async function cleanupOrphanedContacts(): Promise<{ cleaned: number }> {
    await requireAuth();

    // Find contacts with deleted affiliates
    const orphaned = await prisma.sMSContact.findMany({
        where: {
            affiliateId: { not: null },
            affiliate: null,
        },
        select: { id: true },
    });

    // Clear the affiliateId (don't delete - keep message history)
    if (orphaned.length > 0) {
        await prisma.sMSContact.updateMany({
            where: {
                id: { in: orphaned.map(o => o.id) },
            },
            data: {
                affiliateId: null,
            },
        });
    }

    return { cleaned: orphaned.length };
}

// ============================================
// STATS & ANALYTICS
// ============================================

export interface CommunicationsStats {
    todayMessages: number;
    todayInbound: number;
    todayOutbound: number;
    weekMessages: number;
    monthMessages: number;
    failedMessages: number;
    totalContacts: number;
    activeConversations: number;
    responseRate: number;
    avgResponseTime: number | null;
}

/**
 * Get comprehensive communications stats in a single optimized query.
 */
export async function getCommunicationsStats(): Promise<CommunicationsStats> {
    await requireAuth();

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
        todayStats,
        weekMessages,
        monthMessages,
        failedMessages,
        totalContacts,
        activeConversations,
    ] = await Promise.all([
        // Today's stats with direction breakdown
        prisma.sMSLog.groupBy({
            by: ["direction"],
            where: { createdAt: { gte: todayStart } },
            _count: true,
        }),
        // Week total
        prisma.sMSLog.count({
            where: { createdAt: { gte: weekStart } },
        }),
        // Month total
        prisma.sMSLog.count({
            where: { createdAt: { gte: monthStart } },
        }),
        // Failed messages
        prisma.sMSLog.count({
            where: { status: "failed" },
        }),
        // Total contacts with phones
        prisma.affiliate.count({
            where: { phone: { not: null } },
        }),
        // Active conversations (messages in last 7 days)
        prisma.sMSLog.groupBy({
            by: ["conversationPhone"],
            where: { createdAt: { gte: weekStart } },
        }).then(r => r.length),
    ]);

    const todayInbound = todayStats.find(s => s.direction === "INBOUND")?._count || 0;
    const todayOutbound = todayStats.find(s => s.direction === "OUTBOUND")?._count || 0;
    const todayMessages = todayInbound + todayOutbound;

    // Calculate response rate (outbound responses to inbound)
    const responseRate = todayInbound > 0
        ? Math.round((todayOutbound / todayInbound) * 100)
        : 100;

    return {
        todayMessages,
        todayInbound,
        todayOutbound,
        weekMessages,
        monthMessages,
        failedMessages,
        totalContacts,
        activeConversations,
        responseRate,
        avgResponseTime: null, // Would require more complex query
    };
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Mark all messages in a conversation as read.
 */
export async function markConversationAsRead(phone: string): Promise<void> {
    await requireAuth();

    const normalizedPhone = normalizePhoneNumber(phone);

    await prisma.sMSLog.updateMany({
        where: {
            conversationPhone: normalizedPhone,
            direction: "INBOUND",
            status: { not: "read" },
        },
        data: {
            status: "read",
        },
    });
}

/**
 * Bulk sync all partners to SMS contacts.
 * Useful for initial setup or data migration.
 */
export async function bulkSyncPartnersToContacts(): Promise<{ synced: number }> {
    await requireAuth();

    const partners = await prisma.affiliate.findMany({
        where: { phone: { not: null } },
        select: { id: true, name: true, phone: true },
    });

    let synced = 0;

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
        for (const partner of partners) {
            if (!partner.phone) continue;

            const normalizedPhone = normalizePhoneNumber(partner.phone);

            await tx.sMSContact.upsert({
                where: { phoneNumber: normalizedPhone },
                create: {
                    phoneNumber: normalizedPhone,
                    affiliateId: partner.id,
                    name: partner.name,
                },
                update: {
                    affiliateId: partner.id,
                    name: partner.name,
                },
            });

            synced++;
        }
    });

    return { synced };
}
