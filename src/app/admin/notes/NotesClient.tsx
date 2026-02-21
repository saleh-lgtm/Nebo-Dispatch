"use client";

import { useState } from "react";
import {
    StickyNote,
    Plus,
    Edit3,
    Trash2,
    X,
    Clock,
    User,
    AlertCircle,
} from "lucide-react";
import {
    createGlobalNote,
    updateGlobalNote,
    deleteGlobalNote,
} from "@/lib/notesActions";

interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    author: { id: string; name: string | null };
}

interface Props {
    initialNotes: Note[];
    currentUserId: string;
}

export default function NotesClient({ initialNotes, currentUserId }: Props) {
    const [notes, setNotes] = useState<Note[]>(initialNotes);
    const [showForm, setShowForm] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [formData, setFormData] = useState({ title: "", content: "" });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const resetForm = () => {
        setFormData({ title: "", content: "" });
        setEditingNote(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.content.trim()) return;

        setLoading(true);

        try {
            if (editingNote) {
                const updated = await updateGlobalNote(editingNote.id, formData);
                setNotes((prev) =>
                    prev.map((n) => (n.id === editingNote.id ? updated : n))
                );
            } else {
                const newNote = await createGlobalNote({
                    authorId: currentUserId,
                    ...formData,
                });
                setNotes((prev) => [newNote, ...prev]);
            }
            resetForm();
        } catch (error) {
            console.error("Failed to save note:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (note: Note) => {
        setEditingNote(note);
        setFormData({ title: note.title, content: note.content });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        setLoading(true);
        try {
            await deleteGlobalNote(id);
            setNotes((prev) => prev.filter((n) => n.id !== id));
            setDeleteConfirm(null);
        } catch (error) {
            console.error("Failed to delete note:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: "1.5rem" }}>
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <StickyNote size={28} className="text-accent" />
                    <div>
                        <h1 className="font-display" style={{ fontSize: "1.75rem" }}>
                            Global Notes
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Create announcements visible to all dispatchers
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="btn btn-primary"
                >
                    <Plus size={18} /> New Note
                </button>
            </header>

            {/* Notes Grid */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                    gap: "1.5rem",
                }}
            >
                {notes.map((note) => (
                    <div key={note.id} className="glass-card flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <h3
                                className="font-display"
                                style={{ fontSize: "1.25rem", color: "var(--accent)" }}
                            >
                                {note.title}
                            </h3>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleEdit(note)}
                                    className="btn-icon"
                                    style={{ width: "28px", height: "28px" }}
                                    title="Edit"
                                >
                                    <Edit3 size={14} />
                                </button>
                                <button
                                    onClick={() => setDeleteConfirm(note.id)}
                                    className="btn-icon"
                                    style={{
                                        width: "28px",
                                        height: "28px",
                                        color: "var(--danger)",
                                    }}
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <p
                            style={{
                                color: "var(--text-secondary)",
                                lineHeight: 1.6,
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {note.content}
                        </p>

                        <div
                            className="flex items-center gap-4"
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--text-secondary)",
                                borderTop: "1px solid var(--glass-border)",
                                paddingTop: "0.75rem",
                                marginTop: "auto",
                            }}
                        >
                            <div className="flex items-center gap-1">
                                <User size={12} />
                                <span>{note.author.name || "Admin"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock size={12} />
                                <span>{formatDate(note.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {notes.length === 0 && (
                    <div
                        className="glass-card"
                        style={{
                            gridColumn: "1 / -1",
                            textAlign: "center",
                            padding: "3rem",
                        }}
                    >
                        <StickyNote
                            size={48}
                            style={{ opacity: 0.3, margin: "0 auto 1rem" }}
                        />
                        <p style={{ color: "var(--text-secondary)" }}>
                            No global notes yet. Create one to announce important information to
                            all dispatchers.
                        </p>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showForm && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) resetForm();
                    }}
                >
                    <div className="glass-card w-full max-w-lg animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <StickyNote className="text-accent" />
                                <h2 className="font-display" style={{ fontSize: "1.5rem" }}>
                                    {editingNote ? "Edit Note" : "New Note"}
                                </h2>
                            </div>
                            <button onClick={resetForm} className="btn-icon">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label
                                    className="text-xs uppercase tracking-wider font-bold"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    Title
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="input"
                                    placeholder="Enter note title..."
                                    value={formData.title}
                                    onChange={(e) =>
                                        setFormData({ ...formData, title: e.target.value })
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label
                                    className="text-xs uppercase tracking-wider font-bold"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    Content
                                </label>
                                <textarea
                                    required
                                    className="input"
                                    placeholder="Write your message to all dispatchers..."
                                    style={{ height: "150px", resize: "vertical" }}
                                    value={formData.content}
                                    onChange={(e) =>
                                        setFormData({ ...formData, content: e.target.value })
                                    }
                                />
                            </div>

                            <div
                                className="flex items-start gap-2 p-3 rounded-lg"
                                style={{
                                    background: "rgba(183, 175, 163, 0.1)",
                                    border: "1px solid rgba(183, 175, 163, 0.2)",
                                }}
                            >
                                <AlertCircle size={14} className="text-accent mt-0.5" />
                                <p
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "var(--text-secondary)",
                                        lineHeight: 1.5,
                                    }}
                                >
                                    This note will be visible to all dispatchers on their
                                    dashboard.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="btn btn-outline"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading
                                        ? "Saving..."
                                        : editingNote
                                        ? "Update Note"
                                        : "Create Note"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setDeleteConfirm(null);
                    }}
                >
                    <div className="glass-card w-full max-w-sm animate-scale-in text-center">
                        <Trash2
                            size={48}
                            style={{
                                color: "var(--danger)",
                                margin: "0 auto 1rem",
                                opacity: 0.8,
                            }}
                        />
                        <h2
                            className="font-display"
                            style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}
                        >
                            Delete Note?
                        </h2>
                        <p
                            style={{
                                color: "var(--text-secondary)",
                                marginBottom: "1.5rem",
                            }}
                        >
                            This action cannot be undone. The note will be removed from all
                            dispatcher dashboards.
                        </p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="btn btn-outline"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="btn"
                                style={{
                                    background: "var(--danger)",
                                    color: "white",
                                }}
                                disabled={loading}
                            >
                                {loading ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
