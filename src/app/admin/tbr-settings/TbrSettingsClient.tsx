"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    Trash2,
    Edit2,
    Car,
    Check,
    X,
    Database,
    ToggleLeft,
    ToggleRight,
    MoreVertical,
} from "lucide-react";
import {
    upsertVehicleMapping,
    deleteVehicleMapping,
    toggleVehicleMapping,
    seedDefaultMappings,
} from "@/lib/vehicleMappingActions";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

interface VehicleMapping {
    id: string;
    tbrVehicleType: string;
    laVehicleType: string;
    laVehicleId: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface Props {
    initialMappings: VehicleMapping[];
}

export default function TbrSettingsClient({ initialMappings }: Props) {
    const router = useRouter();
    const { addToast } = useToast();
    const [mappings, setMappings] = useState<VehicleMapping[]>(initialMappings);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingMapping, setEditingMapping] = useState<VehicleMapping | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedMapping, setSelectedMapping] = useState<VehicleMapping | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Form state
    const [tbrVehicleType, setTbrVehicleType] = useState("");
    const [laVehicleType, setLaVehicleType] = useState("");
    const [laVehicleId, setLaVehicleId] = useState("");
    const [notes, setNotes] = useState("");

    // Loading state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // Stats
    const totalMappings = mappings.length;
    const activeMappings = mappings.filter((m) => m.isActive).length;
    const inactiveMappings = mappings.filter((m) => !m.isActive).length;

    const resetForm = () => {
        setTbrVehicleType("");
        setLaVehicleType("");
        setLaVehicleId("");
        setNotes("");
        setEditingMapping(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (mapping: VehicleMapping) => {
        setTbrVehicleType(mapping.tbrVehicleType);
        setLaVehicleType(mapping.laVehicleType);
        setLaVehicleId(mapping.laVehicleId || "");
        setNotes(mapping.notes || "");
        setEditingMapping(mapping);
        setActiveDropdown(null);
        setShowModal(true);
    };

    const openDeleteConfirm = (mapping: VehicleMapping) => {
        setSelectedMapping(mapping);
        setActiveDropdown(null);
        setShowDeleteConfirm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tbrVehicleType.trim() || !laVehicleType.trim()) return;

        setIsSubmitting(true);
        try {
            const result = await upsertVehicleMapping({
                id: editingMapping?.id,
                tbrVehicleType: tbrVehicleType.trim(),
                laVehicleType: laVehicleType.trim(),
                laVehicleId: laVehicleId.trim() || undefined,
                notes: notes.trim() || undefined,
            });

            if (!result.success) {
                throw new Error(result.error || "Failed to save mapping");
            }

            addToast(
                editingMapping ? "Mapping updated successfully" : "Mapping created successfully",
                "success"
            );
            setShowModal(false);
            resetForm();
            router.refresh();
        } catch (err) {
            addToast(
                err instanceof Error ? err.message : "Failed to save mapping",
                "error"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedMapping) return;

        setIsSubmitting(true);
        try {
            const result = await deleteVehicleMapping(selectedMapping.id);
            if (!result.success) {
                throw new Error(result.error || "Failed to delete mapping");
            }
            setMappings(mappings.filter((m) => m.id !== selectedMapping.id));
            addToast("Mapping deleted", "success");
            setShowDeleteConfirm(false);
            setSelectedMapping(null);
        } catch (err) {
            addToast(
                err instanceof Error ? err.message : "Failed to delete mapping",
                "error"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggle = async (mapping: VehicleMapping) => {
        setTogglingId(mapping.id);
        try {
            const result = await toggleVehicleMapping(mapping.id, !mapping.isActive);
            if (!result.success) {
                throw new Error(result.error || "Failed to toggle mapping");
            }
            setMappings(
                mappings.map((m) =>
                    m.id === mapping.id ? { ...m, isActive: !m.isActive } : m
                )
            );
            addToast(
                `Mapping ${mapping.isActive ? "deactivated" : "activated"}`,
                "success"
            );
        } catch (err) {
            addToast(
                err instanceof Error ? err.message : "Failed to toggle mapping",
                "error"
            );
        } finally {
            setTogglingId(null);
        }
    };

    const handleSeedDefaults = async () => {
        setIsSeeding(true);
        try {
            const result = await seedDefaultMappings();
            if (!result.success || !result.data) {
                throw new Error(result.error || "Failed to seed defaults");
            }
            addToast(
                `Created ${result.data.created} mappings, ${result.data.skipped} already existed`,
                "success"
            );
            router.refresh();
        } catch (err) {
            addToast(
                err instanceof Error ? err.message : "Failed to seed defaults",
                "error"
            );
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>
                        TBR Vehicle Mappings
                    </h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Map TBR vehicle types to LimoAnywhere vehicle types for automatic trip translation
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleSeedDefaults}
                        disabled={isSeeding}
                        className="btn btn-secondary"
                    >
                        <Database size={18} />
                        <span>{isSeeding ? "Seeding..." : "Seed Defaults"}</span>
                    </button>
                    <button onClick={openCreateModal} className="btn btn-primary">
                        <Plus size={18} />
                        <span>Add Mapping</span>
                    </button>
                </div>
            </header>

            {/* Stats */}
            <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
            >
                <div className="glass-card" style={{ padding: "1rem" }}>
                    <div className="flex items-center gap-3">
                        <div
                            style={{
                                padding: "0.5rem",
                                background: "var(--primary-soft)",
                                borderRadius: "0.5rem",
                            }}
                        >
                            <Car size={20} className="text-accent" />
                        </div>
                        <div>
                            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalMappings}</p>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                Total Mappings
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: "1rem" }}>
                    <div className="flex items-center gap-3">
                        <div
                            style={{
                                padding: "0.5rem",
                                background: "var(--success-bg)",
                                borderRadius: "0.5rem",
                            }}
                        >
                            <Check size={20} style={{ color: "var(--success)" }} />
                        </div>
                        <div>
                            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{activeMappings}</p>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                Active
                            </p>
                        </div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: "1rem" }}>
                    <div className="flex items-center gap-3">
                        <div
                            style={{
                                padding: "0.5rem",
                                background: "var(--danger-bg)",
                                borderRadius: "0.5rem",
                            }}
                        >
                            <X size={20} style={{ color: "var(--danger)" }} />
                        </div>
                        <div>
                            <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>{inactiveMappings}</p>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                Inactive
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card" style={{ overflow: "hidden" }}>
                {mappings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem" }}>
                        <Car
                            size={48}
                            style={{ color: "var(--text-secondary)", margin: "0 auto 1rem" }}
                        />
                        <p style={{ color: "var(--text-secondary)" }}>
                            No vehicle mappings configured yet.
                        </p>
                        <p
                            style={{
                                color: "var(--text-secondary)",
                                fontSize: "0.875rem",
                                marginBottom: "1rem",
                            }}
                        >
                            Click &quot;Seed Defaults&quot; to add standard vehicle mappings.
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    <th
                                        style={{
                                            padding: "1rem",
                                            textAlign: "left",
                                            fontWeight: 500,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        TBR Vehicle Type
                                    </th>
                                    <th
                                        style={{
                                            padding: "1rem",
                                            textAlign: "left",
                                            fontWeight: 500,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        LA Vehicle Type
                                    </th>
                                    <th
                                        style={{
                                            padding: "1rem",
                                            textAlign: "left",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Notes
                                    </th>
                                    <th
                                        style={{
                                            padding: "1rem",
                                            textAlign: "center",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Status
                                    </th>
                                    <th
                                        style={{
                                            padding: "1rem",
                                            textAlign: "right",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {mappings.map((mapping) => (
                                    <tr
                                        key={mapping.id}
                                        style={{
                                            borderBottom: "1px solid var(--border)",
                                            opacity: mapping.isActive ? 1 : 0.6,
                                        }}
                                    >
                                        <td style={{ padding: "1rem" }}>
                                            <span style={{ fontWeight: 500 }}>
                                                {mapping.tbrVehicleType}
                                            </span>
                                        </td>
                                        <td style={{ padding: "1rem" }}>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: "var(--primary-soft)",
                                                    color: "var(--primary)",
                                                }}
                                            >
                                                {mapping.laVehicleType}
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                padding: "1rem",
                                                color: "var(--text-secondary)",
                                                fontSize: "0.875rem",
                                                maxWidth: "200px",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {mapping.notes || "-"}
                                        </td>
                                        <td style={{ padding: "1rem", textAlign: "center" }}>
                                            <button
                                                onClick={() => handleToggle(mapping)}
                                                disabled={togglingId === mapping.id}
                                                className="btn btn-ghost btn-sm"
                                                title={mapping.isActive ? "Deactivate" : "Activate"}
                                                style={{ padding: "0.25rem" }}
                                            >
                                                {mapping.isActive ? (
                                                    <ToggleRight
                                                        size={24}
                                                        style={{ color: "var(--success)" }}
                                                    />
                                                ) : (
                                                    <ToggleLeft
                                                        size={24}
                                                        style={{ color: "var(--text-secondary)" }}
                                                    />
                                                )}
                                            </button>
                                        </td>
                                        <td
                                            style={{
                                                padding: "1rem",
                                                textAlign: "right",
                                                position: "relative",
                                            }}
                                        >
                                            <div style={{ position: "relative", display: "inline-block" }}>
                                                <button
                                                    onClick={() =>
                                                        setActiveDropdown(
                                                            activeDropdown === mapping.id ? null : mapping.id
                                                        )
                                                    }
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ padding: "0.5rem" }}
                                                >
                                                    <MoreVertical size={18} />
                                                </button>
                                                {activeDropdown === mapping.id && (
                                                    <div
                                                        style={{
                                                            position: "absolute",
                                                            right: 0,
                                                            top: "100%",
                                                            background: "var(--bg-secondary)",
                                                            border: "1px solid var(--border)",
                                                            borderRadius: "0.5rem",
                                                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                                            minWidth: "120px",
                                                            zIndex: 10,
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() => openEditModal(mapping)}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "0.5rem",
                                                                width: "100%",
                                                                padding: "0.75rem 1rem",
                                                                border: "none",
                                                                background: "transparent",
                                                                cursor: "pointer",
                                                                fontSize: "0.875rem",
                                                                color: "var(--text-primary)",
                                                            }}
                                                        >
                                                            <Edit2 size={14} />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => openDeleteConfirm(mapping)}
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: "0.5rem",
                                                                width: "100%",
                                                                padding: "0.75rem 1rem",
                                                                border: "none",
                                                                background: "transparent",
                                                                cursor: "pointer",
                                                                fontSize: "0.875rem",
                                                                color: "var(--danger)",
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
                title={editingMapping ? "Edit Mapping" : "Add Mapping"}
                size="md"
            >
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--text-secondary)",
                                textTransform: "uppercase",
                                fontWeight: 600,
                            }}
                        >
                            TBR Vehicle Type *
                        </label>
                        <input
                            type="text"
                            className="input"
                            value={tbrVehicleType}
                            onChange={(e) => setTbrVehicleType(e.target.value)}
                            placeholder="e.g., Executive Sedan"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--text-secondary)",
                                textTransform: "uppercase",
                                fontWeight: 600,
                            }}
                        >
                            LimoAnywhere Vehicle Type *
                        </label>
                        <input
                            type="text"
                            className="input"
                            value={laVehicleType}
                            onChange={(e) => setLaVehicleType(e.target.value)}
                            placeholder="e.g., Sedan"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--text-secondary)",
                                textTransform: "uppercase",
                                fontWeight: 600,
                            }}
                        >
                            LA Vehicle ID (optional)
                        </label>
                        <input
                            type="text"
                            className="input"
                            value={laVehicleId}
                            onChange={(e) => setLaVehicleId(e.target.value)}
                            placeholder="Internal LA vehicle ID"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label
                            style={{
                                fontSize: "0.75rem",
                                color: "var(--text-secondary)",
                                textTransform: "uppercase",
                                fontWeight: 600,
                            }}
                        >
                            Notes
                        </label>
                        <textarea
                            className="input"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes about this mapping..."
                            style={{ minHeight: "80px", resize: "vertical" }}
                        />
                    </div>

                    <div className="flex justify-end gap-3" style={{ marginTop: "1rem" }}>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="btn btn-ghost"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting || !tbrVehicleType.trim() || !laVehicleType.trim()}
                        >
                            {isSubmitting
                                ? "Saving..."
                                : editingMapping
                                ? "Update Mapping"
                                : "Add Mapping"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false);
                    setSelectedMapping(null);
                }}
                title="Delete Mapping"
                size="sm"
            >
                <div className="flex flex-col gap-4">
                    <p style={{ color: "var(--text-secondary)" }}>
                        Are you sure you want to delete the mapping for{" "}
                        <strong style={{ color: "var(--text-primary)" }}>
                            {selectedMapping?.tbrVehicleType}
                        </strong>
                        ?
                    </p>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                        This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="btn btn-ghost"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="btn"
                            style={{ background: "var(--danger)", color: "white" }}
                        >
                            {isSubmitting ? "Deleting..." : "Delete"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Click outside handler for dropdown */}
            {activeDropdown && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 5,
                    }}
                    onClick={() => setActiveDropdown(null)}
                />
            )}
        </div>
    );
}
