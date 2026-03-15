/**
 * Task Types and Utilities
 */

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  dueDate?: Date | null;
  assignToAll: boolean;
  createdBy?: { id: string; name: string | null };
  isCompleted: boolean;
  completedAt: Date | null;
  completionNotes: string | null;
}

export interface DueDateInfo {
  text: string;
  isOverdue: boolean;
}

export interface PriorityInfo {
  label: string;
  level: "high" | "medium" | "normal";
}

/**
 * Format due date for display
 */
export function formatDueDate(date: Date): DueDateInfo {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: "Overdue", isOverdue: true };
  if (diffDays === 0) return { text: "Due today", isOverdue: false };
  if (diffDays === 1) return { text: "Due tomorrow", isOverdue: false };
  return {
    text: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    isOverdue: false,
  };
}

/**
 * Get priority label and level
 */
export function getPriorityInfo(priority: number): PriorityInfo {
  if (priority >= 2) return { label: "High", level: "high" };
  if (priority === 1) return { label: "Medium", level: "medium" };
  return { label: "Normal", level: "normal" };
}

/**
 * Check if task is overdue
 */
export function isTaskOverdue(task: Task): boolean {
  if (task.isCompleted || !task.dueDate) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

/**
 * Sort tasks by priority and due date
 */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Overdue first
    const aOverdue = isTaskOverdue(a);
    const bOverdue = isTaskOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Then by priority (higher first)
    if (a.priority !== b.priority) return b.priority - a.priority;

    // Then by due date (sooner first)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    return 0;
  });
}
