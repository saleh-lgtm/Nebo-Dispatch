"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Get all global notes
export async function getGlobalNotes() {
    return await prisma.globalNote.findMany({
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
    });
}

// Create a new global note
export async function createGlobalNote(data: {
    authorId: string;
    title: string;
    content: string;
}) {
    const note = await prisma.globalNote.create({
        data,
        include: { author: { select: { id: true, name: true } } },
    });

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

// Update a global note
export async function updateGlobalNote(
    id: string,
    data: { title?: string; content?: string }
) {
    const note = await prisma.globalNote.update({
        where: { id },
        data,
        include: { author: { select: { id: true, name: true } } },
    });

    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
    return note;
}

// Delete a global note
export async function deleteGlobalNote(id: string) {
    await prisma.globalNote.delete({ where: { id } });
    revalidatePath("/admin/notes");
    revalidatePath("/dashboard");
}
