"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Convert title to URL-friendly slug
function createSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 100);
}

export interface CreateSOPData {
    title: string;
    description?: string;
    content: string;
    category?: string;
    isPublished?: boolean;
    order?: number;
}

export interface UpdateSOPData {
    title?: string;
    description?: string;
    content?: string;
    category?: string;
    isPublished?: boolean;
    order?: number;
}

// Create a new SOP (Admin only)
export async function createSOP(data: CreateSOPData) {
    const session = await requireAdmin();

    // Generate unique slug
    let slug = createSlug(data.title);
    let slugExists = await prisma.sOP.findUnique({ where: { slug } });
    let counter = 1;
    while (slugExists) {
        slug = `${createSlug(data.title)}-${counter}`;
        slugExists = await prisma.sOP.findUnique({ where: { slug } });
        counter++;
    }

    const sop = await prisma.sOP.create({
        data: {
            title: data.title,
            slug,
            description: data.description,
            content: data.content,
            category: data.category,
            isPublished: data.isPublished ?? true,
            order: data.order ?? 0,
            createdById: session.user.id,
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "SOP",
        sop.id,
        { title: data.title, category: data.category }
    );

    revalidatePath("/sops");
    revalidatePath("/admin/sops");
    return sop;
}

// Get all SOPs (for listing)
export async function getAllSOPs(options?: { includeUnpublished?: boolean }) {
    await requireAuth();

    const where = options?.includeUnpublished ? {} : { isPublished: true };

    return prisma.sOP.findMany({
        where,
        include: {
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: [
            { category: "asc" },
            { order: "asc" },
            { title: "asc" },
        ],
    });
}

// Get SOPs grouped by category
export async function getSOPsByCategory() {
    await requireAuth();

    const sops = await prisma.sOP.findMany({
        where: { isPublished: true },
        select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            category: true,
            order: true,
        },
        orderBy: [
            { category: "asc" },
            { order: "asc" },
            { title: "asc" },
        ],
    });

    // Group by category
    const grouped: Record<string, typeof sops> = {};
    for (const sop of sops) {
        const category = sop.category || "General";
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(sop);
    }

    return grouped;
}

// Get a single SOP by slug
export async function getSOPBySlug(slug: string) {
    await requireAuth();

    return prisma.sOP.findUnique({
        where: { slug },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
    });
}

// Get a single SOP by ID (for editing)
export async function getSOPById(id: string) {
    await requireAdmin();

    return prisma.sOP.findUnique({
        where: { id },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
    });
}

// Update an SOP (Admin only)
export async function updateSOP(id: string, data: UpdateSOPData) {
    const session = await requireAdmin();

    // If title changed, update slug
    let slug: string | undefined;
    if (data.title) {
        const currentSOP = await prisma.sOP.findUnique({ where: { id } });
        if (currentSOP && data.title !== currentSOP.title) {
            slug = createSlug(data.title);
            let slugExists = await prisma.sOP.findFirst({
                where: { slug, id: { not: id } },
            });
            let counter = 1;
            while (slugExists) {
                slug = `${createSlug(data.title)}-${counter}`;
                slugExists = await prisma.sOP.findFirst({
                    where: { slug, id: { not: id } },
                });
                counter++;
            }
        }
    }

    const sop = await prisma.sOP.update({
        where: { id },
        data: {
            title: data.title,
            slug,
            description: data.description,
            content: data.content,
            category: data.category,
            isPublished: data.isPublished,
            order: data.order,
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "SOP",
        id,
        data
    );

    revalidatePath("/sops");
    revalidatePath(`/sops/${sop.slug}`);
    revalidatePath("/admin/sops");
    return sop;
}

// Delete an SOP (Admin only)
export async function deleteSOP(id: string) {
    const session = await requireAdmin();

    const sop = await prisma.sOP.delete({
        where: { id },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "SOP",
        id,
        { title: sop.title }
    );

    revalidatePath("/sops");
    revalidatePath("/admin/sops");
    return sop;
}

// Toggle publish status
export async function toggleSOPPublished(id: string) {
    const session = await requireAdmin();

    const currentSOP = await prisma.sOP.findUnique({ where: { id } });
    if (!currentSOP) throw new Error("SOP not found");

    const sop = await prisma.sOP.update({
        where: { id },
        data: { isPublished: !currentSOP.isPublished },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "SOP",
        id,
        { isPublished: sop.isPublished }
    );

    revalidatePath("/sops");
    revalidatePath("/admin/sops");
    return sop;
}

// Reorder SOPs
export async function reorderSOPs(sopIds: string[]) {
    await requireAdmin();

    const updates = sopIds.map((id, index) =>
        prisma.sOP.update({
            where: { id },
            data: { order: index },
        })
    );

    await prisma.$transaction(updates);

    revalidatePath("/sops");
    revalidatePath("/admin/sops");
}

// Get SOP categories
export async function getSOPCategories() {
    await requireAuth();

    const categories = await prisma.sOP.findMany({
        where: { isPublished: true },
        select: { category: true },
        distinct: ["category"],
    });

    return categories
        .map((c) => c.category)
        .filter((c): c is string => c !== null)
        .sort();
}
