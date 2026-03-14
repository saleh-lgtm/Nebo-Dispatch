"use client";

import { useState } from "react";
import { X, CheckCircle } from "lucide-react";
import styles from "../../Accounting.module.css";
import type { AccountingFlag } from "./types";

interface ResolveModalProps {
    flag: AccountingFlag;
    onClose: () => void;
    onResolve: (resolution: string, notes: string) => Promise<void>;
}

export default function ResolveModal({ flag, onClose, onResolve }: ResolveModalProps) {
    const [resolution, setResolution] = useState("");
    const [accountingNotes, setAccountingNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!resolution) return;
        setSubmitting(true);
        try {
            await onResolve(resolution, accountingNotes);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>Resolve Flag</h3>
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>
                <div className={styles.modalBody}>
                    <p className={styles.resolveInfo}>
                        Resolving flag for reservation <strong>#{flag.reservationId}</strong>
                    </p>

                    <div className={styles.formGroup}>
                        <label>Resolution *</label>
                        <select
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            required
                        >
                            <option value="">Select resolution...</option>
                            <option value="Approved - No Issues">Approved - No Issues</option>
                            <option value="Approved - Minor Adjustment">Approved - Minor Adjustment</option>
                            <option value="Rejected - Requires Correction">Rejected - Requires Correction</option>
                            <option value="Escalated to Management">Escalated to Management</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Accounting Notes</label>
                        <textarea
                            value={accountingNotes}
                            onChange={(e) => setAccountingNotes(e.target.value)}
                            placeholder="Add any notes about this resolution..."
                        />
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button onClick={onClose} className={`${styles.btn} ${styles.btnSecondary}`}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className={`${styles.btn} ${styles.btnSuccess}`}
                        disabled={!resolution || submitting}
                    >
                        <CheckCircle size={16} />
                        {submitting ? "Resolving..." : "Resolve Flag"}
                    </button>
                </div>
            </div>
        </div>
    );
}
