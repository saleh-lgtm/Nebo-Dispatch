"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { z } from "zod";
import {
    createSOPSchema,
    updateSOPSchema,
    createSOPQuizSchema,
    submitQuizAttemptSchema,
    sopSearchSchema,
    quizQuestionDataSchema,
} from "./schemas";

const idSchema = z.string().min(1, "ID is required");
const sopIdsSchema = z.array(z.string().min(1));

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
    quickReference?: string;
    requiresAcknowledgment?: boolean;
    relatedSopIds?: string[];
}

export interface UpdateSOPData {
    title?: string;
    description?: string;
    content?: string;
    category?: string;
    isPublished?: boolean;
    order?: number;
    quickReference?: string;
    requiresAcknowledgment?: boolean;
    relatedSopIds?: string[];
    changeNote?: string; // For version history
}

export interface QuizQuestionData {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
}

// Create a new SOP (Admin only)
export async function createSOP(data: CreateSOPData) {
    try {
        const session = await requireAdmin();

        const parseResult = createSOPSchema.safeParse(data);
        if (!parseResult.success) {
            const errors = parseResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

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
                quickReference: data.quickReference,
                requiresAcknowledgment: data.requiresAcknowledgment ?? false,
                createdById: session.user.id,
            },
        });

        // Add related SOPs if provided
        if (data.relatedSopIds && data.relatedSopIds.length > 0) {
            for (const relatedId of data.relatedSopIds) {
                await prisma.$transaction([
                    prisma.sOPRelated.create({
                        data: { fromSopId: sop.id, toSopId: relatedId },
                    }),
                    prisma.sOPRelated.create({
                        data: { fromSopId: relatedId, toSopId: sop.id },
                    }),
                ]);
            }
        }

        await createAuditLog(
            session.user.id,
            "CREATE",
            "SOP",
            sop.id,
            { title: data.title, category: data.category }
        );

        revalidatePath("/sops");
        revalidatePath("/admin/sops");
        return { success: true, data: sop };
    } catch (error) {
        console.error("createSOP error:", error);
        return { success: false, error: "Failed to create SOP" };
    }
}

// Get all SOPs (for listing)
export async function getAllSOPs(options?: { includeUnpublished?: boolean }) {
    try {
        await requireAuth();

        const where = options?.includeUnpublished ? {} : { isPublished: true };

        const data = await prisma.sOP.findMany({
            where,
            include: {
                createdBy: { select: { id: true, name: true } },
                _count: { select: { reads: true, favorites: true } },
            },
            orderBy: [
                { category: "asc" },
                { order: "asc" },
                { title: "asc" },
            ],
        });

        return { success: true, data };
    } catch (error) {
        console.error("getAllSOPs error:", error);
        return { success: false, error: "Failed to get SOPs", data: [] };
    }
}

// Get SOPs grouped by category
export async function getSOPsByCategory() {
    try {
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

        return { success: true, data: grouped };
    } catch (error) {
        console.error("getSOPsByCategory error:", error);
        return { success: false, error: "Failed to get SOPs by category", data: {} };
    }
}

