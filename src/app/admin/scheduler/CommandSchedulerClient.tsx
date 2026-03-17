"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Download,
    Send,
    Ban,
    Clock,
    Plus,
    Minus,
    X,
    GripVertical,
    Radar,
    Copy,
    Loader2,
} from "lucide-react";
import {
    createSchedule,
    updateSchedule,
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
    formatHour,
    formatHourFull,
    formatShiftShort,
    getShiftDuration,
    getWeekStart,
    addDays,
    formatWeekLabel,
    isOvernightShift,
} from "@/types/schedule";
import "./scheduler-command.css";

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

const DAYS_IN_WEEK = 7;
const GRID_HOURS: number[] = Array.from({ length: 24 }, (_, i) => i); // 0-23
const HOUR_TO_ROW: Record<number, number> = {};
GRID_HOURS.forEach((h, i) => { HOUR_TO_ROW[h] = i; });

// Command Center color palette
const COLORS = [
    "#00f0ff", // Cyan
    "#f472b6", // Pink
    "#a78bfa", // Purple
    "#34d399", // Emerald
    "#fbbf24", // Amber
    "#fb7185", // Rose
    "#38bdf8", // Sky
    "#4ade80", // Green
    "#f97316", // Orange
    "#e879f9", // Fuchsia
];

// ============ Helpers ============

function getErrorMessage(errors?: { message: string }[] | string[]): string {
    if (!errors || errors.length === 0) return "An error occurred";
    const first = errors[0];
    return typeof first === "string" ? first : first.message;
}

function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? "#0a0d12" : "#ffffff";
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

/**
 * Convert schedule records to shift blocks for display
 * NO TIMEZONE CONVERSION - just use the integer hours directly
 */
function schedulesToBlocks(schedules: ScheduleRecord[], dispatchers: Dispatcher[], weekStart: Date): ShiftBlock[] {
    const blocks: ShiftBlock[] = [];

    for (const schedule of schedules) {
        // Get day index from date difference (0=Mon, 6=Sun)
        // Use Math.round to handle any sub-day rounding from timezone offsets
        const schedDate = new Date(schedule.date);
        const diffTime = schedDate.getTime() - weekStart.getTime();
        const dayIndex = Math.round(diffTime / (24 * 60 * 60 * 1000));

        if (dayIndex < 0 || dayIndex > 6) continue;

        const dispatcherIndex = dispatchers.findIndex((d) => d.id === schedule.userId);
        const duration = getShiftDuration(schedule.startHour, schedule.endHour);
        const overnight = isOvernightShift(schedule.startHour, schedule.endHour);

        blocks.push({
            id: schedule.id,
            dispatcherId: schedule.userId,
            dispatcherName: schedule.userName || "Unknown",
            dayIndex,
            startHour: schedule.startHour,
            endHour: schedule.endHour,
            duration,
            market: schedule.market,
            shiftType: schedule.shiftType,
            isPublished: schedule.isPublished,
            color: getShiftColor(schedule, dispatcherIndex),
            isOvernight: overnight,
        });
    }

    return blocks;
}

