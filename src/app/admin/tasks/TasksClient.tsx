"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2, Users, User, CheckSquare, X } from "lucide-react";
import { createAdminTask, updateAdminTask, deleteAdminTask } from "@/lib/taskActions";

interface AdminTask {
    id: string;
    title: string;
    description: string | null;
    assignToAll: boolean;
    assignedToId: string | null;
    assignedTo: { id: string; name: string | null } | null;
    createdBy: { id: string; name: string | null };
    priority: number;
    createdAt: Date;
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
    const [tasks, setTasks] = useState<AdminTask[]>(initialTasks);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignToAll, setAssignToAll] = useState(true);
    const [assignedToId, setAssignedToId] = useState("");
    const [priority, setPriority] = useState(0);

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setAssignToAll(true);
        setAssignedToId("");
        setPriority(0);
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
            };

            if (editingTask) {
                const updated = await updateAdminTask(editingTask.id, data);
                setTasks(tasks.map((t) => (t.id === updated.id ? updated : t)));
            } else {
                const created = await createAdminTask(data);
                setTasks([created, ...tasks]);
            }

            setIsModalOpen(false);
            resetForm();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (taskId: string) => {
        if (!confirm("Are you sure you want to delete this task?")) return;

        await deleteAdminTask(taskId);
        setTasks(tasks.filter((t) => t.id !== taskId));
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>
                        Admin Tasks
                    </h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Assign tasks to dispatchers for their shifts
                    </p>
                </div>
                <button onClick={openCreateModal} className="btn btn-primary">
                    <Plus size={18} />
                    <span>Create Task</span>
                </button>
            </header>

            {/* Tasks Grid */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))" }}>
                {tasks.length === 0 ? (
                    <div className="glass-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem" }}>
                        <CheckSquare size={48} style={{ color: "var(--text-secondary)", margin: "0 auto 1rem" }} />
                        <p style={{ color: "var(--text-secondary)" }}>No admin tasks created yet.</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Create tasks to automatically add them to dispatcher shifts.
                        </p>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <div key={task.id} className="glass-card">
                            <div className="flex justify-between items-start gap-2" style={{ marginBottom: "0.75rem" }}>
                                <div className="flex items-center gap-2">
                                    {task.assignToAll ? (
                                        <span className="badge badge-primary">
                                            <Users size={12} />
                                            All Dispatchers
                                        </span>
                                    ) : (
                                        <span className="badge badge-secondary">
                                            <User size={12} />
                                            {task.assignedTo?.name || "Unassigned"}
                                        </span>
                                    )}
                                    {task.priority > 0 && (
                                        <span className="badge" style={{ background: "var(--warning)", color: "black" }}>
                                            Priority: {task.priority}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => openEditModal(task)}
                                        className="btn-icon"
                                        title="Edit task"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(task.id)}
                                        className="btn-icon"
                                        style={{ color: "var(--danger)" }}
                                        title="Delete task"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                                {task.title}
                            </h3>
                            {task.description && (
                                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
                                    {task.description}
                                </p>
                            )}
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                Created by {task.createdBy.name} on{" "}
                                {new Date(task.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center" style={{ marginBottom: "1.5rem" }}>
                            <h2 className="font-display" style={{ fontSize: "1.5rem" }}>
                                {editingTask ? "Edit Task" : "Create Task"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="btn-icon">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="input-label">Title *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Task title"
                                    required
                                />
                            </div>

                            <div>
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Optional task description..."
                                    style={{ height: "80px", resize: "vertical" }}
                                />
                            </div>

                            <div>
                                <label className="input-label">Assign To</label>
                                <div className="flex gap-4" style={{ marginTop: "0.5rem" }}>
                                    <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            checked={assignToAll}
                                            onChange={() => setAssignToAll(true)}
                                        />
                                        <Users size={16} />
                                        <span>All Dispatchers</span>
                                    </label>
                                    <label className="flex items-center gap-2" style={{ cursor: "pointer" }}>
                                        <input
                                            type="radio"
                                            checked={!assignToAll}
                                            onChange={() => setAssignToAll(false)}
                                        />
                                        <User size={16} />
                                        <span>Specific Dispatcher</span>
                                    </label>
                                </div>
                            </div>

                            {!assignToAll && (
                                <div>
                                    <label className="input-label">Select Dispatcher</label>
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

                            <div>
                                <label className="input-label">Priority (0 = normal, higher = more important)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={priority}
                                    onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                                    min={0}
                                    max={10}
                                />
                            </div>

                            <div className="flex justify-end gap-2" style={{ marginTop: "1rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSubmitting || !title.trim()}
                                >
                                    {isSubmitting ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: 1rem;
                }

                .modal-content {
                    width: 100%;
                    max-width: 500px;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .btn-icon {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: 0.375rem;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }

                .btn-icon:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: var(--text-primary);
                }

                .input-label {
                    display: block;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }

                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .badge-primary {
                    background: var(--accent);
                    color: white;
                }

                .badge-secondary {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                }
            `}</style>
        </div>
    );
}
