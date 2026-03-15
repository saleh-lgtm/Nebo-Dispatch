"use client";

import { useState } from "react";
import { DollarSign, Plus, Trash2, Save, X, FileText } from "lucide-react";
import {
  upsertAffiliatePricing,
  deleteAffiliatePricing,
} from "@/lib/affiliatePricingActions";
import { SERVICE_TYPES } from "@/lib/affiliatePricingTypes";
import { useRouter } from "next/navigation";
import { useToastContext } from "../ui/ToastProvider";
import type { PricingEntry, AffiliatePricingGridProps } from "./types";
import styles from "./AffiliatePricingGrid.module.css";

export default function AffiliatePricingGrid({
  affiliateId,
  affiliateName,
  pricing: initialPricing,
  isAdmin,
  onClose,
}: AffiliatePricingGridProps) {
  const router = useRouter();
  const { addToast } = useToastContext();
  const [pricing, setPricing] = useState<PricingEntry[]>(initialPricing);
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
      addToast("Pricing updated", "success");
      router.refresh();
    } catch (error) {
      console.error("Failed to update pricing:", error);
      addToast("Failed to update pricing", "error");
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
      addToast("Pricing added", "success");
      router.refresh();
    } catch (error) {
      console.error("Failed to add pricing:", error);
      addToast("Failed to add pricing", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (pricingId: string) => {
    setPendingDeleteId(null);
    setLoading(true);
    try {
      await deleteAffiliatePricing(pricingId);
      setPricing(pricing.filter((p) => p.id !== pricingId));
      addToast("Pricing deleted", "success");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete pricing:", error);
      addToast("Failed to delete pricing", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.grid}>
      <div className={styles.header}>
        <div className={styles.title}>
          <DollarSign size={20} />
          <span>Pricing Grid</span>
        </div>
        <span className={styles.subtitle}>{affiliateName}</span>
        {onClose && (
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
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
                <td colSpan={isAdmin ? 4 : 3} className={styles.emptyCell}>
                  No pricing configured yet
                </td>
              </tr>
            )}

            {pricing.map((entry) => (
              <tr key={entry.id}>
                <td className={styles.serviceCell}>{entry.serviceType}</td>
                <td className={styles.rateCell}>
                  {editingRow === entry.id ? (
                    <input
                      type="number"
                      value={editValues.flatRate}
                      onChange={(e) =>
                        setEditValues({ ...editValues, flatRate: e.target.value })
                      }
                      className={styles.editInput}
                      placeholder="0.00"
                      step="0.01"
                    />
                  ) : (
                    <span className={styles.rateValue}>
                      ${entry.flatRate.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className={styles.notesCell}>
                  {editingRow === entry.id ? (
                    <input
                      type="text"
                      value={editValues.notes}
                      onChange={(e) =>
                        setEditValues({ ...editValues, notes: e.target.value })
                      }
                      className={styles.editInput}
                      placeholder="Optional notes..."
                    />
                  ) : (
                    <span className={styles.notesValue}>
                      {entry.notes || "-"}
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className={styles.actionsCell}>
                    {editingRow === entry.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(entry)}
                          className={`${styles.actionBtn} ${styles.saveBtn}`}
                          disabled={loading}
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => setEditingRow(null)}
                          className={`${styles.actionBtn} ${styles.cancelBtn}`}
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(entry)}
                          className={`${styles.actionBtn} ${styles.editBtn}`}
                        >
                          <FileText size={14} />
                        </button>
                        {pendingDeleteId === entry.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className={`${styles.actionBtn} ${styles.confirmDeleteBtn}`}
                              disabled={loading}
                            >
                              {loading ? "..." : "Yes"}
                            </button>
                            <button
                              onClick={() => setPendingDeleteId(null)}
                              className={`${styles.actionBtn} ${styles.cancelBtn}`}
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setPendingDeleteId(entry.id)}
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            disabled={loading}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {newEntry && (
              <tr className={styles.newEntryRow}>
                <td>
                  <select
                    value={newEntry.serviceType}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, serviceType: e.target.value })
                    }
                    className={styles.editInput}
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
                    className={styles.editInput}
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
                    className={styles.editInput}
                    placeholder="Optional notes..."
                  />
                </td>
                <td className={styles.actionsCell}>
                  <button
                    onClick={handleAddNew}
                    className={`${styles.actionBtn} ${styles.saveBtn}`}
                    disabled={loading || !newEntry.serviceType || !newEntry.flatRate}
                  >
                    <Save size={14} />
                  </button>
                  <button
                    onClick={() => setNewEntry(null)}
                    className={`${styles.actionBtn} ${styles.cancelBtn}`}
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
          className={styles.addBtn}
        >
          <Plus size={16} />
          Add Service Rate
        </button>
      )}
    </div>
  );
}
