"use client";

import { useState } from "react";
import { StickyNote, Plus, Clock, User, History, X } from "lucide-react";
import { createShiftNote } from "@/lib/notesActions";
import type { ShiftHandoffNote } from "@/types/note";
import styles from "./ShiftNotesCard.module.css";

interface Props {
    notes: ShiftHandoffNote[];
    hasActiveShift: boolean;
}

export default function ShiftNotesCard({ notes, hasActiveShift }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [localNotes, setLocalNotes] = useState(notes);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setSubmitting(true);
        setError(null);
        try {
            const newNote = await createShiftNote({ title, content });
            setLocalNotes((prev) => [
                {
                    ...newNote,
                    isFromCurrentShift: true,
                    isFromPreviousShift: false,
                    shiftAuthor: newNote.author,
                } as ShiftHandoffNote,
                ...prev,
            ]);
            setTitle("");
            setContent("");
            setShowForm(false);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create note"
            );
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (date: Date) =>
        new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <StickyNote size={18} className={styles.headerIcon} />
                    <h3 className={styles.title}>Active Shift Notes</h3>
                </div>
                {hasActiveShift && (
                    <button
                        onClick={() => setShowForm(true)}
                        className={styles.addButton}
                    >
                        <Plus size={14} /> Add Note
                    </button>
                )}
            </div>

            <div className={styles.list}>
                {localNotes.length > 0 ? (
                    localNotes.slice(0, 8).map((note) => (
                        <div
                            key={note.id}
                            className={`${styles.item} ${
                                note.isFromPreviousShift
                                    ? styles.previousShift
                                    : ""
                            }`}
                        >
                            {note.isFromPreviousShift && (
                                <span className={styles.handoffBadge}>
                                    <History size={10} /> Handoff
                                </span>
                            )}

                            <h4 className={styles.itemTitle}>{note.title}</h4>
                            <p className={styles.itemContent}>
                                {note.content.length > 120
                                    ? `${note.content.slice(0, 120)}...`
                                    : note.content}
                            </p>

                            <div className={styles.meta}>
                                <span>
                                    <User size={10} /> {note.shiftAuthor.name}
                                </span>
                                <span>
                                    <Clock size={10} />{" "}
                                    {formatDate(note.createdAt)}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.empty}>
                        <StickyNote size={32} />
                        <p>No active shift notes</p>
                        {hasActiveShift && (
                            <p className={styles.hint}>
                                Create a note to hand off to the next shift
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Create Note Modal */}
            {showForm && (
                <div
                    className={styles.modalOverlay}
                    onClick={() => setShowForm(false)}
                >
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.modalHeader}>
                            <h3>New Shift Note</h3>
                            <button
                                onClick={() => setShowForm(false)}
                                className={styles.closeBtn}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {error && (
                                <div className={styles.error}>{error}</div>
                            )}
                            <input
                                type="text"
                                placeholder="Note title..."
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className={styles.input}
                                required
                                autoFocus
                            />
                            <textarea
                                placeholder="Write your shift note for handoff..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className={styles.textarea}
                                required
                                rows={4}
                            />
                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className={styles.cancelBtn}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={styles.submitBtn}
                                >
                                    {submitting ? "Creating..." : "Create Note"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
