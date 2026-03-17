"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Send,
    Ban,
    Plus,
    X,
    Trash2,
    Loader2,
    Copy,
} from "lucide-react";
import {
    createSchedule,
    deleteSchedule,
    publishWeek,
    unpublishWeek,
    getWeekSchedules,
    copyPreviousWeek,
    clearWeekSchedules,
} from "@/lib/schedulerActions";
import { useToastContext } from "@/components/ui/ToastProvider";
import ToggleGroup from "@/components/ui/ToggleGroup";
import { useRealtimeSchedule } from "@/hooks/useRealtimeSchedule";
import type { ScheduleRecord, Dispatcher, Market, ShiftType } from "@/types/schedule";
import {
    DAY_NAMES,
    DAY_NAMES_FULL,
    MARKET_COLORS,
    SHIFT_PRESETS,
    formatHourFull,
    formatShiftShort,
    getShiftDuration,
    getWeekStart,
    addDays,
    isOvernightShift,
} from "@/types/schedule";
import "./mobile-scheduler.css";

// ============ Types ============

interface ShiftBlock {
    id: string;
    dispatcherId: string;
    dispatcherName: string;
    dayIndex: number; // 0=Mon, 6=Sun
    startHour: number;
    endHour: number;
    duration: number;
    market: Market | null;
    shiftType: ShiftType;
    isPublished: boolean;
    color: string;
    isOvernight: boolean;
}

// ============ Constants ============

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const COLORS = [
    "#00f0ff", "#f472b6", "#a78bfa", "#34d399", "#fbbf24",
    "#fb7185", "#38bdf8", "#4ade80", "#f97316", "#e879f9",
];

// ============ Helpers ============

function getErrorMessage(errors?: { message: string }[] | string[]): string {
    if (!errors || errors.length === 0) return "An error occurred";
    const first = errors[0];
    return typeof first === "string" ? first : first.message;
}

function getDispatcherColor(index: number): string {
    return COLORS[index % COLORS.length];
}

function getShiftColor(shift: { market: Market | null }, dispatcherIndex: number): string {
    if (shift.market) {
        return MARKET_COLORS[shift.market];
    }
    return getDispatcherColor(dispatcherIndex);
}

function schedulesToBlocks(schedules: ScheduleRecord[], dispatchers: Dispatcher[], weekStart: Date): ShiftBlock[] {
    return schedules.map((schedule) => {
        const schedDate = new Date(schedule.date);
        // Use Math.round to handle any sub-day rounding from timezone offsets
        const diffTime = schedDate.getTime() - weekStart.getTime();
        const dayIndex = Math.round(diffTime / (24 * 60 * 60 * 1000));
        const dispatcherIndex = dispatchers.findIndex((d) => d.id === schedule.userId);
        const duration = getShiftDuration(schedule.startHour, schedule.endHour);

        return {
            id: schedule.id,
            dispatcherId: schedule.userId,
            dispatcherName: schedule.userName || "Unknown",
            dayIndex: Math.max(0, Math.min(6, dayIndex)),
            startHour: schedule.startHour,
            endHour: schedule.endHour,
            duration,
            market: schedule.market,
            shiftType: schedule.shiftType,
            isPublished: schedule.isPublished,
            color: getShiftColor(schedule, dispatcherIndex),
            isOvernight: isOvernightShift(schedule.startHour, schedule.endHour),
        };
    });
}

// ============ Component ============

interface Props {
    dispatchers: Dispatcher[];
    initialSchedules: ScheduleRecord[];
    initialWeekStart: string;
}

