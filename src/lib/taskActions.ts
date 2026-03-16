"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireAuth } from "./auth-helpers";
import { createAuditLog } from "./auditActions";
import { notifyTaskAssigned, notifyTaskAssignedToAll } from "./notificationActions";
import {
    createAdminTaskSchema,
    updateAdminTaskSchema,
    idParamSchema,
    userIdParamSchema,
    getRecentCompletionsSchema,
} from "./schemas";

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
    try {
        const session = await requireAdmin();

        // Validate input
        const parseResult = createAdminTaskSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: task };
    } catch (error) {
        console.error("createAdminTask error:", error);
        return { success: false, error: "Failed to create task" };
    }
}

// Get all active admin tasks (ADMIN/SUPER_ADMIN only)
export async function getAdminTasks() {
    try {
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
                },
            },
            orderBy: [
                { priority: "desc" },
                { dueDate: "asc" },
                { createdAt: "desc" },
            ],
        });

        return { success: true, data: tasks };
    } catch (error) {
        console.error("getAdminTasks error:", error);
        return { success: false, error: "Failed to get admin tasks", data: [] };
    }
}

// Get admin tasks assigned to a specific dispatcher (for shift clock-in)
export async function getDispatcherAdminTasks(userId: string) {
    try {
        await requireAuth();

        // Validate input
        const parseResult = userIdParamSchema.safeParse({ userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID", data: [] };
        }

        const tasks = await prisma.adminTask.findMany({
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

        return { success: true, data: tasks };
    } catch (error) {
        console.error("getDispatcherAdminTasks error:", error);
        return { success: false, error: "Failed to get dispatcher tasks", data: [] };
    }
}

// Update an admin task (ADMIN/SUPER_ADMIN only)
export async function updateAdminTask(
    id: string,
    data: Partial<CreateAdminTaskData>
) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const idResult = idParamSchema.safeParse({ id });
        if (!idResult.success) {
            return { success: false, error: "Invalid task ID" };
        }

        // Validate input
        const parseResult = updateAdminTaskSchema.safeParse(data);
        if (!parseResult.success) {
            return { success: false, error: parseResult.error.issues[0]?.message || "Invalid input" };
        }

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
        return { success: true, data: task };
    } catch (error) {
        console.error("updateAdminTask error:", error);
        return { success: false, error: "Failed to update task" };
    }
}

// Delete (deactivate) an admin task (ADMIN/SUPER_ADMIN only)
export async function deleteAdminTask(id: string) {
    try {
        const session = await requireAdmin();

        // Validate ID
        const parseResult = idParamSchema.safeParse({ id });
        if (!parseResult.success) {
            return { success: false, error: "Invalid task ID" };
        }

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
        return { success: true };
    } catch (error) {
        console.error("deleteAdminTask error:", error);
        return { success: false, error: "Failed to delete task" };
    }
}

// Add admin tasks to a shift when clocking in
export async function addAdminTasksToShift(shiftId: string, userId: string) {
    try {
        // Validate inputs
        const shiftIdResult = idParamSchema.safeParse({ id: shiftId });
        const userIdResult = userIdParamSchema.safeParse({ userId });
        if (!shiftIdResult.success || !userIdResult.success) {
            return { success: false, error: "Invalid input", data: [] };
        }

        const adminTasksResult = await getDispatcherAdminTasks(userId);
        if (!adminTasksResult.success || adminTasksResult.data.length === 0) {
            return { success: true, data: [] };
        }

        const shiftTasks = await prisma.shiftTask.createMany({
            data: adminTasksResult.data.map((task) => ({
                shiftId,
                content: task.title,
                isAdminTask: true,
                assignedById: task.createdById,
                priority: task.priority,
            })),
        });

        return { success: true, data: shiftTasks };
    } catch (error) {
        console.error("addAdminTasksToShift error:", error);
        return { success: false, error: "Failed to add tasks to shift", data: [] };
    }
}

// ============================================
// TASK COMPLETION FUNCTIONS
// ============================================

// Get tasks for a dispatcher's dashboard (with their completion status)
export async function getMyTasks(userId: string) {
    try {
        await requireAuth();

        // Validate input
        const parseResult = userIdParamSchema.safeParse({ userId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid user ID", data: [] };
        }

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
        const data = tasks.map((task) => ({
            ...task,
            isCompleted: task.completions.length > 0,
            completedAt: task.completions[0]?.completedAt || null,
            completionNotes: task.completions[0]?.notes || null,
        }));

        return { success: true, data };
    } catch (error) {
        console.error("getMyTasks error:", error);
        return { success: false, error: "Failed to get tasks", data: [] };
    }
}

// Mark a task as complete (for dispatchers)
export async function completeTask(taskId: string, notes?: string) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = idParamSchema.safeParse({ id: taskId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid task ID" };
        }

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
            return { success: false, error: "Task not found or you are not assigned to it" };
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
        return { success: true, data: completion };
    } catch (error) {
        console.error("completeTask error:", error);
        return { success: false, error: "Failed to complete task" };
    }
}

// Uncomplete a task (for dispatchers - if they made a mistake)
export async function uncompleteTask(taskId: string) {
    try {
        const session = await requireAuth();

        // Validate input
        const parseResult = idParamSchema.safeParse({ id: taskId });
        if (!parseResult.success) {
            return { success: false, error: "Invalid task ID" };
        }

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
        return { success: true };
    } catch (error) {
        console.error("uncompleteTask error:", error);
        return { success: false, error: "Failed to uncomplete task" };
    }
}

// Get task progress for admin dashboard
export async function getTaskProgress() {
    try {
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

        const data = tasks.map((task) => {
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

        return { success: true, data };
    } catch (error) {
        console.error("getTaskProgress error:", error);
        return { success: false, error: "Failed to get task progress", data: [] };
    }
}

// Get recent task completions for admin notifications
export async function getRecentTaskCompletions(limit = 10) {
    try {
        await requireAdmin();

        // Validate input
        const parseResult = getRecentCompletionsSchema.safeParse({ limit });
        if (!parseResult.success) {
            return { success: false, error: "Invalid limit", data: [] };
        }

        const completions = await prisma.adminTaskCompletion.findMany({
            include: {
                task: { select: { id: true, title: true, createdById: true } },
                user: { select: { id: true, name: true } },
            },
            orderBy: { completedAt: "desc" },
            take: limit,
        });

        return { success: true, data: completions };
    } catch (error) {
        console.error("getRecentTaskCompletions error:", error);
        return { success: false, error: "Failed to get recent completions", data: [] };
    }
}
