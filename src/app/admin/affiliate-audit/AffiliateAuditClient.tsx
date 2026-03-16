"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Trash2,
    Edit2,
    Building2,
    ToggleLeft,
    ToggleRight,
    MoreVertical,
    FileSearch,
    Clock,
    ArrowUpDown,
} from "lucide-react";
import {
    addAffiliateToAuditList,
    updateAffiliateAuditConfig,
    removeAffiliateFromAuditList,
} from "@/lib/affiliateAuditActions";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

interface AuditConfig {
    id: string;
    affiliateId: string;
    auditFrequency: string;
    priority: number;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    affiliate: {
        id: string;
        name: string;
        type: string;
        isActive: boolean;
    };
}

interface AvailableAffiliate {
    id: string;
    name: string;
    type: string;
}

interface Stats {
    total: number;
    byFrequency: Record<string, number>;
}

interface Props {
    initialConfigs: AuditConfig[];
    availableAffiliates: AvailableAffiliate[];
    stats: Stats;
}

const FREQUENCY_OPTIONS = [
    { value: "EVERY_SHIFT", label: "Every Shift", description: "Audit during each shift" },
    { value: "DAILY", label: "Daily", description: "Audit once per day" },
    { value: "WEEKLY", label: "Weekly", description: "Audit once per week" },
];

