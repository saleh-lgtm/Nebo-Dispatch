"use client";

import { useState } from "react";
import {
    Bell,
    Plus,
    Pencil,
    Trash2,
    X,
    Clock,
    User,
    Pin,
    PinOff,
    Calendar,
    Eye,
    CheckCircle2,
} from "lucide-react";
import {
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementPin,
} from "@/lib/notesActions";
import styles from "./NotesClient.module.css";

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
    acknowledgedCount: number;
}

interface Props {
    initialNotes: Announcement[];
    totalUsers: number;
}

export default function NotesClient({ initialNotes, totalUsers }: Props) {
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
                const result = await updateAnnouncement(editingNote.id, {
                    title: formData.title,
                    content: formData.content,
                    isPinned: formData.isPinned,
                    expiresAt,
                });
                if (result.success && result.data) {
                    setAnnouncements((prev) =>
                        prev.map((n) =>
                            n.id === editingNote.id
                                ? {
                                      ...n,
                                      title: formData.title,
                                      content: formData.content,
                                      isPinned: formData.isPinned,
                                      expiresAt,
                                      updatedAt: new Date(),
                                  }
                                : n
                        )
                    );
                }
            } else {
                const result = await createAnnouncement({
                    title: formData.title,
                    content: formData.content,
                    isPinned: formData.isPinned,
                    expiresAt,
                });
                if (result.success && result.data) {
                    const newNote: Announcement = {
                        id: result.data.id,
                        title: result.data.title,
                        content: result.data.content,
                        createdAt: result.data.createdAt,
                        updatedAt: result.data.updatedAt,
                        author: result.data.author,
                        isAnnouncement: true,
                        isPinned: result.data.isPinned,
                        expiresAt: result.data.expiresAt,
                        acknowledgedCount: 0,
                    };
                    setAnnouncements((prev) => [newNote, ...prev]);
                }
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
            const result = await deleteAnnouncement(id);
            if (result.success) {
                setAnnouncements((prev) => prev.filter((n) => n.id !== id));
            }
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
            const result = await toggleAnnouncementPin(id);
            if (result.success && result.data) {
                setAnnouncements((prev) =>
                    prev.map((n) =>
                        n.id === id ? { ...n, isPinned: result.data!.isPinned } : n
                    )
                );
            }
        } catch (error) {
            console.error("Failed to toggle pin:", error);
        } finally {
            setPinningId(null);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
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
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.headerIcon}>
                        <Bell size={22} />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>Company Announcements</h1>
                        <p className={styles.headerSubtitle}>
                            Manage announcements visible to all dispatchers
                        </p>
                    </div>
                </div>
                <button onClick={() => setShowForm(true)} className={styles.newBtn}>
                    <Plus size={18} /> New Announcement
                </button>
            </header>

            {/* Cards Grid */}
            <div className={styles.grid}>
                {sortedAnnouncements.map((note) => (
                    <div
                        key={note.id}
                        className={`${styles.card} ${isExpired(note.expiresAt) ? styles.cardExpired : ""} ${note.isPinned ? styles.cardPinned : ""}`}
                    >
                        <div className={styles.cardTop}>
                            <div className={styles.titleRow}>
                                {note.isPinned && <Pin size={14} className={styles.pinIcon} />}
                                <h3 className={styles.cardTitle}>{note.title}</h3>
                            </div>
                            <div className={styles.cardActions}>
                                <button
                                    onClick={() => handleTogglePin(note.id)}
                                    className={styles.iconBtn}
                                    title={note.isPinned ? "Unpin" : "Pin to top"}
                                    disabled={pinningId === note.id}
                                >
                                    {note.isPinned ? <PinOff size={15} /> : <Pin size={15} />}
                                </button>
                                <button
                                    onClick={() => handleEdit(note)}
                                    className={styles.iconBtn}
                                    title="Edit"
                                >
                                    <Pencil size={15} />
                                </button>
                                <button
                                    onClick={() => setDeleteConfirm(note.id)}
                                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                    title="Delete"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        </div>

                        <p className={styles.cardBody}>{note.content}</p>

                        <div className={styles.badgesRow}>
                            <span className={`${styles.badge} ${styles.badgeAck}`}>
                                <Eye size={11} /> Requires acknowledgment
                            </span>
                            {totalUsers > 0 && (
                                <span className={`${styles.badge} ${styles.ackCount}`}>
                                    <CheckCircle2 size={11} />
                                    {note.acknowledgedCount}/{totalUsers} acknowledged
                                </span>
                            )}
                            {note.isPinned && (
                                <span className={`${styles.badge} ${styles.badgePinned}`}>
                                    <Pin size={10} /> Pinned
                                </span>
                            )}
                            {note.expiresAt && (
                                <span
                                    className={`${styles.badge} ${isExpired(note.expiresAt) ? styles.badgeExpired : styles.badgeExpires}`}
                                >
                                    <Calendar size={10} />
                                    {isExpired(note.expiresAt) ? "Expired" : `Expires ${formatDate(note.expiresAt)}`}
                                </span>
                            )}
                        </div>

                        <div className={styles.cardFooter}>
                            <span className={styles.footerItem}>
                                <User size={12} />
                                {note.author.name || "Admin"}
                            </span>
                            <span className={styles.footerItem}>
                                <Clock size={12} />
                                {formatDate(note.createdAt)}
                            </span>
                        </div>
                    </div>
                ))}

                {sortedAnnouncements.length === 0 && (
                    <div className={styles.empty}>
                        <Bell size={48} className={styles.emptyIcon} />
                        <p className={styles.emptyText}>
                            No announcements yet. Create one to announce important
                            information to all dispatchers.
                        </p>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
            {showForm && (
                <div
                    className={styles.overlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) resetForm();
                    }}
                >
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalHeaderLeft}>
                                <Bell size={20} className={styles.modalHeaderIcon} />
                                <h2 className={styles.modalTitle}>
                                    {editingNote ? "Edit Announcement" : "New Announcement"}
                                </h2>
                            </div>
                            <button onClick={resetForm} className={styles.closeBtn}>
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Title</label>
                                <input
                                    type="text"
                                    required
                                    className={styles.fieldInput}
                                    placeholder="Enter announcement title..."
                                    value={formData.title}
                                    onChange={(e) =>
                                        setFormData({ ...formData, title: e.target.value })
                                    }
                                />
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>Content</label>
                                <textarea
                                    required
                                    className={styles.fieldTextarea}
                                    placeholder="Write your message to all dispatchers..."
                                    value={formData.content}
                                    onChange={(e) =>
                                        setFormData({ ...formData, content: e.target.value })
                                    }
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={`${styles.fieldGroup} ${styles.formRowField}`}>
                                    <label className={styles.fieldLabel}>
                                        Expires At (Optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        className={styles.fieldInput}
                                        value={formData.expiresAt}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                expiresAt: e.target.value,
                                            })
                                        }
                                    />
                                </div>

                                <label className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        checked={formData.isPinned}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                isPinned: e.target.checked,
                                            })
                                        }
                                    />
                                    <Pin size={14} /> Pin to top
                                </label>
                            </div>

                            <div className={styles.infoBox}>
                                <Eye size={14} className={styles.infoBoxIcon} />
                                <span>
                                    This announcement will require acknowledgment from all
                                    dispatchers. Unacknowledged announcements will be highlighted
                                    on their dashboard.
                                </span>
                            </div>

                            <div className={styles.formActions}>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className={styles.btnCancel}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.btnSubmit}
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
                    className={styles.overlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setDeleteConfirm(null);
                    }}
                >
                    <div className={styles.deleteModal}>
                        <Trash2 size={40} className={styles.deleteIcon} />
                        <h2 className={styles.deleteTitle}>Delete Announcement?</h2>
                        <p className={styles.deleteText}>
                            This action cannot be undone. The announcement will be removed
                            from all dispatcher dashboards.
                        </p>
                        <div className={styles.deleteActions}>
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className={styles.btnCancel}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className={styles.btnDelete}
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
