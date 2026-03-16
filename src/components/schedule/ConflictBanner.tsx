"use client";

import { AlertTriangle, AlertCircle, X } from "lucide-react";
import type { ValidationError } from "@/types/schedule";
import styles from "./conflict-banner.module.css";

interface ConflictBannerProps {
    conflicts: ValidationError[];
    onDismiss?: () => void;
    onProceedAnyway?: () => void;
    showProceed?: boolean;
}

export function ConflictBanner({
    conflicts,
    onDismiss,
    onProceedAnyway,
    showProceed = false,
}: ConflictBannerProps) {
    const errors = conflicts.filter((c) => c.severity === "error");
    const warnings = conflicts.filter((c) => c.severity === "warning");

    if (conflicts.length === 0) return null;

    const hasErrors = errors.length > 0;

    return (
        <div className={`${styles.banner} ${hasErrors ? styles.error : styles.warning}`}>
            <div className={styles.icon}>
                {hasErrors ? <AlertCircle size={20} /> : <AlertTriangle size={20} />}
            </div>

            <div className={styles.content}>
                <div className={styles.title}>
                    {hasErrors
                        ? `${errors.length} conflict${errors.length > 1 ? "s" : ""} found`
                        : `${warnings.length} warning${warnings.length > 1 ? "s" : ""}`}
                </div>

                <ul className={styles.list}>
                    {errors.map((conflict, idx) => (
                        <li key={`error-${idx}`} className={styles.errorItem}>
                            {conflict.message}
                        </li>
                    ))}
                    {warnings.map((conflict, idx) => (
                        <li key={`warning-${idx}`} className={styles.warningItem}>
                            {conflict.message}
                        </li>
                    ))}
                </ul>

                {(showProceed || onDismiss) && (
                    <div className={styles.actions}>
                        {showProceed && !hasErrors && onProceedAnyway && (
                            <button className={styles.proceedBtn} onClick={onProceedAnyway}>
                                Proceed Anyway
                            </button>
                        )}
                    </div>
                )}
            </div>

            {onDismiss && (
                <button className={styles.dismissBtn} onClick={onDismiss}>
                    <X size={16} />
                </button>
            )}
        </div>
    );
}

// Compact inline version for shift forms
export function ConflictInline({ conflicts }: { conflicts: ValidationError[] }) {
    if (conflicts.length === 0) return null;

    const hasErrors = conflicts.some((c) => c.severity === "error");

    return (
        <div className={`${styles.inline} ${hasErrors ? styles.inlineError : styles.inlineWarning}`}>
            {hasErrors ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
            <span>
                {conflicts.length} {hasErrors ? "conflict" : "warning"}
                {conflicts.length > 1 ? "s" : ""}
            </span>
        </div>
    );
}
