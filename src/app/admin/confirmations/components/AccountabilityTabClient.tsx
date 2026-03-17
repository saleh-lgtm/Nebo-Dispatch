"use client";

import {
    Clock,
    CheckCircle,
    Users,
    ChevronDown,
    ChevronUp,
    ShieldAlert,
    AlertTriangle,
} from "lucide-react";
import { AccountabilityMetric, MissedConfirmation } from "../types";
import { formatTime } from "./utils";
import styles from "./AccountabilityTab.module.css";

interface AccountabilityTabProps {
    accountabilityMetrics: AccountabilityMetric[];
    missedConfirmations: MissedConfirmation[];
    tabLoading: string | null;
    expandedMissed: Set<string>;
    onToggleMissed: (id: string) => void;
}

export default function AccountabilityTabClient({
    accountabilityMetrics,
    missedConfirmations,
    tabLoading,
    expandedMissed,
    onToggleMissed,
}: AccountabilityTabProps) {
    const totalMissed = missedConfirmations.length;
    const avgAccountabilityRate =
        accountabilityMetrics.length > 0
            ? Math.round(
                  accountabilityMetrics.reduce((sum, m) => sum + m.accountabilityRate, 0) /
                      accountabilityMetrics.length
              )
            : 100;
    const worstPerformers = accountabilityMetrics
        .filter((m) => m.confirmationsMissedWhileOnDuty > 0)
        .slice(0, 3);

    return (
        <div className={styles.accountabilityContent}>
            {/* Summary Stats */}
            <div className={styles.accountabilitySummary}>
                <div className={`${styles.summaryStat} ${styles.danger}`}>
                    <span className={styles.label}>Missed Confirmations</span>
                    <span className={styles.value}>{totalMissed}</span>
                    <span className={styles.sub}>Last 30 days</span>
                </div>
                <div
                    className={`${styles.summaryStat} ${
                        avgAccountabilityRate >= 90
                            ? styles.success
                            : avgAccountabilityRate >= 70
                            ? styles.warning
                            : styles.danger
                    }`}
                >
                    <span className={styles.label}>Team Accountability</span>
                    <span className={styles.value}>{avgAccountabilityRate}%</span>
                    <span className={styles.sub}>Average rate</span>
                </div>
                <div className={styles.summaryStat}>
                    <span className={styles.label}>Dispatchers Tracked</span>
                    <span className={styles.value}>{accountabilityMetrics.length}</span>
                    <span className={styles.sub}>Active users</span>
                </div>
            </div>

            {/* Top Issues */}
            {worstPerformers.length > 0 && (
                <div className={`${styles.card} ${styles.topIssuesCard}`}>
                    <h3>
                        <AlertTriangle size={16} />
                        Top Issues
                    </h3>
                    <div className={styles.topIssues}>
                        {worstPerformers.map((m) => (
                            <div key={m.id} className={styles.issueItem}>
                                <div className={styles.issueAvatar}>
                                    {m.name.charAt(0).toUpperCase()}
                                </div>
                                <div className={styles.issueInfo}>
                                    <span className={styles.issueName}>{m.name}</span>
                                    <span className={styles.issueRole}>{m.role}</span>
                                </div>
                                <div className={styles.issueStats}>
                                    <span className={styles.missedCount}>
                                        {m.confirmationsMissedWhileOnDuty} missed
                                    </span>
                                    <span
                                        className={`${styles.rate} ${
                                            m.accountabilityRate >= 80
                                                ? styles.success
                                                : m.accountabilityRate >= 50
                                                ? styles.warning
                                                : styles.danger
                                        }`}
                                    >
                                        {m.accountabilityRate}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dispatcher Accountability Table */}
            <div className={styles.card}>
                <h3>Dispatcher Accountability</h3>
                <p className={styles.cardSubtitle}>
                    Performance metrics including missed confirmations while on duty
                </p>

                {tabLoading === "accountability" ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner} />
                        <p>Loading accountability data...</p>
                    </div>
                ) : accountabilityMetrics.length === 0 ? (
                    <div className={styles.emptyState}>
                        <ShieldAlert size={48} />
                        <p>No accountability data yet</p>
                    </div>
                ) : (
                    <div className={styles.accountabilityTable}>
                        <div className={`${styles.tableHeader} ${styles.accountabilityHeader}`}>
                            <span className={styles.colName}>Dispatcher</span>
                            <span className={styles.colShifts}>Shifts</span>
                            <span className={styles.colCompleted}>Completed</span>
                            <span className={styles.colOntime}>On-Time</span>
                            <span className={styles.colMissed}>Missed</span>
                            <span className={styles.colRate}>Rate</span>
                        </div>
                        {accountabilityMetrics.map((m) => (
                            <div key={m.id} className={`${styles.tableRow} ${styles.accountabilityRow}`}>
                                <div className={styles.colName}>
                                    <div className={styles.dispatcherAvatar}>
                                        {m.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.nameInfo}>
                                        <span className={styles.name}>{m.name}</span>
                                        <span className={styles.role}>{m.role}</span>
                                    </div>
                                </div>
                                <span className={styles.colShifts}>{m.totalShifts}</span>
                                <span className={styles.colCompleted}>{m.confirmationsCompleted}</span>
                                <span className={`${styles.colOntime} ${styles.success}`}>{m.confirmationsOnTime}</span>
                                <span
                                    className={`${styles.colMissed} ${
                                        m.confirmationsMissedWhileOnDuty > 0 ? styles.danger : ""
                                    }`}
                                >
                                    {m.confirmationsMissedWhileOnDuty}
                                </span>
                                <span
                                    className={`${styles.colRate} ${
                                        m.accountabilityRate >= 80
                                            ? styles.success
                                            : m.accountabilityRate >= 50
                                            ? styles.warning
                                            : styles.danger
                                    }`}
                                >
                                    {m.accountabilityRate}%
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Missed Confirmations List */}
            <div className={styles.card}>
                <h3>Missed Confirmations</h3>
                <p className={styles.cardSubtitle}>
                    Confirmations that expired while dispatchers were on duty
                </p>

                {missedConfirmations.length === 0 ? (
                    <div className={styles.emptyState}>
                        <CheckCircle size={48} />
                        <p>No missed confirmations</p>
                    </div>
                ) : (
                    <div className={styles.missedList}>
                        {missedConfirmations.map((conf) => (
                            <div key={conf.id} className={styles.missedItem}>
                                <div
                                    className={styles.missedHeader}
                                    onClick={() => onToggleMissed(conf.id)}
                                >
                                    <div className={styles.missedInfo}>
                                        <span className={styles.tripNumber}>#{conf.tripNumber}</span>
                                        <span className={styles.passenger}>{conf.passengerName}</span>
                                    </div>
                                    <div className={styles.missedMeta}>
                                        <span className={styles.dueTime}>
                                            <Clock size={12} />
                                            Due: {formatTime(conf.dueAt)}
                                        </span>
                                        <span className={styles.onDutyCount}>
                                            <Users size={12} />
                                            {conf.onDutyDispatchers.length} on duty
                                        </span>
                                    </div>
                                    <div className={styles.expandIcon}>
                                        {expandedMissed.has(conf.id) ? (
                                            <ChevronUp size={18} />
                                        ) : (
                                            <ChevronDown size={18} />
                                        )}
                                    </div>
                                </div>
                                {expandedMissed.has(conf.id) && (
                                    <div className={styles.missedDetails}>
                                        <div className={styles.detailRow}>
                                            <span className={styles.detailLabel}>Driver:</span>
                                            <span>{conf.driverName}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <span className={styles.detailLabel}>Pickup:</span>
                                            <span>{formatTime(conf.pickupAt)}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <span className={styles.detailLabel}>Expired:</span>
                                            <span>
                                                {conf.expiredAt
                                                    ? new Date(conf.expiredAt).toLocaleString()
                                                    : "N/A"}
                                            </span>
                                        </div>
                                        <div className={styles.onDutySection}>
                                            <span className={styles.detailLabel}>Dispatchers On Duty:</span>
                                            <div className={styles.onDutyList}>
                                                {conf.onDutyDispatchers.map((d) => (
                                                    <div key={d.id} className={styles.onDutyDispatcher}>
                                                        <div className={`${styles.dispatcherAvatar} ${styles.small}`}>
                                                            {(d.name || "?").charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className={styles.name}>{d.name || "Unknown"}</span>
                                                        <span className={styles.shiftTime}>
                                                            {formatTime(d.shiftStart)}
                                                            {d.shiftEnd
                                                                ? ` - ${formatTime(d.shiftEnd)}`
                                                                : " (active)"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
