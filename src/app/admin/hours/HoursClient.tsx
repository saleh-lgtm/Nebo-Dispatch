"use client";

import { useState } from "react";
import {
    Clock,
    Users,
    TrendingUp,
    Calendar,
    Timer,
    PlayCircle,
    Filter,
} from "lucide-react";

interface HoursSummary {
    userId: string;
    userName: string;
    scheduledHours: number;
    workedHours: number;
    overtime: number;
}

interface ActiveShift {
    id: string;
    clockIn: Date;
    currentHours: number;
    user: {
        id: string;
        name: string | null;
        email: string | null;
    };
}

interface Dispatcher {
    id: string;
    name: string | null;
    email: string | null;
}

interface Props {
    weeklyHours: HoursSummary[];
    monthlyHours: HoursSummary[];
    activeShifts: ActiveShift[];
    weeklyTotals: { totalHours: number; totalShifts: number; avgHoursPerShift: number };
    monthlyTotals: { totalHours: number; totalShifts: number; avgHoursPerShift: number };
    dispatchers: Dispatcher[];
}

export default function HoursClient({
    weeklyHours,
    monthlyHours,
    activeShifts,
    weeklyTotals,
    monthlyTotals,
    dispatchers,
}: Props) {
    const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
    const [selectedDispatcher, setSelectedDispatcher] = useState<string>("");

    const hoursData = activeTab === "weekly" ? weeklyHours : monthlyHours;
    const totals = activeTab === "weekly" ? weeklyTotals : monthlyTotals;

    const filteredData = selectedDispatcher
        ? hoursData.filter((h) => h.userId === selectedDispatcher)
        : hoursData;

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    };

    return (
        <div className="hours-page">
            {/* Header */}
            <header className="page-header">
                <div className="header-content">
                    <div className="header-icon">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h1>Hours Tracking</h1>
                        <p>Monitor team hours, shifts, and overtime</p>
                    </div>
                </div>
            </header>

            {/* Stats Row */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-icon stat-icon-primary">
                        <Clock size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{totals.totalHours}h</span>
                        <span className="stat-label">Total Hours</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon stat-icon-success">
                        <TrendingUp size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{totals.totalShifts}</span>
                        <span className="stat-label">Shifts Completed</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon stat-icon-info">
                        <Timer size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{totals.avgHoursPerShift}h</span>
                        <span className="stat-label">Avg Per Shift</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon stat-icon-warning">
                        <PlayCircle size={20} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{activeShifts.length}</span>
                        <span className="stat-label">Active Now</span>
                    </div>
                </div>
            </div>

            {/* Active Shifts */}
            {activeShifts.length > 0 && (
                <section className="card active-shifts-card">
                    <div className="card-header">
                        <PlayCircle size={18} className="header-icon-active" />
                        <h2>Currently On Shift</h2>
                        <span className="count-badge">{activeShifts.length}</span>
                    </div>
                    <div className="active-shifts-grid">
                        {activeShifts.map((shift) => (
                            <div key={shift.id} className="active-shift-item">
                                <div className="shift-user">
                                    <div className="user-avatar">
                                        {(shift.user.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="user-name">{shift.user.name || "Unknown"}</span>
                                        <span className="shift-time">Started {formatTime(shift.clockIn)}</span>
                                    </div>
                                </div>
                                <div className="shift-hours">
                                    <Timer size={14} />
                                    <span>{shift.currentHours}h</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Hours Table */}
            <section className="card">
                <div className="card-header">
                    <Users size={18} />
                    <h2>Dispatcher Hours</h2>
                    <div className="header-actions">
                        <div className="tabs">
                            <button
                                onClick={() => setActiveTab("weekly")}
                                className={activeTab === "weekly" ? "active" : ""}
                            >
                                <Calendar size={14} />
                                This Week
                            </button>
                            <button
                                onClick={() => setActiveTab("monthly")}
                                className={activeTab === "monthly" ? "active" : ""}
                            >
                                <Calendar size={14} />
                                This Month
                            </button>
                        </div>
                        <div className="filter-dropdown">
                            <Filter size={14} />
                            <select
                                value={selectedDispatcher}
                                onChange={(e) => setSelectedDispatcher(e.target.value)}
                            >
                                <option value="">All Dispatchers</option>
                                {dispatchers.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {filteredData.length === 0 ? (
                    <div className="empty-state">
                        <Clock size={48} />
                        <p>No hours data for this period</p>
                    </div>
                ) : (
                    <div className="hours-table">
                        <div className="table-header">
                            <span>Dispatcher</span>
                            <span>Scheduled</span>
                            <span>Worked</span>
                            <span>Overtime</span>
                            <span>Status</span>
                        </div>
                        {filteredData.map((row) => {
                            const variance = row.workedHours - row.scheduledHours;
                            const status =
                                row.overtime > 0
                                    ? "overtime"
                                    : variance < -2
                                    ? "under"
                                    : variance > 2
                                    ? "over"
                                    : "on-track";

                            return (
                                <div key={row.userId} className="table-row">
                                    <div className="dispatcher-cell">
                                        <div className="dispatcher-avatar">
                                            {row.userName.charAt(0).toUpperCase()}
                                        </div>
                                        <span>{row.userName}</span>
                                    </div>
                                    <span className="hours-cell">{row.scheduledHours}h</span>
                                    <span className="hours-cell worked">{row.workedHours}h</span>
                                    <span className={`hours-cell overtime ${row.overtime > 0 ? "has-overtime" : ""}`}>
                                        {row.overtime > 0 ? `+${row.overtime}h` : "-"}
                                    </span>
                                    <span className={`status-badge status-${status}`}>
                                        {status === "overtime" && "Overtime"}
                                        {status === "under" && "Under Hours"}
                                        {status === "over" && "Over Hours"}
                                        {status === "on-track" && "On Track"}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Totals Row */}
                {filteredData.length > 0 && !selectedDispatcher && (
                    <div className="totals-row">
                        <span className="totals-label">Team Total</span>
                        <span>{filteredData.reduce((sum, r) => sum + r.scheduledHours, 0).toFixed(1)}h</span>
                        <span>{filteredData.reduce((sum, r) => sum + r.workedHours, 0).toFixed(1)}h</span>
                        <span className="overtime-total">
                            +{filteredData.reduce((sum, r) => sum + r.overtime, 0).toFixed(1)}h
                        </span>
                        <span></span>
                    </div>
                )}
            </section>

            <style jsx>{`
                .hours-page {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .page-header {
                    margin-bottom: 2rem;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    background: var(--primary-soft);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                }

                .page-header h1 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }

                .page-header p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .stats-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                }

                .stat-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stat-icon-primary {
                    background: var(--primary-soft);
                    color: var(--primary);
                }

                .stat-icon-success {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .stat-icon-info {
                    background: var(--info-bg);
                    color: var(--info);
                }

                .stat-icon-warning {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                .stat-content {
                    display: flex;
                    flex-direction: column;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.25rem;
                    color: var(--primary);
                }

                .card-header h2 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    flex: 1;
                }

                .header-icon-active {
                    color: var(--success);
                }

                .count-badge {
                    padding: 0.25rem 0.625rem;
                    background: var(--success-bg);
                    color: var(--success);
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .tabs {
                    display: flex;
                    gap: 0.25rem;
                    background: var(--bg-secondary);
                    padding: 0.25rem;
                    border-radius: var(--radius-md);
                }

                .tabs button {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 0.875rem;
                    border-radius: var(--radius-sm);
                    border: none;
                    background: transparent;
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .tabs button:hover {
                    color: var(--text-primary);
                }

                .tabs button.active {
                    background: var(--bg-card);
                    color: var(--primary);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                .filter-dropdown {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                }

                .filter-dropdown select {
                    padding: 0.5rem 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.8rem;
                    cursor: pointer;
                }

                .active-shifts-card {
                    border-color: var(--success-border);
                    background: linear-gradient(
                        135deg,
                        var(--bg-card) 0%,
                        rgba(34, 197, 94, 0.03) 100%
                    );
                }

                .active-shifts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                }

                .active-shift-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    border-left: 3px solid var(--success);
                }

                .shift-user {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .user-avatar {
                    width: 36px;
                    height: 36px;
                    background: var(--primary-soft);
                    color: var(--primary);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                }

                .user-name {
                    display: block;
                    font-weight: 500;
                }

                .shift-time {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .shift-hours {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.375rem 0.75rem;
                    background: var(--success-bg);
                    color: var(--success);
                    border-radius: var(--radius-md);
                    font-weight: 600;
                    font-size: 0.875rem;
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem 0;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    opacity: 0.2;
                    margin-bottom: 1rem;
                }

                .empty-state p {
                    font-size: 0.875rem;
                }

                .hours-table {
                    display: flex;
                    flex-direction: column;
                }

                .table-header,
                .table-row,
                .totals-row {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
                    gap: 1rem;
                    align-items: center;
                    padding: 0.875rem 1rem;
                }

                .table-header {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .table-row {
                    border-bottom: 1px solid var(--border);
                }

                .table-row:last-child {
                    border-bottom: none;
                }

                .dispatcher-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .dispatcher-avatar {
                    width: 32px;
                    height: 32px;
                    background: var(--primary-soft);
                    color: var(--primary);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 0.875rem;
                }

                .hours-cell {
                    font-size: 0.9375rem;
                    color: var(--text-secondary);
                }

                .hours-cell.worked {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .hours-cell.overtime.has-overtime {
                    color: var(--warning);
                    font-weight: 600;
                }

                .status-badge {
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-on-track {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .status-under {
                    background: var(--info-bg);
                    color: var(--info);
                }

                .status-over {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                .status-overtime {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .totals-row {
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    margin-top: 1rem;
                    font-weight: 600;
                }

                .totals-label {
                    color: var(--text-secondary);
                }

                .overtime-total {
                    color: var(--warning);
                }

                @media (max-width: 1024px) {
                    .stats-row {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .header-actions {
                        flex-wrap: wrap;
                    }
                }

                @media (max-width: 768px) {
                    .stats-row {
                        grid-template-columns: 1fr;
                    }

                    .table-header,
                    .table-row,
                    .totals-row {
                        grid-template-columns: 1fr 1fr;
                        gap: 0.5rem;
                    }

                    .table-header span:nth-child(n + 3),
                    .table-row span:nth-child(n + 3),
                    .totals-row span:nth-child(n + 3) {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}
