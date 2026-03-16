"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Send,
    Ban,
    Clock,
    Plus,
    X,
    Trash2,
    GripVertical,
    Loader2,
    Copy,
} from "lucide-react";
import {
    createScheduleBlock,
    updateScheduleBlock,
    deleteScheduleBlock,
    publishWeekSchedules,
    unpublishWeekSchedules,
    getWeekSchedules,
    copyPreviousWeekSchedules,
} from "@/lib/schedulerActions";
import { useToastContext } from "@/components/ui/ToastProvider";
import { useRealtimeSchedule } from "@/hooks/useRealtimeSchedule";
import "./mobile-scheduler.css";

// Types
interface Dispatcher {
    id: string;
    name: string | null;
    email: string | null;
}

interface ScheduleData {
    id: string;
    userId: string;
    shiftStart: Date;
    shiftEnd: Date;
    isPublished: boolean;
    user: { id: string; name: string | null };
}

interface ShiftBlock {
    id: string;
    dispatcherId: string;
    dispatcherName: string;
    day: number;
    startHour: number;
    duration: number;
    isPublished: boolean;
    color: string;
}

// Constants
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COMPANY_TIMEZONE = "America/Chicago";
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Color palette
const COLORS = [
    "#00f0ff", "#f472b6", "#a78bfa", "#34d399", "#fbbf24",
    "#fb7185", "#38bdf8", "#4ade80", "#f97316", "#e879f9",
];

function getDispatcherColor(index: number): string {
    return COLORS[index % COLORS.length];
}

function formatHour(h: number): string {
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function getDateInTimezone(date: Date): { year: number; month: number; day: number; hour: number; dayOfWeek: number } {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: COMPANY_TIMEZONE,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        hour12: false,
        weekday: "short",
    });
    const parts = formatter.formatToParts(date);
    const dayOfWeekStr = parts.find(p => p.type === "weekday")?.value || "Sun";
    const dayOfWeekMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
        year: parseInt(parts.find(p => p.type === "year")?.value || "0"),
        month: parseInt(parts.find(p => p.type === "month")?.value || "0") - 1,
        day: parseInt(parts.find(p => p.type === "day")?.value || "0"),
        hour: parseInt(parts.find(p => p.type === "hour")?.value || "0"),
        dayOfWeek: dayOfWeekMap[dayOfWeekStr] ?? 0,
    };
}

function createDateInTimezone(year: number, month: number, day: number, hour: number): Date {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;
    const tempDate = new Date(dateStr + "Z");
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: COMPANY_TIMEZONE,
        hour: "numeric",
        hour12: false,
    });

    for (let offset = -12; offset <= 14; offset++) {
        const testDate = new Date(tempDate.getTime() + offset * 60 * 60 * 1000);
        const testHour = parseInt(formatter.format(testDate));
        if (testHour === hour) {
            const fullFormatter = new Intl.DateTimeFormat("en-US", {
                timeZone: COMPANY_TIMEZONE,
                year: "numeric",
                month: "numeric",
                day: "numeric",
            });
            const parts = fullFormatter.formatToParts(testDate);
            const testDay = parseInt(parts.find(p => p.type === "day")?.value || "0");
            if (testDay === day) {
                return testDate;
            }
        }
    }
    return new Date(tempDate.getTime() + 6 * 60 * 60 * 1000);
}

function schedulesToBlocks(schedules: ScheduleData[], dispatchers: Dispatcher[]): ShiftBlock[] {
    return schedules.map((schedule) => {
        const shiftStart = new Date(schedule.shiftStart);
        const shiftEnd = new Date(schedule.shiftEnd);
        const startInTz = getDateInTimezone(shiftStart);
        const duration = Math.ceil((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60));
        const dispatcherIndex = dispatchers.findIndex((d) => d.id === schedule.userId);

        return {
            id: schedule.id,
            dispatcherId: schedule.userId,
            dispatcherName: schedule.user.name || "Unknown",
            day: startInTz.dayOfWeek,
            startHour: startInTz.hour,
            duration,
            isPublished: schedule.isPublished,
            color: dispatcherIndex >= 0 ? getDispatcherColor(dispatcherIndex) : COLORS[0],
        };
    });
}

interface Props {
    dispatchers: Dispatcher[];
    initialSchedules: ScheduleData[];
    initialWeekStart: string;
}

