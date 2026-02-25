"use client";

import { useState, useEffect } from "react";
import {
    Phone,
    Clock,
    User,
    Car,
    CheckCircle,
    XCircle,
    PhoneOff,
    RotateCcw,
    AlertTriangle,
    ChevronRight,
} from "lucide-react";
import { completeConfirmation } from "@/lib/tripConfirmationActions";
import { useRouter } from "next/navigation";

type ConfirmationStatus = "PENDING" | "CONFIRMED" | "NO_ANSWER" | "CANCELLED" | "RESCHEDULED" | "EXPIRED";

interface Confirmation {
    id: string;
    tripNumber: string;
    pickupAt: Date | string;
    dueAt: Date | string;
    passengerName: string;
    driverName: string;
    status: string;
    completedAt: Date | string | null;
    completedBy: { id: string; name: string | null } | null;
}

interface Props {
    confirmations: Confirmation[];
    onRefresh?: () => void;
}

const STATUS_OPTIONS: Array<{
    value: ConfirmationStatus;
    label: string;
    icon: typeof CheckCircle;
    className: string;
}> = [
    {
        value: "CONFIRMED",
        label: "Confirmed",
        icon: CheckCircle,
        className: "status-confirmed",
    },
    {
        value: "NO_ANSWER",
        label: "No Answer",
        icon: PhoneOff,
        className: "status-no-answer",
    },
    {
        value: "CANCELLED",
        label: "Cancelled",
        icon: XCircle,
        className: "status-cancelled",
    },
    {
        value: "RESCHEDULED",
        label: "Rescheduled",
        icon: RotateCcw,
        className: "status-rescheduled",
    },
];

