"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Trash2,
    Edit2,
    Users,
    User,
    CheckSquare,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { createAdminTask, updateAdminTask, deleteAdminTask } from "@/lib/taskActions";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

interface TaskCompletion {
    completedAt: Date;
    user: { id: string; name: string | null };
}

interface AdminTask {
    id: string;
    title: string;
    description: string | null;
    assignToAll: boolean;
    assignedToId: string | null;
    assignedTo: { id: string; name: string | null } | null;
    createdBy: { id: string; name: string | null };
    priority: number;
    dueDate: Date | null;
    createdAt: Date;
    completions: TaskCompletion[];
    targetCount: number;
    completedCount: number;
    progress: number;
    isOverdue: boolean;
}

interface Dispatcher {
    id: string;
    name: string | null;
    email: string | null;
}

interface Props {
    initialTasks: AdminTask[];
    dispatchers: Dispatcher[];
}

export default function TasksClient({ initialTasks, dispatchers }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [tasks, setTasks] = useState<AdminTask[]>(initialTasks);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignToAll, setAssignToAll] = useState(true);
    const [assignedToId, setAssignedToId] = useState("");
    const [priority, setPriority] = useState(0);
    const [dueDate, setDueDate] = useState("");

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setAssignToAll(true);
        setAssignedToId("");
        setPriority(0);
        setDueDate("");
        setEditingTask(null);
    };

    const openCreateModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (task: AdminTask) => {
        setTitle(task.title);
        setDescription(task.description || "");
        setAssignToAll(task.assignToAll);
        setAssignedToId(task.assignedToId || "");
        setPriority(task.priority);
        setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
        setEditingTask(task);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setIsSubmitting(true);
        try {
            const data = {
                title: title.trim(),
                description: description.trim() || undefined,
                assignToAll,
                assignedToId: assignToAll ? undefined : assignedToId || undefined,
                priority,
                dueDate: dueDate || undefined,
            };

            if (editingTask) {
                await updateAdminTask(editingTask.id, data);
                addToast("Task updated successfully", "success");
            } else {
                await createAdminTask(data);
                addToast("Task created successfully", "success");
            }

            setIsModalOpen(false);
            resetForm();
            router.refresh();
        } catch {
            addToast("Failed to save task", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return;

        try {
            await deleteAdminTask(taskId);
            setTasks(tasks.filter((t) => t.id !== taskId));
            addToast("Task deleted", "success");
        } catch {
            addToast("Failed to delete task", "error");
        }
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatDateTime = (date: Date | string) => {
        return new Date(date).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    // Stats
    const totalTasks = tasks.length;
    const overdueTasks = tasks.filter((t) => t.isOverdue).length;
    const completedTasks = tasks.filter((t) => t.progress === 100).length;

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>
                        Admin Tasks
                    </h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Assign tasks to dispatchers and track their progress
                    </p>
                </div>
                <button onClick={openCreateModal} className="btn btn-primary">
                    <Plus size={18} />
                    <span>Create Task</span>
                </button>
            </header>

            {/* Stats */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <div className="glass-card" style={{ padding: "1rem" }}>
                    <div className="flex items-center gap-3">
                        <div style={{ padding: "0.5rem", background: "var(--primary-soft)", borderRadius: "0.5rem" }}>
                            <CheckSquare size={20} className="text-accent" />
                        </div>
                        <div>
                            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalTasks}</p>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Active Tasks</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: "1rem" }}>
                    <div className="flex items-center gap-3">
                        <div style={{ padding: "0.5rem", background: "var(--success-bg)", borderRadius: "0.5rem" }}>
                            <CheckCircle2 size={20} style={{ color: "var(--success)" }} />
                        </div>
                        <div>
                            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{completedTasks}</p>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Fully Completed</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: "1rem" }}>
                    <div className="flex items-center gap-3">
                        <div style={{ padding: "0.5rem", background: "var(--danger-bg)", borderRadius: "0.5rem" }}>
                            <AlertTriangle size={20} style={{ color: "var(--danger)" }} />
                        </div>
                        <div>
                            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{overdueTasks}</p>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Overdue</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tasks List */}
            <div className="flex flex-col gap-4">
                {tasks.length === 0 ? (
                    <div className="glass-card" style={{ textAlign: "center", padding: "3rem" }}>
                        <CheckSquare size={48} style={{ color: "var(--text-secondary)", margin: "0 auto 1rem" }} />
                        <p style={{ color: "var(--text-secondary)" }}>No admin tasks created yet.</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Create tasks to assign them to dispatchers.
                        </p>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <div
                            key={task.id}
                            className="glass-card"
                            style={{
                                borderLeft: task.isOverdue
                                    ? "3px solid var(--danger)"
                                    : task.progress === 100
                                    ? "3px solid var(--success)"
                                    : "3px solid var(--primary)",
                            }}
                        >
                            <div className="flex justify-between items-start gap-4 flex-wrap">
                                <div style={{ flex: 1, minWidth: "200px" }}>
                                    <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: "0.5rem" }}>
                                        <h3 style={{ fontSize: "1.125rem", fontWeight: 600 }}>{task.title}</h3>
                                        {task.isOverdue && (
                                            <span className="badge badge-danger" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                <AlertTriangle size={12} /> Overdue
                                            </span>
                                        )}
                                        {task.progress === 100 && (
                                            <span className="badge badge-success" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                <CheckCircle2 size={12} /> Complete
                                            </span>
                                        )}
                                        {task.priority > 0 && (
                                            <span className="badge" style={{ background: "var(--warning)", color: "black" }}>
                                                Priority {task.priority}
                                            </span>
                                        )}
                                    </div>

                                    {task.description && (
                                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
                                            {task.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                                        {task.assignToAll ? (
                                            <span className="flex items-center gap-1">
                                                <Users size={14} /> All Dispatchers
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1">
                                                <User size={14} /> {task.assignedTo?.name || "Unassigned"}
                                            </span>
                                        )}

                                        {task.dueDate && (
                                            <span className="flex items-center gap-1" style={{ color: task.isOverdue ? "var(--danger)" : undefined }}>
                                                <Calendar size={14} /> Due: {formatDate(task.dueDate)}
                                            </span>
                                        )}

                                        <span className="flex items-center gap-1">
                                            <Clock size={14} /> Created {formatDate(task.createdAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Progress */}
                                    <div style={{ textAlign: "center", minWidth: "80px" }}>
                                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: task.progress === 100 ? "var(--success)" : "var(--text-primary)" }}>
                                            {task.progress}%
                                        </div>
                                        <div style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                                            {task.completedCount}/{task.targetCount} done
                                        </div>
                                        <div style={{ width: "80px", height: "4px", background: "var(--bg-secondary)", borderRadius: "2px", marginTop: "0.25rem" }}>
                                            <div
                                                style={{
                                                    width: `${task.progress}%`,
                                                    height: "100%",
                                                    background: task.progress === 100 ? "var(--success)" : "var(--primary)",
                                                    borderRadius: "2px",
                                                    transition: "width 0.3s ease",
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                                            className="btn btn-ghost btn-sm"
                                            title="View completions"
                                        >
                                            {expandedTask === task.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        <button onClick={() => openEditModal(task)} className="btn btn-ghost btn-sm" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(task.id)}
                                            className="btn btn-ghost btn-sm"
                                            style={{ color: "var(--danger)" }}
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Completions Expansion */}
                            {expandedTask === task.id && task.completions.length > 0 && (
                                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                                    <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                                        Completions ({task.completions.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {task.completions.map((completion, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    background: "var(--bg-secondary)",
                                                    padding: "0.375rem 0.75rem",
                                                    borderRadius: "0.375rem",
                                                    fontSize: "0.8125rem",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.5rem",
                                                }}
                                            >
                                                <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                                                <span>{completion.user.name || "Unknown"}</span>
                                                <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                                    {formatDateTime(completion.completedAt)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {expandedTask === task.id && task.completions.length === 0 && (
                                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textAlign: "center" }}>
                                        No completions yet
                                    </p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    resetForm();
                }}
                title={editingTask ? "Edit Task" : "Create Task"}
                size="md"
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                            Title *
                        </label>
                        <input
                            type="text"
                            className="input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Task title"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                            Description
                        </label>
                        <textarea
                            className="input"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional task description..."
                            style={{ minHeight: "80px", resize: "vertical" }}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                            Assign To
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                                <input type="radio" checked={assignToAll} onChange={() => setAssignToAll(true)} />
                                <Users size={16} />
                                <span>All Dispatchers</span>
                            </label>
                            <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                                <input type="radio" checked={!assignToAll} onChange={() => setAssignToAll(false)} />
                                <User size={16} />
                                <span>Specific Dispatcher</span>
                            </label>
                        </div>
                    </div>

                    {!assignToAll && (
                        <div className="flex flex-col gap-1">
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                                Select Dispatcher
                            </label>
                            <select
                                className="input"
                                value={assignedToId}
                                onChange={(e) => setAssignedToId(e.target.value)}
                                required={!assignToAll}
                            >
                                <option value="">Select a dispatcher...</option>
                                {dispatchers.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name || d.email}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex gap-4 flex-wrap">
                        <div className="flex flex-col gap-1" style={{ flex: 1, minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                                Due Date
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-1" style={{ flex: 1, minWidth: "150px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>
                                Priority (0-10)
                            </label>
                            <input
                                type="number"
                                className="input"
                                value={priority}
                                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                                min={0}
                                max={10}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3" style={{ marginTop: "1rem" }}>
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting || !title.trim()}>
                            {isSubmitting ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