export default function AffiliateAuditClient({
    initialConfigs,
    availableAffiliates: initialAvailable,
    stats,
}: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [configs, setConfigs] = useState<AuditConfig[]>(initialConfigs);
    const [availableAffiliates, setAvailableAffiliates] = useState<AvailableAffiliate[]>(initialAvailable);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingConfig, setEditingConfig] = useState<AuditConfig | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedConfig, setSelectedConfig] = useState<AuditConfig | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Form state
    const [selectedAffiliateId, setSelectedAffiliateId] = useState("");
    const [auditFrequency, setAuditFrequency] = useState("EVERY_SHIFT");
    const [priority, setPriority] = useState(0);
    const [notes, setNotes] = useState("");

    // Loading state
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setSelectedAffiliateId("");
        setAuditFrequency("EVERY_SHIFT");
        setPriority(0);
        setNotes("");
        setEditingConfig(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (config: AuditConfig) => {
        setAuditFrequency(config.auditFrequency);
        setPriority(config.priority);
        setNotes(config.notes || "");
        setEditingConfig(config);
        setActiveDropdown(null);
        setShowModal(true);
    };

    const openDeleteConfirm = (config: AuditConfig) => {
        setSelectedConfig(config);
        setActiveDropdown(null);
        setShowDeleteConfirm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingConfig && !selectedAffiliateId) {
            addToast("Please select an affiliate", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingConfig) {
                const result = await updateAffiliateAuditConfig(editingConfig.id, {
                    auditFrequency: auditFrequency as "EVERY_SHIFT" | "DAILY" | "WEEKLY",
                    priority,
                    notes: notes.trim() || undefined,
                });
                if (!result.success || !result.data) {
                    throw new Error(result.error || "Failed to update configuration");
                }
                const updated = result.data as AuditConfig;
                setConfigs(configs.map((c) => (c.id === updated.id ? updated : c)));
                addToast("Configuration updated successfully", "success");
            } else {
                const result = await addAffiliateToAuditList({
                    affiliateId: selectedAffiliateId,
                    auditFrequency: auditFrequency as "EVERY_SHIFT" | "DAILY" | "WEEKLY",
                    priority,
                    notes: notes.trim() || undefined,
                });
                if (!result.success || !result.data) {
                    throw new Error(result.error || "Failed to add affiliate");
                }
                const created = result.data as AuditConfig;
                setConfigs([...configs, created]);
                setAvailableAffiliates(availableAffiliates.filter((a) => a.id !== selectedAffiliateId));
                addToast("Affiliate added to audit list", "success");
            }

            setShowModal(false);
            resetForm();
            router.refresh();
        } catch (err) {
            addToast(
                err instanceof Error ? err.message : "Failed to save configuration",
                "error"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedConfig) return;

        setIsSubmitting(true);
        try {
            await removeAffiliateFromAuditList(selectedConfig.id);
            setConfigs(configs.filter((c) => c.id !== selectedConfig.id));
            setAvailableAffiliates([
                ...availableAffiliates,
                {
                    id: selectedConfig.affiliate.id,
                    name: selectedConfig.affiliate.name,
                    type: selectedConfig.affiliate.type,
                },
            ]);
            addToast("Affiliate removed from audit list", "success");
            setShowDeleteConfirm(false);
            setSelectedConfig(null);
        } catch (err) {
            addToast(
                err instanceof Error ? err.message : "Failed to remove affiliate",
                "error"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const getFrequencyLabel = (freq: string) => {
        return FREQUENCY_OPTIONS.find((f) => f.value === freq)?.label || freq;
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case "FARM_IN":
                return { bg: "rgba(34, 197, 94, 0.1)", text: "#4ade80" };
            case "FARM_OUT":
                return { bg: "rgba(59, 130, 246, 0.1)", text: "#60a5fa" };
            default:
                return { bg: "rgba(156, 163, 175, 0.1)", text: "#9ca3af" };
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        <FileSearch size={28} style={{ marginRight: "0.75rem", color: "#22d3ee" }} />
                        Affiliate Portal Audit Configuration
                    </h1>
                    <p className="page-subtitle">
                        Configure which affiliates dispatchers should audit during their shifts
                    </p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="btn btn-primary"
                    disabled={availableAffiliates.length === 0}
                >
                    <Plus size={18} />
                    Add Affiliate
                </button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(6, 182, 212, 0.1)", color: "#22d3ee" }}>
                        <Building2 size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total Affiliates</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#4ade80" }}>
                        <Clock size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.byFrequency["EVERY_SHIFT"] || 0}</span>
                        <span className="stat-label">Every Shift</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#fbbf24" }}>
                        <Clock size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.byFrequency["DAILY"] || 0}</span>
                        <span className="stat-label">Daily</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: "rgba(168, 85, 247, 0.1)", color: "#c084fc" }}>
                        <Clock size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.byFrequency["WEEKLY"] || 0}</span>
                        <span className="stat-label">Weekly</span>
                    </div>
                </div>
            </div>

            {/* Configs Table */}
            {configs.length === 0 ? (
                <div className="empty-state">
                    <FileSearch size={48} style={{ color: "#22d3ee", marginBottom: "1rem" }} />
                    <h3>No Affiliates Configured</h3>
                    <p>Add affiliates that dispatchers should audit during their shifts.</p>
                    <button
                        onClick={openCreateModal}
                        className="btn btn-primary"
                        disabled={availableAffiliates.length === 0}
                        style={{ marginTop: "1rem" }}
                    >
                        <Plus size={18} />
                        Add First Affiliate
                    </button>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Affiliate</th>
                                <th>Type</th>
                                <th>Frequency</th>
                                <th>Priority</th>
                                <th>Notes</th>
                                <th style={{ width: "60px" }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {configs
                                .sort((a, b) => b.priority - a.priority)
                                .map((config) => {
                                    const typeColor = getTypeColor(config.affiliate.type);
                                    return (
                                        <tr key={config.id}>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <Building2 size={16} style={{ color: "#22d3ee" }} />
                                                    <span style={{ fontWeight: 500 }}>{config.affiliate.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span
                                                    style={{
                                                        padding: "0.25rem 0.5rem",
                                                        borderRadius: "4px",
                                                        fontSize: "0.75rem",
                                                        fontWeight: 500,
                                                        background: typeColor.bg,
                                                        color: typeColor.text,
                                                    }}
                                                >
                                                    {config.affiliate.type.replace("_", " ")}
                                                </span>
                                            </td>
                                            <td>{getFrequencyLabel(config.auditFrequency)}</td>
                                            <td>
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "0.25rem",
                                                    }}
                                                >
                                                    <ArrowUpDown size={12} style={{ opacity: 0.5 }} />
                                                    {config.priority}
                                                </span>
                                            </td>
                                            <td style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                                {config.notes || "—"}
                                            </td>
                                            <td>
                                                <div className="dropdown-container">
                                                    <button
                                                        className="btn btn-icon btn-ghost"
                                                        onClick={() =>
                                                            setActiveDropdown(
                                                                activeDropdown === config.id ? null : config.id
                                                            )
                                                        }
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {activeDropdown === config.id && (
                                                        <div className="dropdown-menu">
                                                            <button
                                                                onClick={() => openEditModal(config)}
                                                                className="dropdown-item"
                                                            >
                                                                <Edit2 size={14} />
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => openDeleteConfirm(config)}
                                                                className="dropdown-item dropdown-item-danger"
                                                            >
                                                                <Trash2 size={14} />
                                                                Remove
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
                title={editingConfig ? "Edit Audit Configuration" : "Add Affiliate to Audit List"}
            >
                <form onSubmit={handleSubmit}>
                    {!editingConfig && (
                        <div className="form-group">
                            <label className="form-label">Select Affiliate</label>
                            <select
                                value={selectedAffiliateId}
                                onChange={(e) => setSelectedAffiliateId(e.target.value)}
                                className="form-select"
                                required
                            >
                                <option value="">Choose an affiliate...</option>
                                {availableAffiliates.map((affiliate) => (
                                    <option key={affiliate.id} value={affiliate.id}>
                                        {affiliate.name} ({affiliate.type.replace("_", " ")})
                                    </option>
                                ))}
                            </select>
                            {availableAffiliates.length === 0 && (
                                <p className="form-hint" style={{ color: "var(--warning)" }}>
                                    All affiliates are already in the audit list.
                                </p>
                            )}
                        </div>
                    )}

                    {editingConfig && (
                        <div className="form-group">
                            <label className="form-label">Affiliate</label>
                            <div
                                style={{
                                    padding: "0.75rem",
                                    background: "rgba(6, 182, 212, 0.1)",
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                <Building2 size={18} style={{ color: "#22d3ee" }} />
                                <span style={{ fontWeight: 500 }}>{editingConfig.affiliate.name}</span>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Audit Frequency</label>
                        <select
                            value={auditFrequency}
                            onChange={(e) => setAuditFrequency(e.target.value)}
                            className="form-select"
                        >
                            {FREQUENCY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label} - {opt.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Priority (higher = shown first)</label>
                        <input
                            type="number"
                            value={priority}
                            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                            className="form-input"
                            min={0}
                            max={100}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notes (optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="form-textarea"
                            placeholder="Any special instructions for auditing this affiliate..."
                            rows={3}
                        />
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            onClick={() => {
                                setShowModal(false);
                                resetForm();
                            }}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting || (!editingConfig && !selectedAffiliateId)}
                        >
                            {isSubmitting ? "Saving..." : editingConfig ? "Update" : "Add to Audit List"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false);
                    setSelectedConfig(null);
                }}
                title="Remove from Audit List"
            >
                <div style={{ marginBottom: "1.5rem" }}>
                    <p>
                        Are you sure you want to remove{" "}
                        <strong>{selectedConfig?.affiliate.name}</strong> from the audit list?
                    </p>
                    <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                        Dispatchers will no longer see this affiliate in their shift report audit section.
                    </p>
                </div>
                <div className="modal-footer">
                    <button
                        onClick={() => {
                            setShowDeleteConfirm(false);
                            setSelectedConfig(null);
                        }}
                        className="btn btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        className="btn btn-danger"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Removing..." : "Remove"}
                    </button>
                </div>
            </Modal>

            <style jsx>{`
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 1rem;
                }
                .stat-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                }
                .stat-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                }
                .stat-content {
                    display: flex;
                    flex-direction: column;
                }
                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    text-align: center;
                }
                .empty-state h3 {
                    margin: 0;
                    color: var(--text-primary);
                }
                .empty-state p {
                    margin: 0.5rem 0 0;
                    color: var(--text-secondary);
                }
                .dropdown-container {
                    position: relative;
                }
                .dropdown-menu {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    padding: 0.25rem;
                    min-width: 120px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    z-index: 10;
                }
                .dropdown-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    background: none;
                    border: none;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background 0.15s;
                }
                .dropdown-item:hover {
                    background: var(--bg-hover);
                }
                .dropdown-item-danger {
                    color: var(--error);
                }
                .dropdown-item-danger:hover {
                    background: rgba(239, 68, 68, 0.1);
                }
            `}</style>
        </div>
    );
}
