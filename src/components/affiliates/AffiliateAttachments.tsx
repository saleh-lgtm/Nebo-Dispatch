"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Download, Trash2, X } from "lucide-react";
import { uploadAffiliateAttachment, deleteAffiliateAttachment } from "@/lib/affiliateActions";
import { uploadFileFromFormData } from "@/lib/storageActions";
import { STORAGE_BUCKETS } from "@/lib/supabase";
import { useToast } from "@/hooks/useToast";
import FileUpload from "@/components/ui/FileUpload";

interface Attachment {
    id: string;
    title: string;
    description: string | null;
    documentType: string | null;
    fileUrl: string;
    fileName: string;
    fileSize: number | null;
    createdAt: Date;
    uploadedBy: { id: string; name: string | null };
}

interface Props {
    affiliateId: string;
    affiliateName: string;
    attachments: Attachment[];
    isAdmin?: boolean;
}

const DOCUMENT_TYPES = [
    "Contract",
    "W-9",
    "Insurance Certificate",
    "COI",
    "Rate Sheet",
    "Agreement",
    "License",
    "Other",
];

export default function AffiliateAttachments({
    affiliateId,
    affiliateName,
    attachments,
    isAdmin = false,
}: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [form, setForm] = useState({
        title: "",
        description: "",
        documentType: "",
    });

    const resetForm = () => {
        setForm({ title: "", description: "", documentType: "" });
        setSelectedFile(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title || !selectedFile) {
            addToast("Please fill in the title and select a file", "error");
            return;
        }

        setLoading(true);
        setUploading(true);

        try {
            // Upload file first
            const formData = new FormData();
            formData.append("file", selectedFile);

            const uploadResult = await uploadFileFromFormData(
                STORAGE_BUCKETS.AFFILIATE_ATTACHMENTS,
                formData,
                `affiliates/${affiliateId}`
            );

            // Create attachment record
            await uploadAffiliateAttachment({
                affiliateId,
                title: form.title,
                description: form.description || undefined,
                documentType: form.documentType || undefined,
                fileUrl: uploadResult.url,
                fileName: uploadResult.fileName,
                fileSize: uploadResult.fileSize,
                mimeType: uploadResult.mimeType,
            });

            addToast("Attachment uploaded successfully", "success");
            setShowModal(false);
            resetForm();
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to upload attachment", "error");
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const handleDelete = async (attachmentId: string, fileName: string) => {
        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

        try {
            await deleteAffiliateAttachment(attachmentId);
            addToast("Attachment deleted successfully", "success");
            router.refresh();
        } catch (error) {
            addToast(error instanceof Error ? error.message : "Failed to delete attachment", "error");
        }
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const formatFileSize = (bytes: number | null): string => {
        if (!bytes) return "";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    return (
        <div className="attachments-section">
            <div className="section-header">
                <h3>
                    <FileText size={18} />
                    Attachments ({attachments.length})
                </h3>
                {isAdmin && (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setShowModal(true)}
                    >
                        <Plus size={16} /> Add
                    </button>
                )}
            </div>

            {attachments.length === 0 ? (
                <div className="empty-state">
                    <FileText size={32} />
                    <p>No attachments yet</p>
                </div>
            ) : (
                <div className="attachments-list">
                    {attachments.map((attachment) => (
                        <div key={attachment.id} className="attachment-item">
                            <div className="attachment-icon">
                                <FileText size={20} />
                            </div>
                            <div className="attachment-info">
                                <span className="attachment-title">{attachment.title}</span>
                                <div className="attachment-meta">
                                    {attachment.documentType && (
                                        <span className="doc-type">{attachment.documentType}</span>
                                    )}
                                    <span>{formatDate(attachment.createdAt)}</span>
                                    {attachment.fileSize && (
                                        <span>{formatFileSize(attachment.fileSize)}</span>
                                    )}
                                </div>
                            </div>
                            <div className="attachment-actions">
                                <a
                                    href={attachment.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-ghost btn-sm"
                                    title="Download"
                                >
                                    <Download size={16} />
                                </a>
                                {isAdmin && (
                                    <button
                                        className="btn btn-ghost btn-sm danger"
                                        onClick={() => handleDelete(attachment.id, attachment.title)}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Upload Attachment</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <p className="modal-subtitle">
                            Adding attachment to <strong>{affiliateName}</strong>
                        </p>

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Title *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="e.g., Insurance Certificate 2024"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Document Type</label>
                                <select
                                    value={form.documentType}
                                    onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                                >
                                    <option value="">Select type...</option>
                                    {DOCUMENT_TYPES.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Optional description..."
                                    rows={2}
                                />
                            </div>

                            <div className="form-group">
                                <FileUpload
                                    label="File *"
                                    onFileSelect={setSelectedFile}
                                    isUploading={uploading}
                                />
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setShowModal(false);
                                        resetForm();
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading || !selectedFile}
                                >
                                    {loading ? "Uploading..." : "Upload"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .attachments-section {
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid var(--border);
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .section-header h3 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    color: var(--text-muted);
                    text-align: center;
                }

                .empty-state p {
                    margin: 0.5rem 0 0;
                    font-size: 0.875rem;
                }

                .attachments-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .attachment-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                }

                .attachment-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    background: var(--bg-hover);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    flex-shrink: 0;
                }

                .attachment-info {
                    flex: 1;
                    min-width: 0;
                }

                .attachment-title {
                    display: block;
                    font-weight: 500;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .attachment-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-top: 0.25rem;
                }

                .doc-type {
                    background: var(--bg-hover);
                    padding: 0.125rem 0.375rem;
                    border-radius: var(--radius-sm);
                }

                .attachment-actions {
                    display: flex;
                    gap: 0.25rem;
                }

                .attachment-actions .danger {
                    color: var(--danger);
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
                    z-index: 200;
                    padding: 1rem;
                }

                .modal-content {
                    width: 100%;
                    max-width: 450px;
                    padding: 1.5rem;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .modal-header h2 {
                    font-size: 1.25rem;
                    margin: 0;
                    color: var(--text-primary);
                }

                .modal-subtitle {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin: 0 0 1.5rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                    margin-bottom: 1rem;
                }

                .form-group label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    padding: 0.625rem 0.875rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--primary);
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    margin-top: 1.5rem;
                }
            `}</style>
        </div>
    );
}
