"use client";

import { useState, useEffect, useCallback } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { getDispatcherHours } from "@/lib/hoursActions";
import styles from "./hoursTab.module.css";

interface HoursTabClientProps {
    startDate: string;
    endDate: string;
}

interface HoursSummary {
    userId: string;
    userName: string;
    scheduledHours: number;
    workedHours: number;
    overtime: number;
}

const COLORS = {
    scheduled: "#3b82f6",  // --info
    worked: "#10b981",     // --success
    overtime: "#d97706",   // --tactical-amber-dim
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
                    {entry.name}: {entry.value}h
                </p>
            ))}
        </div>
    );
}

export default function HoursTabClient({ startDate, endDate }: HoursTabClientProps) {
    const [loading, setLoading] = useState(true);
    const [hours, setHours] = useState<HoursSummary[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const result = await getDispatcherHours(start, end);
            if (result.success && result.data) {
                setHours(result.data);
            }
        } catch (error) {
            console.error("HoursTab fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Totals
    const totalScheduled = hours.reduce((sum, h) => sum + h.scheduledHours, 0);
    const totalWorked = hours.reduce((sum, h) => sum + h.workedHours, 0);
    const totalOvertime = hours.reduce((sum, h) => sum + h.overtime, 0);

    // Chart data — top 10 by worked hours
    const chartData = [...hours]
        .sort((a, b) => b.workedHours - a.workedHours)
        .slice(0, 10)
        .map((h) => ({
            name: h.userName.includes(" ") ? h.userName.split(" ")[0] : h.userName,
            scheduled: h.scheduledHours,
            worked: h.workedHours,
            overtime: h.overtime,
        }));

    // Table data — sorted by worked hours desc
    const tableData = [...hours].sort((a, b) => b.workedHours - a.workedHours);

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
                <div className={styles.skeletonTable} />
            </>
        );
    }

    return (
        <>
            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <p className={styles.cardLabel}>Total Scheduled</p>
                    <p className={styles.cardValue}>{totalScheduled.toFixed(1)}h</p>
                </div>
                <div className={styles.summaryCard}>
                    <p className={styles.cardLabel}>Total Worked</p>
                    <p className={styles.cardValue}>{totalWorked.toFixed(1)}h</p>
                </div>
                <div className={styles.summaryCard}>
                    <p className={styles.cardLabel}>Total Overtime</p>
                    <p className={totalOvertime > 0 ? styles.cardValueWarning : styles.cardValue}>
                        {totalOvertime.toFixed(1)}h
                    </p>
                </div>
                <div className={styles.summaryCard}>
                    <p className={styles.cardLabel}>Active Dispatchers</p>
                    <p className={styles.cardValue}>{hours.length}</p>
                </div>
            </div>

            {/* Hours by Dispatcher Chart */}
            <div className={styles.chartSection}>
                <h3 className={styles.chartTitle}>Hours by Dispatcher — Top 10</h3>
                {chartData.length > 0 ? (
                    <div className={styles.chartWrap}>
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${v}h`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar
                                    dataKey="scheduled"
                                    fill={COLORS.scheduled}
                                    name="Scheduled"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                    dataKey="worked"
                                    fill={COLORS.worked}
                                    name="Worked"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                    dataKey="overtime"
                                    fill={COLORS.overtime}
                                    name="Overtime"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className={styles.chartLegend}>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: COLORS.scheduled }} />
                                Scheduled
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: COLORS.worked }} />
                                Worked
                            </div>
                            <div className={styles.legendItem}>
                                <span className={styles.legendDot} style={{ background: COLORS.overtime }} />
                                Overtime
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles.emptyChart}>
                        No hours data for this period
                    </div>
                )}
            </div>

            {/* Hours Summary Table */}
            <div className={styles.tableSection}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Dispatcher</th>
                            <th className={styles.thRight}>Scheduled</th>
                            <th className={styles.thRight}>Worked</th>
                            <th className={styles.thRight}>Overtime</th>
                            <th className={styles.thRight}>Efficiency</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.length === 0 && (
                            <tr>
                                <td colSpan={5} className={styles.emptyRow}>
                                    No dispatcher hours for this period
                                </td>
                            </tr>
                        )}
                        {tableData.map((d) => {
                            const efficiency = d.scheduledHours > 0
                                ? Math.min(100, Math.round((d.workedHours / d.scheduledHours) * 100))
                                : 0;
                            const effClass = efficiency >= 90
                                ? styles.efficiencyHigh
                                : efficiency >= 70
                                  ? styles.efficiencyMid
                                  : styles.efficiencyLow;

                            return (
                                <tr key={d.userId}>
                                    <td className={styles.tdName}>{d.userName}</td>
                                    <td className={styles.tdScheduled}>{d.scheduledHours}h</td>
                                    <td className={styles.tdWorked}>{d.workedHours}h</td>
                                    <td className={d.overtime > 0 ? styles.tdOvertimeActive : styles.tdOvertime}>
                                        {d.overtime > 0 ? `+${d.overtime}h` : "—"}
                                    </td>
                                    <td className={styles.tdRight}>
                                        <span className={effClass}>{efficiency}%</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}
