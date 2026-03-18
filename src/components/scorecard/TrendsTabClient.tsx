"use client";

import { useState, useEffect, useCallback } from "react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { getDailyActivityTrend, getDispatcherActivityComparison } from "@/lib/trendsActions";
import { getConfirmationStatsOptimized } from "@/lib/tripConfirmationActions";
import styles from "./trendsTab.module.css";

interface TrendsTabClientProps {
    startDate: string;
    endDate: string;
}

interface DailyActivity {
    date: string;
    smsSent: number;
    quotesCreated: number;
    confirmationsCompleted: number;
}

interface DispatcherActivity {
    userId: string;
    userName: string;
    smsSent: number;
    quotesCreated: number;
}

interface ConfirmationStats {
    total: number;
    completed: number;
    onTimeRate: number;
}

// Chart colors — use CSS variable values from globals.css
const COLORS = {
    sms: "#3b82f6",       // --info
    quotes: "#f59e0b",    // --warning / tactical-amber
    confirmations: "#10b981", // --success
};

function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className={styles.chartTooltip}>
            <p className={styles.tooltipLabel}>{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className={styles.tooltipRow} style={{ color: entry.color }}>
                    {entry.name}: {entry.value}
                </p>
            ))}
        </div>
    );
}

export default function TrendsTabClient({ startDate, endDate }: TrendsTabClientProps) {
    const [loading, setLoading] = useState(true);
    const [dailyData, setDailyData] = useState<DailyActivity[]>([]);
    const [comparisonData, setComparisonData] = useState<DispatcherActivity[]>([]);
    const [confirmationStats, setConfirmationStats] = useState<ConfirmationStats | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            // Compute days for confirmation stats
            const diffMs = end.getTime() - start.getTime();
            const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

            const [trendResult, compResult, confResult] = await Promise.all([
                getDailyActivityTrend(start, end),
                getDispatcherActivityComparison(start, end),
                getConfirmationStatsOptimized(days),
            ]);

            if (trendResult.success && trendResult.data) {
                setDailyData(trendResult.data);
            }
            if (compResult.success && compResult.data) {
                setComparisonData(compResult.data);
            }
            if (confResult.success && confResult.data) {
                setConfirmationStats({
                    total: confResult.data.total,
                    completed: confResult.data.completed,
                    onTimeRate: confResult.data.onTimeRate,
                });
            }
        } catch (error) {
            console.error("TrendsTab fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Compute summary totals from daily data
    const totalSms = dailyData.reduce((sum, d) => sum + d.smsSent, 0);
    const totalQuotes = dailyData.reduce((sum, d) => sum + d.quotesCreated, 0);

    // Format date labels for chart
    const chartData = dailyData.map((d) => ({
        ...d,
        label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        }),
    }));

    // Format dispatcher names for bar chart
    const barData = comparisonData.map((d) => ({
        ...d,
        name: d.userName.includes(" ") ? d.userName.split(" ")[0] : d.userName,
    }));

    if (loading) {
        return (
            <>
                <div className={styles.summaryGrid}>
                    <div className={styles.skeletonCard} />
                    <div className={styles.skeletonCard} />
                    <div className={styles.skeletonCard} />
                    <div className={styles.skeletonCard} />
                </div>
                <div className={styles.skeletonChart} />
                <div className={styles.skeletonChart} />
            </>
        );
    }

    return (
        <>
            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <p className={styles.cardLabel}>Total SMS Sent</p>
                    <p className={styles.cardValue}>{totalSms.toLocaleString()}</p>
                </div>
                <div className={styles.summaryCard}>
                    <p className={styles.cardLabel}>Quotes Created</p>
                    <p className={styles.cardValue}>{totalQuotes.toLocaleString()}</p>
                </div>
                <div className={styles.summaryCard}>
                    <p className={styles.cardLabel}>Confirmations Completed</p>
                    <p className={styles.cardValue}>
                        {confirmationStats?.completed.toLocaleString() ?? "—"}
                    </p>
                </div>
                <div className={styles.summaryCard}>
                    <p className={styles.cardLabel}>On-Time Rate</p>
                    <p className={styles.cardValueGreen}>
                        {confirmationStats ? `${confirmationStats.onTimeRate}%` : "—"}
                    </p>
                </div>
            </div>

            {/* Daily Activity Trend */}
            <div className={styles.chartSection}>
                <h3 className={styles.chartTitle}>Daily Activity Trend</h3>
                {chartData.length > 0 ? (
                    <div className={styles.chartWrap}>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="gradSms" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.sms} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={COLORS.sms} stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="gradQuotes" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.quotes} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={COLORS.quotes} stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="gradConf" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.confirmations} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={COLORS.confirmations} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis
                                    dataKey="label"
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="smsSent"
                                    stroke={COLORS.sms}
                                    fill="url(#gradSms)"
                                    name="SMS Sent"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="quotesCreated"
                                    stroke={COLORS.quotes}
                                    fill="url(#gradQuotes)"
                                    name="Quotes Created"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="confirmationsCompleted"
                                    stroke={COLORS.confirmations}
                                    fill="url(#gradConf)"
                                    name="Confirmations"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className={styles.chartLegend}>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: COLORS.sms }} />
                                SMS Sent
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: COLORS.quotes }} />
                                Quotes Created
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: COLORS.confirmations }} />
                                Confirmations
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyChart}>
                        No activity data for this period
                    </div>
                )}
            </div>

            {/* Dispatcher Comparison */}
            <div className={styles.chartSection}>
                <h3 className={styles.chartTitle}>Dispatcher Activity — Top 8</h3>
                {barData.length > 0 ? (
                    <div className={styles.chartWrap}>
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={barData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis
                                    type="number"
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    width={80}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar
                                    dataKey="smsSent"
                                    fill={COLORS.sms}
                                    name="SMS Sent"
                                    radius={[0, 4, 4, 0]}
                                />
                                <Bar
                                    dataKey="quotesCreated"
                                    fill={COLORS.quotes}
                                    name="Quotes Created"
                                    radius={[0, 4, 4, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className={styles.chartLegend}>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: COLORS.sms }} />
                                SMS Sent
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: COLORS.quotes }} />
                                Quotes Created
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyChart}>
                        No dispatcher activity for this period
                    </div>
                )}
            </div>
        </>
    );
}
