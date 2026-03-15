"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import styles from "./SwapActions.module.css";

interface SwapActionsProps {
  requestId: string;
  /** Action type determines which buttons to show */
  type: "respond" | "admin" | "cancel";
  loading?: boolean;
  onAccept?: (notes?: string) => void;
  onReject?: (notes?: string) => void;
  onCancel?: () => void;
  /** Labels for custom button text */
  acceptLabel?: string;
  rejectLabel?: string;
}

export default function SwapActions({
  requestId,
  type,
  loading = false,
  onAccept,
  onReject,
  onCancel,
  acceptLabel,
  rejectLabel,
}: SwapActionsProps) {
  const [notes, setNotes] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const notesLabel = type === "admin" ? "Admin Notes (optional)" : "Your Response (optional)";
  const notesPlaceholder = type === "admin" ? "Add notes..." : "Add a message...";

  if (type === "cancel") {
    if (showCancelConfirm) {
      return (
        <div className={styles.confirmGroup}>
          <button
            onClick={() => {
              onCancel?.();
              setShowCancelConfirm(false);
            }}
            disabled={loading}
            className={styles.confirmBtn}
          >
            {loading ? "..." : "Confirm"}
          </button>
          <button
            onClick={() => setShowCancelConfirm(false)}
            className={styles.cancelBtn}
          >
            No
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => setShowCancelConfirm(true)}
        disabled={loading}
        className={styles.cancelRequestBtn}
      >
        <Trash2 size={14} />
        Cancel
      </button>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.notesField}>
        <label className={styles.label}>{notesLabel}</label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={notesPlaceholder}
          rows={2}
        />
      </div>
      <div className={styles.buttons}>
        <button
          onClick={() => onAccept?.(notes || undefined)}
          disabled={loading}
          className={styles.acceptBtn}
        >
          <CheckCircle size={16} />
          {acceptLabel || (type === "admin" ? "Approve Swap" : "Accept Swap")}
        </button>
        <button
          onClick={() => onReject?.(notes || undefined)}
          disabled={loading}
          className={styles.rejectBtn}
        >
          <XCircle size={16} />
          {rejectLabel || (type === "admin" ? "Reject" : "Decline")}
        </button>
      </div>
    </div>
  );
}
