"use client";

import { useState } from "react";
import { Calendar, User, AlertTriangle, Check, X } from "lucide-react";
import {
    applyTemplateToWeek,
    type ScheduleTemplateWithShifts,
} from "@/lib/scheduleTemplateActions";
import { useToastContext } from "@/components/ui/ToastProvider";
import { DAY_NAMES_FULL, formatHour, getShiftDuration } from "@/types/schedule";
import styles from "./apply-template-modal.module.css";

interface Dispatcher {
    id: string;
    name: string | null;
}

interface ApplyTemplateModalProps {
    template: ScheduleTemplateWithShifts;
    weekStart: Date;
    dispatchers: Dispatcher[];
    onClose: () => void;
    onApplied: () => void;
}

function formatWeekDate(date: Date): string {
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function ApplyTemplateModal({
    template,
    weekStart,
    dispatchers,
    onClose,
    onApplied,
}: ApplyTemplateModalProps) {
    const [assignments, setAssignments] = useState<Record<number, string>>(() => {
        const initial: Record<number, string> = {};
        template.shifts.forEach((shift, idx) => {
            if (shift.dispatcherId) {
                initial[idx] = shift.dispatcherId;
            }
        });
        return initial;
    });
    const [applying, setApplying] = useState(false);
    const { addToast } = useToastContext();

    const handleAssignment = (shiftIndex: number, dispatcherId: string) => {
        setAssignments((prev) => ({
            ...prev,
            [shiftIndex]: dispatcherId,
        }));
    };

    const handleApply = async () => {
        // Validate all shifts have dispatchers
        const unassigned = template.shifts.filter((_, idx) => !assignments[idx]);
        if (unassigned.length > 0) {
            addToast(`${unassigned.length} shifts have no dispatcher assigned`, "error");
            return;
        }

        setApplying(true);
        try {
            const result = await applyTemplateToWeek(template.id, weekStart, assignments);

            if (result.created > 0) {
                addToast(`Created ${result.created} shifts`, "success");
            }
            if (result.skipped > 0) {
                addToast(`Skipped ${result.skipped} shifts (conflicts)`, "warning");
            }
            if (result.errors.length > 0 && result.created === 0) {
                addToast(result.errors[0], "error");
            }

            onApplied();
            onClose();
        } catch {
            addToast("Failed to apply template", "error");
        } finally {
            setApplying(false);
        }
    };

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const assignedCount = Object.keys(assignments).length;
    const totalShifts = template.shifts.length;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        <Calendar size={20} />
                        Apply Template
                    </h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.info}>
                    <div className={styles.templateInfo}>
                        <strong>{template.name}</strong>
                        {template.description && <span> - {template.description}</span>}
                    </div>
                    <div className={styles.weekInfo}>
                        Week of {formatWeekDate(weekStart)} - {formatWeekDate(weekEnd)}
                    </div>
                </div>

                <div className={styles.shiftsContainer}>
                    <div className={styles.shiftsHeader}>
                        <span>Assign dispatchers to shifts</span>
                        <span className={styles.progress}>
                            {assignedCount}/{totalShifts} assigned
                        </span>
                    </div>

                    <div className={styles.shiftsList}>
                        {template.shifts.map((shift, idx) => (
                            <div key={shift.id} className={styles.shiftRow}>
                                <div className={styles.shiftInfo}>
                                    <span className={styles.shiftDay}>
                                        {DAY_NAMES_FULL[shift.dayOfWeek]}
                                    </span>
                                    <span className={styles.shiftTime}>
                                        {formatHour(shift.startHour)} - {formatHour(shift.endHour)}
                                    </span>
                                    <span className={styles.shiftDuration}>
                                        ({getShiftDuration(shift.startHour, shift.endHour)}h)
                                    </span>
                                </div>

                                <div className={styles.assignmentSelect}>
                                    <User size={14} className={styles.userIcon} />
                                    <select
                                        value={assignments[idx] || ""}
                                        onChange={(e) => handleAssignment(idx, e.target.value)}
                                        className={assignments[idx] ? styles.assigned : styles.unassigned}
                                    >
                                        <option value="">Select dispatcher...</option>
                                        {dispatchers.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name || d.id}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {assignedCount < totalShifts && (
                    <div className={styles.warning}>
                        <AlertTriangle size={16} />
                        {totalShifts - assignedCount} shifts still need a dispatcher assigned
                    </div>
                )}

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} disabled={applying}>
                        Cancel
                    </button>
                    <button
                        className={styles.applyBtn}
                        onClick={handleApply}
                        disabled={applying || assignedCount < totalShifts}
                    >
                        {applying ? (
                            "Applying..."
                        ) : (
                            <>
                                <Check size={16} />
                                Apply {totalShifts} Shifts
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
