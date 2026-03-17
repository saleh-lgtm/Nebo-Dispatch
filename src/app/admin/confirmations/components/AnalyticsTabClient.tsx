"use client";

import {
    Phone,
    Clock,
    TrendingUp,
    TrendingDown,
    Timer,
    Calendar,
} from "lucide-react";
import { Stats, TripConfirmation, STATUS_CONFIG } from "../types";
import styles from "./AnalyticsTab.module.css";

interface AnalyticsTabProps {
    stats: Stats;
    todayConfirmations: TripConfirmation[];
    pendingCount: number;
    completedToday: number;
    tabLoading: string | null;
}

export default function AnalyticsTabClient({
    stats,
    todayConfirmations,
    pendingCount,
    completedToday,
    tabLoading,
}: AnalyticsTabProps) {
    return (
        <div className={styles.overviewContent}>
            {/* Key Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.primary}`}>
                        <Phone size={22} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statLabel}>Total Confirmations</span>
                        <span className={styles.statValue}>{stats.total}</span>
                        <span className={styles.statSub}>Last 30 days</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.success}`}>
                        <TrendingUp size={22} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statLabel}>On-Time Rate</span>
                        <span className={styles.statValue}>{stats.onTimeRate}%</span>
                        <span className={styles.statSub}>
                            {stats.onTime} of {stats.completed} completed
                        </span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.warning}`}>
                        <Timer size={22} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statLabel}>Avg Lead Time</span>
                        <span className={styles.statValue}>{stats.avgLeadTime}m</span>
                        <span className={styles.statSub}>Before due time</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={`${styles.statIcon} ${styles.danger}`}>
                        <TrendingDown size={22} />
                    </div>
                    <div className={styles.statContent}>
                        <span className={styles.statLabel}>Late/Expired</span>
                        <span className={styles.statValue}>{stats.late + stats.expired}</span>
                        <span className={styles.statSub}>{stats.late} late, {stats.expired} expired</span>
                    </div>
                </div>
            </div>

            {/* Status Breakdown */}
            <div className={styles.card}>
                <h3>Status Breakdown</h3>
                <div className={styles.statusBreakdown}>
                    {Object.entries(stats.byStatus).map(([status, count]) => {
                        const config = STATUS_CONFIG[status] || {
                            label: status,
                            icon: Clock,
                            color: "#64748b",
                            bgColor: "rgba(100, 116, 139, 0.12)",
                        };
                        const Icon = config.icon;
                        const percentage = stats.total > 0
                            ? Math.round((count / stats.total) * 100)
                            : 0;

                        return (
                            <div key={status} className={styles.statusRow}>
                                <div className={styles.statusInfo}>
                                    <div className={styles.statusIcon} style={{ color: config.color }}>
                                        <Icon size={16} />
                                    </div>
                                    <span className={styles.statusName}>{config.label}</span>
                                </div>
                                <div className={styles.statusBarWrapper}>
                                    <div className={styles.statusBar}>
                                        <div
                                            className={styles.statusBarFill}
                                            style={{
                                                width: `${percentage}%`,
                                                backgroundColor: config.color,
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.statusCount}>
                                    <span className={styles.count}>{count}</span>
                                    <span className={styles.percent}>({percentage}%)</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Today's Activity */}
            <div className={styles.card}>
                <h3>
                    <Calendar size={18} />
                    Today&apos;s Activity
                </h3>
                {tabLoading === "overview" ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner} />
                        <p>Loading today&apos;s data...</p>
                    </div>
                ) : (
                    <div className={styles.todayGrid}>
                        <div className={styles.todayStat}>
                            <span className={styles.value}>{todayConfirmations.length}</span>
                            <span className={styles.label}>Total</span>
                        </div>
                        <div className={`${styles.todayStat} ${styles.success}`}>
                            <span className={styles.value}>{completedToday}</span>
                            <span className={styles.label}>Done</span>
                        </div>
                        <div className={`${styles.todayStat} ${styles.warning}`}>
                            <span className={styles.value}>{pendingCount}</span>
                            <span className={styles.label}>Pending</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
