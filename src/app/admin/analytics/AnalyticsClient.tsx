"use client";

import { useState } from "react";
import {
    BarChart3,
    Phone,
    Mail,
    FileText,
    Clock,
    TrendingUp,
    Users,
    Calendar,
    RefreshCw,
    Award,
    PhoneCall,
    AlertTriangle,
    ArrowRight,
} from "lucide-react";
import Link from "next/link";
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
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import { getPerformanceMetrics, getDispatcherComparison, getDailyTrend } from "@/lib/analyticsActions";
import { getDispatcherHours } from "@/lib/hoursActions";

interface OverallMetrics {
    totalCalls: number;
    totalEmails: number;
    totalQuotes: number;
    totalReports: number;
    averageCallsPerShift: number;
}

interface DispatcherMetrics {
    userId: string;
    userName: string;
    calls: number;
    emails: number;
    quotes: number;
    reportCount: number;
}

interface DailyTrend {
    date: string;
    calls: number;
    emails: number;
    quotes: number;
}

interface HoursSummary {
    userId: string;
    userName: string;
    scheduledHours: number;
    workedHours: number;
    overtime: number;
}

interface ConfirmationSummary {
    total: number;
    completed: number;
    expired: number;
    onTimeRate: number;
}

interface Props {
    initialMetrics: OverallMetrics;
    initialComparison: DispatcherMetrics[];
    initialDailyTrend: DailyTrend[];
    initialHours: HoursSummary[];
    initialStartDate: string;
    initialEndDate: string;
    confirmationSummary?: ConfirmationSummary;
}

const CHART_COLORS = {
    calls: "#4ECDC4",
    emails: "#FF6B6B",
    quotes: "#FFE66D",
    scheduled: "#4ECDC4",
    worked: "#96CEB4",
    overtime: "#FF6B6B",
};

const PIE_COLORS = ["#4ECDC4", "#FF6B6B", "#FFE66D", "#B7AFA3"];

