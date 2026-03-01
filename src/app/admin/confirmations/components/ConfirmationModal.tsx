"use client";

import { useState } from "react";
import {
    Clock,
    CheckCircle,
    XCircle,
    PhoneOff,
    RotateCcw,
    AlertTriangle,
    User,
    Car,
    X,
} from "lucide-react";
import { TripConfirmation, STATUS_CONFIG } from "../types";
import styles from "../Confirmations.module.css";

type ConfirmationStatus = "PENDING" | "CONFIRMED" | "NO_ANSWER" | "CANCELLED" | "RESCHEDULED";

interface Props {
    trip: TripConfirmation;
    onClose: () => void;
    onStatusChange: (tripId: string, status: ConfirmationStatus, notes?: string) => Promise<void>;
    isUpdating: boolean;
}

export default function ConfirmationModal({ trip, onClose, onStatusChange, isUpdating }: Props) {
    const [actionNotes, setActionNotes] = useState(trip.notes || "");
    const [error, setError] = useState<string | null>(null);

    const formatTime = (date: Date | string) => {
        return new Date(date).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: "America/Chicago",
        });
    };

    const handleStatusChange = async (newStatus: ConfirmationStatus) => {
        setError(null);
        try {
            await onStatusChange(trip.id, newStatus, actionNotes);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update confirmation";
            setError(message);
        }
    };

    const config = STATUS_CONFIG[trip.status] || STATUS_CONFIG.PENDING;
    const CurrentIcon = config.icon;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>Edit Confirmation</h3>
                    <span className={styles.tripBadge}>#{trip.tripNumber}</span>
                </div>
                <div className={styles.modalBody}>
                    {error && (
                        <div className={styles.errorBanner}>
                            <AlertTriangle size={14} />
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className={styles.errorClose}>
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    <div className={styles.modalInfo}>
                        <div className={styles.infoRow}>
                            <User size={14} />
                            <span>{trip.passengerName}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <Car size={14} />
                            <span>{trip.driverName}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <Clock size={14} />
                            <span>Pickup: {formatTime(trip.pickupAt)}</span>
                        </div>
                        <div className={`${styles.infoRow} ${styles.currentStatus}`}>
                            <CurrentIcon size={14} style={{ color: config.color }} />
                            <span>Current: <strong style={{ color: config.color }}>{config.label}</strong></span>
                        </div>
                    </div>
                    <div className={styles.statusOptions}>
                        <label>Change Status To:</label>
                        <div className={styles.optionsGrid}>
                            <button
                                className={`${styles.statusBtn} ${styles.statusPending} ${trip.status === "PENDING" ? styles.current : ""}`}
                                onClick={() => handleStatusChange("PENDING")}
                                disabled={isUpdating || trip.status === "PENDING"}
                            >
                                <Clock size={18} />
                                <span>Pending</span>
                            </button>
                            <button
                                className={`${styles.statusBtn} ${styles.statusConfirmed} ${trip.status === "CONFIRMED" ? styles.current : ""}`}
                                onClick={() => handleStatusChange("CONFIRMED")}
                                disabled={isUpdating || trip.status === "CONFIRMED"}
                            >
                                <CheckCircle size={18} />
                                <span>Confirmed</span>
                            </button>
                            <button
                                className={`${styles.statusBtn} ${styles.statusNoAnswer} ${trip.status === "NO_ANSWER" ? styles.current : ""}`}
                                onClick={() => handleStatusChange("NO_ANSWER")}
                                disabled={isUpdating || trip.status === "NO_ANSWER"}
                            >
                                <PhoneOff size={18} />
                                <span>No Answer</span>
                            </button>
                            <button
                                className={`${styles.statusBtn} ${styles.statusCancelled} ${trip.status === "CANCELLED" ? styles.current : ""}`}
                                onClick={() => handleStatusChange("CANCELLED")}
                                disabled={isUpdating || trip.status === "CANCELLED"}
                            >
                                <XCircle size={18} />
                                <span>Cancelled</span>
                            </button>
                            <button
                                className={`${styles.statusBtn} ${styles.statusRescheduled} ${trip.status === "RESCHEDULED" ? styles.current : ""}`}
                                onClick={() => handleStatusChange("RESCHEDULED")}
                                disabled={isUpdating || trip.status === "RESCHEDULED"}
                            >
                                <RotateCcw size={18} />
                                <span>Rescheduled</span>
                            </button>
                        </div>
                    </div>
                    <div className={styles.notesField}>
                        <label>Notes (optional):</label>
                        <textarea
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="Add any notes about the call..."
                        />
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
