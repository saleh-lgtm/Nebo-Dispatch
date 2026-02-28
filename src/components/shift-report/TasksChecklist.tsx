"use client";

import { ClipboardCheck, CheckCircle } from "lucide-react";
import { ShiftTask } from "@/types/shift-report";

interface TasksChecklistProps {
    tasks: ShiftTask[];
    onToggleTask: (taskId: string, currentStatus: boolean) => void;
}

export default function TasksChecklist({ tasks, onToggleTask }: TasksChecklistProps) {
    const completedTasks = tasks.filter((t) => t.isCompleted).length;
    const taskProgress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    return (
        <div className="sidebar-card">
            <div className="sidebar-header">
                <ClipboardCheck size={18} />
                <h3>Shift Tasks</h3>
            </div>

            {tasks.length > 0 && (
                <div className="progress-section">
                    <div className="progress-header">
                        <span className="progress-label">Progress</span>
                        <span className="progress-value">
                            {completedTasks}/{tasks.length}
                        </span>
                    </div>
                    <div className="progress-track">
                        <div className="progress-bar" style={{ width: `${taskProgress}%` }} />
                    </div>
                </div>
            )}

            <div className="tasks-list">
                {tasks.length === 0 ? (
                    <div className="empty-tasks">
                        <CheckCircle size={24} />
                        <p>No tasks assigned</p>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <label key={task.id} className="task-item">
                            <input
                                type="checkbox"
                                checked={task.isCompleted}
                                onChange={() => onToggleTask(task.id, task.isCompleted)}
                                className="task-checkbox"
                            />
                            <span className={`task-text ${task.isCompleted ? "task-completed" : ""}`}>
                                {task.content}
                            </span>
                        </label>
                    ))
                )}
            </div>

            <style jsx>{`
                .sidebar-card {
                    background: linear-gradient(135deg, rgba(30, 30, 50, 0.9) 0%, rgba(25, 25, 45, 0.95) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 1.25rem;
                    position: sticky;
                    top: 100px;
                }

                .sidebar-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--accent);
                    margin-bottom: 1rem;
                }

                .sidebar-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .progress-section {
                    margin-bottom: 1rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                }

                .progress-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .progress-value {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--accent);
                }

                .progress-track {
                    height: 6px;
                    background: rgba(255, 255, 255, 0.06);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, var(--accent), #d4a853);
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }

                .tasks-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .empty-tasks {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1.5rem;
                    color: var(--text-secondary);
                    opacity: 0.5;
                }

                .empty-tasks p {
                    font-size: 0.875rem;
                }

                .task-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.625rem 0.75rem;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .task-item:hover {
                    background: rgba(255, 255, 255, 0.04);
                }

                .task-checkbox {
                    width: 18px;
                    height: 18px;
                    accent-color: var(--accent);
                    cursor: pointer;
                }

                .task-text {
                    font-size: 0.875rem;
                    color: var(--text-primary);
                    transition: all 0.2s;
                }

                .task-completed {
                    color: var(--text-secondary);
                    text-decoration: line-through;
                }
            `}</style>
        </div>
    );
}
