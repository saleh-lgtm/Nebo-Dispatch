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
    FolderOpen,
    ExternalLink,
    FileText,
    AlertTriangle,
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
    quickReference: string | null;
    requiresAcknowledgment: boolean;
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
        quickReference: "",
        requiresAcknowledgment: false,
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
            quickReference: "",
            requiresAcknowledgment: false,
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
                    quickReference: formData.quickReference || undefined,
                    requiresAcknowledgment: formData.requiresAcknowledgment,
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
                    quickReference: formData.quickReference || undefined,
                    requiresAcknowledgment: formData.requiresAcknowledgment,
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
            quickReference: sop.quickReference || "",
            requiresAcknowledgment: sop.requiresAcknowledgment,
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
        <>
            <div className="sops-admin">
                {/* Header */}
                <header className="page-header">
                    <div className="header-content">
                        <div className="header-icon">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h1>Standard Operating Procedures</h1>
                            <p>Manage company SOPs and documentation</p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <select
                            className="filter-select"
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
                        <button onClick={() => setShowForm(true)} className="btn-primary">
                            <Plus size={18} />
                            New SOP
                        </button>
                    </div>
                </header>

                {/* Stats */}
                <div className="stats-row">
                    <div className="stat-item">
                        <span className="stat-number">{sops.length}</span>
                        <span className="stat-label">Total SOPs</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number stat-success">{sops.filter((s) => s.isPublished).length}</span>
                        <span className="stat-label">Published</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number stat-warning">{sops.filter((s) => !s.isPublished).length}</span>
                        <span className="stat-label">Drafts</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number stat-info">{categories.length}</span>
                        <span className="stat-label">Categories</span>
                    </div>
                </div>

                {/* SOPs Table */}
                <div className="table-card">
                    <table>
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSOPs.map((sop) => (
                                <tr key={sop.id}>
                                    <td>
                                        <div className="sop-title">
                                            <div className="title-row">
                                                <span className="title-text">{sop.title}</span>
                                                {sop.requiresAcknowledgment && (
                                                    <span className="ack-badge" title="Requires acknowledgment">
                                                        <AlertTriangle size={12} />
                                                    </span>
                                                )}
                                            </div>
                                            {sop.description && (
                                                <span className="title-desc">{sop.description}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        {sop.category ? (
                                            <span className="category-badge">
                                                <FolderOpen size={12} />
                                                {sop.category}
                                            </span>
                                        ) : (
                                            <span className="no-category">—</span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => handleTogglePublished(sop)}
                                            className={`status-badge ${sop.isPublished ? "published" : "draft"}`}
                                            title={sop.isPublished ? "Click to unpublish" : "Click to publish"}
                                        >
                                            {sop.isPublished ? (
                                                <>
                                                    <Eye size={12} /> Published
                                                </>
                                            ) : (
                                                <>
                                                    <EyeOff size={12} /> Draft
                                                </>
                                            )}
                                        </button>
                                    </td>
                                    <td>
                                        <div className="date-cell">
                                            <Clock size={14} />
                                            {formatDate(sop.updatedAt)}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <Link
                                                href={`/sops/${sop.slug}`}
                                                target="_blank"
                                                className="action-btn"
                                                title="View SOP"
                                            >
                                                <ExternalLink size={16} />
                                            </Link>
                                            <button
                                                onClick={() => handleEdit(sop)}
                                                className="action-btn"
                                                title="Edit"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(sop.id)}
                                                className="action-btn danger"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSOPs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="empty-state">
                                        <FileText size={48} />
                                        <p>
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
            </div>

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
                    <div className="modal modal-lg">
                        <div className="modal-header">
                            <div className="modal-title">
                                <BookOpen size={20} />
                                <h2>{editingSOP ? "Edit SOP" : "New SOP"}</h2>
                            </div>
                            <button onClick={resetForm} className="close-btn">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Title *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g., Customer Complaint Handling"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Category</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Customer Service"
                                        list="categories"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    />
                                    <datalist id="categories">
                                        {categories.map((cat) => (
                                            <option key={cat} value={cat} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <input
                                    type="text"
                                    placeholder="Brief description of this SOP..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Content *</label>
                                <textarea
                                    required
                                    placeholder="Write the SOP content here... (Markdown supported)"
                                    className="content-textarea"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                />
                                <p className="form-hint">Tip: You can use Markdown formatting (headings, lists, bold, etc.)</p>
                            </div>

                            <div className="form-group">
                                <label>Quick Reference (Optional)</label>
                                <textarea
                                    placeholder="Add a brief summary or key points for quick reference..."
                                    className="quick-ref-textarea"
                                    value={formData.quickReference}
                                    onChange={(e) => setFormData({ ...formData, quickReference: e.target.value })}
                                />
                                <p className="form-hint">Shown as a collapsible section at the top of the SOP</p>
                            </div>

                            <div className="toggle-row">
                                <label className="toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.requiresAcknowledgment}
                                        onChange={(e) => setFormData({ ...formData, requiresAcknowledgment: e.target.checked })}
                                    />
                                    <span>Requires Acknowledgment</span>
                                </label>
                                <span className="toggle-hint">Users must confirm they've read and understood this SOP</span>
                            </div>

                            <div className="publish-toggle">
                                <label className="toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.isPublished}
                                        onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                                    />
                                    <span>Publish immediately</span>
                                </label>
                                <span className={`toggle-status ${formData.isPublished ? "published" : "draft"}`}>
                                    {formData.isPublished ? "Will be visible" : "Draft only"}
                                </span>
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={resetForm} className="btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? "Saving..." : editingSOP ? "Update SOP" : "Create SOP"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
                    <div className="modal modal-sm">
                        <div className="delete-modal">
                            <div className="delete-icon">
                                <AlertTriangle size={32} />
                            </div>
                            <h2>Delete SOP?</h2>
                            <p>This action cannot be undone. The SOP will be permanently removed.</p>
                            <div className="delete-actions">
                                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">
                                    Cancel
                                </button>
                                <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger" disabled={loading}>
                                    {loading ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .sops-admin {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                /* Header */
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    background: var(--primary-soft);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                }

                .page-header h1 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .page-header p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .header-actions {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }

                .filter-select {
                    padding: 0.5rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    cursor: pointer;
                    min-width: 150px;
                }

                .btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: var(--primary);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .btn-primary:hover {
                    background: var(--primary-hover);
                }

                /* Stats */
                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-item {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1rem 1.25rem;
                    text-align: center;
                }

                .stat-number {
                    display: block;
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--primary);
                    margin-bottom: 0.25rem;
                }

                .stat-success { color: var(--success); }
                .stat-warning { color: var(--warning); }
                .stat-info { color: var(--info); }

                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                /* Table */
                .table-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                th {
                    padding: 1rem;
                    text-align: left;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border);
                }

                th:last-child {
                    text-align: right;
                }

                td {
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                    vertical-align: middle;
                }

                tr:last-child td {
                    border-bottom: none;
                }

                tr:hover td {
                    background: var(--bg-hover);
                }

                .sop-title {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .title-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .title-text {
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .ack-badge {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    background: var(--warning-bg);
                    color: var(--warning);
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .title-desc {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .category-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.25rem 0.625rem;
                    background: var(--primary-soft);
                    color: var(--primary);
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .no-category {
                    color: var(--text-muted);
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .status-badge.published {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .status-badge.draft {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                .status-badge:hover {
                    opacity: 0.8;
                }

                .date-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                }

                .action-btns {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                }

                .action-btn {
                    padding: 0.375rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-decoration: none;
                }

                .action-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                    border-color: var(--border-hover);
                }

                .action-btn.danger:hover {
                    background: var(--danger-bg);
                    color: var(--danger);
                    border-color: var(--danger-border);
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem !important;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    opacity: 0.3;
                    margin-bottom: 1rem;
                }

                .empty-state p {
                    font-size: 0.875rem;
                }

                /* Modal */
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

                .modal {
                    background: var(--bg-primary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    width: 100%;
                    max-height: 90vh;
                    overflow: auto;
                    animation: modalIn 0.2s ease;
                }

                .modal-lg {
                    max-width: 700px;
                }

                .modal-sm {
                    max-width: 400px;
                }

                @keyframes modalIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                }

                .modal-title {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: var(--primary);
                }

                .modal-title h2 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .close-btn {
                    padding: 0.5rem;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: var(--radius-md);
                    transition: all 0.15s;
                }

                .close-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .modal-form {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .form-group input,
                .form-group textarea {
                    padding: 0.75rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.9375rem;
                    font-family: inherit;
                    transition: border-color 0.15s;
                }

                .form-group input:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .form-group input::placeholder,
                .form-group textarea::placeholder {
                    color: var(--text-muted);
                }

                .content-textarea {
                    height: 250px;
                    resize: vertical;
                    font-family: monospace;
                }

                .quick-ref-textarea {
                    height: 100px;
                    resize: vertical;
                }

                .toggle-row {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.875rem 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                }

                .toggle-hint {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .form-hint {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .publish-toggle {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .toggle-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    font-size: 0.875rem;
                }

                .toggle-label input {
                    accent-color: var(--primary);
                }

                .toggle-status {
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    font-size: 0.6875rem;
                    font-weight: 600;
                }

                .toggle-status.published {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .toggle-status.draft {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    margin-top: 0.5rem;
                }

                .btn-secondary {
                    padding: 0.625rem 1.25rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-secondary:hover {
                    background: var(--bg-hover);
                    border-color: var(--border-hover);
                }

                /* Delete Modal */
                .delete-modal {
                    padding: 2rem;
                    text-align: center;
                }

                .delete-icon {
                    width: 64px;
                    height: 64px;
                    background: var(--danger-bg);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1.25rem;
                    color: var(--danger);
                }

                .delete-modal h2 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }

                .delete-modal p {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    margin-bottom: 1.5rem;
                }

                .delete-actions {
                    display: flex;
                    justify-content: center;
                    gap: 0.75rem;
                }

                .btn-danger {
                    padding: 0.625rem 1.25rem;
                    background: var(--danger);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .btn-danger:hover {
                    background: #DC2626;
                }

                .btn-danger:disabled,
                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                @media (max-width: 768px) {
                    .stats-row {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .form-row {
                        grid-template-columns: 1fr;
                    }

                    .header-actions {
                        width: 100%;
                    }

                    .filter-select {
                        flex: 1;
                    }
                }
            `}</style>
        </>
    );
}
