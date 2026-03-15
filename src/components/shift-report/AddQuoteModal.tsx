"use client";

import { useState } from "react";
import { X } from "lucide-react";
import styles from "./AddQuoteModal.module.css";

export interface QuoteFormData {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceType: string;
  estimatedAmount?: number;
  notes?: string;
}

interface AddQuoteModalProps {
  onClose: () => void;
  onSubmit: (data: QuoteFormData) => Promise<void>;
}

const SERVICE_TYPES = [
  "Airport Transfer",
  "Hourly Service",
  "Point to Point",
  "City Tour",
  "Event Transportation",
  "Corporate",
  "Other",
];

export default function AddQuoteModal({ onClose, onSubmit }: AddQuoteModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    serviceType: "",
    estimatedAmount: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName || !form.serviceType) return;

    setLoading(true);
    try {
      await onSubmit({
        clientName: form.clientName,
        clientEmail: form.clientEmail || undefined,
        clientPhone: form.clientPhone || undefined,
        serviceType: form.serviceType,
        estimatedAmount: form.estimatedAmount
          ? parseFloat(form.estimatedAmount)
          : undefined,
        notes: form.notes || undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Add New Quote</h3>
          <button onClick={onClose} className={styles.closeBtn} type="button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label>Client Name *</label>
            <input
              type="text"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              placeholder="John Doe"
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Email</label>
              <input
                type="email"
                value={form.clientEmail}
                onChange={(e) =>
                  setForm({ ...form, clientEmail: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Phone</label>
              <input
                type="tel"
                value={form.clientPhone}
                onChange={(e) =>
                  setForm({ ...form, clientPhone: e.target.value })
                }
                placeholder="+1 234 567 8900"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Service Type *</label>
              <select
                value={form.serviceType}
                onChange={(e) =>
                  setForm({ ...form, serviceType: e.target.value })
                }
                required
              >
                <option value="">Select service...</option>
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Estimated Amount</label>
              <input
                type="number"
                value={form.estimatedAmount}
                onChange={(e) =>
                  setForm({ ...form, estimatedAmount: e.target.value })
                }
                placeholder="$0.00"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional details about the quote..."
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Quote"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
