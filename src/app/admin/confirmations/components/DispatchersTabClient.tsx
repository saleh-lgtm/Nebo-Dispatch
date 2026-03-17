"use client";

import { Users } from "lucide-react";
import { DispatcherMetric } from "../types";
import styles from "./DispatchersTab.module.css";

interface DispatchersTabProps {
    metrics: DispatcherMetric[];
    tabLoading: string | null;
}

export default function DispatchersTabClient({
    metrics,
    tabLoading,
}: DispatchersTabProps) {
    return (
        <div className={styles.dispatchersContent}>
            <div className={styles.card}>
                <h3>Dispatcher Performance</h3>
                <p className={styles.cardSubtitle}>Last 30 days</p>

                {tabLoading === "dispatchers" ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner} />
                        <p>Loading dispatcher data...</p>
                    </div>
                ) : metrics.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Users size={48} />
                        <p>No confirmation data yet</p>
                    </div>
                ) : (
                    <div className={styles.dispatcherTable}>
                        <div className={styles.tableHeader}>
                            <span className={styles.colName}>Dispatcher</span>
                            <span className={styles.colTotal}>Total</span>
                            <span className={styles.colOntime}>On-Time</span>
                            <span className={styles.colLate}>Late</span>
                            <span className={styles.colRate}>Rate</span>
                        </div>
                        {metrics.map((d) => (
                            <div key={d.id} className={styles.tableRow}>
                                <div className={styles.colName}>
                                    <div className={styles.dispatcherAvatar}>
                                        {d.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span>{d.name}</span>
                                </div>
                                <span className={styles.colTotal}>{d.total}</span>
                                <span className={`${styles.colOntime} ${styles.success}`}>{d.onTime}</span>
                                <span className={`${styles.colLate} ${styles.danger}`}>{d.late}</span>
                                <span className={`${styles.colRate} ${d.onTimeRate >= 80 ? styles.success : d.onTimeRate >= 50 ? styles.warning : styles.danger}`}>
                                    {d.onTimeRate}%
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
