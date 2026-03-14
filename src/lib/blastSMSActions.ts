"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "./auth-helpers";
import { sendBulkSMS } from "./twilioActions";
import { revalidatePath } from "next/cache";

/**
 * Preview blast SMS recipients without sending
 */
export async function previewBlastSMS(tagIds: string[]) {
    await requireAdmin();

    if (tagIds.length === 0) {
        return { recipientCount: 0, recipients: [] };
    }

    const contacts = await prisma.contact.findMany({
        where: {
            isActive: true,
            approvalStatus: "APPROVED",
            phone: { not: null },
            tags: {
                some: { tagId: { in: tagIds } },
            },
        },
        select: {
            id: true,
            name: true,
            phone: true,
            company: true,
            tags: {
                include: {
                    tag: { select: { id: true, name: true, color: true } },
                },
            },
        },
        orderBy: { name: "asc" },
    });

    return {
        recipientCount: contacts.length,
        recipients: contacts,
    };
}

/**
 * Send blast SMS to contacts with selected tags
 */
export async function sendBlastSMS(data: { tagIds: string[]; message: string }) {
    const session = await requireAdmin();

    // Validate input
    const trimmedMessage = data.message.trim();
    if (!trimmedMessage) {
        throw new Error("Message is required");
    }

    if (trimmedMessage.length > 1600) {
        throw new Error("Message is too long (max 1600 characters)");
    }

    if (data.tagIds.length === 0) {
        throw new Error("At least one tag must be selected");
    }

    // Get contacts with valid phone numbers
    const contacts = await prisma.contact.findMany({
        where: {
            isActive: true,
            approvalStatus: "APPROVED",
            phone: { not: null },
            tags: {
                some: { tagId: { in: data.tagIds } },
            },
        },
        select: { id: true, phone: true, name: true },
    });

    if (contacts.length === 0) {
        throw new Error("No contacts with phone numbers found for selected tags");
    }

    // Prepare recipients for bulk send
    const recipients = contacts
        .filter((c) => c.phone)
        .map((c) => ({
            phone: c.phone!,
            message: trimmedMessage,
        }));

    // Send via existing sendBulkSMS infrastructure
    const result = await sendBulkSMS(recipients);

    // Log the blast campaign
    await prisma.blastSMSLog.create({
        data: {
            message: trimmedMessage,
            tagIds: data.tagIds,
            recipientCount: recipients.length,
            successCount: result.successful,
            failCount: result.failed,
            sentById: session.user.id,
        },
    });

    revalidatePath("/admin/sms");

    return {
        ...result,
        message: trimmedMessage,
        tagIds: data.tagIds,
    };
}

/**
 * Get blast SMS campaign history
 */
export async function getBlastSMSHistory(options?: {
    limit?: number;
    offset?: number;
}) {
    await requireAdmin();

    const { limit = 20, offset = 0 } = options || {};

    const [logs, total] = await Promise.all([
        prisma.blastSMSLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
            include: {
                sentBy: { select: { id: true, name: true } },
            },
        }),
        prisma.blastSMSLog.count(),
    ]);

    // Fetch tag names for display
    const allTagIds = [...new Set(logs.flatMap((log) => log.tagIds))];
    const tags = await prisma.contactTag.findMany({
        where: { id: { in: allTagIds } },
        select: { id: true, name: true, color: true },
    });

    const tagMap = new Map(tags.map((t) => [t.id, t]));

    const logsWithTags = logs.map((log) => ({
        ...log,
        tags: log.tagIds.map((id) => tagMap.get(id)).filter(Boolean),
    }));

    return { logs: logsWithTags, total };
}

/**
 * Get blast SMS statistics
 */
export async function getBlastSMSStats() {
    await requireAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [todayBlasts, monthBlasts, totalRecipients, totalSuccess, totalFailed] =
        await Promise.all([
            prisma.blastSMSLog.count({
                where: { createdAt: { gte: today } },
            }),
            prisma.blastSMSLog.count({
                where: { createdAt: { gte: thisMonth } },
            }),
            prisma.blastSMSLog.aggregate({
                _sum: { recipientCount: true },
                where: { createdAt: { gte: thisMonth } },
            }),
            prisma.blastSMSLog.aggregate({
                _sum: { successCount: true },
                where: { createdAt: { gte: thisMonth } },
            }),
            prisma.blastSMSLog.aggregate({
                _sum: { failCount: true },
                where: { createdAt: { gte: thisMonth } },
            }),
        ]);

    return {
        todayBlasts,
        monthBlasts,
        totalRecipients: totalRecipients._sum.recipientCount || 0,
        totalSuccess: totalSuccess._sum.successCount || 0,
        totalFailed: totalFailed._sum.failCount || 0,
    };
}
