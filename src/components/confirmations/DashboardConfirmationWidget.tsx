"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Phone,
    Clock,
    User,
    Car,
    CheckCircle,
    PhoneOff,
    AlertTriangle,
} from "lucide-react";
import { completeConfirmation } from "@/lib/tripConfirmationActions";
import { useRouter } from "next/navigation";
import styles from "./DashboardConfirmationWidget.module.css";

type ConfirmationStatus = "CONFIRMED" | "NO_ANSWER";

interface Confirmation {
    id: string;
    tripNumber: string;
    pickupAt: Date | string;
    dueAt: Date | string;
    passengerName: string;
    driverName: string;
    status: string;
}

interface Props {
    confirmations: Confirmation[];
}

export default function DashboardConfirmationWidget({ confirmations }: Props) {
    const router = useRouter();
    const [completing, setCompleting] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 15000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = useCallback(
        async (id: string, status: ConfirmationStatus) => {
            setCompleting(id);
            setError(null);
            setDismissed((prev) => new Set(prev).add(id));
            try {
                await completeConfirmation(id, status, "");
                router.refresh();
            } catch (err) {
                setDismissed((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                setError(
                    err instanceof Error ? err.message : "Failed to complete confirmation"
                );
            } finally {
                setCompleting(null);
            }
        },
        [router]
    );

    const getTimeUntilDue = (dueAt: Date | string) => {
        const diffMs = new Date(dueAt).getTime() - now.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));
        if (diffMins < 0) {
            const over = Math.abs(diffMins);
            return over >= 60
                ? `${Math.floor(over / 60)}h ${over % 60}m overdue`
                : `${over}m overdue`;
        }
        return diffMins >= 60
            ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`
            : `${diffMins}m`;
    };

    const isOverdue = (dueAt: Date | string) =>
        new Date(dueAt).getTime() < now.getTime();

    const isUrgent = (dueAt: Date | string) => {
        const diff = (new Date(dueAt).getTime() - now.getTime()) / 60000;
        return diff < 30 && diff >= 0;
    };

    const formatTime = (date: Date | string) =>
        new Date(date).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/Chicago",
        });

    const visible = confirmations.filter((c) => !dismissed.has(c.id));

    if (visible.length === 0) {
        return (
            <div className={styles.widget}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        <Phone size={18} />
                        <span>Dispatcher Queue</span>
                    </div>
                    <span className={styles.label}>Confirmations</span>
                </div>
                <div className={styles.emptyState}>
                    <CheckCircle size={32} />
                    <p>Queue is clear</p>
                    <span>No confirmations needed right now</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.widget} ${styles.widgetActive}`}>
            <div className={`${styles.header} ${styles.headerActive}`}>
                <div className={styles.title}>
                    <Phone size={18} />
                    <span>Dispatcher Queue</span>
                </div>
                <div className={styles.headerRight}>
                    <span className={styles.label}>
                        Next {visible.length} trips
                    </span>
                    <span className={styles.countBadge}>{visible.length}</span>
                </div>
            </div>
            <div className={styles.banner}>
                <AlertTriangle size={14} />
                <span>Action Required — Confirm these trips now</span>
            </div>

            {error && <div className={styles.errorBanner}>{error}</div>}

            <div className={styles.list}>
                {visible.map((conf, i) => {
                    const overdue = isOverdue(conf.dueAt);
                    const urgent = isUrgent(conf.dueAt);
                    const isProcessing = completing === conf.id;

                    return (
                        <div
                            key={conf.id}
                            className={`${styles.card} ${overdue ? styles.cardOverdue : ""} ${urgent && !overdue ? styles.cardUrgent : ""} ${isProcessing ? styles.cardCompleting : ""}`}
                        >
                            <div className={styles.position}>
                                <span
                                    className={`${styles.positionNum} ${i === 0 ? styles.positionFirst : ""}`}
                                >
                                    {i + 1}
                                </span>
                            </div>
                            <div className={styles.info}>
                                <div className={styles.tripRow}>
                                    <span className={styles.tripNumber}>
                                        #{conf.tripNumber}
                                    </span>
                                    <span className={styles.pickupTime}>
                                        <Clock size={12} />
                                        PU: {formatTime(conf.pickupAt)}
                                    </span>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>
                                        <User size={12} />
                                        {conf.passengerName}
                                    </span>
                                    <span>
                                        <Car size={12} />
                                        {conf.driverName}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.rightCol}>
                                <span
                                    className={`${styles.countdown} ${overdue ? styles.countdownOverdue : urgent ? styles.countdownUrgent : ""}`}
                                >
                                    {overdue && <AlertTriangle size={12} />}
                                    {getTimeUntilDue(conf.dueAt)}
                                </span>
                                <div className={styles.actions}>
                                    <button
                                        className={styles.confirmBtn}
                                        onClick={() =>
                                            handleAction(conf.id, "CONFIRMED")
                                        }
                                        disabled={isProcessing}
                                        title="Confirmed"
                                    >
                                        <CheckCircle size={14} />
                                        Confirm
                                    </button>
                                    <button
                                        className={styles.noAnswerBtn}
                                        onClick={() =>
                                            handleAction(conf.id, "NO_ANSWER")
                                        }
                                        disabled={isProcessing}
                                        title="No Answer"
                                    >
                                        <PhoneOff size={14} />
                                        No Answer
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
