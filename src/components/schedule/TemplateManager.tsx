"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Trash2, Edit, Plus, Copy } from "lucide-react";
import {
    getScheduleTemplates,
    deleteScheduleTemplate,
    type ScheduleTemplateWithShifts,
} from "@/lib/scheduleTemplateActions";
import { useToastContext } from "@/components/ui/ToastProvider";
import styles from "./template-manager.module.css";

interface TemplateManagerProps {
    onSelectTemplate?: (template: ScheduleTemplateWithShifts) => void;
    onEditTemplate?: (template: ScheduleTemplateWithShifts) => void;
    onCreateNew?: () => void;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHour(hour: number): string {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}${period}`;
}

function getShiftDuration(startHour: number, endHour: number): number {
    if (endHour > startHour) {
        return endHour - startHour;
    }
    // Overnight shift
    return 24 - startHour + endHour;
}

export function TemplateManager({
    onSelectTemplate,
    onEditTemplate,
    onCreateNew,
}: TemplateManagerProps) {
    const [templates, setTemplates] = useState<ScheduleTemplateWithShifts[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const { addToast } = useToastContext();

    useEffect(() => {
        loadTemplates();
    }, [showInactive]);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            const data = await getScheduleTemplates(showInactive);
            setTemplates(data);
        } catch {
            addToast("Failed to load templates", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;

        try {
            const result = await deleteScheduleTemplate(id, true);
            if (result.success) {
                addToast("Template deleted", "success");
                loadTemplates();
            } else {
                addToast(result.error || "Failed to delete", "error");
            }
        } catch {
            addToast("Failed to delete template", "error");
        }
    };

    // Group shifts by day for display
    const getShiftSummary = (template: ScheduleTemplateWithShifts) => {
        const byDay = new Map<number, number>();
        for (const shift of template.shifts) {
            byDay.set(shift.dayOfWeek, (byDay.get(shift.dayOfWeek) || 0) + 1);
        }

        return DAY_NAMES.map((name, idx) => ({
            day: name,
            count: byDay.get(idx) || 0,
        }));
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading templates...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>
                    <Calendar size={18} />
                    Schedule Templates
                </h3>
                <div className={styles.actions}>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                        />
                        Show inactive
                    </label>
                    {onCreateNew && (
                        <button className={styles.createBtn} onClick={onCreateNew}>
                            <Plus size={16} />
                            New Template
                        </button>
                    )}
                </div>
            </div>

            {templates.length === 0 ? (
                <div className={styles.empty}>
                    <p>No templates found.</p>
                    {onCreateNew && (
                        <button className={styles.createBtn} onClick={onCreateNew}>
                            Create your first template
                        </button>
                    )}
                </div>
            ) : (
                <div className={styles.list}>
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className={`${styles.card} ${!template.isActive ? styles.inactive : ""}`}
                        >
                            <div className={styles.cardHeader}>
                                <div>
                                    <h4 className={styles.templateName}>{template.name}</h4>
                                    {template.description && (
                                        <p className={styles.description}>{template.description}</p>
                                    )}
                                </div>
                                <div className={styles.cardActions}>
                                    {onSelectTemplate && (
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => onSelectTemplate(template)}
                                            title="Apply template"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    )}
                                    {onEditTemplate && (
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => onEditTemplate(template)}
                                            title="Edit template"
                                        >
                                            <Edit size={16} />
                                        </button>
                                    )}
                                    <button
                                        className={`${styles.iconBtn} ${styles.danger}`}
                                        onClick={() => handleDelete(template.id, template.name)}
                                        title="Delete template"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className={styles.shiftSummary}>
                                {getShiftSummary(template).map(({ day, count }) => (
                                    <div
                                        key={day}
                                        className={`${styles.dayBadge} ${count > 0 ? styles.hasShifts : ""}`}
                                    >
                                        <span className={styles.dayName}>{day}</span>
                                        {count > 0 && <span className={styles.shiftCount}>{count}</span>}
                                    </div>
                                ))}
                            </div>

                            <div className={styles.shiftList}>
                                {template.shifts.slice(0, 5).map((shift) => (
                                    <div key={shift.id} className={styles.shiftItem}>
                                        <span className={styles.shiftDay}>{DAY_NAMES[shift.dayOfWeek]}</span>
                                        <span className={styles.shiftTime}>
                                            {formatHour(shift.startHour)} ({getShiftDuration(shift.startHour, shift.endHour)}h)
                                        </span>
                                    </div>
                                ))}
                                {template.shifts.length > 5 && (
                                    <div className={styles.moreShifts}>
                                        +{template.shifts.length - 5} more shifts
                                    </div>
                                )}
                            </div>

                            <div className={styles.meta}>
                                <span>Created by {template.createdBy.name || "Unknown"}</span>
                                <span>{template.shifts.length} shifts</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