function calculateOverlapPositions(shifts: ShiftBlock[]): Map<string, { index: number; total: number }> {
    const positions = new Map<string, { index: number; total: number }>();
    const shiftsByDay: Map<number, ShiftBlock[]> = new Map();

    for (const shift of shifts) {
        if (!shiftsByDay.has(shift.dayIndex)) {
            shiftsByDay.set(shift.dayIndex, []);
        }
        shiftsByDay.get(shift.dayIndex)!.push(shift);
    }

    const shiftsOverlap = (a: ShiftBlock, b: ShiftBlock): boolean => {
        // Use hour sets for accurate overnight overlap detection
        const getHourSet = (start: number, end: number): Set<number> => {
            const hours = new Set<number>();
            if (end > start) {
                for (let h = start; h < end; h++) hours.add(h);
            } else {
                for (let h = start; h < 24; h++) hours.add(h);
                for (let h = 0; h < end; h++) hours.add(h);
            }
            return hours;
        };
        const aHours = getHourSet(a.startHour, a.endHour);
        const bHours = getHourSet(b.startHour, b.endHour);
        for (const h of aHours) {
            if (bHours.has(h)) return true;
        }
        return false;
    };

    for (const [, dayShifts] of shiftsByDay) {
        if (dayShifts.length === 0) continue;

        const overlaps: Map<string, Set<string>> = new Map();
        for (const shift of dayShifts) {
            overlaps.set(shift.id, new Set());
        }

        for (let i = 0; i < dayShifts.length; i++) {
            for (let j = i + 1; j < dayShifts.length; j++) {
                if (shiftsOverlap(dayShifts[i], dayShifts[j])) {
                    overlaps.get(dayShifts[i].id)!.add(dayShifts[j].id);
                    overlaps.get(dayShifts[j].id)!.add(dayShifts[i].id);
                }
            }
        }

        const visited = new Set<string>();
        const clusters: ShiftBlock[][] = [];

        for (const shift of dayShifts) {
            if (visited.has(shift.id)) continue;

            const cluster: ShiftBlock[] = [];
            const queue = [shift];

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current.id)) continue;
                visited.add(current.id);
                cluster.push(current);

                for (const neighborId of overlaps.get(current.id) || []) {
                    if (!visited.has(neighborId)) {
                        const neighbor = dayShifts.find(s => s.id === neighborId);
                        if (neighbor) queue.push(neighbor);
                    }
                }
            }

            if (cluster.length > 0) {
                cluster.sort((a, b) => a.startHour - b.startHour || a.dispatcherName.localeCompare(b.dispatcherName));
                clusters.push(cluster);
            }
        }

        for (const cluster of clusters) {
            const total = cluster.length;
            cluster.forEach((shift, index) => {
                positions.set(shift.id, { index, total });
            });
        }
    }

    return positions;
}

// ============ Component ============

interface Props {
    dispatchers: Dispatcher[];
    initialSchedules: ScheduleRecord[];
    initialWeekStart: string;
}