export default function MobileSchedulerClient({ dispatchers, initialSchedules, initialWeekStart }: Props) {
    const { addToast } = useToastContext();
    const [weekStart, setWeekStart] = useState<Date>(new Date(initialWeekStart));
    const [selectedDay, setSelectedDay] = useState(() => {
        const today = getDateInTimezone(new Date());
        return today.dayOfWeek;
    });
    const [shifts, setShifts] = useState<ShiftBlock[]>(() =>
        schedulesToBlocks(initialSchedules, dispatchers)
    );
    const [isPublished, setIsPublished] = useState(() =>
        initialSchedules.some((s) => s.isPublished)
    );
    const [isLoading, setIsLoading] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [addShiftHour, setAddShiftHour] = useState<number | null>(null);
    const [selectedDispatcher, setSelectedDispatcher] = useState<string | null>(null);
    const [shiftDuration, setShiftDuration] = useState(8);
    const [editingShift, setEditingShift] = useState<ShiftBlock | null>(null);
    const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);

    const timelineRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number>(0);

    const loadWeekSchedules = useCallback(async (newWeekStart: Date) => {
        setIsNavigating(true);
        try {
            const schedules = await getWeekSchedules(newWeekStart);
            const blocks = schedulesToBlocks(schedules, dispatchers);
            setShifts(blocks);
            setIsPublished(schedules.some((s) => s.isPublished));
        } finally {
            setIsNavigating(false);
        }
    }, [dispatchers]);

    // Real-time schedule updates - reload when changes detected from other sessions
    const handleRealtimeChange = useCallback(() => {
        // Only reload without showing navigation spinner for realtime updates
        getWeekSchedules(weekStart).then((schedules) => {
            const blocks = schedulesToBlocks(schedules, dispatchers);
            setShifts(blocks);
            setIsPublished(schedules.some((s) => s.isPublished));
        });
    }, [weekStart, dispatchers]);

    useRealtimeSchedule({
        weekStart,
        onAnyChange: handleRealtimeChange,
        enabled: true,
    });

    const goToPrevWeek = async () => {
        const newWeek = new Date(weekStart);
        newWeek.setUTCDate(newWeek.getUTCDate() - 7);
        setWeekStart(newWeek);
        await loadWeekSchedules(newWeek);
    };

    const goToNextWeek = async () => {
        const newWeek = new Date(weekStart);
        newWeek.setUTCDate(newWeek.getUTCDate() + 7);
        setWeekStart(newWeek);
        await loadWeekSchedules(newWeek);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX.current - touchEndX;

        if (Math.abs(diff) > 50) {
            if (diff > 0 && selectedDay < 6) {
                setSelectedDay(selectedDay + 1);
            } else if (diff < 0 && selectedDay > 0) {
                setSelectedDay(selectedDay - 1);
            }
        }
    };

    const getDateForDay = (dayIndex: number): Date => {
        const date = new Date(weekStart);
        date.setUTCDate(date.getUTCDate() + dayIndex);
        return date;
    };

    const formatDateHeader = (dayIndex: number): string => {
        const date = getDateForDay(dayIndex);
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            timeZone: COMPANY_TIMEZONE,
        });
    };

    const dayShifts = useMemo(() => {
        return shifts.filter((s) => s.day === selectedDay).sort((a, b) => a.startHour - b.startHour);
    }, [shifts, selectedDay]);

    const handleHourTap = (hour: number) => {
        setAddShiftHour(hour);
        setShowAddSheet(true);
    };

    const handleAddShift = async () => {
        if (!selectedDispatcher || addShiftHour === null) return;

        setIsLoading(true);
        try {
            const date = getDateForDay(selectedDay);
            const dateInTz = getDateInTimezone(date);
            const shiftStart = createDateInTimezone(dateInTz.year, dateInTz.month, dateInTz.day, addShiftHour);
            const shiftEnd = new Date(shiftStart.getTime() + shiftDuration * 60 * 60 * 1000);

            const result = await createScheduleBlock({
                userId: selectedDispatcher,
                shiftStart,
                shiftEnd,
            });

            if (result.success && result.schedule) {
                const dispatcher = dispatchers.find((d) => d.id === selectedDispatcher);
                const dispatcherIndex = dispatchers.findIndex((d) => d.id === selectedDispatcher);
                setShifts((prev) => [
                    ...prev,
                    {
                        id: result.schedule!.id,
                        dispatcherId: selectedDispatcher,
                        dispatcherName: dispatcher?.name || "Unknown",
                        day: selectedDay,
                        startHour: addShiftHour,
                        duration: shiftDuration,
                        isPublished: false,
                        color: getDispatcherColor(dispatcherIndex),
                    },
                ]);
                addToast("Shift created", "success");
                setShowAddSheet(false);
                setSelectedDispatcher(null);
            } else {
                addToast(result.error || "Failed to create shift", "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteShift = async (shiftId: string) => {
        setDeletingShiftId(shiftId);
        try {
            const result = await deleteScheduleBlock(shiftId);
            if (result.success) {
                setShifts((prev) => prev.filter((s) => s.id !== shiftId));
                setEditingShift(null);
                addToast("Shift deleted", "success");
            } else {
                addToast(result.error || "Failed to delete shift", "error");
            }
        } finally {
            setDeletingShiftId(null);
        }
    };

    const handlePublish = async () => {
        setIsLoading(true);
        try {
            const result = await publishWeekSchedules(weekStart);
            if (result.success) {
                setShifts((prev) => prev.map((s) => ({ ...s, isPublished: true })));
                setIsPublished(true);
                addToast("Schedule published!", "success");
            } else {
                addToast(result.error || "Failed to publish", "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnpublish = async () => {
        setIsLoading(true);
        try {
            const result = await unpublishWeekSchedules(weekStart);
            if (result.success) {
                setShifts((prev) => prev.map((s) => ({ ...s, isPublished: false })));
                setIsPublished(false);
                addToast("Schedule unpublished", "info");
            } else {
                addToast(result.error || "Failed to unpublish", "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const [copying, setCopying] = useState(false);

    const handleCopyPreviousWeek = async () => {
        if (shifts.length > 0) {
            const confirmed = window.confirm(
                "This week already has schedules. Clear them first?"
            );
            if (!confirmed) return;

            for (const shift of shifts) {
                await deleteScheduleBlock(shift.id);
            }
            setShifts([]);
        }

        setCopying(true);
        try {
            const result = await copyPreviousWeekSchedules(weekStart);
            if (result.success && result.schedules) {
                const newBlocks = schedulesToBlocks(result.schedules, dispatchers);
                setShifts(newBlocks);
                addToast(result.message, "success");
            } else {
                addToast(result.message, "error");
            }
        } finally {
            setCopying(false);
        }
    };

    const totalHours = shifts.reduce((sum, s) => sum + s.duration, 0);

    return (
        <div className="m-scheduler">
            {/* Header */}
            <header className="m-header">
                <div className="m-header__top">
                    <div className={`m-status ${isPublished ? "m-status--live" : ""}`}>
                        {isPublished ? "LIVE" : "DRAFT"}
                    </div>
                    <div className="m-header__stats">
                        <span>{shifts.length} shifts</span>
                        <span>{totalHours}h total</span>
                    </div>
                </div>

                <div className="m-week-nav">
                    <button onClick={goToPrevWeek} className="m-nav-btn" disabled={isNavigating}>
                        <ChevronLeft size={20} />
                    </button>
                    <div className="m-week-display">
                        {isNavigating ? (
                            <Loader2 size={16} className="m-spin" />
                        ) : (
                            <>
                                <span className="m-week-display__month">
                                    {weekStart.toLocaleDateString(undefined, { month: "short", timeZone: COMPANY_TIMEZONE })}
                                </span>
                                <span className="m-week-display__range">
                                    {weekStart.getUTCDate()} - {new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).getUTCDate()}
                                </span>
                            </>
                        )}
                    </div>
                    <button onClick={goToNextWeek} className="m-nav-btn" disabled={isNavigating}>
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Day Selector */}
                <div className="m-day-selector">
                    {DAY_NAMES.map((day, i) => (
                        <button
                            key={day}
                            className={`m-day-btn ${selectedDay === i ? "m-day-btn--active" : ""}`}
                            onClick={() => setSelectedDay(i)}
                        >
                            <span className="m-day-btn__name">{day}</span>
                            <span className="m-day-btn__date">{getDateForDay(i).getUTCDate()}</span>
                        </button>
                    ))}
                </div>
            </header>

            {/* Timeline */}
            <div
                className="m-timeline"
                ref={timelineRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <div className="m-timeline__header">
                    <h2>{DAY_FULL[selectedDay]}, {formatDateHeader(selectedDay)}</h2>
                    <span className="m-timeline__shift-count">
                        {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
                    </span>
                </div>

                <div className="m-timeline__grid">
                    {HOURS.map((hour) => {
                        const shiftsAtHour = dayShifts.filter(
                            (s) => hour >= s.startHour && hour < s.startHour + s.duration
                        );

                        return (
                            <div key={hour} className="m-hour-row">
                                <div className="m-hour-label">{formatHour(hour)}</div>
                                <div
                                    className="m-hour-content"
                                    onClick={() => shiftsAtHour.length === 0 && handleHourTap(hour)}
                                >
                                    {shiftsAtHour.map((shift) => {
                                        const isStart = hour === shift.startHour;
                                        const isEnd = hour === shift.startHour + shift.duration - 1;
                                        const isDeleting = deletingShiftId === shift.id;

                                        return (
                                            <div
                                                key={shift.id}
                                                className={`m-shift-block ${isStart ? "m-shift-block--start" : ""} ${isEnd ? "m-shift-block--end" : ""} ${isDeleting ? "m-shift-block--deleting" : ""}`}
                                                style={{ "--shift-color": shift.color } as React.CSSProperties}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingShift(shift);
                                                }}
                                            >
                                                {isStart && (
                                                    <div className="m-shift-block__info">
                                                        <span className="m-shift-block__name">{shift.dispatcherName}</span>
                                                        <span className="m-shift-block__time">
                                                            {formatHour(shift.startHour)} - {formatHour(shift.startHour + shift.duration)}
                                                        </span>
                                                    </div>
                                                )}
                                                {isDeleting && <Loader2 size={16} className="m-spin" />}
                                            </div>
                                        );
                                    })}
                                    {shiftsAtHour.length === 0 && (
                                        <div className="m-hour-empty">
                                            <Plus size={14} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="m-action-bar">
                <button
                    onClick={handleCopyPreviousWeek}
                    className="m-action-btn"
                    disabled={copying}
                >
                    <Copy size={18} />
                    <span>{copying ? "Copying..." : "Copy Week"}</span>
                </button>

                {isPublished ? (
                    <button
                        onClick={handleUnpublish}
                        className="m-action-btn m-action-btn--warning"
                        disabled={isLoading}
                    >
                        <Ban size={18} />
                        <span>{isLoading ? "..." : "Unpublish"}</span>
                    </button>
                ) : (
                    <button
                        onClick={handlePublish}
                        className="m-action-btn m-action-btn--primary"
                        disabled={isLoading || shifts.length === 0}
                    >
                        <Send size={18} />
                        <span>{isLoading ? "..." : "Publish"}</span>
                    </button>
                )}
            </div>

            {/* Add Shift Bottom Sheet */}
            {showAddSheet && (
                <div className="m-sheet-overlay" onClick={() => setShowAddSheet(false)}>
                    <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="m-sheet__handle" />
                        <div className="m-sheet__header">
                            <h3>Add Shift</h3>
                            <span>{DAY_FULL[selectedDay]} at {addShiftHour !== null ? formatHour(addShiftHour) : ""}</span>
                        </div>

                        <div className="m-sheet__content">
                            <div className="m-form-group">
                                <label>Dispatcher</label>
                                <div className="m-dispatcher-list">
                                    {dispatchers.map((d, i) => (
                                        <button
                                            key={d.id}
                                            className={`m-dispatcher-option ${selectedDispatcher === d.id ? "m-dispatcher-option--selected" : ""}`}
                                            style={{ "--d-color": getDispatcherColor(i) } as React.CSSProperties}
                                            onClick={() => setSelectedDispatcher(d.id)}
                                        >
                                            <div className="m-dispatcher-option__avatar">
                                                {(d.name || "?").slice(0, 2).toUpperCase()}
                                            </div>
                                            <span>{d.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="m-form-group">
                                <label>Duration</label>
                                <div className="m-duration-picker">
                                    {[4, 6, 8, 10, 12].map((h) => (
                                        <button
                                            key={h}
                                            className={`m-duration-btn ${shiftDuration === h ? "m-duration-btn--selected" : ""}`}
                                            onClick={() => setShiftDuration(h)}
                                        >
                                            {h}h
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                className="m-sheet__submit"
                                onClick={handleAddShift}
                                disabled={!selectedDispatcher || isLoading}
                            >
                                {isLoading ? <Loader2 size={18} className="m-spin" /> : "Create Shift"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Shift Bottom Sheet */}
            {editingShift && (
                <div className="m-sheet-overlay" onClick={() => setEditingShift(null)}>
                    <div className="m-sheet m-sheet--compact" onClick={(e) => e.stopPropagation()}>
                        <div className="m-sheet__handle" />
                        <div className="m-sheet__header">
                            <h3>{editingShift.dispatcherName}</h3>
                            <span>
                                {formatHour(editingShift.startHour)} - {formatHour(editingShift.startHour + editingShift.duration)}
                                ({editingShift.duration}h)
                            </span>
                        </div>

                        <div className="m-sheet__actions">
                            <button
                                className="m-sheet__action m-sheet__action--delete"
                                onClick={() => handleDeleteShift(editingShift.id)}
                                disabled={deletingShiftId === editingShift.id}
                            >
                                {deletingShiftId === editingShift.id ? (
                                    <Loader2 size={18} className="m-spin" />
                                ) : (
                                    <Trash2 size={18} />
                                )}
                                <span>Delete Shift</span>
                            </button>
                            <button
                                className="m-sheet__action"
                                onClick={() => setEditingShift(null)}
                            >
                                <X size={18} />
                                <span>Cancel</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
