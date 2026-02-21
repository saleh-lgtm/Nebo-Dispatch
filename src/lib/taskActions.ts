"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";

export interface CreateAdminTaskData {
    title: string;
    description?: string;
    assignToAll: boolean;
    assignedToId?: string; // null if assignToAll is true
    priority?: number;
}

// Create a new admin task (ADMIN/SUPER_ADMIN only)
export async function createAdminTask(data: CreateAdminTaskData) {
    const session = await requireAdmin();

    const task = await prisma.adminTask.create({
        data: {
            title: data.title,
            description: data.description,
            assignToAll: data.assignToAll,
            assignedToId: data.assignToAll ? null : data.assignedToId,
            createdById: session.user.id,
            priority: data.priority || 0,
        },
        include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "AdminTask",
        task.id,
        { title: data.title, assignToAll: data.assignToAll, assignedToId: data.assignedToId }
    );

    revalidatePath("/admin/tasks");
    return task;
}

// Get all active admin tasks (ADMIN/SUPER_ADMIN only)
export async function getAdminTasks() {
    await requireAdmin();

    return prisma.adminTask.findMany({
        where: { isActive: true },
        include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
        },
        orderBy: [
            { priority: "desc" },
            { createdAt: "desc" },
        ],
    });
}

// Get admin tasks assigned to a specific dispatcher (for shift clock-in)
export async function getDispatcherAdminTasks(userId: string) {
    await requireAuth();

    return prisma.adminTask.findMany({
        where: {
            isActive: true,
            OR: [
                { assignToAll: true },
                { assignedToId: userId },
            ],
        },
        orderBy: [
            { priority: "desc" },
            { createdAt: "desc" },
        ],
    });
}

// Update an admin task (ADMIN/SUPER_ADMIN only)
export async function updateAdminTask(
    id: string,
    data: Partial<CreateAdminTaskData>
) {
    const session = await requireAdmin();

    const task = await prisma.adminTask.update({
        where: { id },
        data: {
            title: data.title,
            description: data.description,
            assignToAll: data.assignToAll,
            assignedToId: data.assignToAll ? null : data.assignedToId,
            priority: data.priority,
        },
        include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "AdminTask",
        id,
        data
    );

    revalidatePath("/admin/tasks");
    return task;
}

// Delete (deactivate) an admin task (ADMIN/SUPER_ADMIN only)
export async function deleteAdminTask(id: string) {
    const session = await requireAdmin();

    await prisma.adminTask.update({
        where: { id },
        data: { isActive: false },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "AdminTask",
        id
    );

    revalidatePath("/admin/tasks");
}

// Add admin tasks to a shift when clocking in
export async function addAdminTasksToShift(shiftId: string, userId: string) {
    const adminTasks = await getDispatcherAdminTasks(userId);

    if (adminTasks.length === 0) return [];

    const shiftTasks = await prisma.shiftTask.createMany({
        data: adminTasks.map((task) => ({
            shiftId,
            content: task.title,
            isAdminTask: true,
            assignedById: task.createdById,
            priority: task.priority,
        })),
    });

    return shiftTasks;
}
