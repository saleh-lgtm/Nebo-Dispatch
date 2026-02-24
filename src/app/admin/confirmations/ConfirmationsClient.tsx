"use client";

import { useState } from "react";
import {
    Phone,
    Clock,
    CheckCircle,
    XCircle,
    PhoneOff,
    RotateCcw,
    AlertTriangle,
    User,
    TrendingUp,
    TrendingDown,
    Timer,
    BarChart3,
    Users,
    Calendar,
    ArrowRight,
} from "lucide-react";

interface Stats {
    total: number;
    completed: number;
    pending: number;
    expired: number;
    onTime: number;
    late: number;
    avgLeadTime: number;
    onTimeRate: number;
    completionRate: number;
    byStatus: Record<string, number>;
}

interface DispatcherMetric {
    id: string;
    name: string;
    total: number;
    onTime: number;
    late: number;
    onTimeRate: number;
    byStatus: Record<string, number>;
}

interface Confirmation {
    id: string;
    tripNumber: string;
    pickupAt: Date | string;
    dueAt: Date | string;
    passengerName: string;
    driverName: string;
    status: string;
    completedAt: Date | string | null;
    completedBy: { id: string; name: string | null } | null;
}

interface Props {
    stats: Stats;
    dispatcherMetrics: DispatcherMetric[];
    todayConfirmations: Confirmation[];
}

const STATUS_CONFIG: Record<
    string,
    { label: string; icon: typeof CheckCircle; color: string }
> = {
    PENDING: { label: "Pending", icon: Clock, color: "#60a5fa" },
    CONFIRMED: { label: "Confirmed", icon: CheckCircle, color: "#4ade80" },
    NO_ANSWER: { label: "No Answer", icon: PhoneOff, color: "#fbbf24" },
    CANCELLED: { label: "Cancelled", icon: XCircle, color: "#f87171" },
    RESCHEDULED: { label: "Rescheduled", icon: RotateCcw, color: "#60a5fa" },
    EXPIRED: { label: "Expired", icon: AlertTriangle, color: "#ef4444" },
};

