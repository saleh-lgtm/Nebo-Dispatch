"use client";

import React, { useState, useEffect } from "react";
import { Lightbulb, AlertTriangle, Info, Plus, RefreshCw, X } from "lucide-react";
import { getSchedulingSuggestions, type SchedulingSuggestion } from "@/lib/schedulingSuggestions";
import { useToastContext } from "@/components/ui/ToastProvider";
import styles from "./suggestion-panel.module.css";

interface SuggestionPanelProps {
    weekStart: Date;
    onApplySuggestion?: (suggestion: SchedulingSuggestion) => void;
    refreshTrigger?: number; // Increment to force refresh
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(hour: number): string {
    const h = Math.floor(hour);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}${period}`;
}

export function SuggestionPanel({
    weekStart,
    onApplySuggestion,
    refreshTrigger,
}: SuggestionPanelProps) {
    const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());
    const { addToast } = useToastContext();

    useEffect(() => {
        loadSuggestions();
    }, [weekStart, refreshTrigger]);

    const loadSuggestions = async () => {
        try {
            setLoading(true);
            const data = await getSchedulingSuggestions(weekStart);
            setSuggestions(data);
            setDismissed(new Set());
        } catch {
            addToast("Failed to load suggestions", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = (index: number) => {
        setDismissed((prev) => new Set(prev).add(index));
    };

    const handleApply = (suggestion: SchedulingSuggestion) => {
        if (onApplySuggestion && suggestion.action) {
            onApplySuggestion(suggestion);
        }
    };

    const visibleSuggestions = suggestions.filter((_, idx) => !dismissed.has(idx));
    const highPriority = visibleSuggestions.filter((s) => s.priority === "high");
    const otherSuggestions = visibleSuggestions.filter((s) => s.priority !== "high");

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case "high":
                return <AlertTriangle size={14} className={styles.iconHigh} />;
            case "medium":
                return <Lightbulb size={14} className={styles.iconMedium} />;
            default:
                return <Info size={14} className={styles.iconLow} />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "gap_coverage":
                return "Coverage Gap";
            case "overtime_warning":
                return "Overtime";
            case "preference_match":
                return "Preference";
            case "fairness":
                return "Hours Balance";
            case "understaffed":
                return "Understaffed";
            default:
                return type;
        }
    };

    if (collapsed) {
        return (
            <button className={styles.collapsedBtn} onClick={() => setCollapsed(false)}>
                <Lightbulb size={16} />
                {visibleSuggestions.length > 0 && (
                    <span className={styles.badge}>{visibleSuggestions.length}</span>
                )}
            </button>
        );
    }

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <h4 className={styles.title}>
                    <Lightbulb size={16} />
                    Suggestions
                </h4>
                <div className={styles.headerActions}>
                    <button
                        className={styles.refreshBtn}
                        onClick={loadSuggestions}
                        disabled={loading}
                        title="Refresh suggestions"
                    >
                        <RefreshCw size={14} className={loading ? styles.spinning : ""} />
                    </button>
                    <button
                        className={styles.collapseBtn}
                        onClick={() => setCollapsed(true)}
                        title="Minimize"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className={styles.content}>
                {loading && suggestions.length === 0 ? (
                    <div className={styles.loading}>Analyzing schedule...</div>
                ) : visibleSuggestions.length === 0 ? (
                    <div className={styles.empty}>
                        <span>No suggestions - schedule looks good!</span>
                    </div>
                ) : (
                    <>
                        {highPriority.length > 0 && (
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>Needs Attention</div>
                                {highPriority.map((suggestion, idx) => (
                                    <SuggestionItem
                                        key={`high-${idx}`}
                                        suggestion={suggestion}
                                        icon={getPriorityIcon(suggestion.priority)}
                                        typeLabel={getTypeLabel(suggestion.type)}
                                        onDismiss={() => handleDismiss(suggestions.indexOf(suggestion))}
                                        onApply={onApplySuggestion ? () => handleApply(suggestion) : undefined}
                                    />
                                ))}
                            </div>
                        )}

                        {otherSuggestions.length > 0 && (
                            <div className={styles.section}>
                                {highPriority.length > 0 && (
                                    <div className={styles.sectionTitle}>Other Suggestions</div>
                                )}
                                {otherSuggestions.map((suggestion, idx) => (
                                    <SuggestionItem
                                        key={`other-${idx}`}
                                        suggestion={suggestion}
                                        icon={getPriorityIcon(suggestion.priority)}
                                        typeLabel={getTypeLabel(suggestion.type)}
                                        onDismiss={() => handleDismiss(suggestions.indexOf(suggestion))}
                                        onApply={onApplySuggestion ? () => handleApply(suggestion) : undefined}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

interface SuggestionItemProps {
    suggestion: SchedulingSuggestion;
    icon: React.ReactNode;
    typeLabel: string;
    onDismiss: () => void;
    onApply?: () => void;
}

function SuggestionItem({ suggestion, icon, typeLabel, onDismiss, onApply }: SuggestionItemProps) {
    return (
        <div className={`${styles.item} ${styles[suggestion.priority]}`}>
            <div className={styles.itemHeader}>
                {icon}
                <span className={styles.typeLabel}>{typeLabel}</span>
                <button className={styles.dismissBtn} onClick={onDismiss} title="Dismiss">
                    <X size={12} />
                </button>
            </div>
            <p className={styles.message}>{suggestion.message}</p>
            {suggestion.action && onApply && (
                <div className={styles.actionInfo}>
                    <span className={styles.actionDetail}>
                        {DAY_NAMES[suggestion.action.dayOfWeek]} {formatHour(suggestion.action.startHour)} ({suggestion.action.duration}h)
                    </span>
                    <button className={styles.applyBtn} onClick={onApply}>
                        <Plus size={12} />
                        Add Shift
                    </button>
                </div>
            )}
        </div>
    );
}