// Get a single SOP by slug
export async function getSOPBySlug(slug: string) {
    try {
        await requireAuth();

        const slugResult = z.string().min(1).max(200).safeParse(slug);
        if (!slugResult.success) {
            return { success: false, error: "Invalid slug" };
        }

        const data = await prisma.sOP.findUnique({
            where: { slug },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getSOPBySlug error:", error);
        return { success: false, error: "Failed to get SOP" };
    }
}

// Get a single SOP by ID (for editing)
export async function getSOPById(id: string) {
    try {
        await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const data = await prisma.sOP.findUnique({
            where: { id },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getSOPById error:", error);
        return { success: false, error: "Failed to get SOP" };
    }
}

// Update an SOP (Admin only)
export async function updateSOP(id: string, data: UpdateSOPData) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const dataResult = updateSOPSchema.safeParse(data);
        if (!dataResult.success) {
            const errors = dataResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

        const currentSOP = await prisma.sOP.findUnique({ where: { id } });
        if (!currentSOP) {
            return { success: false, error: "SOP not found" };
        }

        // Create version history if content changed
        const contentChanged = data.content && data.content !== currentSOP.content;
        const titleChanged = data.title && data.title !== currentSOP.title;

        if (contentChanged || titleChanged) {
            // Get latest version number
            const latestVersion = await prisma.sOPVersion.findFirst({
                where: { sopId: id },
                orderBy: { version: "desc" },
            });
            const newVersion = (latestVersion?.version || 0) + 1;

            await prisma.sOPVersion.create({
                data: {
                    sopId: id,
                    version: newVersion,
                    title: currentSOP.title,
                    content: currentSOP.content,
                    description: currentSOP.description,
                    quickReference: currentSOP.quickReference,
                    createdById: session.user.id,
                    changeNote: data.changeNote,
                },
            });
        }

        // If title changed, update slug
        let slug: string | undefined;
        if (titleChanged) {
            slug = createSlug(data.title!);
            let slugExists = await prisma.sOP.findFirst({
                where: { slug, id: { not: id } },
            });
            let counter = 1;
            while (slugExists) {
                slug = `${createSlug(data.title!)}-${counter}`;
                slugExists = await prisma.sOP.findFirst({
                    where: { slug, id: { not: id } },
                });
                counter++;
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
                quickReference: data.quickReference,
                requiresAcknowledgment: data.requiresAcknowledgment,
            },
        });

        // Update related SOPs if provided
        if (data.relatedSopIds !== undefined) {
            // Remove existing relations
            await prisma.sOPRelated.deleteMany({
                where: { OR: [{ fromSopId: id }, { toSopId: id }] },
            });

            // Add new relations
            for (const relatedId of data.relatedSopIds) {
                await prisma.$transaction([
                    prisma.sOPRelated.create({
                        data: { fromSopId: id, toSopId: relatedId },
                    }),
                    prisma.sOPRelated.create({
                        data: { fromSopId: relatedId, toSopId: id },
                    }),
                ]);
            }
        }

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "SOP",
            id,
            data as Record<string, unknown>
        );

        revalidatePath("/sops");
        revalidatePath(`/sops/${sop.slug}`);
        revalidatePath("/admin/sops");
        return { success: true, data: sop };
    } catch (error) {
        console.error("updateSOP error:", error);
        return { success: false, error: "Failed to update SOP" };
    }
}

// Delete an SOP (Admin only)
export async function deleteSOP(id: string) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

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
        return { success: true, data: sop };
    } catch (error) {
        console.error("deleteSOP error:", error);
        return { success: false, error: "Failed to delete SOP" };
    }
}

// Toggle publish status
export async function toggleSOPPublished(id: string) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(id);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const currentSOP = await prisma.sOP.findUnique({ where: { id } });
        if (!currentSOP) {
            return { success: false, error: "SOP not found" };
        }

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
        return { success: true, data: sop };
    } catch (error) {
        console.error("toggleSOPPublished error:", error);
        return { success: false, error: "Failed to toggle publish status" };
    }
}

// Reorder SOPs
export async function reorderSOPs(sopIds: string[]) {
    try {
        await requireAdmin();

        const idsResult = sopIdsSchema.safeParse(sopIds);
        if (!idsResult.success) {
            return { success: false, error: "Invalid SOP IDs" };
        }

        const updates = sopIds.map((id, index) =>
            prisma.sOP.update({
                where: { id },
                data: { order: index },
            })
        );

        await prisma.$transaction(updates);

        revalidatePath("/sops");
        revalidatePath("/admin/sops");
        return { success: true };
    } catch (error) {
        console.error("reorderSOPs error:", error);
        return { success: false, error: "Failed to reorder SOPs" };
    }
}

// Get SOP categories
export async function getSOPCategories() {
    try {
        await requireAuth();

        const categories = await prisma.sOP.findMany({
            where: { isPublished: true },
            select: { category: true },
            distinct: ["category"],
        });

        const data = categories
            .map((c) => c.category)
            .filter((c): c is string => c !== null)
            .sort();

        return { success: true, data };
    } catch (error) {
        console.error("getSOPCategories error:", error);
        return { success: false, error: "Failed to get categories", data: [] };
    }
}

