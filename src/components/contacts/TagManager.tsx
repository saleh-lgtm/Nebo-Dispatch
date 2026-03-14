"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { createTag, updateTag, deleteTag } from "@/lib/tagActions";
import styles from "./Contacts.module.css";

interface TagData {
    id: string;
    name: string;
    color: string;
    description: string | null;
    _count: { assignments: number };
}

interface TagManagerProps {
    tags: TagData[];
    onTagsChange: () => void;
}

const DEFAULT_COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#84CC16", // Lime
];

export default function TagManager({ tags, onTagsChange }: TagManagerProps) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [color, setColor] = useState(DEFAULT_COLORS[0]);
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const resetForm = () => {
        setName("");
        setColor(DEFAULT_COLORS[0]);
        setDescription("");
        setShowForm(false);
        setEditingId(null);
        setError("");
    };

    const handleEdit = (tag: TagData) => {
        setEditingId(tag.id);
        setName(tag.name);
        setColor(tag.color);
        setDescription(tag.description || "");
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            if (editingId) {
                await updateTag(editingId, { name, color, description });
            } else {
                await createTag({ name, color, description });
            }
            resetForm();
            onTagsChange();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save tag");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this tag? It will be removed from all contacts.")) {
            return;
        }

        setLoading(true);
        try {
            await deleteTag(id);
            onTagsChange();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete tag");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.tagManager}>
            <div className={styles.tagManagerHeader}>
                <h3 className={styles.tagManagerTitle}>Contact Tags</h3>
                {!showForm && (
                    <button
                        type="button"
                        onClick={() => setShowForm(true)}
                        className="btn btn-primary btn-sm"
                    >
                        <Plus size={16} />
                        Add Tag
                    </button>
                )}
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className={styles.tagForm}>
                    <div className={styles.tagFormRow}>
                        <div className={styles.tagFormField}>
                            <label className={styles.tagFormLabel}>Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={styles.tagFormInput}
                                placeholder="e.g., VIP, Driver, Airport"
                                required
                                maxLength={50}
                            />
                        </div>
                        <div>
                            <label className={styles.tagFormLabel}>Color</label>
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className={styles.tagColorInput}
                            />
                        </div>
                    </div>
                    <div className={styles.tagFormField}>
                        <label className={styles.tagFormLabel}>Description</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={styles.tagFormInput}
                            placeholder="Optional description"
                            maxLength={200}
                        />
                    </div>
                    {error && (
                        <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>
                            {error}
                        </p>
                    )}
                    <div className={styles.tagFormActions}>
                        <button
                            type="button"
                            onClick={resetForm}
                            className="btn btn-secondary btn-sm"
                            disabled={loading}
                        >
                            <X size={14} />
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={loading || !name.trim()}
                        >
                            <Check size={14} />
                            {loading ? "Saving..." : editingId ? "Update" : "Create"}
                        </button>
                    </div>
                </form>
            )}

            <div className={styles.tagList}>
                {tags.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyStateText}>No tags yet. Create your first tag above.</p>
                    </div>
                ) : (
                    tags.map((tag) => (
                        <div key={tag.id} className={styles.tagItem}>
                            <div className={styles.tagItemInfo}>
                                <div
                                    className={styles.tagColorPreview}
                                    style={{ backgroundColor: tag.color }}
                                />
                                <div>
                                    <span className={styles.tagItemName}>{tag.name}</span>
                                    <span className={styles.tagItemCount}>
                                        {" "}
                                        ({tag._count.assignments} contact{tag._count.assignments !== 1 ? "s" : ""})
                                    </span>
                                </div>
                            </div>
                            <div className={styles.tagItemActions}>
                                <button
                                    type="button"
                                    onClick={() => handleEdit(tag)}
                                    className="btn btn-ghost btn-icon btn-sm"
                                    title="Edit tag"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(tag.id)}
                                    className="btn btn-ghost btn-icon btn-sm"
                                    title="Delete tag"
                                    disabled={loading}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
