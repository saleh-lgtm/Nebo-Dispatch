"use client";

import { useState, useMemo } from "react";
import {
    Calendar,
    Plus,
    Trash2,
    Send,
    Ban,
    Download,
    Users,
    Clock,
    Edit2,
    RotateCcw,
} from "lucide-react";
import {
    createScheduleBlock,
    updateScheduleBlock,
    deleteScheduleBlock,
    publishWeekSchedules,
    unpublishWeekSchedules,
    getWeekSchedules,
} from "@/lib/schedulerActions";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

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

// Constants - Fixed 7-day week template
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COLORS = ["#4ECDC4", "#FF6B6B", "#FFE66D", "#45B7D1", "#96CEB4", "#C3A6FF", "#FF8A5C", "#EA6FC4", "#6BCB77", "#4D96FF"];

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

function formatTime(date: Date): string {
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    return `${h}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

function formatTimeShort(date: Date): string {
    const hours = date.getUTCHours();
    const ampm = hours >= 12 ? "p" : "a";
    const h = hours % 12 || 12;
    return `${h}${ampm}`;
}

function getDispatcherColor(index: number): string {
    return COLORS[index % COLORS.length];
}

interface Props {
    dispatchers: Dispatcher[];
    initialSchedules: ScheduleData[];
    initialWeekStart: string;
}

export default function NewSchedulerClient({ dispatchers, initialSchedules, initialWeekStart }: Props) {
    const { addToast } = useToast();
    const [weekStart, setWeekStart] = useState<Date>(new Date(initialWeekStart));
    const [schedules, setSchedules] = useState<ScheduleData[]>(initialSchedules);
    const [isPublished, setIsPublished] = useState(() => initialSchedules.some((s) => s.isPublished));
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingShift, setEditingShift] = useState<ScheduleData | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        dispatcherId: "",
        day: 0,
        startHour: 7,
        startMinute: 0,
        endHour: 15,
        endMinute: 0,
    });

    // Calculate hours per dispatcher
    const dispatcherHours = useMemo(() => {
        const hours = new Map<string, number>();
        schedules.forEach((s) => {
            const duration = (new Date(s.shiftEnd).getTime() - new Date(s.shiftStart).getTime()) / (1000 * 60 * 60);
            hours.set(s.userId, (hours.get(s.userId) || 0) + duration);
        });
        return hours;
    }, [schedules]);

    // Group schedules by day
    const schedulesByDay = useMemo(() => {
        const byDay: Map<number, ScheduleData[]> = new Map();
        for (let i = 0; i < 7; i++) byDay.set(i, []);

        schedules.forEach((s) => {
            const day = new Date(s.shiftStart).getUTCDay();
            byDay.get(day)?.push(s);
        });

        // Sort each day's schedules by start time
        byDay.forEach((daySchedules) => {
            daySchedules.sort((a, b) => new Date(a.shiftStart).getTime() - new Date(b.shiftStart).getTime());
        });

        return byDay;
    }, [schedules]);

    const totalHours = Array.from(dispatcherHours.values()).reduce((a, b) => a + b, 0);

    // Reload current week schedules
    const reloadSchedules = async () => {
        setLoading(true);
        try {
            const currentWeek = getWeekStart(new Date());
            setWeekStart(currentWeek);
            const data = await getWeekSchedules(currentWeek);
            setSchedules(data);
            setIsPublished(data.some((s) => s.isPublished));
            addToast("Schedule refreshed", "success");
        } catch {
            addToast("Failed to load schedules", "error");
        } finally {
            setLoading(false);
        }
    };

    const getDateForDay = (dayIndex: number): Date => {
        const date = new Date(weekStart);
        date.setUTCDate(date.getUTCDate() + dayIndex);
        return date;
    };

    // Get current day of week (0-6, Sunday = 0)
    const currentDayOfWeek = new Date().getDay();

    // CRUD Operations
    const handleAddShift = async () => {
        if (!formData.dispatcherId) {
            addToast("Please select a dispatcher", "error");
            return;
        }

        setLoading(true);
        try {
            const date = getDateForDay(formData.day);
            const shiftStart = new Date(date);
            shiftStart.setUTCHours(formData.startHour, formData.startMinute, 0, 0);

            const shiftEnd = new Date(date);
            shiftEnd.setUTCHours(formData.endHour, formData.endMinute, 0, 0);

            // Handle overnight shifts
            if (shiftEnd <= shiftStart) {
                shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
            }

            const newSchedule = await createScheduleBlock({
                userId: formData.dispatcherId,
                shiftStart,
                shiftEnd,
            });

            if (newSchedule) {
                setSchedules((prev) => [...prev, newSchedule]);
                setShowAddModal(false);
                resetForm();
                addToast("Shift added successfully", "success");
            }
        } catch {
            addToast("Failed to add shift", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateShift = async () => {
        if (!editingShift) return;

        setLoading(true);
        try {
            const date = getDateForDay(formData.day);
            const shiftStart = new Date(date);
            shiftStart.setUTCHours(formData.startHour, formData.startMinute, 0, 0);

            const shiftEnd = new Date(date);
            shiftEnd.setUTCHours(formData.endHour, formData.endMinute, 0, 0);

            if (shiftEnd <= shiftStart) {
                shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
            }

            await updateScheduleBlock(editingShift.id, { shiftStart, shiftEnd });

            setSchedules((prev) =>
                prev.map((s) =>
                    s.id === editingShift.id
                        ? { ...s, shiftStart, shiftEnd }
                        : s
                )
            );

            setEditingShift(null);
            resetForm();
            addToast("Shift updated successfully", "success");
        } catch {
            addToast("Failed to update shift", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteShift = async (id: string) => {
        if (!confirm("Are you sure you want to delete this shift?")) return;

        setLoading(true);
        try {
            await deleteScheduleBlock(id);
            setSchedules((prev) => prev.filter((s) => s.id !== id));
            addToast("Shift deleted", "success");
        } catch {
            addToast("Failed to delete shift", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        setLoading(true);
        try {
            await publishWeekSchedules(weekStart);
            setSchedules((prev) => prev.map((s) => ({ ...s, isPublished: true })));
            setIsPublished(true);
            addToast("Schedule published! Dispatchers can now see their shifts.", "success");
        } catch {
            addToast("Failed to publish schedule", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleUnpublish = async () => {
        setLoading(true);
        try {
            await unpublishWeekSchedules(weekStart);
            setSchedules((prev) => prev.map((s) => ({ ...s, isPublished: false })));
            setIsPublished(false);
            addToast("Schedule unpublished", "info");
        } catch {
            addToast("Failed to unpublish schedule", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const lines = ["Day,Dispatcher,Start,End,Hours"];
        for (let d = 0; d < 7; d++) {
            const daySchedules = schedulesByDay.get(d) || [];
            for (const shift of daySchedules) {
                const duration = (new Date(shift.shiftEnd).getTime() - new Date(shift.shiftStart).getTime()) / (1000 * 60 * 60);
                lines.push(
                    `${DAYS[d]},${shift.user.name || "Unknown"},${formatTime(new Date(shift.shiftStart))},${formatTime(new Date(shift.shiftEnd))},${duration.toFixed(1)}`
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

    const resetForm = () => {
        setFormData({
            dispatcherId: "",
            day: 0,
            startHour: 7,
            startMinute: 0,
            endHour: 15,
            endMinute: 0,
        });
    };

    const openEditModal = (shift: ScheduleData) => {
        const start = new Date(shift.shiftStart);
        const end = new Date(shift.shiftEnd);
        setFormData({
            dispatcherId: shift.userId,
            day: start.getUTCDay(),
            startHour: start.getUTCHours(),
            startMinute: start.getUTCMinutes(),
            endHour: end.getUTCHours(),
            endMinute: end.getUTCMinutes(),
        });
        setEditingShift(shift);
    };

    const openAddModalForDay = (day: number) => {
        resetForm();
        setFormData((prev) => ({ ...prev, day }));
        setShowAddModal(true);
    };

    // Generate hour options
    const hourOptions = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="scheduler-page">
            {/* Header */}
            <header className="scheduler-header glass-card">
                <div className="scheduler-header__left">
                    <Calendar size={24} className="text-accent" />
                    <div>
                        <h1 className="font-display" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>
                            Weekly Schedule
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Fixed 7-day dispatcher rotation
                        </p>
                    </div>
                </div>
                <div className="scheduler-header__actions">
                    <button onClick={reloadSchedules} className="btn btn-ghost" disabled={loading}>
                        <RotateCcw size={16} /> Refresh
                    </button>
                    <button onClick={handleExport} className="btn btn-ghost" disabled={loading}>
                        <Download size={16} /> Export
                    </button>
                    {isPublished ? (
                        <button onClick={handleUnpublish} className="btn btn-outline" style={{ color: "var(--warning)" }} disabled={loading}>
                            <Ban size={16} /> Unpublish
                        </button>
                    ) : (
                        <button onClick={handlePublish} className="btn btn-primary" disabled={loading || schedules.length === 0}>
                            <Send size={16} /> Publish
                        </button>
                    )}
                </div>
            </header>

            <div className="scheduler-layout">
                {/* Sidebar */}
                <aside className="scheduler-sidebar glass-card">
                    {/* Stats */}
                    <div className="sidebar-section">
                        <h3 className="sidebar-title">
                            <Clock size={14} /> Coverage
                        </h3>
                        <div className="stat-row">
                            <span>Total Hours</span>
                            <span className="stat-value">{totalHours.toFixed(0)}h / 168h</span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${Math.min((totalHours / 168) * 100, 100)}%` }} />
                        </div>
                        <div className="stat-row" style={{ marginTop: "0.75rem" }}>
                            <span>Status</span>
                            <span className={isPublished ? "badge badge-success" : "badge badge-warning"}>
                                {isPublished ? "Published" : "Draft"}
                            </span>
                        </div>
                    </div>

                    {/* Dispatchers */}
                    <div className="sidebar-section">
                        <h3 className="sidebar-title">
                            <Users size={14} /> Dispatchers
                        </h3>
                        <div className="dispatcher-list">
                            {dispatchers.map((d, i) => (
                                <div key={d.id} className="dispatcher-item">
                                    <div className="dispatcher-color" style={{ background: getDispatcherColor(i) }} />
                                    <span className="dispatcher-name">{d.name || d.email}</span>
                                    <span className="dispatcher-hours">{(dispatcherHours.get(d.id) || 0).toFixed(0)}h</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Main Schedule Grid */}
                <main className="scheduler-main">
                    <div className="schedule-grid">
                        {DAYS.map((day, dayIndex) => {
                            const daySchedules = schedulesByDay.get(dayIndex) || [];
                            const isToday = dayIndex === currentDayOfWeek;

                            return (
                                <div key={day} className={`day-column ${isToday ? "today" : ""}`}>
                                    <div className="day-header">
                                        <span className="day-name">{day}</span>
                                    </div>

                                    <div className="day-shifts">
                                        {daySchedules.map((shift) => {
                                            const dispatcherIndex = dispatchers.findIndex((d) => d.id === shift.userId);
                                            const color = getDispatcherColor(dispatcherIndex);
                                            const duration = (new Date(shift.shiftEnd).getTime() - new Date(shift.shiftStart).getTime()) / (1000 * 60 * 60);

                                            return (
                                                <div
                                                    key={shift.id}
                                                    className="shift-card"
                                                    style={{ borderLeftColor: color }}
                                                >
                                                    <div className="shift-card__header">
                                                        <span className="shift-card__name">{shift.user.name || "Unknown"}</span>
                                                        <div className="shift-card__actions">
                                                            <button onClick={() => openEditModal(shift)} className="shift-action-btn" title="Edit">
                                                                <Edit2 size={12} />
                                                            </button>
                                                            <button onClick={() => handleDeleteShift(shift.id)} className="shift-action-btn delete" title="Delete">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="shift-card__time">
                                                        {formatTimeShort(new Date(shift.shiftStart))} - {formatTimeShort(new Date(shift.shiftEnd))}
                                                        <span className="shift-card__duration">{duration.toFixed(0)}h</span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <button
                                            onClick={() => openAddModalForDay(dayIndex)}
                                            className="add-shift-btn"
                                        >
                                            <Plus size={14} /> Add Shift
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showAddModal || editingShift !== null}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingShift(null);
                    resetForm();
                }}
                title={editingShift ? "Edit Shift" : "Add Shift"}
                size="sm"
            >
                <div className="shift-form">
                    <div className="form-group">
                        <label>Dispatcher</label>
                        <select
                            value={formData.dispatcherId}
                            onChange={(e) => setFormData({ ...formData, dispatcherId: e.target.value })}
                            className="input"
                            disabled={!!editingShift}
                        >
                            <option value="">Select Dispatcher</option>
                            {dispatchers.map((d) => (
                                <option key={d.id} value={d.id}>{d.name || d.email}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Day</label>
                        <select
                            value={formData.day}
                            onChange={(e) => setFormData({ ...formData, day: parseInt(e.target.value) })}
                            className="input"
                        >
                            {DAYS.map((day, i) => (
                                <option key={i} value={i}>{day}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Start Time</label>
                            <div className="time-input">
                                <select
                                    value={formData.startHour}
                                    onChange={(e) => setFormData({ ...formData, startHour: parseInt(e.target.value) })}
                                    className="input"
                                >
                                    {hourOptions.map((h) => (
                                        <option key={h} value={h}>
                                            {h === 0 ? "12" : h > 12 ? h - 12 : h} {h < 12 ? "AM" : "PM"}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>End Time</label>
                            <div className="time-input">
                                <select
                                    value={formData.endHour}
                                    onChange={(e) => setFormData({ ...formData, endHour: parseInt(e.target.value) })}
                                    className="input"
                                >
                                    {hourOptions.map((h) => (
                                        <option key={h} value={h}>
                                            {h === 0 ? "12" : h > 12 ? h - 12 : h} {h < 12 ? "AM" : "PM"}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            onClick={() => {
                                setShowAddModal(false);
                                setEditingShift(null);
                                resetForm();
                            }}
                            className="btn btn-ghost"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={editingShift ? handleUpdateShift : handleAddShift}
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? "Saving..." : editingShift ? "Update Shift" : "Add Shift"}
                        </button>
                    </div>
                </div>
            </Modal>

            <style jsx>{`
                .scheduler-page {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .scheduler-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .scheduler-header__left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .scheduler-header__actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .scheduler-layout {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 1.5rem;
                }

                @media (max-width: 1024px) {
                    .scheduler-layout {
                        grid-template-columns: 1fr;
                    }
                }

                /* Sidebar */
                .scheduler-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    height: fit-content;
                    position: sticky;
                    top: 1rem;
                }

                .sidebar-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .sidebar-title {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .week-nav {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.5rem;
                }

                .week-display {
                    font-weight: 600;
                    font-size: 0.875rem;
                    text-align: center;
                }

                .stat-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.8125rem;
                }

                .stat-value {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .progress-bar {
                    height: 6px;
                    background: var(--bg-secondary);
                    border-radius: 3px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--primary), var(--accent));
                    border-radius: 3px;
                    transition: width 0.3s ease;
                }

                .dispatcher-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .dispatcher-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8125rem;
                }

                .dispatcher-color {
                    width: 12px;
                    height: 12px;
                    border-radius: 3px;
                    flex-shrink: 0;
                }

                .dispatcher-name {
                    flex: 1;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .dispatcher-hours {
                    color: var(--text-secondary);
                    font-weight: 500;
                }

                /* Main Grid */
                .scheduler-main {
                    overflow-x: auto;
                }

                .schedule-grid {
                    display: grid;
                    grid-template-columns: repeat(7, minmax(140px, 1fr));
                    gap: 0.75rem;
                    min-width: 900px;
                }

                .day-column {
                    display: flex;
                    flex-direction: column;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                }

                .day-column.today {
                    border-color: var(--primary);
                    box-shadow: 0 0 0 1px var(--primary-soft);
                }

                .day-header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem 0.75rem;
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border);
                }

                .day-column.today .day-header {
                    background: var(--primary-soft);
                }

                .day-name {
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .day-column.today .day-name {
                    color: var(--primary);
                }

                .day-shifts {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    min-height: 200px;
                }

                .shift-card {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    padding: 0.5rem 0.625rem;
                    border-left: 3px solid var(--primary);
                }

                .shift-card__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.25rem;
                }

                .shift-card__name {
                    font-size: 0.8125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .shift-card__actions {
                    display: flex;
                    gap: 0.25rem;
                    opacity: 0;
                    transition: opacity 0.15s ease;
                }

                .shift-card:hover .shift-card__actions {
                    opacity: 1;
                }

                .shift-action-btn {
                    background: var(--bg-hover);
                    border: none;
                    border-radius: 4px;
                    padding: 0.25rem;
                    cursor: pointer;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }

                .shift-action-btn:hover {
                    background: var(--bg-primary);
                    color: var(--text-primary);
                }

                .shift-action-btn.delete:hover {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .shift-card__time {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .shift-card__duration {
                    background: var(--bg-hover);
                    padding: 0.125rem 0.375rem;
                    border-radius: 4px;
                    font-weight: 500;
                }

                .add-shift-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.375rem;
                    padding: 0.5rem;
                    background: none;
                    border: 1px dashed var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    margin-top: auto;
                }

                .add-shift-btn:hover {
                    border-color: var(--primary);
                    color: var(--primary);
                    background: var(--primary-soft);
                }

                /* Form Styles */
                .shift-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .time-input {
                    display: flex;
                    gap: 0.5rem;
                }

                .time-input .input {
                    flex: 1;
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    margin-top: 0.5rem;
                }
            `}</style>
        </div>
    );
}