export default function MobileSchedulerClient({ dispatchers, initialSchedules, initialWeekStart }: Props) {
    const { addToast } = useToastContext();
    const [weekStart, setWeekStart] = useState<Date>(() => new Date(initialWeekStart));
    const [selectedDay, setSelectedDay] = useState(() => {
        // Get today's day index (0=Mon, 6=Sun)
        const today = new Date();
        const day = today.getDay();
        return day === 0 ? 6 : day - 1; // Convert Sun=0 to 6, Mon=1 to 0, etc.
    });
    const [shifts, setShifts] = useState<ShiftBlock[]>(() =>
        schedulesToBlocks(initialSchedules, dispatchers, new Date(initialWeekStart))
    );
    const [isPublished, setIsPublished] = useState(() =>
        initialSchedules.some((s) => s.isPublished)
    );
    const [isLoading, setIsLoading] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [showAddSheet, setShowAddSheet] = useState(false);
    const [addShiftHour, setAddShiftHour] = useState<number | null>(null);
    const [selectedDispatcher, setSelectedDispatcher] = useState<string | null>(null);
    const [selectedShiftType, setSelectedShiftType] = useState<ShiftType>("CUSTOM");
    const [customDuration, setCustomDuration] = useState(8);
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
    const [editingShift, setEditingShift] = useState<ShiftBlock | null>(null);
    const [deletingShiftId, setDeletingShiftId] = useState<string | null>(null);
    const [copying, setCopying] = useState(false);

    const timelineRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number>(0);

    const loadWeekSchedules = useCallback(async (newWeekStart: Date) => {
        setIsNavigating(true);
        try {
            const result = await getWeekSchedules(newWeekStart);
            const blocks = schedulesToBlocks(result.schedules, dispatchers, newWeekStart);
            setShifts(blocks);
            setIsPublished(result.isPublished);
        } finally {
            setIsNavigating(false);
        }
    }, [dispatchers]);

    // Real-time schedule updates
    const handleRealtimeChange = useCallback(() => {
        getWeekSchedules(weekStart).then((result) => {
            const blocks = schedulesToBlocks(result.schedules, dispatchers, weekStart);
            setShifts(blocks);
            setIsPublished(result.isPublished);
        });
    }, [weekStart, dispatchers]);

    useRealtimeSchedule({
        weekStart,
        onAnyChange: handleRealtimeChange,
        enabled: true,
    });

    const goToPrevWeek = async () => {
        const newWeek = getWeekStart(addDays(weekStart, -7));
        setWeekStart(newWeek);
        await loadWeekSchedules(newWeek);
    };

    const goToNextWeek = async () => {
        const newWeek = getWeekStart(addDays(weekStart, 7));
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
        return addDays(weekStart, dayIndex);
    };

    const formatDateHeader = (dayIndex: number): string => {
        const date = getDateForDay(dayIndex);
        return date.toLocaleDateString('en-US', {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        });
    };

    const dayShifts = useMemo(() => {
        return shifts.filter((s) => s.dayIndex === selectedDay).sort((a, b) => a.startHour - b.startHour);
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
            let startHour: number;
            let endHour: number;

            if (selectedShiftType === "CUSTOM") {
                startHour = addShiftHour;
                endHour = (addShiftHour + customDuration) % 24;
            } else {
                const preset = SHIFT_PRESETS[selectedShiftType];
                startHour = preset.startHour;
                endHour = preset.endHour;
            }

            const result = await createSchedule({
                userId: selectedDispatcher,
                date,
                startHour,
                endHour,
                market: selectedMarket,
                shiftType: selectedShiftType,
            });

            if (result.success && result.schedule) {
                const dispatcher = dispatchers.find((d) => d.id === selectedDispatcher);
                const dispatcherIndex = dispatchers.findIndex((d) => d.id === selectedDispatcher);
                const duration = getShiftDuration(startHour, endHour);

                setShifts((prev) => [
                    ...prev,
                    {
                        id: result.schedule!.id,
                        dispatcherId: selectedDispatcher,
                        dispatcherName: dispatcher?.name || "Unknown",
                        dayIndex: selectedDay,
                        startHour,
                        endHour,
                        duration,
                        market: selectedMarket,
                        shiftType: selectedShiftType,
                        isPublished: false,
                        color: selectedMarket ? MARKET_COLORS[selectedMarket] : getDispatcherColor(dispatcherIndex),
                        isOvernight: isOvernightShift(startHour, endHour),
                    },
                ]);
                addToast("Shift created", "success");
                setShowAddSheet(false);
                setSelectedDispatcher(null);
            } else {
                addToast(getErrorMessage(result.errors), "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteShift = async (shiftId: string) => {
        setDeletingShiftId(shiftId);
        try {
            const result = await deleteSchedule(shiftId);
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
            const result = await publishWeek(weekStart);
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
            const result = await unpublishWeek(weekStart);
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

    const handleCopyPreviousWeek = async () => {
        if (shifts.length > 0) {
            const confirmed = window.confirm(
                "This week already has schedules. Clear them first?"
            );
            if (!confirmed) return;

            const clearResult = await clearWeekSchedules(weekStart);
            if (!clearResult.success) {
                addToast("Failed to clear schedules", "error");
                return;
            }
            setShifts([]);
        }

        setCopying(true);
        try {
            const result = await copyPreviousWeek(weekStart);
            if (result.success && result.copied > 0) {
                await loadWeekSchedules(weekStart);
                addToast(`Copied ${result.copied} shifts`, "success");
            } else {
                addToast(getErrorMessage(result.errors) || "No shifts to copy", "warning");
            }
        } finally {
            setCopying(false);
        }
    };

    const totalHours = shifts.reduce((sum, s) => sum + s.duration, 0);

    // Check if hour is covered by a shift (accounting for overnight)
    const isHourCovered = (shift: ShiftBlock, hour: number): boolean => {
        if (shift.isOvernight) {
            // Overnight: e.g., 22-6 covers 22,23,0,1,2,3,4,5
            return hour >= shift.startHour || hour < shift.endHour;
        }
        return hour >= shift.startHour && hour < shift.endHour;
    };

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
                                    {weekStart.toLocaleDateString('en-US', { month: "short", timeZone: "UTC" })}
                                </span>
                                <span className="m-week-display__range">
                                    {weekStart.getUTCDate()} - {addDays(weekStart, 6).getUTCDate()}
                                </span>
                            </>
                        )}
                    </div>
                    <button onClick={goToNextWeek} className="m-nav-btn" disabled={isNavigating}>
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Day Selector - Monday first */}
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
                    <h2>{DAY_NAMES_FULL[selectedDay]}, {formatDateHeader(selectedDay)}</h2>
                    <span className="m-timeline__shift-count">
                        {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
                    </span>
                </div>

                <div className="m-timeline__grid">
                    {HOURS.map((hour) => {
                        const shiftsAtHour = dayShifts.filter((s) => isHourCovered(s, hour));

                        return (
                            <div key={hour} className="m-hour-row">
                                <div className="m-hour-label">{formatHourFull(hour)}</div>
                                <div
                                    className="m-hour-content"
                                    onClick={() => shiftsAtHour.length === 0 && handleHourTap(hour)}
                                >
                                    {shiftsAtHour.map((shift) => {
                                        const isStart = hour === shift.startHour;
                                        const isEnd = shift.isOvernight
                                            ? hour === (shift.endHour - 1 + 24) % 24
                                            : hour === shift.endHour - 1;
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
                                                            {formatShiftShort(shift.startHour, shift.endHour)}
                                                            {shift.market && ` · ${shift.market}`}
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
                            <span>{DAY_NAMES_FULL[selectedDay]} at {addShiftHour !== null ? formatHourFull(addShiftHour) : ""}</span>
                        </div>

                        <div className="m-sheet__content">
                            <div className="m-form-group">
                                <label>Dispatcher</label>
                                <div className="m-dispatcher-list">
                                    {dispatchers.map((d, i) => (
                                        <button
                                            key={d.id}
                                            className={`m-dispatcher-option ${selectedDispatcher === d.id ? "m-dispatcher-option--selected" : ""}`}
                                            style={{ "--d-color": selectedMarket ? MARKET_COLORS[selectedMarket] : getDispatcherColor(i) } as React.CSSProperties}
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
                                <label>Shift Type</label>
                                <ToggleGroup
                                    options={[
                                        { value: "MORNING", label: "6A-2P" },
                                        { value: "AFTERNOON", label: "2P-10P" },
                                        { value: "NIGHT", label: "10P-6A" },
                                        { value: "CUSTOM", label: "Custom" },
                                    ]}
                                    value={selectedShiftType}
                                    onChange={(v) => setSelectedShiftType(v as ShiftType)}
                                    size="sm"
                                    fullWidth
                                />
                            </div>

                            {selectedShiftType === "CUSTOM" && (
                                <div className="m-form-group">
                                    <label>Duration</label>
                                    <ToggleGroup
                                        options={[
                                            { value: "4", label: "4h" },
                                            { value: "6", label: "6h" },
                                            { value: "8", label: "8h" },
                                            { value: "10", label: "10h" },
                                            { value: "12", label: "12h" },
                                        ]}
                                        value={String(customDuration)}
                                        onChange={(v) => setCustomDuration(Number(v))}
                                        size="sm"
                                        fullWidth
                                    />
                                </div>
                            )}

                            <div className="m-form-group">
                                <label>Market (optional)</label>
                                <ToggleGroup
                                    options={[
                                        { value: "", label: "None" },
                                        { value: "DFW", label: "DFW", color: MARKET_COLORS.DFW },
                                        { value: "AUS", label: "AUS", color: MARKET_COLORS.AUS },
                                        { value: "SAT", label: "SAT", color: MARKET_COLORS.SAT },
                                    ]}
                                    value={selectedMarket ?? ""}
                                    onChange={(v) => setSelectedMarket((v || null) as Market | null)}
                                    size="sm"
                                    fullWidth
                                />
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
                                {formatShiftShort(editingShift.startHour, editingShift.endHour)}
                                {" "}({editingShift.duration}h)
                                {editingShift.market && ` · ${editingShift.market}`}
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
