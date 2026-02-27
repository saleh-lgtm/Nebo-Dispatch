"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Trophy,
    TrendingUp,
    RefreshCw,
    Users,
    Zap,
    Award,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import {
    getEngagementReport,
    getDailyEngagementTrend,
    ENGAGEMENT_POINTS,
    type DispatcherEngagement,
} from "@/lib/engagementActions";

interface ChartData {
    date: string;
    total: number;
    [key: string]: string | number;
}

interface DispatcherInfo {
    id: string;
    name: string;
    color: string;
}

interface Props {
    initialDays?: number;
}

const CHART_COLORS = [
    "#3b82f6", // blue
    "#22c55e", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#f97316", // orange
    "#6366f1", // indigo
];

export default function EngagementLeaderboard({ initialDays = 7 }: Props) {
    const [days, setDays] = useState(initialDays);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [dispatchers, setDispatchers] = useState<DispatcherInfo[]>([]);
    const [leaderboard, setLeaderboard] = useState<DispatcherEngagement[]>([]);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [trendData, reportData] = await Promise.all([
                getDailyEngagementTrend(days),
                getEngagementReport(days),
            ]);

            setChartData(trendData.chartData);
            setDispatchers(trendData.dispatchers);
            setLeaderboard(reportData.dispatchers);
        } catch (error) {
            console.error("Failed to fetch engagement data:", error);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        fetchData();
    };

    const handleDaysChange = (newDays: number) => {
        setDays(newDays);
    };

    const toggleExpanded = (userId: string) => {
        setExpandedUser(expandedUser === userId ? null : userId);
    };

    // Calculate totals
    const totalActions = leaderboard.reduce((sum, d) => sum + d.totalActions, 0);
    const totalPoints = leaderboard.reduce((sum, d) => sum + d.totalPoints, 0);
    const topPerformer = leaderboard[0];

    // Custom tooltip
    const CustomTooltip = ({
        active,
        payload,
        label,
    }: {
        active?: boolean;
        payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
        label?: string;
    }) => {
        if (active && payload && payload.length) {
            const dispatcherPayloads = payload.filter((p) => p.dataKey !== "total");
            return (
                <div
                    style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                >
                    <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{label}</p>
                    {dispatcherPayloads.map((entry, index) => {
                        const dispatcherInfo = dispatchers.find((d) => d.id === entry.dataKey);
                        return (
                            <p
                                key={index}
                                style={{ color: entry.color, fontSize: "0.875rem" }}
                            >
                                {dispatcherInfo?.name || entry.name}: {entry.value} actions
                            </p>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <Trophy size={28} style={{ color: "#FFE66D" }} />
                    <div>
                        <h2 className="font-display" style={{ fontSize: "1.5rem" }}>
                            Dispatcher Engagement
                        </h2>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Track actions and performance across the team
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                        {[7, 14, 30].map((d) => (
                            <button
                                key={d}
                                onClick={() => handleDaysChange(d)}
                                className={`btn ${days === d ? "btn-primary" : "btn-outline"}`}
                                style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}
                            >
                                {d} Days
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleRefresh}
                        className="btn btn-outline"
                        disabled={loading}
                        style={{ padding: "0.5rem 0.75rem" }}
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "1rem",
                }}
            >
                <div className="glass-card flex items-center gap-4">
                    <div
                        style={{
                            padding: "0.75rem",
                            borderRadius: "0.5rem",
                            background: "rgba(59, 130, 246, 0.1)",
                        }}
                    >
                        <Zap size={24} style={{ color: "#3b82f6" }} />
                    </div>
                    <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            Total Actions
                        </p>
                        <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalActions}</h3>
                    </div>
                </div>

                <div className="glass-card flex items-center gap-4">
                    <div
                        style={{
                            padding: "0.75rem",
                            borderRadius: "0.5rem",
                            background: "rgba(34, 197, 94, 0.1)",
                        }}
                    >
                        <TrendingUp size={24} style={{ color: "#22c55e" }} />
                    </div>
                    <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            Total Points
                        </p>
                        <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalPoints}</h3>
                    </div>
                </div>

                <div className="glass-card flex items-center gap-4">
                    <div
                        style={{
                            padding: "0.75rem",
                            borderRadius: "0.5rem",
                            background: "rgba(139, 92, 246, 0.1)",
                        }}
                    >
                        <Users size={24} style={{ color: "#8b5cf6" }} />
                    </div>
                    <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            Active Dispatchers
                        </p>
                        <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{leaderboard.length}</h3>
                    </div>
                </div>

                {topPerformer && (
                    <div className="glass-card flex items-center gap-4">
                        <div
                            style={{
                                padding: "0.75rem",
                                borderRadius: "0.5rem",
                                background: "rgba(255, 230, 109, 0.15)",
                            }}
                        >
                            <Award size={24} style={{ color: "#FFE66D" }} />
                        </div>
                        <div>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                Top Performer
                            </p>
                            <h3 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                                {topPerformer.userName.split(" ")[0]}
                            </h3>
                        </div>
                    </div>
                )}
            </div>

            {/* Area Chart */}
            <div className="glass-card">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={20} className="text-accent" />
                    <h3 className="font-display" style={{ fontSize: "1.25rem" }}>
                        Daily Actions Trend
                    </h3>
                </div>

                {loading ? (
                    <div
                        style={{
                            height: 320,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <RefreshCw size={32} className="animate-spin" style={{ opacity: 0.5 }} />
                    </div>
                ) : chartData.length > 0 ? (
                    <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    {dispatchers.map((dispatcher) => (
                                        <linearGradient
                                            key={dispatcher.id}
                                            id={`color-${dispatcher.id}`}
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="5%"
                                                stopColor={dispatcher.color}
                                                stopOpacity={0.8}
                                            />
                                            <stop
                                                offset="95%"
                                                stopColor={dispatcher.color}
                                                stopOpacity={0.1}
                                            />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(255,255,255,0.1)"
                                />
                                <XAxis
                                    dataKey="date"
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return date.toLocaleDateString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                        });
                                    }}
                                />
                                <YAxis
                                    stroke="var(--text-secondary)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    formatter={(value) => {
                                        const dispatcher = dispatchers.find((d) => d.id === value);
                                        return (
                                            <span
                                                style={{
                                                    color: "var(--text-secondary)",
                                                    fontSize: "0.75rem",
                                                }}
                                            >
                                                {dispatcher?.name || value}
                                            </span>
                                        );
                                    }}
                                />
                                {dispatchers.map((dispatcher) => (
                                    <Area
                                        key={dispatcher.id}
                                        type="monotone"
                                        dataKey={dispatcher.id}
                                        stackId="1"
                                        stroke={dispatcher.color}
                                        fillOpacity={1}
                                        fill={`url(#color-${dispatcher.id})`}
                                        name={dispatcher.id}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <TrendingUp
                            size={48}
                            style={{ opacity: 0.2, margin: "0 auto 1rem" }}
                        />
                        <p style={{ color: "var(--text-secondary)" }}>
                            No engagement data available for this period.
                        </p>
                    </div>
                )}
            </div>

            {/* Leaderboard Table */}
            <div className="glass-card">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Trophy size={20} style={{ color: "#FFE66D" }} />
                        <h3 className="font-display" style={{ fontSize: "1.25rem" }}>
                            Engagement Leaderboard
                        </h3>
                    </div>
                    <div
                        style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            display: "flex",
                            gap: "1rem",
                        }}
                    >
                        <span>Q:{ENGAGEMENT_POINTS.QUOTE_CREATED}pts</span>
                        <span>T:{ENGAGEMENT_POINTS.TRIP_CONFIRMED}pts</span>
                        <span>S:{ENGAGEMENT_POINTS.SMS_SENT}pts</span>
                        <span>Task:{ENGAGEMENT_POINTS.TASK_COMPLETED}pts</span>
                    </div>
                </div>

                {loading ? (
                    <div
                        style={{
                            height: 200,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <RefreshCw size={32} className="animate-spin" style={{ opacity: 0.5 }} />
                    </div>
                ) : leaderboard.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                minWidth: "600px",
                            }}
                        >
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    <th
                                        style={{
                                            padding: "0.75rem 1rem",
                                            textAlign: "left",
                                            fontWeight: 500,
                                            width: "60px",
                                        }}
                                    >
                                        Rank
                                    </th>
                                    <th
                                        style={{
                                            padding: "0.75rem 1rem",
                                            textAlign: "left",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Dispatcher
                                    </th>
                                    <th
                                        style={{
                                            padding: "0.75rem 1rem",
                                            textAlign: "center",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Actions
                                    </th>
                                    <th
                                        style={{
                                            padding: "0.75rem 1rem",
                                            textAlign: "center",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Points
                                    </th>
                                    <th
                                        style={{
                                            padding: "0.75rem 1rem",
                                            textAlign: "center",
                                            fontWeight: 500,
                                            width: "50px",
                                        }}
                                    >

                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {leaderboard.map((dispatcher, index) => (
                                    <>
                                        <tr
                                            key={dispatcher.userId}
                                            style={{
                                                borderBottom: expandedUser === dispatcher.userId ? "none" : "1px solid var(--border)",
                                                background:
                                                    index === 0
                                                        ? "rgba(255, 230, 109, 0.05)"
                                                        : index === 1
                                                        ? "rgba(192, 192, 192, 0.05)"
                                                        : index === 2
                                                        ? "rgba(205, 127, 50, 0.05)"
                                                        : "transparent",
                                                cursor: "pointer",
                                            }}
                                            onClick={() => toggleExpanded(dispatcher.userId)}
                                        >
                                            <td
                                                style={{
                                                    padding: "0.75rem 1rem",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        width: "28px",
                                                        height: "28px",
                                                        borderRadius: "50%",
                                                        background:
                                                            index === 0
                                                                ? "linear-gradient(135deg, #FFE66D, #f59e0b)"
                                                                : index === 1
                                                                ? "linear-gradient(135deg, #e5e7eb, #9ca3af)"
                                                                : index === 2
                                                                ? "linear-gradient(135deg, #cd7f32, #8b4513)"
                                                                : "var(--bg-tertiary)",
                                                        color:
                                                            index < 3 ? "#1a1a1a" : "var(--text-primary)",
                                                        fontSize: "0.875rem",
                                                    }}
                                                >
                                                    {index + 1}
                                                </span>
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.75rem 1rem",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {dispatcher.userName}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.75rem 1rem",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {dispatcher.totalActions}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.75rem 1rem",
                                                    textAlign: "center",
                                                    fontWeight: 600,
                                                    color: "#22c55e",
                                                }}
                                            >
                                                {dispatcher.totalPoints}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "0.75rem 1rem",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {expandedUser === dispatcher.userId ? (
                                                    <ChevronUp size={18} style={{ color: "var(--text-secondary)" }} />
                                                ) : (
                                                    <ChevronDown size={18} style={{ color: "var(--text-secondary)" }} />
                                                )}
                                            </td>
                                        </tr>
                                        {expandedUser === dispatcher.userId && (
                                            <tr key={`${dispatcher.userId}-details`}>
                                                <td
                                                    colSpan={5}
                                                    style={{
                                                        padding: "0 1rem 1rem 1rem",
                                                        borderBottom: "1px solid var(--border)",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "grid",
                                                            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                                            gap: "0.75rem",
                                                            padding: "1rem",
                                                            background: "var(--bg-tertiary)",
                                                            borderRadius: "0.5rem",
                                                        }}
                                                    >
                                                        <div>
                                                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                                                Quotes
                                                            </p>
                                                            <p style={{ fontWeight: 600 }}>
                                                                {dispatcher.breakdown.quotesCreated}{" "}
                                                                <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                                                                    (+{dispatcher.breakdown.quotesCreated * ENGAGEMENT_POINTS.QUOTE_CREATED}pts)
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                                                Trips Confirmed
                                                            </p>
                                                            <p style={{ fontWeight: 600 }}>
                                                                {dispatcher.breakdown.tripsConfirmed}{" "}
                                                                <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                                                                    (+{dispatcher.breakdown.tripsConfirmed * ENGAGEMENT_POINTS.TRIP_CONFIRMED}pts)
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                                                SMS Sent
                                                            </p>
                                                            <p style={{ fontWeight: 600 }}>
                                                                {dispatcher.breakdown.smsSent}{" "}
                                                                <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                                                                    (+{dispatcher.breakdown.smsSent * ENGAGEMENT_POINTS.SMS_SENT}pts)
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                                                Tasks Completed
                                                            </p>
                                                            <p style={{ fontWeight: 600 }}>
                                                                {dispatcher.breakdown.tasksCompleted}{" "}
                                                                <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                                                                    (+{dispatcher.breakdown.tasksCompleted * ENGAGEMENT_POINTS.TASK_COMPLETED}pts)
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                                                Billing Reviews
                                                            </p>
                                                            <p style={{ fontWeight: 600 }}>
                                                                {dispatcher.breakdown.billingReviews}{" "}
                                                                <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                                                                    (+{dispatcher.breakdown.billingReviews * ENGAGEMENT_POINTS.BILLING_REVIEW}pts)
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                                                Shift Notes
                                                            </p>
                                                            <p style={{ fontWeight: 600 }}>
                                                                {dispatcher.breakdown.shiftNotesCreated}{" "}
                                                                <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                                                                    (+{dispatcher.breakdown.shiftNotesCreated * ENGAGEMENT_POINTS.SHIFT_NOTE_CREATED}pts)
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                                                Announcements
                                                            </p>
                                                            <p style={{ fontWeight: 600 }}>
                                                                {dispatcher.breakdown.announcementsAcknowledged}{" "}
                                                                <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                                                                    (+{dispatcher.breakdown.announcementsAcknowledged * ENGAGEMENT_POINTS.ANNOUNCEMENT_ACKNOWLEDGED}pts)
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                                                Quote Follow-ups
                                                            </p>
                                                            <p style={{ fontWeight: 600 }}>
                                                                {dispatcher.breakdown.quoteFollowups}{" "}
                                                                <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                                                                    (+{dispatcher.breakdown.quoteFollowups * ENGAGEMENT_POINTS.QUOTE_FOLLOWUP}pts)
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Users size={48} style={{ opacity: 0.2, margin: "0 auto 1rem" }} />
                        <p style={{ color: "var(--text-secondary)" }}>
                            No dispatcher data found for this period.
                        </p>
                    </div>
                )}
            </div>

            {/* Point Values Legend */}
            <div className="glass-card" style={{ padding: "1rem" }}>
                <div className="flex items-center gap-2 mb-3">
                    <Zap size={16} className="text-accent" />
                    <h4 style={{ fontSize: "0.875rem", fontWeight: 600 }}>Point Values</h4>
                </div>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "1rem",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                    }}
                >
                    <span>Quote Created: <strong style={{ color: "#22c55e" }}>{ENGAGEMENT_POINTS.QUOTE_CREATED}pts</strong></span>
                    <span>Trip Confirmed: <strong style={{ color: "#22c55e" }}>{ENGAGEMENT_POINTS.TRIP_CONFIRMED}pts</strong></span>
                    <span>SMS Sent: <strong style={{ color: "#22c55e" }}>{ENGAGEMENT_POINTS.SMS_SENT}pts</strong></span>
                    <span>Task Completed: <strong style={{ color: "#22c55e" }}>{ENGAGEMENT_POINTS.TASK_COMPLETED}pts</strong></span>
                    <span>Billing Review: <strong style={{ color: "#22c55e" }}>{ENGAGEMENT_POINTS.BILLING_REVIEW}pts</strong></span>
                    <span>Shift Note: <strong style={{ color: "#22c55e" }}>{ENGAGEMENT_POINTS.SHIFT_NOTE_CREATED}pts</strong></span>
                    <span>Announcement Ack: <strong style={{ color: "#22c55e" }}>{ENGAGEMENT_POINTS.ANNOUNCEMENT_ACKNOWLEDGED}pts</strong></span>
                    <span>Quote Follow-up: <strong style={{ color: "#22c55e" }}>{ENGAGEMENT_POINTS.QUOTE_FOLLOWUP}pts</strong></span>
                </div>
            </div>
        </div>
    );
}
