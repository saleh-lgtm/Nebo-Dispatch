"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ToggleGroup from "@/components/ui/ToggleGroup";
import type { DispatcherScorecard, RecentActivity } from "@/lib/scorecardActions";
import { getDispatcherScorecard, getDispatcherRecentActivity } from "@/lib/scorecardActions";
import styles from "./scorecardDetail.module.css";

interface ScorecardDetailClientProps {
    scorecard: DispatcherScorecard;
    recentActivity: RecentActivity[];
    initialFrom: string;
    initialTo: string;
}

const DATE_PRESETS = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "custom", label: "Custom" },
];

function getDateRange(preset: string): { from: Date; to: Date } {
    const now = new Date();
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    switch (preset) {
        case "today": {
            const from = new Date(now);
            from.setHours(0, 0, 0, 0);
            return { from, to };
        }
        case "week": {
            const from = new Date(now);
            const day = from.getDay();
            const diff = day === 0 ? 6 : day - 1;
            from.setDate(from.getDate() - diff);
            from.setHours(0, 0, 0, 0);
            return { from, to };
        }
        case "month":
        default: {
            const from = new Date(now.getFullYear(), now.getMonth(), 1);
            from.setHours(0, 0, 0, 0);
            return { from, to };
        }
    }
}

function scoreColor(score: number): string {
    if (score >= 90) return styles.colorGreen;
    if (score >= 70) return styles.colorAmber;
    return styles.colorRed;
}

function activityIcon(type: RecentActivity["type"]): string {
    switch (type) {
        case "confirmation": return "\u260E";
        case "sms": return "\u2709";
        case "shift": return "\u23F0";
        case "quote": return "\u{1F4B0}";
        case "report": return "\u{1F4CB}";
        default: return "\u2022";
    }
}

function formatTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function ScorecardDetailClient({
    scorecard: initialScorecard,
    recentActivity: initialActivity,
    initialFrom,
    initialTo,
}: ScorecardDetailClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [scorecard, setScorecard] = useState(initialScorecard);
    const [activity, setActivity] = useState(initialActivity);
    const [preset, setPreset] = useState("month");
    const [customFrom, setCustomFrom] = useState(initialFrom.split("T")[0]);
    const [customTo, setCustomTo] = useState(initialTo.split("T")[0]);

    const sc = scorecard;
    const cm = sc.confirmationMetrics;
    const comm = sc.communicationMetrics;
    const em = sc.emailMetrics;
    const sm = sc.shiftMetrics;
    const qm = sc.quoteMetrics;

    async function refreshData(from: Date, to: Date) {
        startTransition(async () => {
            const [scResult, actResult] = await Promise.all([
                getDispatcherScorecard(sc.userId, { from, to }),
                getDispatcherRecentActivity(sc.userId, 20),
            ]);
            if (scResult.success && scResult.data) {
                setScorecard(scResult.data);
            }
            if (actResult.success && actResult.data) {
                setActivity(actResult.data);
            }
        });
    }

    async function handlePresetChange(newPreset: string) {
        setPreset(newPreset);
        if (newPreset === "custom") return;
        const range = getDateRange(newPreset);
        await refreshData(range.from, range.to);
    }

    async function handleCustomApply() {
        const from = new Date(customFrom);
        from.setHours(0, 0, 0, 0);
        const to = new Date(customTo);
        to.setHours(23, 59, 59, 999);
        await refreshData(from, to);
    }

    return (
        <div className={styles.container}>
            {/* Back button + header */}
            <button className={styles.backBtn} onClick={() => router.push("/admin/scorecard")}>
                &larr; Back to Leaderboard
            </button>

            <div className={styles.headerCard}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.name}>{sc.userName}</h1>
                    <div className={styles.headerMeta}>
                        <span className={styles.roleBadge}>{sc.role}</span>
                        {sc.userEmail && <span className={styles.email}>{sc.userEmail}</span>}
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.overallScore}>
                        <span className={`${styles.scoreValue} ${scoreColor(sc.overallScore)}`}>
                            {sc.overallScore}
                        </span>
                        <span className={`${styles.letterGrade} ${scoreColor(sc.overallScore)}`}>
                            {sc.letterGrade}
                        </span>
                    </div>
                    <div className={styles.accountabilityBadge}>
                        Accountability: {cm.accountabilityScore}/100
                    </div>
                </div>
            </div>

            {/* Date controls */}
            <div className={styles.controls}>
                <ToggleGroup
                    options={DATE_PRESETS}
                    value={preset}
                    onChange={handlePresetChange}
                    size="sm"
                />
                {preset === "custom" && (
                    <div className={styles.customRange}>
                        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={styles.dateInput} />
                        <span className={styles.dateSeparator}>to</span>
                        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={styles.dateInput} />
                        <button onClick={handleCustomApply} className={styles.applyBtn} disabled={isPending}>Apply</button>
                    </div>
                )}
            </div>

            {isPending && <div className={styles.loadingBar} />}

            {/* 5 Metric Cards */}
            <div className={styles.metricsGrid}>
                {/* Confirmations */}
                <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                        <h3 className={styles.metricTitle}>Confirmations</h3>
                        <span className={`${styles.metricScore} ${scoreColor(sc.categoryScores.confirmations)}`}>
                            {sc.categoryScores.confirmations}
                        </span>
                    </div>
                    <div className={styles.metricBody}>
                        <div className={styles.statRow}>
                            <span>Total Handled</span>
                            <span className={styles.statValue}>{cm.totalHandled}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>On-Time Rate</span>
                            <span className={styles.statValue}>{Math.round(cm.onTimeRate * 100)}%</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Avg Minutes Before Due</span>
                            <span className={styles.statValue}>{cm.avgMinutesBeforeDue.toFixed(0)} min</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Missed</span>
                            <span className={`${styles.statValue} ${cm.missedCount > 0 ? styles.colorRed : ""}`}>
                                {cm.missedCount}
                            </span>
                        </div>
                    </div>
                    {/* Confirmation breakdown bar */}
                    {cm.totalHandled > 0 && (
                        <div className={styles.breakdownBar}>
                            <div
                                className={styles.barOnTime}
                                style={{ width: `${cm.onTimeRate * 100}%` }}
                                title={`On-time: ${cm.onTimeCount}`}
                            />
                            <div
                                className={styles.barLate}
                                style={{ width: `${(1 - cm.onTimeRate) * 100}%` }}
                                title={`Late: ${cm.totalHandled - cm.onTimeCount}`}
                            />
                        </div>
                    )}
                </div>

                {/* Communications */}
                <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                        <h3 className={styles.metricTitle}>Communications</h3>
                        <span className={`${styles.metricScore} ${scoreColor(sc.categoryScores.communications)}`}>
                            {sc.categoryScores.communications}
                        </span>
                    </div>
                    <div className={styles.metricBody}>
                        <div className={styles.statRow}>
                            <span>SMS Sent</span>
                            <span className={styles.statValue}>{comm.smsSent}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>SMS Received</span>
                            <span className={styles.statValue}>{comm.smsReceived}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Avg Response Time</span>
                            <span className={styles.statValue}>
                                {comm.avgResponseTimeMinutes !== null
                                    ? `${comm.avgResponseTimeMinutes} min`
                                    : "N/A"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Email (Front) */}
                <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                        <h3 className={styles.metricTitle}>Email</h3>
                        <span className={`${styles.metricScore} ${scoreColor(sc.categoryScores.email)}`}>
                            {sc.categoryScores.email}
                        </span>
                    </div>
                    <div className={styles.metricBody}>
                        {em ? (
                            <>
                                <div className={styles.statRow}>
                                    <span>Emails Sent</span>
                                    <span className={styles.statValue}>{em.emailsSent}</span>
                                </div>
                                <div className={styles.statRow}>
                                    <span>Emails Received</span>
                                    <span className={styles.statValue}>{em.emailsReceived}</span>
                                </div>
                                <div className={styles.statRow}>
                                    <span>Avg Response Time</span>
                                    <span className={styles.statValue}>
                                        {em.avgResponseTimeMinutes !== null
                                            ? `${em.avgResponseTimeMinutes} min`
                                            : "N/A"}
                                    </span>
                                </div>
                                {Object.keys(em.inboxBreakdown).length > 0 && (
                                    <>
                                        <div className={styles.statRow} style={{ marginTop: "0.5rem", borderTop: "none" }}>
                                            <span style={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>Inbox Breakdown</span>
                                            <span />
                                        </div>
                                        {Object.entries(em.inboxBreakdown)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([inbox, count]) => (
                                                <div key={inbox} className={styles.statRow}>
                                                    <span>{inbox}</span>
                                                    <span className={styles.statValue}>{count}</span>
                                                </div>
                                            ))}
                                    </>
                                )}
                            </>
                        ) : (
                            <div className={styles.notConnected}>
                                Not connected to Front
                            </div>
                        )}
                    </div>
                </div>

                {/* Shifts */}
                <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                        <h3 className={styles.metricTitle}>Punctuality & Shifts</h3>
                        <span className={`${styles.metricScore} ${scoreColor(sc.categoryScores.punctuality)}`}>
                            {sc.categoryScores.punctuality}
                        </span>
                    </div>
                    <div className={styles.metricBody}>
                        <div className={styles.statRow}>
                            <span>Total Shifts</span>
                            <span className={styles.statValue}>{sm.totalShifts}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Avg Clock-In</span>
                            <span className={styles.statValue}>
                                {sm.avgPunctualityMinutes > 0
                                    ? `${sm.avgPunctualityMinutes} min early`
                                    : sm.avgPunctualityMinutes < 0
                                      ? `${Math.abs(sm.avgPunctualityMinutes)} min late`
                                      : "On time"}
                            </span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Self Rating</span>
                            <span className={styles.statValue}>
                                {sm.avgSelfRating !== null ? `${sm.avgSelfRating}/5` : "N/A"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Quote Metrics */}
                <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                        <h3 className={styles.metricTitle}>Quotes</h3>
                        <span className={`${styles.metricScore} ${scoreColor(sc.categoryScores.quotes)}`}>
                            {sc.categoryScores.quotes}
                        </span>
                    </div>
                    <div className={styles.metricBody}>
                        <div className={styles.statRow}>
                            <span>Created</span>
                            <span className={styles.statValue}>{qm.totalCreated}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Won</span>
                            <span className={`${styles.statValue} ${styles.colorGreen}`}>{qm.won}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Lost</span>
                            <span className={`${styles.statValue} ${styles.colorRed}`}>{qm.lost}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Pending</span>
                            <span className={styles.statValue}>{qm.pending}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Conversion Rate</span>
                            <span className={styles.statValue}>{Math.round(qm.conversionRate * 100)}%</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Won Revenue</span>
                            <span className={styles.statValue}>${qm.totalEstimatedRevenue.toLocaleString()}</span>
                        </div>
                    </div>
                    {/* Quote funnel */}
                    {qm.totalCreated > 0 && (
                        <div className={styles.funnelBar}>
                            <div className={styles.funnelCreated} style={{ width: "100%" }}>
                                {qm.totalCreated}
                            </div>
                            {qm.won > 0 && (
                                <div
                                    className={styles.funnelWon}
                                    style={{ width: `${(qm.won / qm.totalCreated) * 100}%` }}
                                >
                                    {qm.won} won
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Report Compliance */}
                <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                        <h3 className={styles.metricTitle}>Report Compliance</h3>
                        <span className={`${styles.metricScore} ${scoreColor(sc.categoryScores.reportCompliance)}`}>
                            {sc.categoryScores.reportCompliance}
                        </span>
                    </div>
                    <div className={styles.metricBody}>
                        <div className={styles.statRow}>
                            <span>Submission Rate</span>
                            <span className={styles.statValue}>
                                {Math.round(sm.reportSubmissionRate * 100)}%
                            </span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Shifts Without Report</span>
                            <span className={`${styles.statValue} ${(sm.totalShifts - Math.round(sm.reportSubmissionRate * sm.totalShifts)) > 0 ? styles.colorRed : ""}`}>
                                {sm.totalShifts - Math.round(sm.reportSubmissionRate * sm.totalShifts)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className={styles.activitySection}>
                <h2 className={styles.sectionTitle}>Recent Activity</h2>
                {activity.length === 0 ? (
                    <p className={styles.emptyActivity}>No recent activity</p>
                ) : (
                    <div className={styles.activityList}>
                        {activity.map((a, i) => (
                            <div key={i} className={styles.activityItem}>
                                <span className={styles.activityIcon}>{activityIcon(a.type)}</span>
                                <span className={styles.activityDesc}>{a.description}</span>
                                <span className={styles.activityTime}>{formatTime(a.timestamp)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
