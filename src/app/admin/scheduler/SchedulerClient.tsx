"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Download,
    Send,
    Ban,
    Users,
    Clock,
    Plus,
    Minus,
    X,
    GripVertical,
} from "lucide-react";
import {
    createScheduleBlock,
    updateScheduleBlock,
    deleteScheduleBlock,
    publishWeekSchedules,
    unpublishWeekSchedules,
    getWeekSchedules,
} from "@/lib/schedulerActions";

// Helper to get start of week (Sunday 00:00:00)
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}
import "./scheduler.css";

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
const HOURS_IN_DAY = 24;
const DAYS_IN_WEEK = 7;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHIFT_START = 23; // Grid starts at 11 PM

// Color palette for dispatchers
const COLORS = [
    "#4ECDC4", "#FF6B6B", "#FFE66D", "#45B7D1", "#96CEB4",
    "#C3A6FF", "#FF8A5C", "#EA6FC4", "#6BCB77", "#4D96FF",
];

// Grid hour order: starts at 11 PM (23), wraps through midnight to 10 PM (22)
const GRID_HOURS: number[] = [];
for (let i = 0; i < 24; i++) GRID_HOURS.push((SHIFT_START + i) % 24);

// Lookup: actual hour -> grid row index
const HOUR_TO_ROW: Record<number, number> = {};
GRID_HOURS.forEach((h, i) => { HOUR_TO_ROW[h] = i; });

function formatHour(h: number): string {
    if (h === 0) return "12a";
    if (h < 12) return h + "a";
    if (h === 12) return "12p";
    return (h - 12) + "p";
}

function formatHourFull(h: number): string {
    const hour = ((h % 24) + 24) % 24;
    if (hour === 0) return "12:00 AM";
    if (hour < 12) return hour + ":00 AM";
    if (hour === 12) return "12:00 PM";
    return (hour - 12) + ":00 PM";
}

function getContrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? "#1a1a2e" : "#ffffff";
}

function getDispatcherColor(index: number): string {
    return COLORS[index % COLORS.length];
}

// Convert schedule data to shift blocks
function schedulesToBlocks(schedules: ScheduleData[], dispatchers: Dispatcher[], weekStart: Date): ShiftBlock[] {
    return schedules.map((schedule) => {
        const shiftStart = new Date(schedule.shiftStart);
        const shiftEnd = new Date(schedule.shiftEnd);

        const dayOfWeek = shiftStart.getDay();
        const startHour = shiftStart.getHours();
        const duration = Math.round((shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60));

        const dispatcherIndex = dispatchers.findIndex((d) => d.id === schedule.userId);

        return {
            id: schedule.id,
            dispatcherId: schedule.userId,
            dispatcherName: schedule.user.name || "Unknown",
            day: dayOfWeek,
            startHour,
            duration,
            isPublished: schedule.isPublished,
            color: getDispatcherColor(dispatcherIndex),
        };
    });
}

interface Props {
    dispatchers: Dispatcher[];
    initialSchedules: ScheduleData[];
    initialWeekStart: string;
}

