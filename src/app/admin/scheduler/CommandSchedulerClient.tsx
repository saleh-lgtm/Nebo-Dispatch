"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
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
    Radio,
    Radar,
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
import "./scheduler-command.css";

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
    isCrossMidnight?: boolean;
    isContinuation?: boolean;
}

// Constants
const DAYS_IN_WEEK = 7;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHIFT_START = 23;

// Command Center color palette - vibrant, glowing colors
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

// Grid hour order
const GRID_HOURS: number[] = [];
for (let i = 0; i < 24; i++) GRID_HOURS.push((SHIFT_START + i) % 24);

const HOUR_TO_ROW: Record<number, number> = {};
GRID_HOURS.forEach((h, i) => { HOUR_TO_ROW[h] = i; });

function formatHour(h: number): string {
    if (h === 0) return "12a";
    if (h < 12) return `${h}a`;
    if (h === 12) return "12p";
    return `${h - 12}p`;
}

function formatHourFull(h: number): string {
    const hour = ((h % 24) + 24) % 24;
    if (hour === 0) return "12:00 AM";
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return "12:00 PM";
    return `${hour - 12}:00 PM`;
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

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function schedulesToBlocks(schedules: ScheduleData[], dispatchers: Dispatcher[], weekStart: Date): ShiftBlock[] {
    const blocks: ShiftBlock[] = [];

    for (const schedule of schedules) {
        const shiftStart = new Date(schedule.shiftStart);
        const shiftEnd = new Date(schedule.shiftEnd);

        const dayOfWeek = shiftStart.getUTCDay();
        const startHour = shiftStart.getUTCHours();
        const totalDuration = Math.ceil((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60));

        const dispatcherIndex = dispatchers.findIndex((d) => d.id === schedule.userId);
        const color = dispatcherIndex >= 0 ? getDispatcherColor(dispatcherIndex) : COLORS[0];

        const hoursUntilMidnight = 24 - startHour;

        if (totalDuration > hoursUntilMidnight && startHour !== 0) {
            blocks.push({
                id: schedule.id,
                dispatcherId: schedule.userId,
                dispatcherName: schedule.user.name || "Unknown",
                day: dayOfWeek,
                startHour,
                duration: hoursUntilMidnight,
                isPublished: schedule.isPublished,
                color,
                isCrossMidnight: true,
            });

            const nextDay = (dayOfWeek + 1) % 7;
            const remainingHours = totalDuration - hoursUntilMidnight;
            blocks.push({
                id: `${schedule.id}-cont`,
                dispatcherId: schedule.userId,
                dispatcherName: schedule.user.name || "Unknown",
                day: nextDay,
                startHour: 0,
                duration: remainingHours,
                isPublished: schedule.isPublished,
                color,
                isContinuation: true,
            });
        } else {
            blocks.push({
                id: schedule.id,
                dispatcherId: schedule.userId,
                dispatcherName: schedule.user.name || "Unknown",
                day: dayOfWeek,
                startHour,
                duration: totalDuration,
                isPublished: schedule.isPublished,
                color,
            });
        }
    }

    return blocks;
}

function calculateOverlapPositions(shifts: ShiftBlock[]): Map<string, { index: number; total: number }> {
    const positions = new Map<string, { index: number; total: number }>();
    const shiftsByDay: Map<number, ShiftBlock[]> = new Map();

    for (const shift of shifts) {
        if (!shiftsByDay.has(shift.day)) {
            shiftsByDay.set(shift.day, []);
        }
        shiftsByDay.get(shift.day)!.push(shift);
    }

    const shiftsOverlap = (a: ShiftBlock, b: ShiftBlock): boolean => {
        const aEnd = a.startHour + a.duration;
        const bEnd = b.startHour + b.duration;
        return !(aEnd <= b.startHour || bEnd <= a.startHour);
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

interface Props {
    dispatchers: Dispatcher[];
    initialSchedules: ScheduleData[];
    initialWeekStart: string;
}

export default function CommandSchedulerClient({ dispatchers, initialSchedules, initialWeekStart }: Props) {
    const [weekStart, setWeekStart] = useState<Date>(new Date(initialWeekStart));
    const [shifts, setShifts] = useState<ShiftBlock[]>(() =>
        schedulesToBlocks(initialSchedules, dispatchers, new Date(initialWeekStart))
    );
    const [defaultDuration, setDefaultDuration] = useState(8);
    const [isPublished, setIsPublished] = useState(() =>
        initialSchedules.some((s) => s.isPublished)
    );
    const [dragState, setDragState] = useState<{
        type: "new" | "move";
        dispatcherId: string;
        dispatcherName: string;
        color: string;
        shiftId?: string;
        duration: number;
    } | null>(null);
    const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 });
    const [highlightCell, setHighlightCell] = useState<{ day: number; hour: number } | null>(null);

    const gridRef = useRef<HTMLDivElement>(null);

    const overlapPositions = useMemo(() => calculateOverlapPositions(shifts), [shifts]);

    const dispatcherHoursMap = useMemo(() => {
        const hours = new Map<string, number>();
        shifts.forEach(s => {
            hours.set(s.dispatcherId, (hours.get(s.dispatcherId) || 0) + s.duration);
        });
        return hours;
    }, [shifts]);

    const loadWeekSchedules = useCallback(async (newWeekStart: Date) => {
        const schedules = await getWeekSchedules(newWeekStart);
        const blocks = schedulesToBlocks(schedules, dispatchers, newWeekStart);
        setShifts(blocks);
        setIsPublished(schedules.some((s) => s.isPublished));
    }, [dispatchers]);

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

    const goToToday = async () => {
        const newWeek = getWeekStart(new Date());
        setWeekStart(newWeek);
        await loadWeekSchedules(newWeek);
    };

    const formatWeekRange = () => {
        const start = new Date(weekStart);
        const end = new Date(weekStart);
        end.setUTCDate(end.getUTCDate() + 6);
        const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
        return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}, ${start.getUTCFullYear()}`;
    };

    const getDateForDay = (dayIndex: number): Date => {
        const date = new Date(weekStart);
        date.setUTCDate(date.getUTCDate() + dayIndex);
        return date;
    };

    const isToday = (dayIndex: number): boolean => {
        const date = getDateForDay(dayIndex);
        const today = new Date();
        return date.getUTCDate() === today.getUTCDate() &&
            date.getUTCMonth() === today.getUTCMonth() &&
            date.getUTCFullYear() === today.getUTCFullYear();
    };

    const handleDispatcherDragStart = (dispatcher: Dispatcher, e: React.DragEvent) => {
        const index = dispatchers.findIndex((d) => d.id === dispatcher.id);
        setDragState({
            type: "new",
            dispatcherId: dispatcher.id,
            dispatcherName: dispatcher.name || "Unknown",
            color: getDispatcherColor(index),
            duration: defaultDuration,
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
            duration: shift.duration,
        });
        e.dataTransfer.setData("text/plain", shift.id);
        e.dataTransfer.effectAllowed = "move";
    };

    // Calculate cell from mouse position (for drops on shifts overlay)
    const getCellFromPosition = (e: React.DragEvent): { day: number; hour: number } | null => {
        if (!gridRef.current) return null;

        const rect = gridRef.current.getBoundingClientRect();
        const scrollLeft = gridRef.current.scrollLeft;
        const scrollTop = gridRef.current.scrollTop;

        // Account for time column (64px) and header (48px)
        const x = e.clientX - rect.left + scrollLeft - 64;
        const y = e.clientY - rect.top + scrollTop - 48;

        if (x < 0 || y < 0) return null;

        const cellWidth = (gridRef.current.scrollWidth - 64) / 7;
        const cellHeight = 28;

        const day = Math.floor(x / cellWidth);
        const rowIndex = Math.floor(y / cellHeight);

        if (day < 0 || day >= 7 || rowIndex < 0 || rowIndex >= 24) return null;

        const hour = GRID_HOURS[rowIndex];
        return { day, hour };
    };

    const handleCellDragOver = (day: number, hour: number, e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = dragState?.type === "new" ? "copy" : "move";
        setHighlightCell({ day, hour });
        setGhostPosition({ x: e.clientX, y: e.clientY });
    };

    // Handle drag over shifts overlay (for drops on existing shifts)
    const handleOverlayDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = dragState?.type === "new" ? "copy" : "move";
        const cell = getCellFromPosition(e);
        if (cell) {
            setHighlightCell(cell);
        }
        setGhostPosition({ x: e.clientX, y: e.clientY });
    };

    // Handle drop on shifts overlay
    const handleOverlayDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const cell = getCellFromPosition(e);
        if (cell) {
            await handleCellDrop(cell.day, cell.hour);
        }
    };

    const handleCellDrop = async (day: number, hour: number) => {
        if (!dragState) return;

        const date = getDateForDay(day);
        const shiftStart = new Date(date);
        shiftStart.setUTCHours(hour, 0, 0, 0);

        const shiftEnd = new Date(shiftStart);
        shiftEnd.setUTCHours(shiftEnd.getUTCHours() + dragState.duration);

        if (dragState.type === "new") {
            const newSchedule = await createScheduleBlock({
                userId: dragState.dispatcherId,
                shiftStart,
                shiftEnd,
            });

            if (newSchedule) {
                const dispatcherIndex = dispatchers.findIndex((d) => d.id === dragState.dispatcherId);
                setShifts((prev) => [
                    ...prev,
                    {
                        id: newSchedule.id,
                        dispatcherId: dragState.dispatcherId,
                        dispatcherName: dragState.dispatcherName,
                        day,
                        startHour: hour,
                        duration: dragState.duration,
                        isPublished: false,
                        color: getDispatcherColor(dispatcherIndex),
                    },
                ]);
            }
        } else if (dragState.type === "move" && dragState.shiftId) {
            await updateScheduleBlock(dragState.shiftId, {
                shiftStart,
                shiftEnd,
            });

            setShifts((prev) =>
                prev.map((s) =>
                    s.id === dragState.shiftId
                        ? { ...s, day, startHour: hour }
                        : s
                )
            );
        }

        setDragState(null);
        setHighlightCell(null);
    };

    const handleDragEnd = () => {
        setDragState(null);
        setHighlightCell(null);
    };

    const handleDeleteShift = async (shiftId: string) => {
        await deleteScheduleBlock(shiftId);
        setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    };

    const handlePublish = async () => {
        await publishWeekSchedules(weekStart);
        setShifts((prev) => prev.map((s) => ({ ...s, isPublished: true })));
        setIsPublished(true);
    };

    const handleUnpublish = async () => {
        await unpublishWeekSchedules(weekStart);
        setShifts((prev) => prev.map((s) => ({ ...s, isPublished: false })));
        setIsPublished(false);
    };

    const [copying, setCopying] = useState(false);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);

    const handleCopyPreviousWeek = async () => {
        if (shifts.length > 0) {
            const confirmed = window.confirm(
                "This week already has schedules. Copy will only work on empty weeks. Do you want to clear all schedules first?"
            );
            if (!confirmed) return;

            // Delete all current week schedules
            for (const shift of shifts) {
                await deleteScheduleBlock(shift.id);
            }
            setShifts([]);
        }

        setCopying(true);
        setCopyMessage(null);
        try {
            const result = await copyPreviousWeekSchedules(weekStart);
            setCopyMessage(result.message);

            if (result.copied > 0 && result.schedules) {
                // Convert to shift blocks and update state
                const newBlocks = schedulesToBlocks(result.schedules, dispatchers, weekStart);
                setShifts(newBlocks);
            }

            // Clear message after 3 seconds
            setTimeout(() => setCopyMessage(null), 3000);
        } catch (error) {
            console.error("Failed to copy schedules:", error);
            setCopyMessage("Failed to copy schedules");
        } finally {
            setCopying(false);
        }
    };

    const handleExport = () => {
        const lines = ["Day,Dispatcher,Start,End,Hours"];
        for (let d = 0; d < DAYS_IN_WEEK; d++) {
            const dayShifts = shifts.filter((s) => s.day === d).sort((a, b) => a.startHour - b.startHour);
            for (const shift of dayShifts) {
                lines.push(
                    `${DAY_FULL[d]},${shift.dispatcherName},${formatHourFull(shift.startHour)},${formatHourFull(shift.startHour + shift.duration)},${shift.duration}`
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
                    <button onClick={goToPrevWeek} className="cmd-nav-btn">
                        <ChevronLeft size={18} />
                    </button>
                    <div className="cmd-week-display">
                        <span className="cmd-week-display__label">Week</span>
                        <span className="cmd-week-display__range">{formatWeekRange()}</span>
                    </div>
                    <button onClick={goToNextWeek} className="cmd-nav-btn">
                        <ChevronRight size={18} />
                    </button>
                    <button onClick={goToToday} className="cmd-today-btn">
                        Today
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
                        <button onClick={handleUnpublish} className="cmd-btn cmd-btn--warning">
                            <Ban size={14} />
                            Unpublish
                        </button>
                    ) : (
                        <button onClick={handlePublish} className="cmd-btn cmd-btn--primary">
                            <Send size={14} />
                            Publish Week
                        </button>
                    )}
                </div>
                {copyMessage && (
                    <div className="cmd-toast" style={{
                        position: "fixed",
                        bottom: "1rem",
                        right: "1rem",
                        padding: "0.75rem 1rem",
                        background: copyMessage.includes("Copied") ? "rgba(74, 222, 128, 0.2)" : "rgba(251, 191, 36, 0.2)",
                        border: `1px solid ${copyMessage.includes("Copied") ? "#4ade80" : "#fbbf24"}`,
                        borderRadius: "6px",
                        color: copyMessage.includes("Copied") ? "#4ade80" : "#fbbf24",
                        fontSize: "0.875rem",
                        zIndex: 1000,
                    }}>
                        {copyMessage}
                    </div>
                )}
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
                            const color = getDispatcherColor(index);
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

                    {/* Duration Control */}
                    <div className="cmd-sidebar__section">
                        <div className="cmd-section-title">Shift Duration</div>
                        <div className="cmd-duration">
                            <button
                                onClick={() => setDefaultDuration((d) => Math.max(1, d - 1))}
                                className="cmd-duration__btn"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="cmd-duration__value">
                                {defaultDuration}
                                <span className="cmd-duration__unit">h</span>
                            </span>
                            <button
                                onClick={() => setDefaultDuration((d) => Math.min(24, d + 1))}
                                className="cmd-duration__btn"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
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
                    <div className="cmd-grid-wrapper" ref={gridRef}>
                        <div className="cmd-grid">
                            {/* Corner */}
                            <div className="cmd-grid__corner">
                                <Clock size={16} className="cmd-grid__corner-icon" />
                            </div>

                            {/* Day Headers */}
                            {DAY_NAMES.map((day, i) => {
                                const date = getDateForDay(i);
                                const today = isToday(i);
                                return (
                                    <div
                                        key={day}
                                        className={`cmd-day-header ${today ? 'cmd-day-header--today' : ''}`}
                                    >
                                        <span className="cmd-day-header__name">{day}</span>
                                        <span className="cmd-day-header__date">{date.getUTCDate()}</span>
                                    </div>
                                );
                            })}

                            {/* Time labels and cells */}
                            {GRID_HOURS.map((hour) => (
                                <React.Fragment key={`row-${hour}`}>
                                    <div
                                        className={`cmd-time-label ${hour === 23 || hour === 7 || hour === 15 ? 'cmd-time-label--shift-start' : ''}`}
                                    >
                                        {formatHour(hour)}
                                    </div>

                                    {Array.from({ length: DAYS_IN_WEEK }).map((_, dayIndex) => (
                                        <div
                                            key={`cell-${dayIndex}-${hour}`}
                                            className={`cmd-cell ${hour === 23 || hour === 7 || hour === 15 ? 'cmd-cell--shift-boundary' : ''} ${highlightCell?.day === dayIndex && highlightCell?.hour === hour ? 'cmd-cell--highlight' : ''}`}
                                            onDragOver={(e) => handleCellDragOver(dayIndex, hour, e)}
                                            onDrop={() => handleCellDrop(dayIndex, hour)}
                                        />
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Shift blocks overlay - handles drops on existing shifts */}
                        <div
                            className="cmd-shifts-overlay"
                            onDragOver={handleOverlayDragOver}
                            onDrop={handleOverlayDrop}
                        >
                            {shifts.map((shift) => {
                                const rowIndex = HOUR_TO_ROW[shift.startHour];
                                const top = rowIndex * 28 + 48; // 28px row height + 48px header

                                const position = overlapPositions.get(shift.id) || { index: 0, total: 1 };
                                const { index: overlapIndex, total: overlapTotal } = position;

                                const dayWidth = 100 / 7;
                                const shiftWidth = dayWidth / overlapTotal;
                                const left = shift.day * dayWidth + (overlapIndex * shiftWidth);

                                const height = shift.duration * 28;
                                const hasOverlap = overlapTotal > 1;

                                const classNames = ["cmd-shift"];
                                if (shift.isCrossMidnight) classNames.push("cmd-shift--cross-midnight");
                                if (shift.isContinuation) classNames.push("cmd-shift--continuation");
                                if (hasOverlap) classNames.push("cmd-shift--overlap");

                                return (
                                    <div
                                        key={shift.id}
                                        className={classNames.join(" ")}
                                        style={{
                                            '--shift-color': shift.color,
                                            top: `${top}px`,
                                            left: `calc(${left}% + 2px)`,
                                            width: `calc(${shiftWidth}% - 4px)`,
                                            height: `${height}px`,
                                            color: getContrastColor(shift.color),
                                        } as React.CSSProperties}
                                        draggable={!shift.isContinuation}
                                        onDragStart={(e) => !shift.isContinuation && handleShiftDragStart(shift, e)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <span className="cmd-shift__name">{shift.dispatcherName}</span>
                                        <span className="cmd-shift__time">
                                            {formatHourFull(shift.startHour)} – {formatHourFull(shift.startHour + shift.duration)}
                                        </span>
                                        {!shift.isContinuation && (
                                            <button
                                                className="cmd-shift__delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteShift(shift.id);
                                                }}
                                            >
                                                <X size={10} />
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
                    <span className="cmd-ghost__time">{dragState.duration}h shift</span>
                </div>
            )}
        </div>
    );
}
