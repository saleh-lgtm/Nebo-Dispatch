"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { notifyTaskAssigned, notifyTaskAssignedToAll } from "./notificationActions";

export interface CreateAdminTaskData {
    title: string;
    description?: string;
    assignToAll: boolean;
    assignedToId?: string; // null if assignToAll is true
    priority?: number;
    dueDate?: Date | string;
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
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
        },
        include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
            completions: { select: { userId: true, completedAt: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "CREATE",
        "AdminTask",
        task.id,
        { title: data.title, assignToAll: data.assignToAll, assignedToId: data.assignedToId, dueDate: data.dueDate }
    );

    // Notify assigned users about the new task
    if (data.assignToAll) {
        await notifyTaskAssignedToAll(task.id, data.title);
    } else if (data.assignedToId) {
        await notifyTaskAssigned(data.assignedToId, task.id, data.title);
    }

    revalidatePath("/admin/tasks");
    revalidatePath("/dashboard");
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
            completions: {
                include: {
                    user: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: [
            { priority: "desc" },
            { dueDate: "asc" },
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
            dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
        },
        include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
            completions: {
                include: {
                    user: { select: { id: true, name: true } },
                },
            },
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
    revalidatePath("/dashboard");
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

// ============================================
// TASK COMPLETION FUNCTIONS
// ============================================

// Get tasks for a dispatcher's dashboard (with their completion status)
export async function getMyTasks(userId: string) {
    await requireAuth();

    const tasks = await prisma.adminTask.findMany({
        where: {
            isActive: true,
            OR: [
                { assignToAll: true },
                { assignedToId: userId },
            ],
        },
        include: {
            createdBy: { select: { id: true, name: true } },
            completions: {
                where: { userId },
                select: { completedAt: true, notes: true },
            },
        },
        orderBy: [
            { priority: "desc" },
            { dueDate: "asc" },
            { createdAt: "desc" },
        ],
    });

    // Transform to include isCompleted flag
    return tasks.map((task) => ({
        ...task,
        isCompleted: task.completions.length > 0,
        completedAt: task.completions[0]?.completedAt || null,
        completionNotes: task.completions[0]?.notes || null,
    }));
}

// Mark a task as complete (for dispatchers)
export async function completeTask(taskId: string, notes?: string) {
    const session = await requireAuth();

    // Check if task exists and user is assigned
    const task = await prisma.adminTask.findFirst({
        where: {
            id: taskId,
            isActive: true,
            OR: [
                { assignToAll: true },
                { assignedToId: session.user.id },
            ],
        },
    });

    if (!task) {
        throw new Error("Task not found or you are not assigned to it");
    }

    // Create completion record (upsert to handle re-completion)
    const completion = await prisma.adminTaskCompletion.upsert({
        where: {
            taskId_userId: {
                taskId,
                userId: session.user.id,
            },
        },
        create: {
            taskId,
            userId: session.user.id,
            notes,
        },
        update: {
            completedAt: new Date(),
            notes,
        },
        include: {
            task: { select: { title: true } },
        },
    });

    await createAuditLog(
        session.user.id,
        "UPDATE",
        "AdminTaskCompletion",
        completion.id,
        { taskId, action: "completed", notes }
    );

    revalidatePath("/dashboard");
    revalidatePath("/admin/tasks");
    return completion;
}

// Uncomplete a task (for dispatchers - if they made a mistake)
export async function uncompleteTask(taskId: string) {
    const session = await requireAuth();

    await prisma.adminTaskCompletion.delete({
        where: {
            taskId_userId: {
                taskId,
                userId: session.user.id,
            },
        },
    });

    await createAuditLog(
        session.user.id,
        "DELETE",
        "AdminTaskCompletion",
        taskId,
        { action: "uncompleted" }
    );

    revalidatePath("/dashboard");
    revalidatePath("/admin/tasks");
}

// Get task progress for admin dashboard
export async function getTaskProgress() {
    await requireAdmin();

    const tasks = await prisma.adminTask.findMany({
        where: { isActive: true },
        include: {
            assignedTo: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
            completions: {
                include: {
                    user: { select: { id: true, name: true } },
                },
                orderBy: { completedAt: "desc" },
            },
        },
        orderBy: [
            { priority: "desc" },
            { dueDate: "asc" },
            { createdAt: "desc" },
        ],
    });

    // Get total dispatcher count for "assign to all" tasks
    const dispatcherCount = await prisma.user.count({
        where: { role: "DISPATCHER", isActive: true },
    });

    return tasks.map((task) => {
        const targetCount = task.assignToAll ? dispatcherCount : 1;
        const completedCount = task.completions.length;
        const progress = targetCount > 0 ? Math.round((completedCount / targetCount) * 100) : 0;

        return {
            ...task,
            targetCount,
            completedCount,
            progress,
            isOverdue: task.dueDate ? new Date(task.dueDate) < new Date() && progress < 100 : false,
        };
    });
}

// Get recent task completions for admin notifications
export async function getRecentTaskCompletions(limit = 10) {
    await requireAdmin();

    return prisma.adminTaskCompletion.findMany({
        include: {
            task: { select: { id: true, title: true, createdById: true } },
            user: { select: { id: true, name: true } },
        },
        orderBy: { completedAt: "desc" },
        take: limit,
    });
}
