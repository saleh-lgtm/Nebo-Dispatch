// Task-related types

import type { UserReference } from "./user";

/**
 * Shift task (checklist item during a shift)
 */
export interface ShiftTask {
    id: string;
    content: string;
    isCompleted: boolean;
    startedAt?: Date | null;
    completedAt?: Date | null;
}

/**
 * Admin-assigned task
 */
export interface AdminTask {
    id: string;
    title: string;
    description: string | null;
    priority: number;
    dueDate?: Date | null;
    assignToAll: boolean;
    createdBy?: UserReference;
    isCompleted: boolean;
    completedAt: Date | null;
    completionNotes: string | null;
}

/**
 * Task completion record
 */
export interface TaskCompletion {
    userId: string;
    completedAt: Date;
    notes: string | null;
    user: UserReference;
}

/**
 * Admin task with progress tracking
 */
export interface TaskWithProgress {
    id: string;
    title: string;
    description: string | null;
    priority: number;
    dueDate: Date | null;
    assignToAll: boolean;
    assignedTo: UserReference | null;
    createdBy: UserReference;
    completions: TaskCompletion[];
    targetCount: number;
    completedCount: number;
    progress: number;
    isOverdue: boolean;
}

/**
 * Task priority levels
 */
export const TASK_PRIORITIES = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    URGENT: 4,
} as const;

export type TaskPriority = typeof TASK_PRIORITIES[keyof typeof TASK_PRIORITIES];
