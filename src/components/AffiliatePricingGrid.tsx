"use client";

import { useState } from "react";
import { DollarSign, Plus, Trash2, Save, X, FileText, Copy } from "lucide-react";
import {
    upsertAffiliatePricing,
    deleteAffiliatePricing,
    SERVICE_TYPES,
} from "@/lib/affiliatePricingActions";
import { useRouter } from "next/navigation";

interface PricingEntry {
    id: string;
    serviceType: string;
    flatRate: number;
    notes: string | null;
}

interface Props {
    affiliateId: string;
    affiliateName: string;
    pricing: PricingEntry[];
    isAdmin: boolean;
    onClose?: () => void;
}

export default function AffiliatePricingGrid({
    affiliateId,
    affiliateName,
    pricing: initialPricing,
    isAdmin,
    onClose,
}: Props) {
    const router = useRouter();
    const [pricing, setPricing] = useState(initialPricing);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [newEntry, setNewEntry] = useState<{
        serviceType: string;
        flatRate: string;
        notes: string;
    } | null>(null);
    const [editValues, setEditValues] = useState<{
        flatRate: string;
        notes: string;
    }>({ flatRate: "", notes: "" });
    const [loading, setLoading] = useState(false);

    const usedServiceTypes = pricing.map((p) => p.serviceType);
    const availableServiceTypes = SERVICE_TYPES.filter(
        (st) => !usedServiceTypes.includes(st)
    );

    const handleStartEdit = (entry: PricingEntry) => {
        setEditingRow(entry.id);
        setEditValues({
            flatRate: entry.flatRate.toString(),
            notes: entry.notes || "",
        });
    };

    const handleSaveEdit = async (entry: PricingEntry) => {
        if (!editValues.flatRate) return;

        setLoading(true);
        try {
            await upsertAffiliatePricing({
                affiliateId,
                serviceType: entry.serviceType,
                flatRate: parseFloat(editValues.flatRate),
                notes: editValues.notes || undefined,
            });

            setPricing(
                pricing.map((p) =>
                    p.id === entry.id
                        ? {
                              ...p,
                              flatRate: parseFloat(editValues.flatRate),
                              notes: editValues.notes || null,
                          }
                        : p
                )
            );
            setEditingRow(null);
            router.refresh();
        } catch (error) {
            console.error("Failed to update pricing:", error);
            alert("Failed to update pricing");
        } finally {
            setLoading(false);
        }
    };

    const handleAddNew = async () => {
        if (!newEntry || !newEntry.serviceType || !newEntry.flatRate) return;

        setLoading(true);
        try {
            const result = await upsertAffiliatePricing({
                affiliateId,
                serviceType: newEntry.serviceType,
                flatRate: parseFloat(newEntry.flatRate),
                notes: newEntry.notes || undefined,
            });

            setPricing([
                ...pricing,
                {
                    id: result.id,
                    serviceType: newEntry.serviceType,
                    flatRate: parseFloat(newEntry.flatRate),
                    notes: newEntry.notes || null,
                },
            ]);
            setNewEntry(null);
            router.refresh();
        } catch (error) {
            console.error("Failed to add pricing:", error);
            alert("Failed to add pricing");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (pricingId: string) => {
        if (!confirm("Are you sure you want to delete this pricing entry?")) return;

        setLoading(true);
        try {
            await deleteAffiliatePricing(pricingId);
            setPricing(pricing.filter((p) => p.id !== pricingId));
            router.refresh();
        } catch (error) {
            console.error("Failed to delete pricing:", error);
            alert("Failed to delete pricing");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pricing-grid">
            <div className="pricing-header">
                <div className="pricing-title">
                    <DollarSign size={20} />
                    <span>Pricing Grid</span>
                </div>
                <span className="pricing-subtitle">{affiliateName}</span>
                {onClose && (
                    <button onClick={onClose} className="close-btn">
                        <X size={18} />
                    </button>
                )}
            </div>

            <div className="pricing-table-container">
                <table className="pricing-table">
                    <thead>
                        <tr>
                            <th>Service Type</th>
                            <th>Flat Rate</th>
                            <th>Notes</th>
                            {isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {pricing.length === 0 && !newEntry && (
                            <tr>
                                <td colSpan={isAdmin ? 4 : 3} className="empty-cell">
                                    No pricing configured yet
                                </td>
                            </tr>
                        )}

                        {pricing.map((entry) => (
                            <tr key={entry.id}>
                                <td className="service-cell">{entry.serviceType}</td>
                                <td className="rate-cell">
                                    {editingRow === entry.id ? (
                                        <input
                                            type="number"
                                            value={editValues.flatRate}
                                            onChange={(e) =>
                                                setEditValues({ ...editValues, flatRate: e.target.value })
                                            }
                                            className="edit-input"
                                            placeholder="0.00"
                                            step="0.01"
                                        />
                                    ) : (
                                        <span className="rate-value">
                                            ${entry.flatRate.toFixed(2)}
                                        </span>
                                    )}
                                </td>
                                <td className="notes-cell">
                                    {editingRow === entry.id ? (
                                        <input
                                            type="text"
                                            value={editValues.notes}
                                            onChange={(e) =>
                                                setEditValues({ ...editValues, notes: e.target.value })
                                            }
                                            className="edit-input"
                                            placeholder="Optional notes..."
                                        />
                                    ) : (
                                        <span className="notes-value">{entry.notes || "-"}</span>
                                    )}
                                </td>
                                {isAdmin && (
                                    <td className="actions-cell">
                                        {editingRow === entry.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleSaveEdit(entry)}
                                                    className="action-btn save"
                                                    disabled={loading}
                                                >
                                                    <Save size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setEditingRow(null)}
                                                    className="action-btn cancel"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleStartEdit(entry)}
                                                    className="action-btn edit"
                                                >
                                                    <FileText size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="action-btn delete"
                                                    disabled={loading}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}

                        {newEntry && (
                            <tr className="new-entry-row">
                                <td>
                                    <select
                                        value={newEntry.serviceType}
                                        onChange={(e) =>
                                            setNewEntry({ ...newEntry, serviceType: e.target.value })
                                        }
                                        className="edit-input"
                                    >
                                        <option value="">Select service...</option>
                                        {availableServiceTypes.map((st) => (
                                            <option key={st} value={st}>
                                                {st}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        value={newEntry.flatRate}
                                        onChange={(e) =>
                                            setNewEntry({ ...newEntry, flatRate: e.target.value })
                                        }
                                        className="edit-input"
                                        placeholder="0.00"
                                        step="0.01"
                                    />
                                </td>
                                <td>
                                    <input
                                        type="text"
                                        value={newEntry.notes}
                                        onChange={(e) =>
                                            setNewEntry({ ...newEntry, notes: e.target.value })
                                        }
                                        className="edit-input"
                                        placeholder="Optional notes..."
                                    />
                                </td>
                                <td className="actions-cell">
                                    <button
                                        onClick={handleAddNew}
                                        className="action-btn save"
                                        disabled={loading || !newEntry.serviceType || !newEntry.flatRate}
                                    >
                                        <Save size={14} />
                                    </button>
                                    <button
                                        onClick={() => setNewEntry(null)}
                                        className="action-btn cancel"
                                    >
                                        <X size={14} />
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAdmin && !newEntry && availableServiceTypes.length > 0 && (
                <button
                    onClick={() =>
                        setNewEntry({ serviceType: "", flatRate: "", notes: "" })
                    }
                    className="add-btn"
                >
                    <Plus size={16} />
                    Add Service Rate
                </button>
            )}

            <style jsx>{`
                .pricing-grid {
                    background: linear-gradient(
                        135deg,
                        rgba(30, 30, 50, 0.9) 0%,
                        rgba(25, 25, 45, 0.95) 100%
                    );
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    padding: 1.25rem;
                }

                .pricing-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }

                .pricing-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #4ade80;
                }

                .pricing-subtitle {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    flex: 1;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.25rem;
                    transition: color 0.2s;
                }

                .close-btn:hover {
                    color: var(--text-primary);
                }

                .pricing-table-container {
                    overflow-x: auto;
                }

                .pricing-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .pricing-table th {
                    text-align: left;
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    padding: 0.75rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }

                .pricing-table td {
                    padding: 0.75rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                }

                .pricing-table tr:last-child td {
                    border-bottom: none;
                }

                .service-cell {
                    font-weight: 500;
                    color: var(--text-primary);
                    font-size: 0.875rem;
                }

                .rate-cell {
                    width: 120px;
                }

                .rate-value {
                    font-weight: 600;
                    color: #4ade80;
                    font-size: 0.9rem;
                }

                .notes-cell {
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    max-width: 200px;
                }

                .notes-value {
                    display: block;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .empty-cell {
                    text-align: center;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    padding: 2rem !important;
                }

                .actions-cell {
                    width: 80px;
                    display: flex;
                    gap: 0.25rem;
                }

                .action-btn {
                    padding: 0.375rem;
                    border-radius: 6px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn.edit {
                    background: rgba(59, 130, 246, 0.15);
                    color: #60a5fa;
                }

                .action-btn.edit:hover {
                    background: rgba(59, 130, 246, 0.25);
                }

                .action-btn.delete {
                    background: rgba(239, 68, 68, 0.15);
                    color: #f87171;
                }

                .action-btn.delete:hover {
                    background: rgba(239, 68, 68, 0.25);
                }

                .action-btn.save {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                }

                .action-btn.save:hover {
                    background: rgba(34, 197, 94, 0.25);
                }

                .action-btn.cancel {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-secondary);
                }

                .action-btn.cancel:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .edit-input {
                    width: 100%;
                    padding: 0.5rem;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    color: var(--text-primary);
                    font-size: 0.8rem;
                }

                .edit-input:focus {
                    outline: none;
                    border-color: var(--accent);
                }

                .new-entry-row {
                    background: rgba(34, 197, 94, 0.05);
                }

                .add-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    margin-top: 1rem;
                    padding: 0.625rem 1rem;
                    background: rgba(34, 197, 94, 0.15);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    border-radius: 8px;
                    color: #4ade80;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .add-btn:hover {
                    background: rgba(34, 197, 94, 0.25);
                }
            `}</style>
        </div>
    );
}