export default function SchedulerClient({ dispatchers, initialSchedules, initialWeekStart }: Props) {
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

    // Load schedules when week changes
    const loadWeekSchedules = useCallback(async (newWeekStart: Date) => {
        const schedules = await getWeekSchedules(newWeekStart);
        const blocks = schedulesToBlocks(schedules, dispatchers, newWeekStart);
        setShifts(blocks);
        setIsPublished(schedules.some((s) => s.isPublished));
    }, [dispatchers]);

    // Navigate weeks
    const goToPrevWeek = async () => {
        const newWeek = new Date(weekStart);
        newWeek.setDate(newWeek.getDate() - 7);
        setWeekStart(newWeek);
        await loadWeekSchedules(newWeek);
    };

    const goToNextWeek = async () => {
        const newWeek = new Date(weekStart);
        newWeek.setDate(newWeek.getDate() + 7);
        setWeekStart(newWeek);
        await loadWeekSchedules(newWeek);
    };

    const goToToday = async () => {
        const newWeek = getWeekStart(new Date());
        setWeekStart(newWeek);
        await loadWeekSchedules(newWeek);
    };

    // Format week display
    const formatWeekRange = () => {
        const start = new Date(weekStart);
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
        return `${start.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, opts)}, ${start.getFullYear()}`;
    };

    // Get date for a day column
    const getDateForDay = (dayIndex: number): Date => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + dayIndex);
        return date;
    };

    // Handle drag start from dispatcher panel
    const handleDispatcherDragStart = (dispatcher: Dispatcher, e: React.DragEvent) => {
        const index = dispatchers.findIndex((d) => d.id === dispatcher.id);
        setDragState({
            type: "new",
            dispatcherId: dispatcher.id,
            dispatcherName: dispatcher.name || "Unknown",
            color: getDispatcherColor(index),
            duration: defaultDuration,
        });
        e.dataTransfer.effectAllowed = "copy";
    };

    // Handle drag start from existing shift
    const handleShiftDragStart = (shift: ShiftBlock, e: React.DragEvent) => {
        setDragState({
            type: "move",
            dispatcherId: shift.dispatcherId,
            dispatcherName: shift.dispatcherName,
            color: shift.color,
            shiftId: shift.id,
            duration: shift.duration,
        });
        e.dataTransfer.effectAllowed = "move";
    };

    // Handle drag over cell
    const handleCellDragOver = (day: number, hour: number, e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = dragState?.type === "new" ? "copy" : "move";
        setHighlightCell({ day, hour });
        setGhostPosition({ x: e.clientX, y: e.clientY });
    };

    // Handle drop on cell
    const handleCellDrop = async (day: number, hour: number) => {
        if (!dragState) return;

        const date = getDateForDay(day);
        const shiftStart = new Date(date);
        shiftStart.setHours(hour, 0, 0, 0);

        const shiftEnd = new Date(shiftStart);
        shiftEnd.setHours(shiftEnd.getHours() + dragState.duration);

        if (dragState.type === "new") {
            // Create new shift
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
            // Move existing shift
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

    // Handle drag end
    const handleDragEnd = () => {
        setDragState(null);
        setHighlightCell(null);
    };

    // Delete shift
    const handleDeleteShift = async (shiftId: string) => {
        await deleteScheduleBlock(shiftId);
        setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    };

    // Publish/unpublish
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

    // Export CSV
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

    // Calculate shift hours per dispatcher
    const getDispatcherHours = (dispatcherId: string): number => {
        return shifts
            .filter((s) => s.dispatcherId === dispatcherId)
            .reduce((sum, s) => sum + s.duration, 0);
    };

    // Total hours scheduled
    const totalHours = shifts.reduce((sum, s) => sum + s.duration, 0);

    return (
        <div className="scheduler-container animate-fade-in">
            {/* Toolbar */}
            <header className="scheduler-toolbar glass-card">
                <div className="scheduler-toolbar__left">
                    <Calendar size={20} className="text-accent" />
                    <h1 className="font-display">Dispatch Scheduler</h1>
                    <span className="badge">24/7</span>
                </div>

                <div className="scheduler-toolbar__center">
                    <button onClick={goToPrevWeek} className="btn-icon">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="week-display">{formatWeekRange()}</span>
                    <button onClick={goToNextWeek} className="btn-icon">
                        <ChevronRight size={20} />
                    </button>
                    <button onClick={goToToday} className="btn btn-outline" style={{ marginLeft: "0.5rem" }}>
                        Today
                    </button>
                </div>

                <div className="scheduler-toolbar__right">
                    <button onClick={handleExport} className="btn btn-outline">
                        <Download size={16} /> Export
                    </button>
                    {isPublished ? (
                        <button onClick={handleUnpublish} className="btn btn-outline" style={{ color: "var(--warning)" }}>
                            <Ban size={16} /> Unpublish
                        </button>
                    ) : (
                        <button onClick={handlePublish} className="btn btn-primary">
                            <Send size={16} /> Publish Week
                        </button>
                    )}
                </div>
            </header>

            <div className="scheduler-layout">
                {/* Sidebar: Dispatcher Panel */}
                <aside className="scheduler-sidebar glass-card">
                    <div className="sidebar-section">
                        <div className="sidebar-header">
                            <Users size={16} className="text-accent" />
                            <h3>Dispatchers</h3>
                        </div>
                        <div className="dispatcher-list">
                            {dispatchers.map((dispatcher, index) => (
                                <div
                                    key={dispatcher.id}
                                    className="dispatcher-card"
                                    draggable
                                    onDragStart={(e) => handleDispatcherDragStart(dispatcher, e)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div
                                        className="dispatcher-avatar"
                                        style={{ background: getDispatcherColor(index) }}
                                    >
                                        {(dispatcher.name || "?").slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="dispatcher-info">
                                        <span className="dispatcher-name">{dispatcher.name || "Unknown"}</span>
                                        <span className="dispatcher-hours">{getDispatcherHours(dispatcher.id)}h scheduled</span>
                                    </div>
                                    <GripVertical size={14} className="drag-handle" />
                                </div>
                            ))}
                            {dispatchers.length === 0 && (
                                <p className="empty-text">No dispatchers found</p>
                            )}
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-header">
                            <Clock size={16} className="text-accent" />
                            <h3>Shift Duration</h3>
                        </div>
                        <div className="duration-control">
                            <button
                                onClick={() => setDefaultDuration((d) => Math.max(1, d - 1))}
                                className="btn-icon"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="duration-value">{defaultDuration}h</span>
                            <button
                                onClick={() => setDefaultDuration((d) => Math.min(24, d + 1))}
                                className="btn-icon"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-header">
                            <h3>Coverage Stats</h3>
                        </div>
                        <div className="stat-row">
                            <span>Total Hours</span>
                            <span className="stat-value">{totalHours} / 168</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${Math.min((totalHours / 168) * 100, 100)}%` }}
                            />
                        </div>
                        <div className="stat-row">
                            <span>Status</span>
                            <span className={isPublished ? "stat-success" : "stat-warning"}>
                                {isPublished ? "Published" : "Draft"}
                            </span>
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-header">
                            <h3>Shift Legend</h3>
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot" style={{ background: "#FF6B6B" }} />
                            Night (11p-7a)
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot" style={{ background: "#4ECDC4" }} />
                            Morning (7a-3p)
                        </div>
                        <div className="legend-item">
                            <span className="legend-dot" style={{ background: "#FFE66D" }} />
                            Afternoon (3p-11p)
                        </div>
                    </div>
                </aside>

                {/* Main Grid */}
                <main className="scheduler-main">
                    <div className="grid-wrapper" ref={gridRef}>
                        <div className="scheduler-grid">
                            {/* Corner cell */}
                            <div className="grid-corner" />

                            {/* Day headers */}
                            {DAY_NAMES.map((day, i) => {
                                const date = getDateForDay(i);
                                return (
                                    <div key={day} className="grid-day-header">
                                        <span className="day-name">{day}</span>
                                        <span className="day-date">{date.getDate()}</span>
                                    </div>
                                );
                            })}

                            {/* Time labels and cells */}
                            {GRID_HOURS.map((hour, rowIndex) => (
                                <>
                                    {/* Time label */}
                                    <div
                                        key={`time-${hour}`}
                                        className={`grid-time-label ${hour === 23 || hour === 7 || hour === 15 ? "shift-boundary" : ""}`}
                                    >
                                        {formatHour(hour)}
                                    </div>

                                    {/* Day cells for this hour */}
                                    {Array.from({ length: DAYS_IN_WEEK }).map((_, dayIndex) => (
                                        <div
                                            key={`cell-${dayIndex}-${hour}`}
                                            className={`grid-cell ${hour === 23 || hour === 7 || hour === 15 ? "shift-boundary-cell" : ""} ${highlightCell?.day === dayIndex && highlightCell?.hour === hour ? "highlight" : ""}`}
                                            onDragOver={(e) => handleCellDragOver(dayIndex, hour, e)}
                                            onDrop={() => handleCellDrop(dayIndex, hour)}
                                        />
                                    ))}
                                </>
                            ))}
                        </div>

                        {/* Shift blocks overlay */}
                        <div className="shifts-overlay">
                            {shifts.map((shift) => {
                                const rowIndex = HOUR_TO_ROW[shift.startHour];
                                const top = (rowIndex + 1) * 30 + 44; // +1 for header, 30px per row, 44px header
                                const left = (shift.day + 1) * (100 / 8); // +1 for time column
                                const height = shift.duration * 30;

                                return (
                                    <div
                                        key={shift.id}
                                        className="shift-block"
                                        style={{
                                            top: `${top}px`,
                                            left: `calc(${left}% + 2px)`,
                                            width: `calc(${100 / 8}% - 4px)`,
                                            height: `${height}px`,
                                            background: shift.color,
                                            color: getContrastColor(shift.color),
                                        }}
                                        draggable
                                        onDragStart={(e) => handleShiftDragStart(shift, e)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <span className="shift-name">{shift.dispatcherName}</span>
                                        <span className="shift-time">
                                            {formatHourFull(shift.startHour)} - {formatHourFull(shift.startHour + shift.duration)}
                                        </span>
                                        <button
                                            className="shift-delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteShift(shift.id);
                                            }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>

            {/* Ghost block for drag preview */}
            {dragState && (
                <div
                    className="ghost-block"
                    style={{
                        left: ghostPosition.x + 12,
                        top: ghostPosition.y - 20,
                        background: dragState.color,
                        color: getContrastColor(dragState.color),
                    }}
                >
                    <span className="ghost-name">{dragState.dispatcherName}</span>
                    <span className="ghost-time">{dragState.duration}h shift</span>
                </div>
            )}
        </div>
    );
}