// ============================================
// SEARCH
// ============================================

export async function searchSOPs(query: string) {
    try {
        await requireAuth();

        const parseResult = sopSearchSchema.safeParse({ query });
        if (!parseResult.success) {
            return { success: true, data: [] };
        }

        const searchTerms = query.toLowerCase().trim();
        if (!searchTerms) return { success: true, data: [] };

        const data = await prisma.sOP.findMany({
            where: {
                isPublished: true,
                OR: [
                    { title: { contains: searchTerms, mode: "insensitive" } },
                    { description: { contains: searchTerms, mode: "insensitive" } },
                    { content: { contains: searchTerms, mode: "insensitive" } },
                    { category: { contains: searchTerms, mode: "insensitive" } },
                ],
            },
            select: {
                id: true,
                title: true,
                slug: true,
                description: true,
                category: true,
            },
            orderBy: { title: "asc" },
            take: 20,
        });

        return { success: true, data };
    } catch (error) {
        console.error("searchSOPs error:", error);
        return { success: false, error: "Failed to search SOPs", data: [] };
    }
}

// ============================================
// READ TRACKING & ACKNOWLEDGMENT
// ============================================

export async function markSOPAsRead(sopId: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const data = await prisma.sOPRead.upsert({
            where: {
                sopId_userId: { sopId, userId: session.user.id },
            },
            create: {
                sopId,
                userId: session.user.id,
            },
            update: {
                readAt: new Date(),
            },
        });

        return { success: true, data };
    } catch (error) {
        console.error("markSOPAsRead error:", error);
        return { success: false, error: "Failed to mark SOP as read" };
    }
}

export async function acknowledgesSOP(sopId: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const data = await prisma.sOPRead.upsert({
            where: {
                sopId_userId: { sopId, userId: session.user.id },
            },
            create: {
                sopId,
                userId: session.user.id,
                acknowledged: true,
                acknowledgedAt: new Date(),
            },
            update: {
                acknowledged: true,
                acknowledgedAt: new Date(),
            },
        });

        revalidatePath(`/sops`);
        return { success: true, data };
    } catch (error) {
        console.error("acknowledgesSOP error:", error);
        return { success: false, error: "Failed to acknowledge SOP" };
    }
}

export async function getSOPReadStatus(sopId: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const data = await prisma.sOPRead.findUnique({
            where: {
                sopId_userId: { sopId, userId: session.user.id },
            },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getSOPReadStatus error:", error);
        return { success: false, error: "Failed to get read status" };
    }
}

export async function getSOPReadStats(sopId: string) {
    try {
        await requireAdmin();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const [totalReads, totalAcknowledged, reads] = await Promise.all([
            prisma.sOPRead.count({ where: { sopId } }),
            prisma.sOPRead.count({ where: { sopId, acknowledged: true } }),
            prisma.sOPRead.findMany({
                where: { sopId },
                include: { user: { select: { id: true, name: true } } },
                orderBy: { readAt: "desc" },
            }),
        ]);

        return { success: true, data: { totalReads, totalAcknowledged, reads } };
    } catch (error) {
        console.error("getSOPReadStats error:", error);
        return { success: false, error: "Failed to get read stats" };
    }
}

export async function getUnacknowledgedSOPs(userId: string) {
    try {
        await requireAuth();

        const userIdResult = idSchema.safeParse(userId);
        if (!userIdResult.success) {
            return { success: true, data: [] };
        }

        const sops = await prisma.sOP.findMany({
            where: {
                isPublished: true,
                requiresAcknowledgment: true,
            },
            include: {
                reads: {
                    where: { userId, acknowledged: true },
                },
            },
        });

        return { success: true, data: sops.filter((sop) => sop.reads.length === 0) };
    } catch (error) {
        console.error("getUnacknowledgedSOPs error:", error);
        return { success: false, error: "Failed to get unacknowledged SOPs", data: [] };
    }
}

// ============================================
// FAVORITES / BOOKMARKS
// ============================================

export async function toggleSOPFavorite(sopId: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const existing = await prisma.sOPFavorite.findUnique({
            where: {
                sopId_userId: { sopId, userId: session.user.id },
            },
        });

        if (existing) {
            await prisma.sOPFavorite.delete({
                where: { id: existing.id },
            });
            revalidatePath("/sops");
            return { success: true, data: { favorited: false } };
        } else {
            await prisma.sOPFavorite.create({
                data: { sopId, userId: session.user.id },
            });
            revalidatePath("/sops");
            return { success: true, data: { favorited: true } };
        }
    } catch (error) {
        console.error("toggleSOPFavorite error:", error);
        return { success: false, error: "Failed to toggle favorite" };
    }
}