export default function AnalyticsClient({
    initialMetrics,
    initialComparison,
    initialDailyTrend,
    initialHours,
    initialStartDate,
    initialEndDate,
    confirmationSummary,
}: Props) {
    const [activeTab, setActiveTab] = useState<"performance" | "hours">("performance");
    const [metrics, setMetrics] = useState(initialMetrics);
    const [comparison, setComparison] = useState(initialComparison);
    const [dailyTrend, setDailyTrend] = useState(initialDailyTrend);
    const [hours, setHours] = useState(initialHours);
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [loading, setLoading] = useState(false);

    const handleDateChange = async () => {
        setLoading(true);
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const [newMetrics, newComparison, newTrend, newHours] = await Promise.all([
                getPerformanceMetrics(start, end),
                getDispatcherComparison(start, end),
                getDailyTrend(start, end),
                getDispatcherHours(start, end),
            ]);

            setMetrics(newMetrics);
            setComparison(newComparison);
            setDailyTrend(newTrend);
            setHours(newHours);
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const setPresetRange = (preset: "today" | "7days" | "30days" | "thisMonth") => {
        const end = new Date();
        const start = new Date();

        switch (preset) {
            case "today":
                break;
            case "7days":
                start.setDate(start.getDate() - 7);
                break;
            case "30days":
                start.setDate(start.getDate() - 30);
                break;
            case "thisMonth":
                start.setDate(1);
                break;
        }

        setStartDate(start.toISOString().split("T")[0]);
        setEndDate(end.toISOString().split("T")[0]);
    };

    const totalScheduledHours = hours.reduce((sum, h) => sum + h.scheduledHours, 0);
    const totalWorkedHours = hours.reduce((sum, h) => sum + h.workedHours, 0);
    const totalOvertime = hours.reduce((sum, h) => sum + h.overtime, 0);

    // Prepare chart data
    const trendChartData = dailyTrend.map((day) => ({
        ...day,
        date: new Date(day.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        total: day.calls + day.emails + day.quotes,
    }));

    const dispatcherChartData = comparison.slice(0, 8).map((d) => ({
        name: d.userName.split(" ")[0],
        calls: d.calls,
        emails: d.emails,
        quotes: d.quotes,
    }));

    const metricsBreakdown = [
        { name: "Calls", value: metrics.totalCalls },
        { name: "Emails", value: metrics.totalEmails },
        { name: "Quotes", value: metrics.totalQuotes },
    ].filter((m) => m.value > 0);

    const hoursChartData = hours.slice(0, 10).map((h) => ({
        name: h.userName.split(" ")[0],
        scheduled: h.scheduledHours,
        worked: h.workedHours,
        overtime: h.overtime,
    }));

    // Find top performer
    const topPerformer = comparison.length > 0
        ? comparison.reduce((top, d) => (d.calls + d.emails + d.quotes > top.calls + top.emails + top.quotes ? d : top))
        : null;

    // Custom tooltip component
    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}>
                    <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color, fontSize: "0.875rem" }}>
                            {entry.name}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: "1.5rem" }}>
            {/* Header */}
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <BarChart3 size={28} className="text-accent" />
                    <div>
                        <h1 className="font-display" style={{ fontSize: "1.75rem" }}>
                            Analytics Dashboard
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                            Performance metrics and hours tracking
                        </p>
                    </div>
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPresetRange("today")}
                            className="btn btn-outline"
                            style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setPresetRange("7days")}
                            className="btn btn-outline"
                            style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}
                        >
                            7 Days
                        </button>
                        <button
                            onClick={() => setPresetRange("30days")}
                            className="btn btn-outline"
                            style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}
                        >
                            30 Days
                        </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="date"
                            className="input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ padding: "0.5rem", fontSize: "0.875rem" }}
                        />
                        <span style={{ color: "var(--text-secondary)" }}>to</span>
                        <input
                            type="date"
                            className="input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ padding: "0.5rem", fontSize: "0.875rem" }}
                        />
                        <button
                            onClick={handleDateChange}
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ padding: "0.5rem 1rem" }}
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <button
                    onClick={() => setActiveTab("performance")}
                    style={{
                        padding: "0.75rem 1rem",
                        background: "none",
                        border: "none",
                        borderBottom: activeTab === "performance" ? "2px solid var(--accent)" : "2px solid transparent",
                        color: activeTab === "performance" ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: activeTab === "performance" ? 600 : 400,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                    }}
                >
                    <TrendingUp size={18} /> Performance
                </button>
                <button
                    onClick={() => setActiveTab("hours")}
                    style={{
                        padding: "0.75rem 1rem",
                        background: "none",
                        border: "none",
                        borderBottom: activeTab === "hours" ? "2px solid var(--accent)" : "2px solid transparent",
                        color: activeTab === "hours" ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: activeTab === "hours" ? 600 : 400,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                    }}
                >
                    <Clock size={18} /> Hours Tracking
                </button>
            </div>

            {/* Performance Tab */}
            {activeTab === "performance" && (
                <>
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
                                    background: "rgba(78, 205, 196, 0.1)",
                                }}
                            >
                                <Phone size={24} style={{ color: "#4ECDC4" }} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Total Calls
                                </p>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{metrics.totalCalls}</h3>
                            </div>
                        </div>

                        <div className="glass-card flex items-center gap-4">
                            <div
                                style={{
                                    padding: "0.75rem",
                                    borderRadius: "0.5rem",
                                    background: "rgba(255, 107, 107, 0.1)",
                                }}
                            >
                                <Mail size={24} style={{ color: "#FF6B6B" }} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Emails Sent
                                </p>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{metrics.totalEmails}</h3>
                            </div>
                        </div>

                        <div className="glass-card flex items-center gap-4">
                            <div
                                style={{
                                    padding: "0.75rem",
                                    borderRadius: "0.5rem",
                                    background: "rgba(255, 230, 109, 0.1)",
                                }}
                            >
                                <FileText size={24} style={{ color: "#FFE66D" }} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Quotes Given
                                </p>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{metrics.totalQuotes}</h3>
                            </div>
                        </div>

                        <div className="glass-card flex items-center gap-4">
                            <div
                                style={{
                                    padding: "0.75rem",
                                    borderRadius: "0.5rem",
                                    background: "rgba(183, 175, 163, 0.1)",
                                }}
                            >
                                <TrendingUp size={24} className="text-accent" />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Avg Calls/Shift
                                </p>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                                    {metrics.averageCallsPerShift}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
                        {/* Daily Trend Chart */}
                        <div className="glass-card">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar size={20} className="text-accent" />
                                <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                                    Daily Activity Trend
                                </h2>
                            </div>

                            {trendChartData.length > 0 ? (
                                <div style={{ height: 280 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendChartData}>
                                            <defs>
                                                <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.calls} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.calls} stopOpacity={0.1} />
                                                </linearGradient>
                                                <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.emails} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.emails} stopOpacity={0.1} />
                                                </linearGradient>
                                                <linearGradient id="colorQuotes" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.quotes} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.quotes} stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis
                                                dataKey="date"
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
                                                dataKey="calls"
                                                stroke={CHART_COLORS.calls}
                                                fillOpacity={1}
                                                fill="url(#colorCalls)"
                                                name="Calls"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="emails"
                                                stroke={CHART_COLORS.emails}
                                                fillOpacity={1}
                                                fill="url(#colorEmails)"
                                                name="Emails"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="quotes"
                                                stroke={CHART_COLORS.quotes}
                                                fillOpacity={1}
                                                fill="url(#colorQuotes)"
                                                name="Quotes"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Calendar size={48} style={{ opacity: 0.2, margin: "0 auto 1rem" }} />
                                    <p style={{ color: "var(--text-secondary)" }}>
                                        No daily data available for this period.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Metrics Breakdown Pie Chart */}
                        <div className="glass-card">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 size={20} className="text-accent" />
                                <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                                    Activity Breakdown
                                </h2>
                            </div>

                            {metricsBreakdown.length > 0 ? (
                                <div style={{ height: 280 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={metricsBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {metricsBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend
                                                verticalAlign="bottom"
                                                height={36}
                                                formatter={(value) => (
                                                    <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                                        {value}
                                                    </span>
                                                )}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <BarChart3 size={48} style={{ opacity: 0.2, margin: "0 auto 1rem" }} />
                                    <p style={{ color: "var(--text-secondary)" }}>
                                        No activity data available.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dispatcher Comparison Bar Chart */}
                    <div className="glass-card">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Users size={20} className="text-accent" />
                                <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                                    Dispatcher Performance
                                </h2>
                            </div>

                            {topPerformer && (
                                <div className="flex items-center gap-2" style={{ padding: "0.5rem 1rem", background: "rgba(255, 230, 109, 0.1)", borderRadius: "9999px" }}>
                                    <Award size={16} style={{ color: "#FFE66D" }} />
                                    <span style={{ fontSize: "0.875rem", color: "#FFE66D" }}>
                                        Top: {topPerformer.userName}
                                    </span>
                                </div>
                            )}
                        </div>

                        {dispatcherChartData.length > 0 ? (
                            <div style={{ height: 300 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dispatcherChartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            stroke="var(--text-secondary)"
                                            fontSize={12}
                                            width={80}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend
                                            verticalAlign="top"
                                            height={36}
                                            formatter={(value) => (
                                                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                                    {value}
                                                </span>
                                            )}
                                        />
                                        <Bar dataKey="calls" fill={CHART_COLORS.calls} name="Calls" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="emails" fill={CHART_COLORS.emails} name="Emails" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="quotes" fill={CHART_COLORS.quotes} name="Quotes" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
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

                    {/* Confirmation Accountability Summary */}
                    {confirmationSummary && (
                        <Link href="/admin/confirmations" style={{ textDecoration: "none" }}>
                            <div
                                className="glass-card"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "1.25rem",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    border: "1px solid var(--glass-border)",
                                }}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        style={{
                                            padding: "0.75rem",
                                            borderRadius: "0.5rem",
                                            background:
                                                confirmationSummary.expired > 0
                                                    ? "rgba(255, 107, 107, 0.15)"
                                                    : "rgba(78, 205, 196, 0.15)",
                                        }}
                                    >
                                        <PhoneCall
                                            size={24}
                                            style={{
                                                color:
                                                    confirmationSummary.expired > 0
                                                        ? "#FF6B6B"
                                                        : "#4ECDC4",
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                            2-Hour Confirmations
                                        </h3>
                                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                            {confirmationSummary.completed} completed,{" "}
                                            {confirmationSummary.expired > 0 && (
                                                <span style={{ color: "#FF6B6B" }}>
                                                    {confirmationSummary.expired} missed
                                                </span>
                                            )}
                                            {confirmationSummary.expired === 0 && (
                                                <span style={{ color: "#4ade80" }}>0 missed</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        {confirmationSummary.expired > 0 && (
                                            <AlertTriangle size={18} style={{ color: "#fbbf24" }} />
                                        )}
                                        <span
                                            style={{
                                                padding: "0.375rem 0.75rem",
                                                borderRadius: "9999px",
                                                fontSize: "0.875rem",
                                                fontWeight: 600,
                                                background:
                                                    confirmationSummary.onTimeRate >= 90
                                                        ? "rgba(74, 222, 128, 0.15)"
                                                        : confirmationSummary.onTimeRate >= 70
                                                        ? "rgba(251, 191, 36, 0.15)"
                                                        : "rgba(248, 113, 113, 0.15)",
                                                color:
                                                    confirmationSummary.onTimeRate >= 90
                                                        ? "#4ade80"
                                                        : confirmationSummary.onTimeRate >= 70
                                                        ? "#fbbf24"
                                                        : "#f87171",
                                            }}
                                        >
                                            {confirmationSummary.onTimeRate}% on-time
                                        </span>
                                    </div>
                                    <ArrowRight size={18} style={{ color: "var(--text-secondary)" }} />
                                </div>
                            </div>
                        </Link>
                    )}
                </>
            )}

            {/* Hours Tab */}
            {activeTab === "hours" && (
                <>
                    {/* Hours Summary Cards */}
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
                                    background: "rgba(183, 175, 163, 0.1)",
                                }}
                            >
                                <Clock size={24} className="text-accent" />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Total Scheduled
                                </p>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                                    {totalScheduledHours.toFixed(1)}h
                                </h3>
                            </div>
                        </div>

                        <div className="glass-card flex items-center gap-4">
                            <div
                                style={{
                                    padding: "0.75rem",
                                    borderRadius: "0.5rem",
                                    background: "rgba(150, 206, 180, 0.1)",
                                }}
                            >
                                <Clock size={24} style={{ color: "#96CEB4" }} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Total Worked
                                </p>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                                    {totalWorkedHours.toFixed(1)}h
                                </h3>
                            </div>
                        </div>

                        <div className="glass-card flex items-center gap-4">
                            <div
                                style={{
                                    padding: "0.75rem",
                                    borderRadius: "0.5rem",
                                    background: "rgba(255, 107, 107, 0.1)",
                                }}
                            >
                                <TrendingUp size={24} style={{ color: "#FF6B6B" }} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Total Overtime
                                </p>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                                    {totalOvertime.toFixed(1)}h
                                </h3>
                            </div>
                        </div>

                        <div className="glass-card flex items-center gap-4">
                            <div
                                style={{
                                    padding: "0.75rem",
                                    borderRadius: "0.5rem",
                                    background: "rgba(78, 205, 196, 0.1)",
                                }}
                            >
                                <Users size={24} style={{ color: "#4ECDC4" }} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Active Dispatchers
                                </p>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{hours.length}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Hours by Dispatcher Chart */}
                    <div className="glass-card">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={20} className="text-accent" />
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                                Hours by Dispatcher
                            </h2>
                        </div>

                        {hoursChartData.length > 0 ? (
                            <div style={{ height: 350 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={hoursChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
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
                                            tickFormatter={(value) => `${value}h`}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend
                                            verticalAlign="top"
                                            height={36}
                                            formatter={(value) => (
                                                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                                    {value}
                                                </span>
                                            )}
                                        />
                                        <Bar dataKey="scheduled" fill={CHART_COLORS.scheduled} name="Scheduled" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="worked" fill={CHART_COLORS.worked} name="Worked" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="overtime" fill={CHART_COLORS.overtime} name="Overtime" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Clock size={48} style={{ opacity: 0.2, margin: "0 auto 1rem" }} />
                                <p style={{ color: "var(--text-secondary)" }}>
                                    No hours data found for this period.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Hours Table */}
                    {hours.length > 0 && (
                        <div className="glass-card" style={{ overflow: "hidden" }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Users size={20} className="text-accent" />
                                <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                                    Hours Summary Table
                                </h2>
                            </div>
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                            <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 500 }}>Dispatcher</th>
                                            <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 500 }}>Scheduled</th>
                                            <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 500 }}>Worked</th>
                                            <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 500 }}>Overtime</th>
                                            <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 500 }}>Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hours.map((dispatcher) => {
                                            const efficiency = dispatcher.scheduledHours > 0
                                                ? ((dispatcher.workedHours / dispatcher.scheduledHours) * 100).toFixed(0)
                                                : 0;
                                            return (
                                                <tr key={dispatcher.userId} style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>
                                                        {dispatcher.userName}
                                                    </td>
                                                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: CHART_COLORS.scheduled }}>
                                                        {dispatcher.scheduledHours}h
                                                    </td>
                                                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: CHART_COLORS.worked }}>
                                                        {dispatcher.workedHours}h
                                                    </td>
                                                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", color: dispatcher.overtime > 0 ? CHART_COLORS.overtime : "var(--text-secondary)" }}>
                                                        {dispatcher.overtime > 0 ? `+${dispatcher.overtime}h` : "-"}
                                                    </td>
                                                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                                                        <span
                                                            style={{
                                                                padding: "0.25rem 0.5rem",
                                                                borderRadius: "9999px",
                                                                fontSize: "0.75rem",
                                                                fontWeight: 500,
                                                                background: Number(efficiency) >= 90 ? "rgba(16, 185, 129, 0.15)" : Number(efficiency) >= 70 ? "rgba(255, 230, 109, 0.15)" : "rgba(255, 107, 107, 0.15)",
                                                                color: Number(efficiency) >= 90 ? "var(--success)" : Number(efficiency) >= 70 ? "#FFE66D" : "#FF6B6B",
                                                            }}
                                                        >
                                                            {efficiency}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
