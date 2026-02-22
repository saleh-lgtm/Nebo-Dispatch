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
            _count: { select: { reads: true, favorites: true } },
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

    const currentSOP = await prisma.sOP.findUnique({ where: { id } });
    if (!currentSOP) throw new Error("SOP not found");

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

// ============================================
// SEARCH
// ============================================

export async function searchSOPs(query: string) {
    await requireAuth();

    if (!query.trim()) return [];

    const searchTerms = query.toLowerCase().trim();

    return prisma.sOP.findMany({
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
}

// ============================================
// READ TRACKING & ACKNOWLEDGMENT
// ============================================

export async function markSOPAsRead(sopId: string) {
    const session = await requireAuth();

    return prisma.sOPRead.upsert({
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
}

export async function acknowledgesSOP(sopId: string) {
    const session = await requireAuth();

    const read = await prisma.sOPRead.upsert({
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
    return read;
}

export async function getSOPReadStatus(sopId: string) {
    const session = await requireAuth();

    return prisma.sOPRead.findUnique({
        where: {
            sopId_userId: { sopId, userId: session.user.id },
        },
    });
}

export async function getSOPReadStats(sopId: string) {
    await requireAdmin();

    const [totalReads, totalAcknowledged, reads] = await Promise.all([
        prisma.sOPRead.count({ where: { sopId } }),
        prisma.sOPRead.count({ where: { sopId, acknowledged: true } }),
        prisma.sOPRead.findMany({
            where: { sopId },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { readAt: "desc" },
        }),
    ]);

    return { totalReads, totalAcknowledged, reads };
}

export async function getUnacknowledgedSOPs(userId: string) {
    await requireAuth();

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

    return sops.filter((sop) => sop.reads.length === 0);
}

// ============================================
// FAVORITES / BOOKMARKS
// ============================================

export async function toggleSOPFavorite(sopId: string) {
    const session = await requireAuth();

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
        return { favorited: false };
    } else {
        await prisma.sOPFavorite.create({
            data: { sopId, userId: session.user.id },
        });
        revalidatePath("/sops");
        return { favorited: true };
    }
}

export async function getFavoriteSOPs() {
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

    return favorites.map((f) => f.sop);
}

export async function isSOPFavorited(sopId: string) {
    const session = await requireAuth();

    const favorite = await prisma.sOPFavorite.findUnique({
        where: {
            sopId_userId: { sopId, userId: session.user.id },
        },
    });

    return !!favorite;
}

// ============================================
// RELATED SOPs
// ============================================

export async function addRelatedSOP(fromSopId: string, toSopId: string) {
    await requireAdmin();

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
}

export async function removeRelatedSOP(fromSopId: string, toSopId: string) {
    await requireAdmin();

    await prisma.$transaction([
        prisma.sOPRelated.deleteMany({
            where: { fromSopId, toSopId },
        }),
        prisma.sOPRelated.deleteMany({
            where: { fromSopId: toSopId, toSopId: fromSopId },
        }),
    ]);

    revalidatePath("/admin/sops");
}

export async function getRelatedSOPs(sopId: string) {
    await requireAuth();

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

    return related.map((r) => r.toSop).filter((sop) => sop.isPublished);
}

// ============================================
// VERSION HISTORY
// ============================================

export async function createSOPVersion(
    sopId: string,
    changeNote?: string
) {
    const session = await requireAdmin();

    const sop = await prisma.sOP.findUnique({ where: { id: sopId } });
    if (!sop) throw new Error("SOP not found");

    // Get the latest version number
    const latestVersion = await prisma.sOPVersion.findFirst({
        where: { sopId },
        orderBy: { version: "desc" },
    });

    const newVersion = (latestVersion?.version || 0) + 1;

    return prisma.sOPVersion.create({
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
}

export async function getSOPVersions(sopId: string) {
    await requireAdmin();

    return prisma.sOPVersion.findMany({
        where: { sopId },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: { version: "desc" },
    });
}

export async function getSOPVersion(sopId: string, version: number) {
    await requireAdmin();

    return prisma.sOPVersion.findUnique({
        where: { sopId_version: { sopId, version } },
        include: {
            createdBy: { select: { id: true, name: true } },
        },
    });
}

export async function restoreSOPVersion(sopId: string, version: number) {
    const session = await requireAdmin();

    const versionData = await prisma.sOPVersion.findUnique({
        where: { sopId_version: { sopId, version } },
    });

    if (!versionData) throw new Error("Version not found");

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
    return sop;
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
    await requireAdmin();

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
    return quiz;
}

export async function updateSOPQuiz(
    quizId: string,
    questions: QuizQuestionData[],
    title?: string,
    passingScore?: number
) {
    await requireAdmin();

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
    return quiz;
}

export async function deleteSOPQuiz(quizId: string) {
    await requireAdmin();

    await prisma.sOPQuiz.delete({ where: { id: quizId } });
    revalidatePath("/admin/sops");
}

export async function getSOPQuiz(sopId: string) {
    await requireAuth();

    return prisma.sOPQuiz.findUnique({
        where: { sopId },
        include: {
            questions: { orderBy: { order: "asc" } },
        },
    });
}

export async function submitQuizAttempt(
    quizId: string,
    answers: number[]
) {
    const session = await requireAuth();

    const quiz = await prisma.sOPQuiz.findUnique({
        where: { id: quizId },
        include: { questions: { orderBy: { order: "asc" } } },
    });

    if (!quiz) throw new Error("Quiz not found");

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
    return { attempt, score, passed, correct, total: quiz.questions.length };
}

export async function getQuizAttempts(quizId: string) {
    await requireAdmin();

    return prisma.sOPQuizAttempt.findMany({
        where: { quizId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { completedAt: "desc" },
    });
}

export async function getUserQuizAttempts(userId: string, sopId: string) {
    await requireAuth();

    const quiz = await prisma.sOPQuiz.findUnique({ where: { sopId } });
    if (!quiz) return [];

    return prisma.sOPQuizAttempt.findMany({
        where: { quizId: quiz.id, userId },
        orderBy: { completedAt: "desc" },
    });
}

// ============================================
// EXTENDED SOP RETRIEVAL
// ============================================

export async function getSOPWithDetails(slug: string) {
    const session = await requireAuth();

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

    if (!sop) return null;

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
        ...sop,
        relatedSOPs,
        isRead: !!readStatus,
        isAcknowledged: readStatus?.acknowledged || false,
        isFavorited: !!favorite,
        quizAttempts,
        hasPassed: quizAttempts.some((a) => a.passed),
    };
}

// Get SOPs for admin with full stats
export async function getSOPsWithStats() {
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

    return sops.map((sop) => ({
        ...sop,
        readCount: sop._count.reads,
        favoriteCount: sop._count.favorites,
        acknowledgedCount: sop.reads.length,
        hasQuiz: !!sop.quiz,
        quizAttemptCount: sop.quiz?._count.attempts || 0,
    }));
}