export async function getFavoriteSOPs() {
    try {
        const session = await requireAuth();

        const favorites = await prisma.sOPFavorite.findMany({
            where: { userId: session.user.id },
            include: {
                sop: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        description: true,
                        category: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return { success: true, data: favorites.map((f) => f.sop) };
    } catch (error) {
        console.error("getFavoriteSOPs error:", error);
        return { success: false, error: "Failed to get favorites", data: [] };
    }
}

export async function isSOPFavorited(sopId: string) {
    try {
        const session = await requireAuth();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const favorite = await prisma.sOPFavorite.findUnique({
            where: {
                sopId_userId: { sopId, userId: session.user.id },
            },
        });

        return { success: true, data: !!favorite };
    } catch (error) {
        console.error("isSOPFavorited error:", error);
        return { success: false, error: "Failed to check favorite status" };
    }
}

// ============================================
// RELATED SOPs
// ============================================

export async function addRelatedSOP(fromSopId: string, toSopId: string) {
    try {
        await requireAdmin();

        const fromResult = idSchema.safeParse(fromSopId);
        const toResult = idSchema.safeParse(toSopId);
        if (!fromResult.success || !toResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        // Create bidirectional relationship
        await prisma.$transaction([
            prisma.sOPRelated.upsert({
                where: { fromSopId_toSopId: { fromSopId, toSopId } },
                create: { fromSopId, toSopId },
                update: {},
            }),
            prisma.sOPRelated.upsert({
                where: { fromSopId_toSopId: { fromSopId: toSopId, toSopId: fromSopId } },
                create: { fromSopId: toSopId, toSopId: fromSopId },
                update: {},
            }),
        ]);

        revalidatePath("/admin/sops");
        return { success: true };
    } catch (error) {
        console.error("addRelatedSOP error:", error);
        return { success: false, error: "Failed to add related SOP" };
    }
}

export async function removeRelatedSOP(fromSopId: string, toSopId: string) {
    try {
        await requireAdmin();

        const fromResult = idSchema.safeParse(fromSopId);
        const toResult = idSchema.safeParse(toSopId);
        if (!fromResult.success || !toResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        await prisma.$transaction([
            prisma.sOPRelated.deleteMany({
                where: { fromSopId, toSopId },
            }),
            prisma.sOPRelated.deleteMany({
                where: { fromSopId: toSopId, toSopId: fromSopId },
            }),
        ]);

        revalidatePath("/admin/sops");
        return { success: true };
    } catch (error) {
        console.error("removeRelatedSOP error:", error);
        return { success: false, error: "Failed to remove related SOP" };
    }
}

export async function getRelatedSOPs(sopId: string) {
    try {
        await requireAuth();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID", data: [] };
        }

        const related = await prisma.sOPRelated.findMany({
            where: { fromSopId: sopId },
            include: {
                toSop: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        description: true,
                        category: true,
                        isPublished: true,
                    },
                },
            },
        });

        return { success: true, data: related.map((r) => r.toSop).filter((sop) => sop.isPublished) };
    } catch (error) {
        console.error("getRelatedSOPs error:", error);
        return { success: false, error: "Failed to get related SOPs", data: [] };
    }
}

// ============================================
// VERSION HISTORY
// ============================================

export async function createSOPVersion(
    sopId: string,
    changeNote?: string
) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const sop = await prisma.sOP.findUnique({ where: { id: sopId } });
        if (!sop) {
            return { success: false, error: "SOP not found" };
        }

        // Get the latest version number
        const latestVersion = await prisma.sOPVersion.findFirst({
            where: { sopId },
            orderBy: { version: "desc" },
        });

        const newVersion = (latestVersion?.version || 0) + 1;

        const data = await prisma.sOPVersion.create({
            data: {
                sopId,
                version: newVersion,
                title: sop.title,
                content: sop.content,
                description: sop.description,
                quickReference: sop.quickReference,
                createdById: session.user.id,
                changeNote,
            },
        });

        return { success: true, data };
    } catch (error) {
        console.error("createSOPVersion error:", error);
        return { success: false, error: "Failed to create SOP version" };
    }
}

