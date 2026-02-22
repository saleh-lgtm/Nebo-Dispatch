"use client";

import { useState } from "react";
import {
    ClipboardCheck,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Users,
    ChevronDown,
    ChevronUp,
    ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface TaskCompletion {
    userId: string;
    completedAt: Date;
    notes: string | null;
    user: { id: string; name: string | null };
}

interface Task {
    id: string;
    title: string;
    description: string | null;
    priority: number;
    dueDate: Date | null;
    assignToAll: boolean;
    assignedTo: { id: string; name: string | null } | null;
    createdBy: { id: string; name: string | null };
    completions: TaskCompletion[];
    targetCount: number;
    completedCount: number;
    progress: number;
    isOverdue: boolean;
}

interface Props {
    tasks: Task[];
}

export default function AdminTaskProgressPanel({ tasks }: Props) {
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    const overdueTasks = tasks.filter((t) => t.isOverdue);
    const inProgressTasks = tasks.filter((t) => t.progress > 0 && t.progress < 100 && !t.isOverdue);
    const recentlyCompletedTasks = tasks.filter((t) => t.progress === 100).slice(0, 3);

    const totalTasks = tasks.length;
    const fullyCompletedCount = tasks.filter((t) => t.progress === 100).length;
    const overdueCount = overdueTasks.length;

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const getPriorityLabel = (priority: number) => {
        if (priority >= 2) return { label: "High", className: "priority-high" };
        if (priority === 1) return { label: "Medium", className: "priority-medium" };
        return null;
    };

    const renderTaskItem = (task: Task) => {
        const isExpanded = expandedTaskId === task.id;
        const priorityInfo = getPriorityLabel(task.priority);

        return (
            <div
                key={task.id}
                className={`task-item ${task.isOverdue ? "overdue" : ""}`}
            >
                <div
                    className="task-header"
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                    <div className="task-info">
                        <div className="task-title-row">
                            <span className="task-title">{task.title}</span>
                            {priorityInfo && (
                                <span className={`priority-badge ${priorityInfo.className}`}>
                                    {priorityInfo.label}
                                </span>
                            )}
                            {task.isOverdue && (
                                <span className="overdue-badge">
                                    <AlertTriangle size={10} />
                                    Overdue
                                </span>
                            )}
                        </div>
                        <div className="task-meta">
                            {task.assignToAll ? (
                                <span className="assign-badge">
                                    <Users size={10} />
                                    All Dispatchers
                                </span>
                            ) : task.assignedTo ? (
                                <span className="assign-badge">{task.assignedTo.name}</span>
                            ) : null}
                            {task.dueDate && (
                                <span className="due-badge">
                                    <Clock size={10} />
                                    Due {formatDate(task.dueDate)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="task-progress-section">
                        <div className="progress-text">
                            {task.completedCount}/{task.targetCount}
                        </div>
                        <div className="progress-bar">
                            <div
                                className={`progress-fill ${task.progress === 100 ? "complete" : ""}`}
                                style={{ width: `${task.progress}%` }}
                            />
                        </div>
                        <button className="expand-btn">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                {isExpanded && task.completions.length > 0 && (
                    <div className="completions-list">
                        {task.completions.map((completion) => (
                            <div key={completion.userId} className="completion-item">
                                <CheckCircle2 size={12} className="check-icon" />
                                <span className="completion-user">{completion.user.name}</span>
                                <span className="completion-time">
                                    {formatDate(completion.completedAt)}
                                </span>
                                {completion.notes && (
                                    <span className="completion-notes">"{completion.notes}"</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="admin-tasks-panel">
            <div className="panel-header">
                <div className="header-left">
                    <ClipboardCheck size={18} className="header-icon" />
                    <h3>Task Progress</h3>
                </div>
                <Link href="/admin/tasks" className="view-all-link">
                    View All
                    <ExternalLink size={12} />
                </Link>
            </div>

            {/* Stats Row */}
            <div className="stats-row">
                <div className="mini-stat">
                    <span className="stat-value">{totalTasks}</span>
                    <span className="stat-label">Active</span>
                </div>
                <div className="mini-stat success">
                    <span className="stat-value">{fullyCompletedCount}</span>
                    <span className="stat-label">Complete</span>
                </div>
                {overdueCount > 0 && (
                    <div className="mini-stat danger">
                        <span className="stat-value">{overdueCount}</span>
                        <span className="stat-label">Overdue</span>
                    </div>
                )}
            </div>

            <div className="tasks-content">
                {/* Overdue Tasks */}
                {overdueTasks.length > 0 && (
                    <div className="task-section">
                        <div className="section-label danger">
                            <AlertTriangle size={12} />
                            Overdue
                        </div>
                        {overdueTasks.map(renderTaskItem)}
                    </div>
                )}

                {/* In Progress Tasks */}
                {inProgressTasks.length > 0 && (
                    <div className="task-section">
                        <div className="section-label">
                            <Clock size={12} />
                            In Progress
                        </div>
                        {inProgressTasks.slice(0, 3).map(renderTaskItem)}
                    </div>
                )}

                {/* Recently Completed */}
                {recentlyCompletedTasks.length > 0 && (
                    <div className="task-section">
                        <div className="section-label success">
                            <CheckCircle2 size={12} />
                            Recently Completed
                        </div>
                        {recentlyCompletedTasks.map(renderTaskItem)}
                    </div>
                )}

                {tasks.length === 0 && (
                    <div className="empty-state">
                        <ClipboardCheck size={28} />
                        <p>No active tasks</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .admin-tasks-panel {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                }

                .panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1rem;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .panel-header :global(.header-icon) {
                    color: var(--primary);
                }

                .panel-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                }

                .view-all-link {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.75rem;
                    color: var(--primary);
                    text-decoration: none;
                    transition: opacity 0.15s;
                }

                .view-all-link:hover {
                    opacity: 0.8;
                }

                /* Stats Row */
                .stats-row {
                    display: flex;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--border);
                }

                .mini-stat {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 0.5rem 0.875rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    min-width: 60px;
                }

                .mini-stat .stat-value {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .mini-stat .stat-label {
                    font-size: 0.625rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                .mini-stat.success .stat-value {
                    color: var(--success);
                }

                .mini-stat.danger .stat-value {
                    color: var(--danger);
                }

                /* Tasks Content */
                .tasks-content {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .task-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .section-label {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 500;
                }

                .section-label.danger {
                    color: var(--danger);
                }

                .section-label.success {
                    color: var(--success);
                }

                /* Task Item */
                .task-item {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    transition: background 0.15s;
                }

                .task-item:hover {
                    background: var(--bg-hover);
                }

                .task-item.overdue {
                    border-left: 3px solid var(--danger);
                }

                .task-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    cursor: pointer;
                }

                .task-info {
                    flex: 1;
                    min-width: 0;
                }

                .task-title-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .task-title {
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .priority-badge {
                    font-size: 0.5625rem;
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

                .overdue-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.625rem;
                    color: var(--danger);
                    font-weight: 500;
                }

                .task-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    margin-top: 0.25rem;
                }

                .assign-badge,
                .due-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                }

                .task-progress-section {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-shrink: 0;
                }

                .progress-text {
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    min-width: 32px;
                    text-align: right;
                }

                .progress-bar {
                    width: 60px;
                    height: 6px;
                    background: var(--border);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: var(--primary);
                    transition: width 0.3s ease;
                }

                .progress-fill.complete {
                    background: var(--success);
                }

                .expand-btn {
                    background: none;
                    border: none;
                    padding: 0.25rem;
                    cursor: pointer;
                    color: var(--text-muted);
                    display: flex;
                    align-items: center;
                }

                /* Completions List */
                .completions-list {
                    border-top: 1px solid var(--border);
                    padding: 0.75rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                    background: var(--bg-card);
                }

                .completion-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .completion-item :global(.check-icon) {
                    color: var(--success);
                    flex-shrink: 0;
                }

                .completion-user {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .completion-time {
                    color: var(--text-muted);
                }

                .completion-notes {
                    font-style: italic;
                    color: var(--text-muted);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .empty-state {
                    text-align: center;
                    padding: 2rem 0;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    opacity: 0.3;
                    margin-bottom: 0.5rem;
                }

                .empty-state p {
                    font-size: 0.875rem;
                }
            `}</style>
        </div>
    );
}