export default function ConfirmationWidget({ confirmations, onRefresh }: Props) {
    const router = useRouter();
    const [completing, setCompleting] = useState<string | null>(null);
    const [selectedConfirmation, setSelectedConfirmation] = useState<Confirmation | null>(null);
    const [notes, setNotes] = useState("");
    const [now, setNow] = useState(new Date());

    // Update "now" every minute for time display
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const getTimeUntilDue = (dueAt: Date | string) => {
        const due = new Date(dueAt);
        const diffMs = due.getTime() - now.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));

        if (diffMins < 0) {
            const overdueMins = Math.abs(diffMins);
            if (overdueMins >= 60) {
                return `${Math.floor(overdueMins / 60)}h ${overdueMins % 60}m overdue`;
            }
            return `${overdueMins}m overdue`;
        }

        if (diffMins >= 60) {
            return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
        }
        return `${diffMins}m`;
    };

    const isOverdue = (dueAt: Date | string) => {
        return new Date(dueAt).getTime() < now.getTime();
    };

    const isUrgent = (dueAt: Date | string) => {
        const due = new Date(dueAt);
        const diffMins = (due.getTime() - now.getTime()) / (1000 * 60);
        return diffMins < 30; // Less than 30 minutes
    };

    const formatTime = (date: Date | string) => {
        return new Date(date).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Chicago",
        });
    };

    const handleComplete = async (status: ConfirmationStatus) => {
        if (!selectedConfirmation) return;

        setCompleting(selectedConfirmation.id);
        try {
            await completeConfirmation(selectedConfirmation.id, status, notes);
            setSelectedConfirmation(null);
            setNotes("");
            router.refresh();
            onRefresh?.();
        } catch (error) {
            console.error("Failed to complete confirmation:", error);
        } finally {
            setCompleting(null);
        }
    };

    if (confirmations.length === 0) {
        return (
            <div className="confirmation-widget">
                <div className="widget-header">
                    <div className="widget-title">
                        <Phone size={18} />
                        <span>2-Hour Confirmations</span>
                    </div>
                </div>
                <div className="empty-state">
                    <CheckCircle size={32} />
                    <p>No confirmations due</p>
                </div>
                <style jsx>{styles}</style>
            </div>
        );
    }

    return (
        <div className="confirmation-widget">
            <div className="widget-header">
                <div className="widget-title">
                    <Phone size={18} />
                    <span>2-Hour Confirmations</span>
                </div>
                <span className="count-badge">{confirmations.length}</span>
            </div>

            <div className="confirmations-list">
                {confirmations.map((conf) => {
                    const overdue = isOverdue(conf.dueAt);
                    const urgent = isUrgent(conf.dueAt);

                    return (
                        <div
                            key={conf.id}
                            className={`confirmation-item ${overdue ? "overdue" : ""} ${urgent && !overdue ? "urgent" : ""}`}
                            onClick={() => setSelectedConfirmation(conf)}
                        >
                            <div className="conf-main">
                                <div className="conf-trip">
                                    <span className="trip-number">#{conf.tripNumber}</span>
                                    <span className="pickup-time">
                                        <Clock size={12} />
                                        PU: {formatTime(conf.pickupAt)}
                                    </span>
                                </div>
                                <div className="conf-details">
                                    <span className="detail-item">
                                        <User size={12} />
                                        {conf.passengerName}
                                    </span>
                                    <span className="detail-item">
                                        <Car size={12} />
                                        {conf.driverName}
                                    </span>
                                </div>
                            </div>
                            <div className="conf-time">
                                <span className={`time-badge ${overdue ? "overdue" : urgent ? "urgent" : ""}`}>
                                    {overdue && <AlertTriangle size={12} />}
                                    {getTimeUntilDue(conf.dueAt)}
                                </span>
                                <ChevronRight size={16} className="chevron" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Completion Modal */}
            {selectedConfirmation && (
                <div className="modal-overlay" onClick={() => setSelectedConfirmation(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Complete Confirmation</h3>
                            <span className="trip-badge">#{selectedConfirmation.tripNumber}</span>
                        </div>

                        <div className="modal-body">
                            <div className="modal-info">
                                <div className="info-row">
                                    <User size={14} />
                                    <span>{selectedConfirmation.passengerName}</span>
                                </div>
                                <div className="info-row">
                                    <Car size={14} />
                                    <span>{selectedConfirmation.driverName}</span>
                                </div>
                                <div className="info-row">
                                    <Clock size={14} />
                                    <span>Pickup: {formatTime(selectedConfirmation.pickupAt)}</span>
                                </div>
                            </div>

                            <div className="status-options">
                                <label>Call Outcome:</label>
                                <div className="options-grid">
                                    {STATUS_OPTIONS.map((option) => {
                                        const Icon = option.icon;
                                        return (
                                            <button
                                                key={option.value}
                                                className={`status-btn ${option.className}`}
                                                onClick={() => handleComplete(option.value)}
                                                disabled={completing !== null}
                                            >
                                                <Icon size={18} />
                                                <span>{option.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="notes-field">
                                <label>Notes (optional):</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any notes about the call..."
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="cancel-btn"
                                onClick={() => setSelectedConfirmation(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{styles}</style>
        </div>
    );
}

const styles = `
    .confirmation-widget {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        overflow: hidden;
    }

    .widget-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        border-bottom: 1px solid var(--border);
        background: var(--bg-secondary);
    }

    .widget-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .widget-title svg {
        color: var(--accent);
    }

    .count-badge {
        background: var(--danger);
        color: white;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2rem;
        color: var(--text-secondary);
    }

    .empty-state svg {
        color: var(--accent);
        opacity: 0.5;
    }

    .confirmations-list {
        max-height: 320px;
        overflow-y: auto;
    }

    .confirmation-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.875rem 1rem;
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        transition: background 0.15s;
    }

    .confirmation-item:hover {
        background: var(--bg-hover);
    }

    .confirmation-item:last-child {
        border-bottom: none;
    }

    .confirmation-item.overdue {
        background: var(--danger-bg);
    }

    .confirmation-item.urgent {
        background: var(--warning-bg);
    }

    .conf-main {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .conf-trip {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .trip-number {
        font-weight: 600;
        color: var(--text-primary);
    }

    .pickup-time {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
    }

    .conf-details {
        display: flex;
        gap: 1rem;
    }

    .detail-item {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }

    .conf-time {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .time-badge {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        background: var(--success-bg);
        color: var(--success);
    }

    .time-badge.urgent {
        background: var(--warning-bg);
        color: var(--warning);
    }

    .time-badge.overdue {
        background: var(--danger-bg);
        color: var(--danger);
    }

    .chevron {
        color: var(--text-secondary);
    }

    /* Modal */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    .modal {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 16px;
        width: 100%;
        max-width: 400px;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--border);
    }

    .modal-header h3 {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
    }

    .trip-badge {
        background: var(--accent);
        color: var(--text-inverse);
        padding: 0.25rem 0.625rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 600;
    }

    .modal-body {
        padding: 1.25rem;
    }

    .modal-info {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        background: var(--bg-secondary);
        border-radius: 8px;
        margin-bottom: 1rem;
    }

    .info-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: var(--text-secondary);
    }

    .info-row svg {
        color: var(--accent);
    }

    .status-options {
        margin-bottom: 1rem;
    }

    .status-options label {
        display: block;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
    }

    .options-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
    }

    .status-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.375rem;
        padding: 0.875rem;
        border: 1px solid;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.8rem;
        font-weight: 500;
    }

    .status-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        filter: brightness(1.1);
    }

    .status-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .status-btn.status-confirmed {
        background: var(--success-bg);
        border-color: var(--success);
        color: var(--success);
    }

    .status-btn.status-no-answer {
        background: var(--warning-bg);
        border-color: var(--warning);
        color: var(--warning);
    }

    .status-btn.status-cancelled {
        background: var(--danger-bg);
        border-color: var(--danger);
        color: var(--danger);
    }

    .status-btn.status-rescheduled {
        background: var(--info-bg);
        border-color: var(--info);
        color: var(--info);
    }

    .notes-field label {
        display: block;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
    }

    .notes-field textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 0.875rem;
        resize: vertical;
        min-height: 60px;
    }

    .notes-field textarea:focus {
        outline: none;
        border-color: var(--accent);
    }

    .modal-footer {
        padding: 0.75rem 1.25rem;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: flex-end;
    }

    .cancel-btn {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: transparent;
        color: var(--text-secondary);
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .cancel-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
    }

    /* Scrollbar */
    .confirmations-list::-webkit-scrollbar {
        width: 4px;
    }

    .confirmations-list::-webkit-scrollbar-track {
        background: transparent;
    }

    .confirmations-list::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 2px;
    }
`;