export async function getSOPVersions(sopId: string) {
    try {
        await requireAdmin();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID", data: [] };
        }

        const data = await prisma.sOPVersion.findMany({
            where: { sopId },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { version: "desc" },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getSOPVersions error:", error);
        return { success: false, error: "Failed to get SOP versions", data: [] };
    }
}

export async function getSOPVersion(sopId: string, version: number) {
    try {
        await requireAdmin();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const versionResult = z.number().min(1).safeParse(version);
        if (!versionResult.success) {
            return { success: false, error: "Invalid version number" };
        }

        const data = await prisma.sOPVersion.findUnique({
            where: { sopId_version: { sopId, version } },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getSOPVersion error:", error);
        return { success: false, error: "Failed to get SOP version" };
    }
}

export async function restoreSOPVersion(sopId: string, version: number) {
    try {
        const session = await requireAdmin();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const versionResult = z.number().min(1).safeParse(version);
        if (!versionResult.success) {
            return { success: false, error: "Invalid version number" };
        }

        const versionData = await prisma.sOPVersion.findUnique({
            where: { sopId_version: { sopId, version } },
        });

        if (!versionData) {
            return { success: false, error: "Version not found" };
        }

        // Create a new version from current state before restoring
        await createSOPVersion(sopId, `Before restoring to version ${version}`);

        // Restore the old version
        const sop = await prisma.sOP.update({
            where: { id: sopId },
            data: {
                title: versionData.title,
                content: versionData.content,
                description: versionData.description,
                quickReference: versionData.quickReference,
            },
        });

        await createAuditLog(
            session.user.id,
            "UPDATE",
            "SOP",
            sopId,
            { action: "restored", fromVersion: version }
        );

        revalidatePath("/sops");
        revalidatePath("/admin/sops");
        return { success: true, data: sop };
    } catch (error) {
        console.error("restoreSOPVersion error:", error);
        return { success: false, error: "Failed to restore SOP version" };
    }
}

// ============================================
// QUIZ SYSTEM
// ============================================

export async function createSOPQuiz(
    sopId: string,
    questions: QuizQuestionData[],
    title?: string,
    passingScore?: number
) {
    try {
        await requireAdmin();

        const parseResult = createSOPQuizSchema.safeParse({ sopId, questions, title, passingScore });
        if (!parseResult.success) {
            const errors = parseResult.error.flatten().fieldErrors;
            const firstError = Object.values(errors)[0]?.[0] || "Invalid input";
            return { success: false, error: firstError };
        }

        const quiz = await prisma.sOPQuiz.create({
            data: {
                sopId,
                title,
                passingScore: passingScore || 80,
                questions: {
                    create: questions.map((q, index) => ({
                        question: q.question,
                        options: JSON.stringify(q.options),
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation,
                        order: index,
                    })),
                },
            },
            include: { questions: true },
        });

        revalidatePath("/admin/sops");
        return { success: true, data: quiz };
    } catch (error) {
        console.error("createSOPQuiz error:", error);
        return { success: false, error: "Failed to create quiz" };
    }
}

export async function updateSOPQuiz(
    quizId: string,
    questions: QuizQuestionData[],
    title?: string,
    passingScore?: number
) {
    try {
        await requireAdmin();

        const idResult = idSchema.safeParse(quizId);
        if (!idResult.success) {
            return { success: false, error: "Invalid quiz ID" };
        }

        const questionsResult = z.array(quizQuestionDataSchema).min(1).safeParse(questions);
        if (!questionsResult.success) {
            return { success: false, error: "Invalid quiz questions" };
        }

        // Delete existing questions
        await prisma.sOPQuizQuestion.deleteMany({ where: { quizId } });

        // Update quiz and create new questions
        const quiz = await prisma.sOPQuiz.update({
            where: { id: quizId },
            data: {
                title,
                passingScore: passingScore || 80,
                questions: {
                    create: questions.map((q, index) => ({
                        question: q.question,
                        options: JSON.stringify(q.options),
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation,
                        order: index,
                    })),
                },
            },
            include: { questions: { orderBy: { order: "asc" } } },
        });

        revalidatePath("/admin/sops");
        return { success: true, data: quiz };
    } catch (error) {
        console.error("updateSOPQuiz error:", error);
        return { success: false, error: "Failed to update quiz" };
    }
}

export async function deleteSOPQuiz(quizId: string) {
    try {
        await requireAdmin();

        const idResult = idSchema.safeParse(quizId);
        if (!idResult.success) {
            return { success: false, error: "Invalid quiz ID" };
        }

        await prisma.sOPQuiz.delete({ where: { id: quizId } });
        revalidatePath("/admin/sops");
        return { success: true };
    } catch (error) {
        console.error("deleteSOPQuiz error:", error);
        return { success: false, error: "Failed to delete quiz" };
    }
}

export async function getSOPQuiz(sopId: string) {
    try {
        await requireAuth();

        const idResult = idSchema.safeParse(sopId);
        if (!idResult.success) {
            return { success: false, error: "Invalid SOP ID" };
        }

        const data = await prisma.sOPQuiz.findUnique({
            where: { sopId },
            include: {
                questions: { orderBy: { order: "asc" } },
            },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getSOPQuiz error:", error);
        return { success: false, error: "Failed to get quiz" };
    }
}

export async function submitQuizAttempt(
    quizId: string,
    answers: number[]
) {
    try {
        const session = await requireAuth();

        const parseResult = submitQuizAttemptSchema.safeParse({ quizId, answers });
        if (!parseResult.success) {
            return { success: false, error: "Invalid quiz submission" };
        }

        const quiz = await prisma.sOPQuiz.findUnique({
            where: { id: quizId },
            include: { questions: { orderBy: { order: "asc" } } },
        });

        if (!quiz) {
            return { success: false, error: "Quiz not found" };
        }

        // Calculate score
        let correct = 0;
        quiz.questions.forEach((q, index) => {
            if (answers[index] === q.correctAnswer) correct++;
        });

        const score = Math.round((correct / quiz.questions.length) * 100);
        const passed = score >= quiz.passingScore;

        const attempt = await prisma.sOPQuizAttempt.create({
            data: {
                quizId,
                userId: session.user.id,
                score,
                passed,
                answers: JSON.stringify(answers),
                completedAt: new Date(),
            },
        });

        // If passed, also acknowledge the SOP
        if (passed) {
            await prisma.sOPRead.upsert({
                where: {
                    sopId_userId: { sopId: quiz.sopId, userId: session.user.id },
                },
                create: {
                    sopId: quiz.sopId,
                    userId: session.user.id,
                    acknowledged: true,
                    acknowledgedAt: new Date(),
                },
                update: {
                    acknowledged: true,
                    acknowledgedAt: new Date(),
                },
            });
        }

        revalidatePath("/sops");
        return { success: true, data: { attempt, score, passed, correct, total: quiz.questions.length } };
    } catch (error) {
        console.error("submitQuizAttempt error:", error);
        return { success: false, error: "Failed to submit quiz" };
    }
}

export async function getQuizAttempts(quizId: string) {
    try {
        await requireAdmin();

        const idResult = idSchema.safeParse(quizId);
        if (!idResult.success) {
            return { success: false, error: "Invalid quiz ID", data: [] };
        }

        const data = await prisma.sOPQuizAttempt.findMany({
            where: { quizId },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { completedAt: "desc" },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getQuizAttempts error:", error);
        return { success: false, error: "Failed to get quiz attempts", data: [] };
    }
}

export async function getUserQuizAttempts(userId: string, sopId: string) {
    try {
        await requireAuth();

        const userIdResult = idSchema.safeParse(userId);
        const sopIdResult = idSchema.safeParse(sopId);
        if (!userIdResult.success || !sopIdResult.success) {
            return { success: false, error: "Invalid ID", data: [] };
        }

        const quiz = await prisma.sOPQuiz.findUnique({ where: { sopId } });
        if (!quiz) return { success: true, data: [] };

        const data = await prisma.sOPQuizAttempt.findMany({
            where: { quizId: quiz.id, userId },
            orderBy: { completedAt: "desc" },
        });

        return { success: true, data };
    } catch (error) {
        console.error("getUserQuizAttempts error:", error);
        return { success: false, error: "Failed to get quiz attempts", data: [] };
    }
}

// ============================================
// EXTENDED SOP RETRIEVAL
// ============================================

export async function getSOPWithDetails(slug: string) {
    try {
        const session = await requireAuth();

        const slugResult = z.string().min(1).max(200).safeParse(slug);
        if (!slugResult.success) {
            return { success: false, error: "Invalid slug" };
        }

        const sop = await prisma.sOP.findUnique({
            where: { slug },
            include: {
                createdBy: { select: { id: true, name: true } },
                relatedFrom: {
                    include: {
                        toSop: {
                            select: { id: true, title: true, slug: true, description: true, isPublished: true },
                        },
                    },
                },
                quiz: {
                    include: {
                        questions: { orderBy: { order: "asc" } },
                    },
                },
            },
        });

        if (!sop) return { success: true, data: null };

        // Get user's read/acknowledgment status
        const readStatus = await prisma.sOPRead.findUnique({
            where: { sopId_userId: { sopId: sop.id, userId: session.user.id } },
        });

        // Get favorite status
        const favorite = await prisma.sOPFavorite.findUnique({
            where: { sopId_userId: { sopId: sop.id, userId: session.user.id } },
        });

        // Get user's quiz attempts if quiz exists
        let quizAttempts: Awaited<ReturnType<typeof prisma.sOPQuizAttempt.findMany>> = [];
        if (sop.quiz) {
            quizAttempts = await prisma.sOPQuizAttempt.findMany({
                where: { quizId: sop.quiz.id, userId: session.user.id },
                orderBy: { completedAt: "desc" },
                take: 5,
            });
        }

        const relatedSOPs = sop.relatedFrom
            .map((r) => r.toSop)
            .filter((s) => s.isPublished);

        // Mark as read
        await markSOPAsRead(sop.id);

        return {
            success: true,
            data: {
                ...sop,
                relatedSOPs,
                isRead: !!readStatus,
                isAcknowledged: readStatus?.acknowledged || false,
                isFavorited: !!favorite,
                quizAttempts,
                hasPassed: quizAttempts.some((a) => a.passed),
            },
        };
    } catch (error) {
        console.error("getSOPWithDetails error:", error);
        return { success: false, error: "Failed to get SOP details" };
    }
}

// Get SOPs for admin with full stats
export async function getSOPsWithStats() {
    try {
        await requireAdmin();

        const sops = await prisma.sOP.findMany({
            include: {
                createdBy: { select: { id: true, name: true } },
                _count: {
                    select: {
                        reads: true,
                        favorites: true,
                    },
                },
                reads: {
                    where: { acknowledged: true },
                    select: { id: true },
                },
                quiz: {
                    select: { id: true, _count: { select: { attempts: true } } },
                },
            },
            orderBy: [{ category: "asc" }, { order: "asc" }, { title: "asc" }],
        });

        const data = sops.map((sop) => ({
            ...sop,
            readCount: sop._count.reads,
            favoriteCount: sop._count.favorites,
            acknowledgedCount: sop.reads.length,
            hasQuiz: !!sop.quiz,
            quizAttemptCount: sop.quiz?._count.attempts || 0,
        }));

        return { success: true, data };
    } catch (error) {
        console.error("getSOPsWithStats error:", error);
        return { success: false, error: "Failed to get SOPs with stats", data: [] };
    }
}
