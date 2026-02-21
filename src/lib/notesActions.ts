"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

// Get all global notes (any authenticated user can view)
export async function getGlobalNotes() {
    await requireAuth();

    return await prisma.globalNote.findMany({
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
    });
}

// Create a new global note (ADMIN/SUPER_ADMIN only)
export async function createGlobalNote(data: {
    authorId: string;
    title: string;
    content: string;
}) {
    const session = await requireAdmin();

    const note = await prisma.globalNote.create({
        data,
        include: { author: { select: { id: true, name: true } } },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "GlobalNote",
        note.id,
        { title: data.title }
    );

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

// Update a global note (ADMIN/SUPER_ADMIN only)
export async function updateGlobalNote(
    id: string,
    data: { title?: string; content?: string }
) {
    const session = await requireAdmin();

    const note = await prisma.globalNote.update({
        where: { id },
        data,
        include: { author: { select: { id: true, name: true } } },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "GlobalNote",
        id,
        data
    );

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

// Delete a global note (ADMIN/SUPER_ADMIN only)
export async function deleteGlobalNote(id: string) {
    const session = await requireAdmin();

    await prisma.globalNote.delete({ where: { id } });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "GlobalNote",
        id
    );

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
}