export default function CommandSchedulerClient({ dispatchers, initialSchedules, initialWeekStart }: Props) {
    const { addToast } = useToastContext();
    const [weekStart, setWeekStart] = useState<Date>(() => new Date(initialWeekStart));
    const [shifts, setShifts] = useState<ShiftBlock[]>(() =>
        schedulesToBlocks(initialSchedules, dispatchers, new Date(initialWeekStart))
    );
    const [selectedShiftType, setSelectedShiftType] = useState<ShiftType>("CUSTOM");
    const [customDuration, setCustomDuration] = useState(8);
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
    const [isPublished, setIsPublished] = useState(() =>
        initialSchedules.some((s) => s.isPublished)
    );
    const [dragState, setDragState] = useState<{
        type: "new" | "move";
        dispatcherId: string;
        dispatcherName: string;
        color: string;
        shiftId?: string;
        startHour: number;
        endHour: number;
    } | null>(null);
    const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 });
    const [highlightCell, setHighlightCell] = useState<{ day: number; hour: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const [focusedCell, setFocusedCell] = useState<{ day: number; hour: number } | null>(null);
    const [copying, setCopying] = useState(false);

    const gridRef = useRef<HTMLDivElement>(null);

    // Get shift start/end based on type
    const getShiftHours = useCallback((): { startHour: number; endHour: number } => {
        if (selectedShiftType === "CUSTOM") {
            // For custom, use the clicked hour as start
            return { startHour: 6, endHour: 6 + customDuration };
        }
        return SHIFT_PRESETS[selectedShiftType];
    }, [selectedShiftType, customDuration]);

    const overlapPositions = useMemo(() => calculateOverlapPositions(shifts), [shifts]);

    const dispatcherHoursMap = useMemo(() => {
        const hours = new Map<string, number>();
        shifts.forEach(s => {
            hours.set(s.dispatcherId, (hours.get(s.dispatcherId) || 0) + s.duration);
        });
        return hours;
    }, [shifts]);

    const loadWeekSchedules = useCallback(async (newWeekStart: Date) => {
        const result = await getWeekSchedules(newWeekStart);
        const blocks = schedulesToBlocks(result.schedules, dispatchers, newWeekStart);
        setShifts(blocks);
        setIsPublished(result.isPublished);
    }, [dispatchers]);

    // Real-time schedule updates
    const handleRealtimeChange = useCallback(() => {
        loadWeekSchedules(weekStart);
    }, [loadWeekSchedules, weekStart]);

    useRealtimeSchedule({
        weekStart,
        onAnyChange: handleRealtimeChange,
        enabled: true,
    });

    const goToPrevWeek = async () => {
        setIsNavigating(true);
        try {
            const newWeek = addDays(weekStart, -7);
            const normalized = getWeekStart(newWeek);
            setWeekStart(normalized);
            await loadWeekSchedules(normalized);
        } finally {
            setIsNavigating(false);
        }
    };

    const goToNextWeek = async () => {
        setIsNavigating(true);
        try {
            const newWeek = addDays(weekStart, 7);
            const normalized = getWeekStart(newWeek);
            setWeekStart(normalized);
            await loadWeekSchedules(normalized);
        } finally {
            setIsNavigating(false);
        }
    };

    const goToToday = async () => {
        setIsNavigating(true);
        try {
            const newWeek = getWeekStart(new Date());
            setWeekStart(newWeek);
            await loadWeekSchedules(newWeek);
        } finally {
            setIsNavigating(false);
        }
    };

    const getDateForDay = (dayIndex: number): Date => {
        return addDays(weekStart, dayIndex);
    };

    const isToday = (dayIndex: number): boolean => {
        const date = getDateForDay(dayIndex);
        const today = new Date();
        return date.getUTCDate() === today.getDate() &&
            date.getUTCMonth() === today.getMonth() &&
            date.getUTCFullYear() === today.getFullYear();
    };

    // Keyboard navigation
    const handleCellKeyDown = useCallback((e: React.KeyboardEvent, day: number, hour: number) => {
        let newDay = day;
        let newHour = hour;

        switch (e.key) {
            case "ArrowUp":
                e.preventDefault();
                newHour = Math.max(0, hour - 1);
                break;
            case "ArrowDown":
                e.preventDefault();
                newHour = Math.min(23, hour + 1);
                break;
            case "ArrowLeft":
                e.preventDefault();
                newDay = Math.max(0, day - 1);
                break;
            case "ArrowRight":
                e.preventDefault();
                newDay = Math.min(6, day + 1);
                break;
            default:
                return;
        }

        setFocusedCell({ day: newDay, hour: newHour });
        const cellId = `cell-${newDay}-${newHour}`;
        const cell = document.getElementById(cellId);
        cell?.focus();
    }, []);

    const handleDispatcherDragStart = (dispatcher: Dispatcher, e: React.DragEvent) => {
        const index = dispatchers.findIndex((d) => d.id === dispatcher.id);
        const { startHour, endHour } = getShiftHours();
        setDragState({
            type: "new",
            dispatcherId: dispatcher.id,
            dispatcherName: dispatcher.name || "Unknown",
            color: selectedMarket ? MARKET_COLORS[selectedMarket] : getDispatcherColor(index),
            startHour,
            endHour,
        });
        e.dataTransfer.setData("text/plain", dispatcher.id);
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleShiftDragStart = (shift: ShiftBlock, e: React.DragEvent) => {
        setDragState({
            type: "move",
            dispatcherId: shift.dispatcherId,
            dispatcherName: shift.dispatcherName,
            color: shift.color,
            shiftId: shift.id,
            startHour: shift.startHour,
            endHour: shift.endHour,
        });
        e.dataTransfer.setData("text/plain", shift.id);
        e.dataTransfer.effectAllowed = "move";
    };

    const getCellFromPosition = (e: React.DragEvent): { day: number; hour: number } | null => {
        if (!gridRef.current) return null;

        const rect = gridRef.current.getBoundingClientRect();
        const scrollLeft = gridRef.current.scrollLeft;
        const scrollTop = gridRef.current.scrollTop;

        const x = e.clientX - rect.left + scrollLeft - 64;
        const y = e.clientY - rect.top + scrollTop - 48;

        if (x < 0 || y < 0) return null;

        const cellWidth = (gridRef.current.scrollWidth - 64) / 7;
        const cellHeight = 28;

        const day = Math.floor(x / cellWidth);
        const rowIndex = Math.floor(y / cellHeight);

        if (day < 0 || day >= 7 || rowIndex < 0 || rowIndex >= 24) return null;

        return { day, hour: rowIndex };
    };

    const handleCellDragOver = (day: number, hour: number, e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = dragState?.type === "new" ? "copy" : "move";
        setHighlightCell({ day, hour });
        setGhostPosition({ x: e.clientX, y: e.clientY });
    };

    const handleOverlayDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = dragState?.type === "new" ? "copy" : "move";
        const cell = getCellFromPosition(e);
        if (cell) {
            setHighlightCell(cell);
        }
        setGhostPosition({ x: e.clientX, y: e.clientY });
    };

    const handleOverlayDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const cell = getCellFromPosition(e);
        if (cell) {
            await handleCellDrop(cell.day, cell.hour);
        }
    };

    const handleCellDrop = async (dayIndex: number, clickedHour: number) => {
        if (!dragState) return;

        const date = getDateForDay(dayIndex);
        let startHour: number;
        let endHour: number;

        if (dragState.type === "new") {
            // For new shifts, use the clicked hour as start
            if (selectedShiftType === "CUSTOM") {
                startHour = clickedHour;
                endHour = (clickedHour + customDuration) % 24;
            } else {
                const preset = SHIFT_PRESETS[selectedShiftType];
                startHour = preset.startHour;
                endHour = preset.endHour;
            }

            const result = await createSchedule({
                userId: dragState.dispatcherId,
                date,
                startHour,
                endHour,
                market: selectedMarket,
                shiftType: selectedShiftType,
            });

            if (result.success && result.schedule) {
                const dispatcherIndex = dispatchers.findIndex((d) => d.id === dragState.dispatcherId);
                setShifts((prev) => [
                    ...prev,
                    {
                        id: result.schedule!.id,
                        dispatcherId: dragState.dispatcherId,
                        dispatcherName: dragState.dispatcherName,
                        dayIndex,
                        startHour,
                        endHour,
                        duration: getShiftDuration(startHour, endHour),
                        market: selectedMarket,
                        shiftType: selectedShiftType,
                        isPublished: false,
                        color: selectedMarket ? MARKET_COLORS[selectedMarket] : getDispatcherColor(dispatcherIndex),
                        isOvernight: isOvernightShift(startHour, endHour),
                    },
                ]);
                addToast(`Shift created for ${dragState.dispatcherName}`, "success");
            } else {
                addToast(getErrorMessage(result.errors), "error");
            }
        } else if (dragState.type === "move" && dragState.shiftId) {
            // For moves, use the clicked hour as new start, keep same duration
            const originalDuration = getShiftDuration(dragState.startHour, dragState.endHour);
            startHour = clickedHour;
            endHour = (clickedHour + originalDuration) % 24;

            const result = await updateSchedule(dragState.shiftId, {
                date,
                startHour,
                endHour,
            });

            if (result.success) {
                setShifts((prev) =>
                    prev.map((s) =>
                        s.id === dragState.shiftId
                            ? {
                                ...s,
                                dayIndex,
                                startHour,
                                endHour,
                                duration: originalDuration,
                                isOvernight: isOvernightShift(startHour, endHour),
                            }
                            : s
                    )
                );
            } else {
                addToast(getErrorMessage(result.errors), "error");
            }
        }

        setDragState(null);
        setHighlightCell(null);
    };

    const handleDragEnd = () => {
        setDragState(null);
        setHighlightCell(null);
    };

    const handleDeleteShift = async (shiftId: string) => {
        setActionInProgress(shiftId);
        try {
            const result = await deleteSchedule(shiftId);
            if (result.success) {
                setShifts((prev) => prev.filter((s) => s.id !== shiftId));
            } else {
                addToast(result.error || "Failed to delete shift", "error");
            }
        } finally {
            setActionInProgress(null);
        }
    };

    const handlePublish = async () => {
        setIsLoading(true);
        const result = await publishWeek(weekStart);
        setIsLoading(false);

        if (result.success) {
            setShifts((prev) => prev.map((s) => ({ ...s, isPublished: true })));
            setIsPublished(true);
            addToast("Schedule published! Dispatchers have been notified.", "success");
        } else {
            addToast(result.error || "Failed to publish schedule", "error");
        }
    };

    const handleUnpublish = async () => {
        setIsLoading(true);
        const result = await unpublishWeek(weekStart);
        setIsLoading(false);

        if (result.success) {
            setShifts((prev) => prev.map((s) => ({ ...s, isPublished: false })));
            setIsPublished(false);
            addToast("Schedule unpublished", "info");
        } else {
            addToast(result.error || "Failed to unpublish schedule", "error");
        }
    };

    const handleCopyPreviousWeek = async () => {
        if (shifts.length > 0) {
            const confirmed = window.confirm(
                "This week already has schedules. Do you want to clear them and copy from last week?"
            );
            if (!confirmed) return;

            const clearResult = await clearWeekSchedules(weekStart);
            if (!clearResult.success) {
                addToast("Failed to clear existing schedules", "error");
                return;
            }
            setShifts([]);
        }

        setCopying(true);
        try {
            const result = await copyPreviousWeek(weekStart);

            if (result.success && result.copied > 0) {
                // Reload to get the new schedules
                await loadWeekSchedules(weekStart);
                addToast(`Copied ${result.copied} shifts from last week`, "success");
            } else {
                addToast(getErrorMessage(result.errors) || "No shifts to copy from last week", "warning");
            }
        } catch (error) {
            console.error("Failed to copy schedules:", error);
            addToast("Failed to copy schedules. Please try again.", "error");
        } finally {
            setCopying(false);
        }
    };

    const handleExport = () => {
        const lines = ["Day,Dispatcher,Start,End,Hours,Market"];
        for (let d = 0; d < DAYS_IN_WEEK; d++) {
            const dayShifts = shifts.filter((s) => s.dayIndex === d).sort((a, b) => a.startHour - b.startHour);
            for (const shift of dayShifts) {
                lines.push(
                    `${DAY_NAMES_FULL[d]},${shift.dispatcherName},${formatHourFull(shift.startHour)},${formatHourFull(shift.endHour)},${shift.duration},${shift.market || ""}`
                );
            }
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `schedule-${weekStart.toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getDispatcherHours = useCallback((dispatcherId: string): number => {
        return dispatcherHoursMap.get(dispatcherId) || 0;
    }, [dispatcherHoursMap]);

    const totalHours = shifts.reduce((sum, s) => sum + s.duration, 0);
    const coveragePercent = Math.round((totalHours / 168) * 100);

    return (
        <div className="cmd-scheduler">
            {/* Header */}
            <header className="cmd-header">
                <div className="cmd-header__brand">
                    <div className="cmd-logo">
                        <div className="cmd-logo__icon">
                            <Radar />
                        </div>
                        <span className="cmd-logo__text">Dispatch Command</span>
                    </div>
                    <div className={`cmd-status ${isPublished ? 'cmd-status--live' : ''}`}>
                        <span className="cmd-status__dot" />
                        {isPublished ? 'LIVE' : 'DRAFT'}
                    </div>
                </div>

                <div className="cmd-header__nav">
                    <button onClick={goToPrevWeek} className="cmd-nav-btn" disabled={isNavigating}>
                        {isNavigating ? <Loader2 size={18} className="cmd-spin" /> : <ChevronLeft size={18} />}
                    </button>
                    <div className="cmd-week-display">
                        <span className="cmd-week-display__label">Week</span>
                        <span className="cmd-week-display__range">{formatWeekLabel(weekStart)}</span>
                    </div>
                    <button onClick={goToNextWeek} className="cmd-nav-btn" disabled={isNavigating}>
                        {isNavigating ? <Loader2 size={18} className="cmd-spin" /> : <ChevronRight size={18} />}
                    </button>
                    <button onClick={goToToday} className="cmd-today-btn" disabled={isNavigating}>
                        {isNavigating ? "Loading..." : "Today"}
                    </button>
                </div>

                <div className="cmd-header__actions">
                    <button
                        onClick={handleCopyPreviousWeek}
                        className="cmd-btn cmd-btn--ghost"
                        disabled={copying}
                        title="Copy last week's schedule to this week"
                    >
                        <Copy size={14} />
                        {copying ? "Copying..." : "Copy Last Week"}
                    </button>
                    <button onClick={handleExport} className="cmd-btn cmd-btn--ghost">
                        <Download size={14} />
                        Export
                    </button>
                    {isPublished ? (
                        <button
                            onClick={handleUnpublish}
                            className="cmd-btn cmd-btn--warning"
                            disabled={isLoading}
                        >
                            <Ban size={14} />
                            {isLoading ? "Saving..." : "Unpublish"}
                        </button>
                    ) : (
                        <button
                            onClick={handlePublish}
                            className="cmd-btn cmd-btn--primary"
                            disabled={isLoading || shifts.length === 0}
                        >
                            <Send size={14} />
                            {isLoading ? "Publishing..." : "Publish Week"}
                        </button>
                    )}
                </div>
            </header>

            {/* Main Layout */}
            <div className="cmd-main">
                {/* Sidebar */}
                <aside className="cmd-sidebar">
                    <div className="cmd-sidebar__header">
                        <span className="cmd-sidebar__title">Dispatchers</span>
                        <span className="cmd-sidebar__count">{dispatchers.length}</span>
                    </div>

                    <div className="cmd-dispatchers">
                        {dispatchers.map((dispatcher, index) => {
                            const color = selectedMarket ? MARKET_COLORS[selectedMarket] : getDispatcherColor(index);
                            return (
                                <div
                                    key={dispatcher.id}
                                    className="cmd-dispatcher"
                                    style={{ '--dispatcher-color': color } as React.CSSProperties}
                                    draggable
                                    onDragStart={(e) => handleDispatcherDragStart(dispatcher, e)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="cmd-dispatcher__avatar">
                                        {(dispatcher.name || "?").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="cmd-dispatcher__info">
                                        <span className="cmd-dispatcher__name">{dispatcher.name || "Unknown"}</span>
                                        <div className="cmd-dispatcher__meta">
                                            <span className="cmd-dispatcher__hours">{getDispatcherHours(dispatcher.id)}h</span>
                                            <span>this week</span>
                                        </div>
                                    </div>
                                    <GripVertical size={14} className="cmd-dispatcher__grip" />
                                </div>
                            );
                        })}
                        {dispatchers.length === 0 && (
                            <p style={{ color: 'var(--cmd-text-dim)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                                No dispatchers found
                            </p>
                        )}
                    </div>

                    {/* Shift Type Selection */}
                    <div className="cmd-sidebar__section">
                        <div className="cmd-section-title">Shift Type</div>
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
                        {selectedShiftType === "CUSTOM" && (
                            <div className="cmd-duration">
                                <button
                                    onClick={() => setCustomDuration((d) => Math.max(1, d - 1))}
                                    className="cmd-duration__btn"
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="cmd-duration__value">
                                    {customDuration}
                                    <span className="cmd-duration__unit">h</span>
                                </span>
                                <button
                                    onClick={() => setCustomDuration((d) => Math.min(24, d + 1))}
                                    className="cmd-duration__btn"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Market Selection */}
                    <div className="cmd-sidebar__section">
                        <div className="cmd-section-title">Market</div>
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

                    {/* Coverage Gauge */}
                    <div className="cmd-sidebar__section">
                        <div className="cmd-section-title">Weekly Coverage</div>
                        <div className="cmd-coverage">
                            <div className="cmd-gauge" style={{ '--coverage': coveragePercent } as React.CSSProperties}>
                                <svg className="cmd-gauge__ring" viewBox="0 0 120 120">
                                    <circle className="cmd-gauge__bg" cx="60" cy="60" r="50" />
                                    <circle className="cmd-gauge__fill" cx="60" cy="60" r="50" />
                                </svg>
                                <div className="cmd-gauge__center">
                                    <span className="cmd-gauge__value">{coveragePercent}%</span>
                                    <span className="cmd-gauge__label">Coverage</span>
                                </div>
                            </div>
                            <div className="cmd-coverage-stats">
                                <div className="cmd-stat">
                                    <div className="cmd-stat__value">{totalHours}</div>
                                    <div className="cmd-stat__label">Hours</div>
                                </div>
                                <div className="cmd-stat">
                                    <div className="cmd-stat__value">168</div>
                                    <div className="cmd-stat__label">Target</div>
                                </div>
                                <div className={`cmd-stat ${isPublished ? 'cmd-stat--success' : 'cmd-stat--warning'}`}>
                                    <div className="cmd-stat__value">{shifts.length}</div>
                                    <div className="cmd-stat__label">Shifts</div>
                                </div>
                                <div className="cmd-stat">
                                    <div className="cmd-stat__value">{168 - totalHours}</div>
                                    <div className="cmd-stat__label">Gap</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Grid Container */}
                <div className="cmd-grid-container">
                    {isNavigating && (
                        <div className="cmd-grid-loading">
                            <Loader2 size={32} className="cmd-spin cmd-grid-loading__spinner" />
                        </div>
                    )}
                    <div className="cmd-grid-wrapper" ref={gridRef}>
                        <div
                            className="cmd-grid"
                            role="grid"
                            aria-label="Weekly schedule grid - drag dispatchers to create shifts"
                        >
                            {/* Corner */}
                            <div className="cmd-grid__corner" role="presentation">
                                <Clock size={16} className="cmd-grid__corner-icon" aria-hidden="true" />
                            </div>

                            {/* Day Headers - Monday first */}
                            {DAY_NAMES.map((day, i) => {
                                const date = getDateForDay(i);
                                const today = isToday(i);
                                return (
                                    <div
                                        key={day}
                                        className={`cmd-day-header ${today ? 'cmd-day-header--today' : ''}`}
                                        role="columnheader"
                                        aria-label={`${DAY_NAMES_FULL[i]}, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`}
                                    >
                                        <span className="cmd-day-header__name">{day}</span>
                                        <span className="cmd-day-header__date">{date.getUTCDate()}</span>
                                    </div>
                                );
                            })}

                            {/* Time labels and cells */}
                            {GRID_HOURS.map((hour, rowIndex) => (
                                <React.Fragment key={`row-${hour}`}>
                                    <div
                                        className={`cmd-time-label ${hour === 6 || hour === 14 || hour === 22 ? 'cmd-time-label--shift-start' : ''}`}
                                        role="rowheader"
                                        aria-label={formatHourFull(hour)}
                                    >
                                        {formatHour(hour)}
                                    </div>

                                    {Array.from({ length: DAYS_IN_WEEK }).map((_, dayIndex) => (
                                        <div
                                            id={`cell-${dayIndex}-${hour}`}
                                            key={`cell-${dayIndex}-${hour}`}
                                            className={`cmd-cell ${hour === 6 || hour === 14 || hour === 22 ? 'cmd-cell--shift-boundary' : ''} ${highlightCell?.day === dayIndex && highlightCell?.hour === hour ? 'cmd-cell--highlight' : ''} ${focusedCell?.day === dayIndex && focusedCell?.hour === hour ? 'cmd-cell--focused' : ''}`}
                                            role="gridcell"
                                            tabIndex={rowIndex === 0 && dayIndex === 0 ? 0 : -1}
                                            aria-label={`${DAY_NAMES_FULL[dayIndex]} at ${formatHourFull(hour)}. Press Enter to create shift.`}
                                            onDragOver={(e) => handleCellDragOver(dayIndex, hour, e)}
                                            onDrop={() => handleCellDrop(dayIndex, hour)}
                                            onKeyDown={(e) => handleCellKeyDown(e, dayIndex, hour)}
                                            onFocus={() => setFocusedCell({ day: dayIndex, hour })}
                                        />
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Shift blocks overlay */}
                        <div
                            className="cmd-shifts-overlay"
                            onDragOver={handleOverlayDragOver}
                            onDrop={handleOverlayDrop}
                        >
                            {shifts.map((shift) => {
                                const rowIndex = HOUR_TO_ROW[shift.startHour];
                                const top = rowIndex * 28 + 48;

                                const position = overlapPositions.get(shift.id) || { index: 0, total: 1 };
                                const { index: overlapIndex, total: overlapTotal } = position;

                                const dayWidth = 100 / 7;
                                const shiftWidth = dayWidth / overlapTotal;
                                const left = shift.dayIndex * dayWidth + (overlapIndex * shiftWidth);

                                // For overnight shifts, only show the first part (until midnight)
                                const displayDuration = shift.isOvernight
                                    ? (24 - shift.startHour)
                                    : shift.duration;
                                const height = displayDuration * 28;
                                const hasOverlap = overlapTotal > 1;

                                const isBeingDeleted = actionInProgress === shift.id;
                                const classNames = ["cmd-shift"];
                                if (shift.isOvernight) classNames.push("cmd-shift--overnight");
                                if (hasOverlap) classNames.push("cmd-shift--overlap");
                                if (isBeingDeleted) classNames.push("cmd-shift--deleting");

                                return (
                                    <div
                                        key={shift.id}
                                        className={classNames.join(" ")}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`${shift.dispatcherName}'s shift on ${DAY_NAMES_FULL[shift.dayIndex]}, ${formatShiftShort(shift.startHour, shift.endHour)}, ${shift.duration} hours${shift.isPublished ? ', published' : ', draft'}${shift.market ? `, ${shift.market} market` : ''}. Drag to move.`}
                                        style={{
                                            '--shift-color': shift.color,
                                            top: `${top}px`,
                                            left: `calc(${left}% + 2px)`,
                                            width: `calc(${shiftWidth}% - 4px)`,
                                            height: `${height}px`,
                                            color: getContrastColor(shift.color),
                                        } as React.CSSProperties}
                                        draggable={!isBeingDeleted}
                                        onDragStart={(e) => handleShiftDragStart(shift, e)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        {isBeingDeleted ? (
                                            <Loader2 size={16} className="cmd-spin cmd-shift__loader" />
                                        ) : (
                                            <>
                                                <span className="cmd-shift__name">{shift.dispatcherName}</span>
                                                <span className="cmd-shift__time">
                                                    {formatShiftShort(shift.startHour, shift.endHour)}
                                                </span>
                                                {shift.market && (
                                                    <span className="cmd-shift__market">{shift.market}</span>
                                                )}
                                            </>
                                        )}
                                        {!isBeingDeleted && (
                                            <button
                                                className="cmd-shift__delete"
                                                aria-label={`Delete ${shift.dispatcherName}'s shift`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteShift(shift.id);
                                                }}
                                            >
                                                <X size={10} aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ghost block */}
            {dragState && (
                <div
                    className="cmd-ghost"
                    style={{
                        '--ghost-color': dragState.color,
                        left: ghostPosition.x + 12,
                        top: ghostPosition.y - 20,
                        color: getContrastColor(dragState.color),
                    } as React.CSSProperties}
                >
                    <span className="cmd-ghost__name">{dragState.dispatcherName}</span>
                    <span className="cmd-ghost__time">
                        {formatShiftShort(dragState.startHour, dragState.endHour)}
                    </span>
                </div>
            )}
        </div>
    );
}
