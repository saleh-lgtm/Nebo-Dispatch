"use client";

import { useState } from "react";
import {
    BookOpen,
    Plus,
    Edit3,
    Trash2,
    X,
    Eye,
    EyeOff,
    Clock,
    User,
    FolderOpen,
    GripVertical,
    ExternalLink,
} from "lucide-react";
import {
    createSOP,
    updateSOP,
    deleteSOP,
    toggleSOPPublished,
} from "@/lib/sopActions";
import Link from "next/link";

interface SOP {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    content: string;
    category: string | null;
    isPublished: boolean;
    order: number;
    createdBy: { id: string; name: string | null };
    createdAt: Date;
    updatedAt: Date;
}

interface Props {
    initialSOPs: SOP[];
}

export default function SOPsAdminClient({ initialSOPs }: Props) {
    const [sops, setSOPs] = useState<SOP[]>(initialSOPs);
    const [showForm, setShowForm] = useState(false);
    const [editingSOP, setEditingSOP] = useState<SOP | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        content: "",
        category: "",
        isPublished: true,
    });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [filterCategory, setFilterCategory] = useState<string>("all");

    const categories = [...new Set(sops.map((s) => s.category).filter(Boolean))] as string[];

    const filteredSOPs =
        filterCategory === "all"
            ? sops
            : sops.filter((s) => s.category === filterCategory);

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            content: "",
            category: "",
            isPublished: true,
        });
        setEditingSOP(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.content.trim()) return;

        setLoading(true);

        try {
            if (editingSOP) {
                const updated = await updateSOP(editingSOP.id, {
                    title: formData.title,
                    description: formData.description || undefined,
                    content: formData.content,
                    category: formData.category || undefined,
                    isPublished: formData.isPublished,
                });
                setSOPs((prev) =>
                    prev.map((s) =>
                        s.id === editingSOP.id ? { ...s, ...updated } : s
                    )
                );
            } else {
                const newSOP = await createSOP({
                    title: formData.title,
                    description: formData.description || undefined,
                    content: formData.content,
                    category: formData.category || undefined,
                    isPublished: formData.isPublished,
                });
                setSOPs((prev) => [
                    { ...newSOP, createdBy: { id: "", name: "You" } } as SOP,
                    ...prev,
                ]);
            }
            resetForm();
        } catch (error) {
            console.error("Failed to save SOP:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (sop: SOP) => {
        setEditingSOP(sop);
        setFormData({
            title: sop.title,
            description: sop.description || "",
            content: sop.content,
            category: sop.category || "",
            isPublished: sop.isPublished,
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        setLoading(true);
        try {
            await deleteSOP(id);
            setSOPs((prev) => prev.filter((s) => s.id !== id));
            setDeleteConfirm(null);
        } catch (error) {
            console.error("Failed to delete SOP:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePublished = async (sop: SOP) => {
        try {
            const updated = await toggleSOPPublished(sop.id);
            setSOPs((prev) =>
                prev.map((s) =>
                    s.id === sop.id ? { ...s, isPublished: updated.isPublished } : s
                )
            );
        } catch (error) {
            console.error("Failed to toggle publish status:", error);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: "1.5rem" }}>
            {/* Header */}
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <BookOpen size={28} className="text-accent" />
                    <div>
                        <h1 className="font-display" style={{ fontSize: "1.75rem" }}>
                            Standard Operating Procedures
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Manage company SOPs and documentation
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="input"
                        style={{ width: "auto", minWidth: "150px" }}
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                    <button onClick={() => setShowForm(true)} className="btn btn-primary">
                        <Plus size={18} /> New SOP
                    </button>
                </div>
            </header>

            {/* Stats Row */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "1rem",
                }}
            >
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 700, color: "var(--accent)" }}>
                        {sops.length}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Total SOPs
                    </p>
                </div>
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 700, color: "var(--success)" }}>
                        {sops.filter((s) => s.isPublished).length}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Published
                    </p>
                </div>
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 700, color: "var(--warning)" }}>
                        {sops.filter((s) => !s.isPublished).length}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Drafts
                    </p>
                </div>
                <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", fontWeight: 700, color: "var(--info)" }}>
                        {categories.length}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Categories
                    </p>
                </div>
            </div>

            {/* SOPs List */}
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr
                            style={{
                                borderBottom: "1px solid var(--border)",
                                background: "rgba(0,0,0,0.2)",
                            }}
                        >
                            <th
                                style={{
                                    padding: "1rem",
                                    textAlign: "left",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                }}
                            >
                                Title
                            </th>
                            <th
                                style={{
                                    padding: "1rem",
                                    textAlign: "left",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                }}
                            >
                                Category
                            </th>
                            <th
                                style={{
                                    padding: "1rem",
                                    textAlign: "center",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                }}
                            >
                                Status
                            </th>
                            <th
                                style={{
                                    padding: "1rem",
                                    textAlign: "left",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                }}
                            >
                                Updated
                            </th>
                            <th
                                style={{
                                    padding: "1rem",
                                    textAlign: "right",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                }}
                            >
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredSOPs.map((sop, idx) => (
                            <tr
                                key={sop.id}
                                style={{
                                    borderBottom:
                                        idx < filteredSOPs.length - 1
                                            ? "1px solid var(--border)"
                                            : "none",
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = "rgba(196, 167, 125, 0.05)")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = "transparent")
                                }
                            >
                                <td style={{ padding: "1rem" }}>
                                    <div className="flex flex-col gap-1">
                                        <span style={{ fontWeight: 500 }}>{sop.title}</span>
                                        {sop.description && (
                                            <span
                                                style={{
                                                    fontSize: "0.8125rem",
                                                    color: "var(--text-secondary)",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 1,
                                                    WebkitBoxOrient: "vertical",
                                                    overflow: "hidden",
                                                }}
                                            >
                                                {sop.description}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: "1rem" }}>
                                    {sop.category ? (
                                        <span
                                            className="badge badge-primary"
                                            style={{ fontSize: "0.6875rem" }}
                                        >
                                            <FolderOpen size={10} />
                                            {sop.category}
                                        </span>
                                    ) : (
                                        <span style={{ color: "var(--text-muted)" }}>-</span>
                                    )}
                                </td>
                                <td style={{ padding: "1rem", textAlign: "center" }}>
                                    <button
                                        onClick={() => handleTogglePublished(sop)}
                                        className={`badge ${
                                            sop.isPublished ? "badge-success" : "badge-warning"
                                        }`}
                                        style={{ cursor: "pointer" }}
                                        title={
                                            sop.isPublished
                                                ? "Click to unpublish"
                                                : "Click to publish"
                                        }
                                    >
                                        {sop.isPublished ? (
                                            <>
                                                <Eye size={10} /> Published
                                            </>
                                        ) : (
                                            <>
                                                <EyeOff size={10} /> Draft
                                            </>
                                        )}
                                    </button>
                                </td>
                                <td style={{ padding: "1rem" }}>
                                    <div className="flex items-center gap-1" style={{ color: "var(--text-secondary)", fontSize: "0.8125rem" }}>
                                        <Clock size={12} />
                                        {formatDate(sop.updatedAt)}
                                    </div>
                                </td>
                                <td style={{ padding: "1rem" }}>
                                    <div className="flex justify-end gap-2">
                                        <Link
                                            href={`/sops/${sop.slug}`}
                                            target="_blank"
                                            className="btn btn-ghost btn-sm"
                                            style={{ padding: "0.375rem 0.5rem" }}
                                            title="View SOP"
                                        >
                                            <ExternalLink size={14} />
                                        </Link>
                                        <button
                                            onClick={() => handleEdit(sop)}
                                            className="btn btn-ghost btn-sm"
                                            style={{ padding: "0.375rem 0.5rem" }}
                                            title="Edit"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(sop.id)}
                                            className="btn btn-ghost btn-sm"
                                            style={{
                                                padding: "0.375rem 0.5rem",
                                                color: "var(--danger)",
                                            }}
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredSOPs.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: "3rem", textAlign: "center" }}>
                                    <BookOpen
                                        size={48}
                                        style={{ opacity: 0.3, margin: "0 auto 1rem" }}
                                    />
                                    <p style={{ color: "var(--text-secondary)" }}>
                                        {filterCategory === "all"
                                            ? "No SOPs yet. Create one to get started."
                                            : `No SOPs in "${filterCategory}" category.`}
                                    </p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {showForm && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) resetForm();
                    }}
                >
                    <div
                        className="glass-card w-full animate-scale-in"
                        style={{ maxWidth: "800px", maxHeight: "90vh", overflow: "auto" }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <BookOpen className="text-accent" />
                                <h2 className="font-display" style={{ fontSize: "1.5rem" }}>
                                    {editingSOP ? "Edit SOP" : "New SOP"}
                                </h2>
                            </div>
                            <button onClick={resetForm} className="btn-icon">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "1rem",
                                }}
                            >
                                <div className="flex flex-col gap-1">
                                    <label
                                        className="text-xs uppercase tracking-wider font-bold"
                                        style={{ color: "var(--text-secondary)" }}
                                    >
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="input"
                                        placeholder="e.g., Customer Complaint Handling"
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
                                        Category
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g., Customer Service"
                                        list="categories"
                                        value={formData.category}
                                        onChange={(e) =>
                                            setFormData({ ...formData, category: e.target.value })
                                        }
                                    />
                                    <datalist id="categories">
                                        {categories.map((cat) => (
                                            <option key={cat} value={cat} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label
                                    className="text-xs uppercase tracking-wider font-bold"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    Description
                                </label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Brief description of this SOP..."
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label
                                    className="text-xs uppercase tracking-wider font-bold"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    Content *
                                </label>
                                <textarea
                                    required
                                    className="input"
                                    placeholder="Write the SOP content here... (Markdown supported)"
                                    style={{ height: "300px", resize: "vertical", fontFamily: "monospace" }}
                                    value={formData.content}
                                    onChange={(e) =>
                                        setFormData({ ...formData, content: e.target.value })
                                    }
                                />
                                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                    Tip: You can use Markdown formatting (headings, lists, bold, etc.)
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isPublished}
                                        onChange={(e) =>
                                            setFormData({ ...formData, isPublished: e.target.checked })
                                        }
                                        style={{ accentColor: "var(--accent)" }}
                                    />
                                    <span style={{ fontSize: "0.875rem" }}>
                                        Publish immediately
                                    </span>
                                </label>
                                <span
                                    className={`badge ${
                                        formData.isPublished ? "badge-success" : "badge-warning"
                                    }`}
                                    style={{ fontSize: "0.625rem" }}
                                >
                                    {formData.isPublished ? "Will be visible" : "Draft only"}
                                </span>
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
                                        : editingSOP
                                        ? "Update SOP"
                                        : "Create SOP"}
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
                            Delete SOP?
                        </h2>
                        <p
                            style={{
                                color: "var(--text-secondary)",
                                marginBottom: "1.5rem",
                            }}
                        >
                            This action cannot be undone. The SOP will be permanently removed.
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
