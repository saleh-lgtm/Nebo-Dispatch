"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "./auth-helpers";
import { frontFetchAll, frontFetch, clearFrontCache } from "./frontApiClient";
import type { FrontEvent, FrontConversation, FrontTeammate } from "./frontApiClient";

// ============================================
// Types
// ============================================

export interface FrontEmailMetrics {
    emailsSent: number;
    emailsReceived: number;
    avgResponseTimeMinutes: number | null;
    inboxBreakdown: Record<string, number>;
}

export interface FrontTeamMember {
    userId: string;
    userName: string;
    emailsSent: number;
    emailsReceived: number;
    avgResponseTimeMinutes: number | null;
}

export interface FrontOpenConversations {
    totalOpen: number;
    unassigned: number;
    oldestUnanswered: {
        subject: string;
        waitingMinutes: number;
    } | null;
}

// ============================================
// Individual Email Metrics
// ============================================

export async function getFrontEmailMetrics(
    userId: string,
    from: Date,
    to: Date
): Promise<{ success: boolean; data?: FrontEmailMetrics; error?: string }> {
    try {
        await requireAdmin();

        // Look up Front teammate mapping
        const mapping = await prisma.frontTeammateMapping.findUnique({
            where: { userId },
        });

        if (!mapping) {
            return { success: true, data: undefined }; // No mapping = no Front data
        }

        const fromTs = Math.floor(from.getTime() / 1000);
        const toTs = Math.floor(to.getTime() / 1000);

        // Fetch outbound events (emails sent)
        const outboundEvents = await frontFetchAll<FrontEvent>(
            `/events?q[types][]=outbound&q[after]=${fromTs}&q[before]=${toTs}&limit=100`
        );

        // Fetch inbound events
        const inboundEvents = await frontFetchAll<FrontEvent>(
            `/events?q[types][]=inbound&q[after]=${fromTs}&q[before]=${toTs}&limit=100`
        );

        // Filter outbound by this teammate
        const myOutbound = outboundEvents.filter(
            (e) => e.target?.data?.author?.id === mapping.frontTeammateId
        );

        // Count emails sent
        const emailsSent = myOutbound.length;

        // Build inbox breakdown from outbound events
        const inboxBreakdown: Record<string, number> = {};
        for (const e of myOutbound) {
            const inboxes = e.source?.data || [];
            for (const inbox of inboxes) {
                // Skip demo inboxes
                if (inbox.name.startsWith("[Demo]")) continue;
                inboxBreakdown[inbox.name] = (inboxBreakdown[inbox.name] || 0) + 1;
            }
        }

        // Count inbound emails (all team — we'll attribute conversations this user replied to)
        const emailsReceived = inboundEvents.length;

        // Compute average response time
        // For each outbound from this user, find the most recent inbound on the same conversation
        let totalResponseTime = 0;
        let responseCount = 0;

        // Group inbound events by conversation ID
        const inboundByConversation = new Map<string, number[]>();
        for (const e of inboundEvents) {
            if (!e.conversation?.id) continue;
            const existing = inboundByConversation.get(e.conversation.id) || [];
            existing.push(e.emitted_at);
            inboundByConversation.set(e.conversation.id, existing);
        }

        // For each outbound from this teammate, find the preceding inbound
        for (const e of myOutbound) {
            if (!e.conversation?.id) continue;
            const inbounds = inboundByConversation.get(e.conversation.id);
            if (!inbounds || inbounds.length === 0) continue;

            // Find the most recent inbound before this outbound
            const outboundTime = e.emitted_at;
            let closestInbound: number | null = null;
            for (const inTime of inbounds) {
                if (inTime < outboundTime) {
                    if (closestInbound === null || inTime > closestInbound) {
                        closestInbound = inTime;
                    }
                }
            }

            if (closestInbound !== null) {
                const diffMinutes = (outboundTime - closestInbound) / 60;
                if (diffMinutes <= 480) { // Only count responses within 8 hours
                    totalResponseTime += diffMinutes;
                    responseCount++;
                }
            }
        }

        return {
            success: true,
            data: {
                emailsSent,
                emailsReceived,
                avgResponseTimeMinutes: responseCount > 0
                    ? Math.round((totalResponseTime / responseCount) * 10) / 10
                    : null,
                inboxBreakdown,
            },
        };
    } catch (error) {
        console.error("getFrontEmailMetrics error:", error);
        return { success: false, error: "Failed to get Front email metrics" };
    }
}

// ============================================
// Team Overview
// ============================================

