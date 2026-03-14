"use client";

import { Flag, Eye, CheckCircle, FileText } from "lucide-react";
import styles from "../../Accounting.module.css";

interface Stats {
    pending: number;
    inReview: number;
    resolved: number;
    total: number;
}

interface FlagsStatsProps {
    stats: Stats;
}

export default function FlagsStats({ stats }: FlagsStatsProps) {
    return (
        <div className={styles.statsGrid}>
            <div className={`${styles.statCard} ${styles.statPending}`}>
                <div className={styles.statIcon}>
                    <Flag size={20} />
                </div>
                <div className={styles.statContent}>
                    <span className={styles.statValue}>{stats.pending}</span>
                    <span className={styles.statLabel}>Pending</span>
                </div>
            </div>
            <div className={`${styles.statCard} ${styles.statReview}`}>
                <div className={styles.statIcon}>
                    <Eye size={20} />
                </div>
                <div className={styles.statContent}>
                    <span className={styles.statValue}>{stats.inReview}</span>
                    <span className={styles.statLabel}>In Review</span>
                </div>
            </div>
            <div className={`${styles.statCard} ${styles.statResolved}`}>
                <div className={styles.statIcon}>
                    <CheckCircle size={20} />
                </div>
                <div className={styles.statContent}>
                    <span className={styles.statValue}>{stats.resolved}</span>
                    <span className={styles.statLabel}>Resolved</span>
                </div>
            </div>
            <div className={`${styles.statCard} ${styles.statTotal}`}>
                <div className={styles.statIcon}>
                    <FileText size={20} />
                </div>
                <div className={styles.statContent}>
                    <span className={styles.statValue}>{stats.total}</span>
                    <span className={styles.statLabel}>Total Flags</span>
                </div>
            </div>
        </div>
    );
}
