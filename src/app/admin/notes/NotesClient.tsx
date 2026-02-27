"use client";

import { useState } from "react";
import {
    Bell,
    Plus,
    Edit3,
    Trash2,
    X,
    Clock,
    User,
    AlertCircle,
    Pin,
    PinOff,
    Calendar,
    Eye,
} from "lucide-react";
import {
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementPin,
} from "@/lib/notesActions";

interface Announcement {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    author: { id: string; name: string | null };
    isAnnouncement: boolean;
    isPinned: boolean;
    expiresAt: Date | null;
}

interface Props {
    initialNotes: Announcement[];
    currentUserId: string;
}

export default function NotesClient({ initialNotes, currentUserId }: Props) {
    // Filter to only show announcements
    const [announcements, setAnnouncements] = useState<Announcement[]>(
        initialNotes.filter((n) => n.isAnnouncement)
    );
    const [showForm, setShowForm] = useState(false);
    const [editingNote, setEditingNote] = useState<Announcement | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        content: "",
        isPinned: false,
        expiresAt: "",
    });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [pinningId, setPinningId] = useState<string | null>(null);

    const resetForm = () => {
        setFormData({ title: "", content: "", isPinned: false, expiresAt: "" });
        setEditingNote(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.content.trim()) return;

        setLoading(true);

        try {
            const expiresAt = formData.expiresAt
                ? new Date(formData.expiresAt)
                : null;

            if (editingNote) {
                const updated = await updateAnnouncement(editingNote.id, {
                    title: formData.title,
                    content: formData.content,
                    isPinned: formData.isPinned,
                    expiresAt,
                });
                setAnnouncements((prev) =>
                    prev.map((n) =>
                        n.id === editingNote.id ? (updated as Announcement) : n
                    )
                );
            } else {
                const newAnnouncement = await createAnnouncement({
                    title: formData.title,
                    content: formData.content,
                    isPinned: formData.isPinned,
                    expiresAt,
                });
                setAnnouncements((prev) => [
                    newAnnouncement as Announcement,
                    ...prev,
                ]);
            }
            resetForm();
        } catch (error) {
            console.error("Failed to save announcement:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (note: Announcement) => {
        setEditingNote(note);
        setFormData({
            title: note.title,
            content: note.content,
            isPinned: note.isPinned,
            expiresAt: note.expiresAt
                ? new Date(note.expiresAt).toISOString().slice(0, 16)
                : "",
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        setLoading(true);
        try {
            await deleteAnnouncement(id);
            setAnnouncements((prev) => prev.filter((n) => n.id !== id));
            setDeleteConfirm(null);
        } catch (error) {
            console.error("Failed to delete announcement:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePin = async (id: string) => {
        setPinningId(id);
        try {
            const updated = await toggleAnnouncementPin(id);
            setAnnouncements((prev) =>
                prev.map((n) =>
                    n.id === id ? { ...n, isPinned: updated.isPinned } : n
                )
            );
        } catch (error) {
            console.error("Failed to toggle pin:", error);
        } finally {
            setPinningId(null);
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

    const isExpired = (expiresAt: Date | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    // Sort: pinned first, then by date
    const sortedAnnouncements = [...announcements].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    });

    return (
        <div
            className="flex flex-col gap-6 animate-fade-in"
            style={{ padding: "1.5rem" }}
        >
            {/* Header */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bell size={28} className="text-accent" />
                    <div>
                        <h1
                            className="font-display"
                            style={{ fontSize: "1.75rem" }}
                        >
                            Company Announcements
                        </h1>
                        <p
                            style={{
                                color: "var(--text-secondary)",
                                fontSize: "0.875rem",
                            }}
                        >
                            Create announcements visible to all dispatchers
                            (require acknowledgment)
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="btn btn-primary"
                >
                    <Plus size={18} /> New Announcement
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
                {sortedAnnouncements.map((note) => (
                    <div
                        key={note.id}
                        className="glass-card flex flex-col gap-4"
                        style={{
                            borderLeft: note.isPinned
                                ? "4px solid var(--danger)"
                                : "4px solid var(--warning)",
                            opacity: isExpired(note.expiresAt) ? 0.6 : 1,
                        }}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                {note.isPinned && (
                                    <Pin
                                        size={14}
                                        style={{ color: "var(--danger)" }}
                                    />
                                )}
                                <h3
                                    className="font-display"
                                    style={{
                                        fontSize: "1.25rem",
                                        color: "var(--accent)",
                                    }}
                                >
                                    {note.title}
                                </h3>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleTogglePin(note.id)}
                                    className="btn-icon"
                                    style={{ width: "28px", height: "28px" }}
                                    title={
                                        note.isPinned ? "Unpin" : "Pin to top"
                                    }
                                    disabled={pinningId === note.id}
                                >
                                    {note.isPinned ? (
                                        <PinOff size={14} />
                                    ) : (
                                        <Pin size={14} />
                                    )}
                                </button>
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

                        {note.expiresAt && (
                            <div
                                className="flex items-center gap-2"
                                style={{
                                    fontSize: "0.75rem",
                                    color: isExpired(note.expiresAt)
                                        ? "var(--danger)"
                                        : "var(--warning)",
                                    padding: "0.5rem",
                                    background: isExpired(note.expiresAt)
                                        ? "var(--danger-bg)"
                                        : "var(--warning-bg)",
                                    borderRadius: "var(--radius-sm)",
                                }}
                            >
                                <Calendar size={12} />
                                <span>
                                    {isExpired(note.expiresAt)
                                        ? "Expired"
                                        : "Expires"}{" "}
                                    {formatDate(note.expiresAt)}
                                </span>
                            </div>
                        )}

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

                {sortedAnnouncements.length === 0 && (
                    <div
                        className="glass-card"
                        style={{
                            gridColumn: "1 / -1",
                            textAlign: "center",
                            padding: "3rem",
                        }}
                    >
                        <Bell
                            size={48}
                            style={{ opacity: 0.3, margin: "0 auto 1rem" }}
                        />
                        <p style={{ color: "var(--text-secondary)" }}>
                            No announcements yet. Create one to announce
                            important information to all dispatchers.
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
                                <Bell className="text-accent" />
                                <h2
                                    className="font-display"
                                    style={{ fontSize: "1.5rem" }}
                                >
                                    {editingNote
                                        ? "Edit Announcement"
                                        : "New Announcement"}
                                </h2>
                            </div>
                            <button onClick={resetForm} className="btn-icon">
                                <X size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="flex flex-col gap-4"
                        >
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
                                    placeholder="Enter announcement title..."
                                    value={formData.title}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            title: e.target.value,
                                        })
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
                                        setFormData({
                                            ...formData,
                                            content: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div
                                className="flex gap-4"
                                style={{ flexWrap: "wrap" }}
                            >
                                <div className="flex flex-col gap-1 flex-1">
                                    <label
                                        className="text-xs uppercase tracking-wider font-bold"
                                        style={{
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        Expires At (Optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className="input"
                                        value={formData.expiresAt}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                expiresAt: e.target.value,
                                            })
                                        }
                                    />
                                </div>

                                <label
                                    className="flex items-center gap-2 cursor-pointer"
                                    style={{ alignSelf: "flex-end" }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.isPinned}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                isPinned: e.target.checked,
                                            })
                                        }
                                        style={{ width: "16px", height: "16px" }}
                                    />
                                    <span
                                        className="flex items-center gap-1"
                                        style={{ fontSize: "0.875rem" }}
                                    >
                                        <Pin size={14} /> Pin to top
                                    </span>
                                </label>
                            </div>

                            <div
                                className="flex items-start gap-2 p-3 rounded-lg"
                                style={{
                                    background: "rgba(245, 158, 11, 0.1)",
                                    border: "1px solid rgba(245, 158, 11, 0.2)",
                                }}
                            >
                                <Eye
                                    size={14}
                                    className="text-warning mt-0.5"
                                />
                                <p
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "var(--text-secondary)",
                                        lineHeight: 1.5,
                                    }}
                                >
                                    This announcement will require
                                    acknowledgment from all dispatchers.
                                    Unacknowledged announcements will be
                                    highlighted on their dashboard.
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
                                        ? "Update Announcement"
                                        : "Create Announcement"}
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
                        if (e.target === e.currentTarget)
                            setDeleteConfirm(null);
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
                            style={{
                                fontSize: "1.25rem",
                                marginBottom: "0.5rem",
                            }}
                        >
                            Delete Announcement?
                        </h2>
                        <p
                            style={{
                                color: "var(--text-secondary)",
                                marginBottom: "1.5rem",
                            }}
                        >
                            This action cannot be undone. The announcement will
                            be removed from all dispatcher dashboards.
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
