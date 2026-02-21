"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Get all affiliates with optional filter
export async function getAffiliatesWithStatus(status?: "all" | "pending" | "approved") {
    await requireAuth();

    const where = status === "pending"
        ? { isApproved: false }
        : status === "approved"
            ? { isApproved: true }
            : {};

    return await prisma.affiliate.findMany({
        where,
        orderBy: [
            { isApproved: "asc" },
            { createdAt: "desc" },
        ],
        include: {
            submittedBy: { select: { id: true, name: true, email: true } },
        },
    });
}

// Get pending affiliates count (for admin badge)
export async function getPendingAffiliatesCount() {
    await requireAdmin();

    return await prisma.affiliate.count({
        where: { isApproved: false },
    });
}

// Approve an affiliate (ADMIN/SUPER_ADMIN only)
export async function approveAffiliate(id: string, adminNotes?: string) {
    const session = await requireAdmin();

    const affiliate = await prisma.affiliate.update({
        where: { id },
        data: {
            isApproved: true,
        },
    });

    await createAuditLog(
        session.user.id,
        "APPROVE",
        "Affiliate",
        id,
        { name: affiliate.name, adminNotes }
    );

    revalidatePath("/affiliates");
    return affiliate;
}

// Reject/Delete an affiliate (ADMIN/SUPER_ADMIN only)
export async function rejectAffiliate(id: string, reason?: string) {
    const session = await requireAdmin();

    const affiliate = await prisma.affiliate.findUnique({
        where: { id },
        select: { name: true },
    });

    await prisma.affiliate.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "REJECT",
        "Affiliate",
        id,
        { name: affiliate?.name, reason }
    );

    revalidatePath("/affiliates");
}

// Update an affiliate (ADMIN/SUPER_ADMIN only)
export async function updateAffiliate(
    id: string,
    data: {
        name?: string;
        email?: string;
        market?: string;
        notes?: string;
        cityTransferRate?: string;
    }
) {
    const session = await requireAdmin();

    const affiliate = await prisma.affiliate.update({
        where: { id },
        data,
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "Affiliate",
        id,
        data
    );

    revalidatePath("/affiliates");
    return affiliate;
}

// Delete an approved affiliate (ADMIN/SUPER_ADMIN only)
export async function deleteAffiliate(id: string) {
    const session = await requireAdmin();

    const affiliate = await prisma.affiliate.findUnique({
        where: { id },
        select: { name: true },
    });

    await prisma.affiliate.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "Affiliate",
        id,
        { name: affiliate?.name }
    );

    revalidatePath("/affiliates");
}