export async function getFrontTeamOverview(
    from: Date,
    to: Date
): Promise<{ success: boolean; data?: FrontTeamMember[]; error?: string }> {
    try {
        await requireAdmin();

        // Get all mappings with user info
        const mappings = await prisma.frontTeammateMapping.findMany({
            include: { user: { select: { id: true, name: true } } },
        });

        if (mappings.length === 0) {
            return { success: true, data: [] };
        }

        const fromTs = Math.floor(from.getTime() / 1000);
        const toTs = Math.floor(to.getTime() / 1000);

        // Fetch all outbound and inbound events for the period
        const [outboundEvents, inboundEvents] = await Promise.all([
            frontFetchAll<FrontEvent>(
                `/events?q[types][]=outbound&q[after]=${fromTs}&q[before]=${toTs}&limit=100`
            ),
            frontFetchAll<FrontEvent>(
                `/events?q[types][]=inbound&q[after]=${fromTs}&q[before]=${toTs}&limit=100`
            ),
        ]);

        // Group inbound by conversation for response time
        const inboundByConversation = new Map<string, number[]>();
        for (const e of inboundEvents) {
            if (!e.conversation?.id) continue;
            const existing = inboundByConversation.get(e.conversation.id) || [];
            existing.push(e.emitted_at);
            inboundByConversation.set(e.conversation.id, existing);
        }

        // Build per-teammate metrics
        const results: FrontTeamMember[] = [];

        for (const mapping of mappings) {
            const myOutbound = outboundEvents.filter(
                (e) => e.target?.data?.author?.id === mapping.frontTeammateId
            );

            // Response time calculation
            let totalResponseTime = 0;
            let responseCount = 0;

            for (const e of myOutbound) {
                if (!e.conversation?.id) continue;
                const inbounds = inboundByConversation.get(e.conversation.id);
                if (!inbounds) continue;

                const outboundTime = e.emitted_at;
                let closestInbound: number | null = null;
                for (const inTime of inbounds) {
                    if (inTime < outboundTime) {
                        if (closestInbound === null || inTime > closestInbound) {
                            closestInbound = inTime;
                        }
                    }
                }

                if (closestInbound !== null) {
                    const diffMinutes = (outboundTime - closestInbound) / 60;
                    if (diffMinutes <= 480) {
                        totalResponseTime += diffMinutes;
                        responseCount++;
                    }
                }
            }

            results.push({
                userId: mapping.userId,
                userName: mapping.user.name ?? "Unknown",
                emailsSent: myOutbound.length,
                emailsReceived: inboundEvents.length, // Team total
                avgResponseTimeMinutes: responseCount > 0
                    ? Math.round((totalResponseTime / responseCount) * 10) / 10
                    : null,
            });
        }

        return { success: true, data: results };
    } catch (error) {
        console.error("getFrontTeamOverview error:", error);
        return { success: false, error: "Failed to get Front team overview" };
    }
}

// ============================================
// Open Conversations
// ============================================

export async function getFrontOpenConversations(): Promise<{
    success: boolean;
    data?: FrontOpenConversations;
    error?: string;
}> {
    try {
        await requireAdmin();

        const conversations = await frontFetchAll<FrontConversation>(
            "/conversations?q[statuses][]=open&q[statuses][]=unassigned&limit=100"
        );

        const totalOpen = conversations.length;
        const unassigned = conversations.filter((c) => !c.assignee).length;

        // Find oldest unanswered
        let oldest: FrontConversation | null = null;
        for (const c of conversations) {
            if (!c.assignee) {
                if (!oldest || c.waiting_since < oldest.waiting_since) {
                    oldest = c;
                }
            }
        }

        return {
            success: true,
            data: {
                totalOpen,
                unassigned,
                oldestUnanswered: oldest
                    ? {
                          subject: oldest.subject,
                          waitingMinutes: Math.round(
                              (Date.now() / 1000 - oldest.waiting_since) / 60
                          ),
                      }
                    : null,
            },
        };
    } catch (error) {
        console.error("getFrontOpenConversations error:", error);
        return { success: false, error: "Failed to get open conversations" };
    }
}

// ============================================
// Admin Settings — Teammate Management
// ============================================

export async function getFrontTeammateMappings(): Promise<{
    success: boolean;
    data?: Array<{
        id: string;
        userId: string;
        userName: string;
        userEmail: string | null;
        frontTeammateId: string;
        frontName: string;
        frontEmail: string;
    }>;
    error?: string;
}> {
    try {
        await requireAdmin();

        const mappings = await prisma.frontTeammateMapping.findMany({
            include: {
                user: { select: { name: true, email: true } },
            },
            orderBy: { frontName: "asc" },
        });

        return {
            success: true,
            data: mappings.map((m) => ({
                id: m.id,
                userId: m.userId,
                userName: m.user.name ?? "Unknown",
                userEmail: m.user.email,
                frontTeammateId: m.frontTeammateId,
                frontName: m.frontName,
                frontEmail: m.frontEmail,
            })),
        };
    } catch (error) {
        console.error("getFrontTeammateMappings error:", error);
        return { success: false, error: "Failed to get mappings" };
    }
}

export async function getFrontTeammatesFromApi(): Promise<{
    success: boolean;
    data?: FrontTeammate[];
    error?: string;
}> {
    try {
        await requireAdmin();

        const result = await frontFetch<{ _results: FrontTeammate[] }>("/teammates");
        return { success: true, data: result._results };
    } catch (error) {
        console.error("getFrontTeammatesFromApi error:", error);
        return { success: false, error: "Failed to fetch Front teammates — check API key" };
    }
}

export async function createFrontMapping(
    userId: string,
    frontTeammateId: string,
    frontName: string,
    frontEmail: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        await prisma.frontTeammateMapping.create({
            data: { userId, frontTeammateId, frontName, frontEmail },
        });

        return { success: true };
    } catch (error) {
        console.error("createFrontMapping error:", error);
        return { success: false, error: "Failed to create mapping" };
    }
}

export async function deleteFrontMapping(
    mappingId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();

        await prisma.frontTeammateMapping.delete({
            where: { id: mappingId },
        });

        clearFrontCache();
        return { success: true };
    } catch (error) {
        console.error("deleteFrontMapping error:", error);
        return { success: false, error: "Failed to delete mapping" };
    }
}

export async function checkFrontApiStatus(): Promise<{
    success: boolean;
    data?: { connected: boolean; teammateCount: number };
    error?: string;
}> {
    try {
        await requireAdmin();

        const result = await frontFetch<{ _results: FrontTeammate[] }>("/teammates");
        return {
            success: true,
            data: {
                connected: true,
                teammateCount: result._results.length,
            },
        };
    } catch {
        return {
            success: true,
            data: { connected: false, teammateCount: 0 },
        };
    }
}