export default function ConfirmationsClient({
    stats,
    dispatcherMetrics,
    todayConfirmations,
}: Props) {
    const [selectedTab, setSelectedTab] = useState<"overview" | "dispatchers" | "today">(
        "overview"
    );

    const formatTime = (date: Date | string) => {
        return new Date(date).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const isOverdue = (dueAt: Date | string) => {
        return new Date(dueAt).getTime() < Date.now();
    };

    const pendingCount = todayConfirmations.filter((c) => c.status === "PENDING").length;
    const completedToday = todayConfirmations.filter((c) => c.completedAt !== null).length;

    return (
        <div className="confirmations-page">
            {/* Header */}
            <header className="page-header">
                <div>
                    <h1>
                        <Phone size={24} />
                        2-Hour Confirmation Metrics
                    </h1>
                    <p>Track dispatcher performance on trip confirmations</p>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button
                    className={`tab-btn ${selectedTab === "overview" ? "active" : ""}`}
                    onClick={() => setSelectedTab("overview")}
                >
                    <BarChart3 size={16} />
                    Overview
                </button>
                <button
                    className={`tab-btn ${selectedTab === "dispatchers" ? "active" : ""}`}
                    onClick={() => setSelectedTab("dispatchers")}
                >
                    <Users size={16} />
                    Dispatchers
                </button>
                <button
                    className={`tab-btn ${selectedTab === "today" ? "active" : ""}`}
                    onClick={() => setSelectedTab("today")}
                >
                    <Calendar size={16} />
                    Today
                    {pendingCount > 0 && (
                        <span className="pending-badge">{pendingCount}</span>
                    )}
                </button>
            </div>

            {/* Overview Tab */}
            {selectedTab === "overview" && (
                <div className="overview-content">
                    {/* Key Stats Cards */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon primary">
                                <Phone size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Total Confirmations</span>
                                <span className="stat-value">{stats.total}</span>
                                <span className="stat-sub">Last 30 days</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon success">
                                <TrendingUp size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">On-Time Rate</span>
                                <span className="stat-value">{stats.onTimeRate}%</span>
                                <span className="stat-sub">
                                    {stats.onTime} of {stats.completed} completed
                                </span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon warning">
                                <Timer size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Avg Lead Time</span>
                                <span className="stat-value">{stats.avgLeadTime}m</span>
                                <span className="stat-sub">Before due time</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon danger">
                                <TrendingDown size={22} />
                            </div>
                            <div className="stat-content">
                                <span className="stat-label">Late/Expired</span>
                                <span className="stat-value">
                                    {stats.late + stats.expired}
                                </span>
                                <span className="stat-sub">{stats.late} late, {stats.expired} expired</span>
                            </div>
                        </div>
                    </div>

                    {/* Status Breakdown */}
                    <div className="card">
                        <h3>Status Breakdown</h3>
                        <div className="status-breakdown">
                            {Object.entries(stats.byStatus).map(([status, count]) => {
                                const config = STATUS_CONFIG[status] || {
                                    label: status,
                                    icon: Clock,
                                    color: "#64748b",
                                };
                                const Icon = config.icon;
                                const percentage = stats.total > 0
                                    ? Math.round((count / stats.total) * 100)
                                    : 0;

                                return (
                                    <div key={status} className="status-row">
                                        <div className="status-info">
                                            <div
                                                className="status-icon"
                                                style={{ color: config.color }}
                                            >
                                                <Icon size={16} />
                                            </div>
                                            <span className="status-name">{config.label}</span>
                                        </div>
                                        <div className="status-bar-wrapper">
                                            <div className="status-bar">
                                                <div
                                                    className="status-bar-fill"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: config.color,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="status-count">
                                            <span className="count">{count}</span>
                                            <span className="percent">({percentage}%)</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Dispatchers Tab */}
            {selectedTab === "dispatchers" && (
                <div className="dispatchers-content">
                    <div className="card">
                        <h3>Dispatcher Performance</h3>
                        <p className="card-subtitle">Last 30 days</p>

                        {dispatcherMetrics.length === 0 ? (
                            <div className="empty-state">
                                <Users size={48} />
                                <p>No confirmation data yet</p>
                            </div>
                        ) : (
                            <div className="dispatcher-table">
                                <div className="table-header">
                                    <span className="col-name">Dispatcher</span>
                                    <span className="col-total">Total</span>
                                    <span className="col-ontime">On-Time</span>
                                    <span className="col-late">Late</span>
                                    <span className="col-rate">Rate</span>
                                </div>
                                {dispatcherMetrics.map((d) => (
                                    <div key={d.id} className="table-row">
                                        <div className="col-name">
                                            <div className="dispatcher-avatar">
                                                {d.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span>{d.name}</span>
                                        </div>
                                        <span className="col-total">{d.total}</span>
                                        <span className="col-ontime success">{d.onTime}</span>
                                        <span className="col-late danger">{d.late}</span>
                                        <span className={`col-rate ${d.onTimeRate >= 80 ? "success" : d.onTimeRate >= 50 ? "warning" : "danger"}`}>
                                            {d.onTimeRate}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Today Tab */}
            {selectedTab === "today" && (
                <div className="today-content">
                    {/* Today Summary */}
                    <div className="today-summary">
                        <div className="summary-stat">
                            <span className="label">Total Today</span>
                            <span className="value">{todayConfirmations.length}</span>
                        </div>
                        <div className="summary-stat success">
                            <span className="label">Completed</span>
                            <span className="value">{completedToday}</span>
                        </div>
                        <div className="summary-stat warning">
                            <span className="label">Pending</span>
                            <span className="value">{pendingCount}</span>
                        </div>
                    </div>

                    {/* Today's Confirmations List */}
                    <div className="card">
                        <h3>Today&apos;s Confirmations</h3>

                        {todayConfirmations.length === 0 ? (
                            <div className="empty-state">
                                <Calendar size={48} />
                                <p>No confirmations for today</p>
                            </div>
                        ) : (
                            <div className="confirmations-list">
                                {todayConfirmations.map((conf) => {
                                    const config = STATUS_CONFIG[conf.status] || STATUS_CONFIG.PENDING;
                                    const Icon = config.icon;
                                    const overdue = conf.status === "PENDING" && isOverdue(conf.dueAt);

                                    return (
                                        <div
                                            key={conf.id}
                                            className={`confirmation-row ${overdue ? "overdue" : ""}`}
                                        >
                                            <div className="conf-status">
                                                <div
                                                    className="status-badge"
                                                    style={{ color: config.color }}
                                                >
                                                    <Icon size={14} />
                                                    <span>{config.label}</span>
                                                </div>
                                            </div>
                                            <div className="conf-trip">
                                                <span className="trip-number">
                                                    #{conf.tripNumber}
                                                </span>
                                                <span className="pickup-time">
                                                    <Clock size={12} />
                                                    PU: {formatTime(conf.pickupAt)}
                                                </span>
                                            </div>
                                            <div className="conf-people">
                                                <span className="person">
                                                    <User size={12} />
                                                    {conf.passengerName}
                                                </span>
                                            </div>
                                            <div className="conf-completed">
                                                {conf.completedBy ? (
                                                    <span className="completed-by">
                                                        {conf.completedBy.name}
                                                        <ArrowRight size={12} />
                                                        {formatTime(conf.completedAt!)}
                                                    </span>
                                                ) : (
                                                    <span className="awaiting">Awaiting call</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style jsx>{`
                .confirmations-page {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .page-header {
                    margin-bottom: 1.5rem;
                }

                .page-header h1 {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .page-header h1 :global(svg) {
                    color: var(--accent);
                }

                .page-header p {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                }

                /* Tab Navigation */
                .tab-nav {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                    border-bottom: 1px solid var(--border);
                    padding-bottom: 0.5rem;
                }

                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: transparent;
                    border: none;
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .tab-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .tab-btn.active {
                    background: var(--primary-soft);
                    color: var(--primary);
                }

                .pending-badge {
                    background: var(--danger);
                    color: white;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                /* Stats Grid */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                }

                .stat-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .stat-icon.primary {
                    background: var(--primary-soft);
                    color: var(--primary);
                }

                .stat-icon.success {
                    background: rgba(34, 197, 94, 0.15);
                    color: #4ade80;
                }

                .stat-icon.warning {
                    background: rgba(245, 158, 11, 0.15);
                    color: #fbbf24;
                }

                .stat-icon.danger {
                    background: rgba(239, 68, 68, 0.15);
                    color: #f87171;
                }

                .stat-content {
                    display: flex;
                    flex-direction: column;
                }

                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .stat-sub {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                /* Card */
                .card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 1.25rem;
                }

                .card h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .card-subtitle {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                }

                /* Status Breakdown */
                .status-breakdown {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-top: 1rem;
                }

                .status-row {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .status-info {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    width: 120px;
                    flex-shrink: 0;
                }

                .status-icon {
                    display: flex;
                    align-items: center;
                }

                .status-name {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .status-bar-wrapper {
                    flex: 1;
                }

                .status-bar {
                    height: 8px;
                    background: var(--bg-secondary);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .status-bar-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.3s ease;
                }

                .status-count {
                    width: 80px;
                    text-align: right;
                    flex-shrink: 0;
                }

                .status-count .count {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .status-count .percent {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    margin-left: 0.25rem;
                }

                /* Dispatcher Table */
                .dispatcher-table {
                    margin-top: 1rem;
                }

                .table-header,
                .table-row {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                    gap: 1rem;
                    padding: 0.75rem 0;
                    align-items: center;
                }

                .table-header {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid var(--border);
                }

                .table-row {
                    border-bottom: 1px solid var(--border);
                }

                .table-row:last-child {
                    border-bottom: none;
                }

                .col-name {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .dispatcher-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: var(--primary-soft);
                    color: var(--primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 0.875rem;
                }

                .col-total,
                .col-ontime,
                .col-late,
                .col-rate {
                    font-size: 0.875rem;
                    text-align: center;
                }

                .success {
                    color: #4ade80;
                }

                .warning {
                    color: #fbbf24;
                }

                .danger {
                    color: #f87171;
                }

                /* Today Summary */
                .today-summary {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .summary-stat {
                    flex: 1;
                    padding: 1rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    text-align: center;
                }

                .summary-stat .label {
                    display: block;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    margin-bottom: 0.25rem;
                }

                .summary-stat .value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }

                .summary-stat.success .value {
                    color: #4ade80;
                }

                .summary-stat.warning .value {
                    color: #fbbf24;
                }

                /* Confirmations List */
                .confirmations-list {
                    margin-top: 1rem;
                }

                .confirmation-row {
                    display: grid;
                    grid-template-columns: 140px 1fr 1fr 1fr;
                    gap: 1rem;
                    padding: 0.875rem 0;
                    border-bottom: 1px solid var(--border);
                    align-items: center;
                }

                .confirmation-row:last-child {
                    border-bottom: none;
                }

                .confirmation-row.overdue {
                    background: rgba(239, 68, 68, 0.08);
                    margin: 0 -1.25rem;
                    padding-left: 1.25rem;
                    padding-right: 1.25rem;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    font-weight: 500;
                }

                .conf-trip {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .trip-number {
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .pickup-time {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .conf-people .person {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .conf-completed .completed-by {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    color: #4ade80;
                }

                .conf-completed .awaiting {
                    font-size: 0.8125rem;
                    color: var(--text-muted);
                }

                /* Empty State */
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 3rem 0;
                    color: var(--text-secondary);
                }

                .empty-state :global(svg) {
                    opacity: 0.3;
                }

                @media (max-width: 768px) {
                    .confirmations-page {
                        padding: 1rem;
                    }

                    .tab-nav {
                        overflow-x: auto;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr 1fr;
                    }

                    .table-header,
                    .table-row {
                        grid-template-columns: 1.5fr 1fr 1fr;
                    }

                    .col-ontime,
                    .col-late {
                        display: none;
                    }

                    .confirmation-row {
                        grid-template-columns: 1fr;
                        gap: 0.5rem;
                    }

                    .today-summary {
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
}
