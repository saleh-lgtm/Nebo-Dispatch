"use client";

import { useState } from "react";
import { User, Car, Clock, AlertTriangle, X } from "lucide-react";
import type { Confirmation, ConfirmationStatus } from "./types";
import { STATUS_OPTIONS } from "./types";
import { formatConfirmationTime } from "./utils";
import styles from "./ConfirmationModal.module.css";

interface Props {
  confirmation: Confirmation;
  onComplete: (status: ConfirmationStatus, notes?: string) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export default function ConfirmationModal({
  confirmation,
  onComplete,
  onClose,
  loading = false,
  error,
  onClearError,
}: Props) {
  const [notes, setNotes] = useState("");

  const handleComplete = async (status: ConfirmationStatus) => {
    await onComplete(status, notes || undefined);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Complete Confirmation</h3>
          <span className={styles.tripBadge}>#{confirmation.tripNumber}</span>
        </div>

        <div className={styles.body}>
          {error && (
            <div className={styles.error}>
              <AlertTriangle size={14} />
              <span>{error}</span>
              {onClearError && (
                <button onClick={onClearError} className={styles.errorClose}>
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          <div className={styles.info}>
            <div className={styles.infoRow}>
              <User size={14} />
              <span>{confirmation.passengerName}</span>
            </div>
            <div className={styles.infoRow}>
              <Car size={14} />
              <span>{confirmation.driverName}</span>
            </div>
            <div className={styles.infoRow}>
              <Clock size={14} />
              <span>Pickup: {formatConfirmationTime(confirmation.pickupAt)}</span>
            </div>
          </div>

          <div className={styles.statusSection}>
            <label>Call Outcome:</label>
            <div className={styles.optionsGrid}>
              {STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    className={`${styles.statusBtn} ${styles[option.className]}`}
                    onClick={() => handleComplete(option.value)}
                    disabled={loading}
                  >
                    <Icon size={18} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.notesField}>
            <label>Notes (optional):</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the call..."
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
