"use client";

import { useState, useTransition } from "react";
import {
    CheckSquare,
    Square,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    MessageSquare,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { completeTask, uncompleteTask } from "@/lib/taskActions";
import { useRouter } from "next/navigation";

interface Task {
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

interface Props {
    tasks: Task[];
}

export default function TasksPanel({ tasks }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    const incompleteTasks = tasks.filter((t) => !t.isCompleted);
    const completedTasks = tasks.filter((t) => t.isCompleted);

    const handleToggleComplete = async (task: Task) => {
        setLoadingTaskId(task.id);
        startTransition(async () => {
            try {
                if (task.isCompleted) {
                    await uncompleteTask(task.id);
                } else {
                    await completeTask(task.id, notes[task.id] || undefined);
                    setNotes((prev) => ({ ...prev, [task.id]: "" }));
                }
                router.refresh();
            } catch (error) {
                console.error("Failed to toggle task:", error);
            } finally {
                setLoadingTaskId(null);
            }
        });
    };

    const formatDueDate = (date: Date) => {
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
    };

    const getPriorityLabel = (priority: number) => {
        if (priority >= 2) return { label: "High", className: "priority-high" };
        if (priority === 1) return { label: "Medium", className: "priority-medium" };
        return { label: "Normal", className: "priority-normal" };
    };

    const renderTask = (task: Task, isCompletedSection: boolean) => {
        const isLoading = loadingTaskId === task.id;
        const isExpanded = expandedTaskId === task.id;
        const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;
        const priorityInfo = getPriorityLabel(task.priority);

        return (
            <div
                key={task.id}
                className={`task-item ${task.isCompleted ? "completed" : ""} ${
                    dueInfo?.isOverdue && !task.isCompleted ? "overdue" : ""
                }`}
            >
                <div className="task-main">
                    <button
                        className="task-checkbox"
                        onClick={() => handleToggleComplete(task)}
                        disabled={isLoading || isPending}
                    >
                        {isLoading ? (
                            <Loader2 size={18} className="spinner" />
                        ) : task.isCompleted ? (
                            <CheckSquare size={18} className="checked" />
                        ) : (
                            <Square size={18} />
                        )}
                    </button>

                    <div className="task-content">
                        <div className="task-header">
                            <span className={`task-title ${task.isCompleted ? "completed" : ""}`}>
                                {task.title}
                            </span>
                            {!isCompletedSection && task.priority > 0 && (
                                <span className={`priority-badge ${priorityInfo.className}`}>
                                    {priorityInfo.label}
                                </span>
                            )}
                        </div>

                        {task.description && (
                            <p className="task-description">{task.description}</p>
                        )}

                        <div className="task-meta">
                            {dueInfo && !task.isCompleted && (
                                <span className={`due-badge ${dueInfo.isOverdue ? "overdue" : ""}`}>
                                    {dueInfo.isOverdue ? (
                                        <AlertTriangle size={12} />
                                    ) : (
                                        <Clock size={12} />
                                    )}
                                    {dueInfo.text}
                                </span>
                            )}
                            {task.isCompleted && task.completedAt && (
                                <span className="completed-badge">
                                    <CheckCircle2 size={12} />
                                    Completed{" "}
                                    {new Date(task.completedAt).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                            )}
                            <span className="from-badge">From: {task.createdBy?.name || "Admin"}</span>
                        </div>
                    </div>

                    {!task.isCompleted && (
                        <button
                            className="expand-btn"
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    )}
                </div>

                {isExpanded && !task.isCompleted && (
                    <div className="task-expand">
                        <div className="notes-input-wrapper">
                            <MessageSquare size={14} />
                            <input
                                type="text"
                                placeholder="Add completion notes (optional)..."
                                value={notes[task.id] || ""}
                                onChange={(e) =>
                                    setNotes((prev) => ({ ...prev, [task.id]: e.target.value }))
                                }
                                className="notes-input"
                            />
                        </div>
                        <button
                            className="complete-btn"
                            onClick={() => handleToggleComplete(task)}
                            disabled={isLoading || isPending}
                        >
                            {isLoading ? (
                                <Loader2 size={14} className="spinner" />
                            ) : (
                                <CheckCircle2 size={14} />
                            )}
                            Mark Complete
                        </button>
                    </div>
                )}

                {task.isCompleted && task.completionNotes && (
                    <div className="completion-notes">
                        <MessageSquare size={12} />
                        <span>{task.completionNotes}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="tasks-panel">
            <div className="panel-header">
                <CheckSquare size={18} className="header-icon" />
                <h3>My Tasks</h3>
                {incompleteTasks.length > 0 && (
                    <span className="task-count">{incompleteTasks.length}</span>
                )}
            </div>

            <div className="tasks-content">
                {incompleteTasks.length > 0 ? (
                    <div className="tasks-section">
                        {incompleteTasks.map((task) => renderTask(task, false))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <CheckCircle2 size={32} />
                        <p>All tasks completed!</p>
                    </div>
                )}

                {completedTasks.length > 0 && (
                    <div className="completed-section">
                        <div className="section-divider">
                            <span>Completed ({completedTasks.length})</span>
                        </div>
                        <div className="tasks-section completed">
                            {completedTasks.slice(0, 3).map((task) => renderTask(task, true))}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .tasks-panel {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                }

                .panel-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .panel-header :global(.header-icon) {
                    color: var(--primary);
                }

                .panel-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    flex: 1;
                }

                .task-count {
                    background: var(--primary);
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                }

                .tasks-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .tasks-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .task-item {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    padding: 0.75rem;
                    transition: all 0.15s ease;
                }

                .task-item:hover {
                    background: var(--bg-hover);
                }

                .task-item.completed {
                    opacity: 0.7;
                }

                .task-item.overdue {
                    border-left: 3px solid var(--danger);
                }

                .task-main {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                }

                .task-checkbox {
                    background: none;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    transition: color 0.15s;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .task-checkbox:hover {
                    color: var(--primary);
                }

                .task-checkbox :global(.checked) {
                    color: var(--success);
                }

                .task-checkbox :global(.spinner) {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .task-content {
                    flex: 1;
                    min-width: 0;
                }

                .task-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .task-title {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .task-title.completed {
                    text-decoration: line-through;
                    color: var(--text-muted);
                }

                .priority-badge {
                    font-size: 0.625rem;
                    font-weight: 600;
                    padding: 0.125rem 0.375rem;
                    border-radius: 4px;
                    text-transform: uppercase;
                }

                .priority-high {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .priority-medium {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                .priority-normal {
                    background: var(--bg-hover);
                    color: var(--text-muted);
                }

                .task-description {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin-top: 0.25rem;
                    line-height: 1.4;
                }

                .task-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    margin-top: 0.5rem;
                    flex-wrap: wrap;
                }

                .due-badge,
                .completed-badge,
                .from-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                }

                .due-badge.overdue {
                    color: var(--danger);
                    font-weight: 500;
                }

                .completed-badge {
                    color: var(--success);
                }

                .expand-btn {
                    background: none;
                    border: none;
                    padding: 0.25rem;
                    cursor: pointer;
                    color: var(--text-muted);
                    border-radius: var(--radius-sm);
                    transition: all 0.15s;
                }

                .expand-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .task-expand {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-top: 0.75rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--border);
                }

                .notes-input-wrapper {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    padding: 0.5rem 0.75rem;
                    color: var(--text-muted);
                }

                .notes-input {
                    flex: 1;
                    background: none;
                    border: none;
                    outline: none;
                    font-size: 0.8125rem;
                    color: var(--text-primary);
                    font-family: inherit;
                }

                .notes-input::placeholder {
                    color: var(--text-muted);
                }

                .complete-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    background: var(--success);
                    color: white;
                    border: none;
                    padding: 0.5rem 0.875rem;
                    border-radius: var(--radius-md);
                    font-size: 0.8125rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                    font-family: inherit;
                }

                .complete-btn:hover:not(:disabled) {
                    background: #16A34A;
                }

                .complete-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .completion-notes {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.375rem;
                    margin-top: 0.5rem;
                    margin-left: 2rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    font-style: italic;
                }

                .section-divider {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin: 1rem 0 0.75rem;
                }

                .section-divider span {
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .section-divider::after {
                    content: "";
                    flex: 1;
                    height: 1px;
                    background: var(--border);
                }

                .completed-section .tasks-section {
                    opacity: 0.7;
                }

                .empty-state {
                    text-align: center;
                    padding: 2rem 0;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    color: var(--success);
                    opacity: 0.5;
                    margin-bottom: 0.5rem;
                }

                .empty-state p {
                    font-size: 0.875rem;
                }
            `}</style>
        </div>
    );
}
