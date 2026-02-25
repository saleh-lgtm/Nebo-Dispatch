"use client";

import { useState } from "react";
import {
    FileText,
    Phone,
    Mail,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Clock,
    Star,
    Eye,
    Filter,
    Search,
    MessageSquare,
    X,
    Award,
    BarChart3,
} from "lucide-react";
import { getAllShiftReports, reviewShiftReport, getDispatcherPerformance } from "@/lib/shiftReportActions";

interface QuoteData {
    id: string;
    clientName: string;
    serviceType: string;
    status: string;
    estimatedAmount: number | null;
}

interface ShiftData {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    totalHours: number | null;
    quotes?: QuoteData[];
}

interface UserData {
    id: string;
    name: string | null;
    email: string | null;
}

interface Report {
    id: string;
    userId: string;
    shiftId: string;
    status: "DRAFT" | "SUBMITTED" | "REVIEWED" | "FLAGGED";
    callsReceived: number;
    emailsSent: number;
    quotesGiven: number;
    totalReservationsHandled: number;
    complaintsReceived: number;
    complaintsResolved: number;
    escalations: number;
    driversDispatched: number;
    noShowsHandled: number;
    latePickups: number;
    handoffNotes: string | null;
    generalComments: string | null;
    newIdeas: string | null;
    incidents: string | null;
    achievements: string | null;
    challenges: string | null;
    shiftRating: number | null;
    performanceScore: number | null;
    adminFeedback: string | null;
    acceptedReservations: unknown;
    modifiedReservations: unknown;
    cancelledReservations: unknown;
    createdAt: Date;
    user: UserData;
    shift: ShiftData;
    reviewedBy: { id: string; name: string | null } | null;
}

interface DispatcherStats {
    id: string;
    name: string | null;
    email: string | null;
    totalReports: number;
    totalHours: number;
    avgPerformanceScore: number;
    totalCalls: number;
    totalEmails: number;
    totalQuotes: number;
    flaggedReports: number;
}

interface Props {
    initialReports: Report[];
    totalReports: number;
    stats: {
        today: number;
        thisWeek: number;
        thisMonth: number;
        pending: number;
        flagged: number;
    };
    teamPerformance: {
        dispatchers: DispatcherStats[];
        teamTotals: {
            totalReports: number;
            totalHours: number;
            totalCalls: number;
            totalEmails: number;
            totalQuotes: number;
            avgPerformanceScore: number;
        };
    };
    dispatchers: UserData[];
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "var(--text-secondary)",
    SUBMITTED: "var(--warning)",
    REVIEWED: "var(--success)",
    FLAGGED: "var(--danger)",
};

const STATUS_LABELS: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Pending Review",
    REVIEWED: "Reviewed",
    FLAGGED: "Flagged",
};

export default function ReportsClient({
    initialReports,
    totalReports,
    stats,
    teamPerformance,
    dispatchers,
}: Props) {
    const [reports, setReports] = useState<Report[]>(initialReports);
    const [total, setTotal] = useState(totalReports);
    const [activeTab, setActiveTab] = useState<"reports" | "performance">("reports");
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [reviewModal, setReviewModal] = useState<Report | null>(null);
    const [loading, setLoading] = useState(false);

    // Filters
    const [filterDispatcher, setFilterDispatcher] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Review form
    const [performanceScore, setPerformanceScore] = useState<number>(0);
    const [adminFeedback, setAdminFeedback] = useState("");
    const [reviewStatus, setReviewStatus] = useState<"REVIEWED" | "FLAGGED">("REVIEWED");

    // Performance view
    const [selectedDispatcher, setSelectedDispatcher] = useState<string | null>(null);
    const [dispatcherPerformance, setDispatcherPerformance] = useState<any>(null);

    const handleFilter = async () => {
        setLoading(true);
        try {
            const { reports: filtered, total: filteredTotal } = await getAllShiftReports({
                userId: filterDispatcher || undefined,
                status: filterStatus || undefined,
                limit: 50,
            });
            setReports(filtered as Report[]);
            setTotal(filteredTotal);
        } catch (error) {
            console.error("Filter failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async () => {
        if (!reviewModal) return;
        setLoading(true);

        try {
            await reviewShiftReport(reviewModal.id, {
                performanceScore,
                adminFeedback,
                status: reviewStatus,
            });

            // Update local state
            setReports(prev =>
                prev.map(r =>
                    r.id === reviewModal.id
                        ? { ...r, performanceScore, adminFeedback, status: reviewStatus }
                        : r
                )
            );

            setReviewModal(null);
            setPerformanceScore(0);
            setAdminFeedback("");
        } catch (error) {
            console.error("Review failed:", error);
            alert("Failed to submit review");
        } finally {
            setLoading(false);
        }
    };

    const handleViewDispatcherPerformance = async (dispatcherId: string) => {
        setLoading(true);
        try {
            const performance = await getDispatcherPerformance(dispatcherId);
            setDispatcherPerformance(performance);
            setSelectedDispatcher(dispatcherId);
        } catch (error) {
            console.error("Failed to load performance:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatDuration = (hours: number | null) => {
        if (!hours) return "N/A";
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    const getScoreColor = (score: number | null) => {
        if (!score) return "var(--text-secondary)";
        if (score >= 80) return "var(--success)";
        if (score >= 60) return "var(--warning)";
        return "var(--danger)";
    };

    const filteredReports = reports.filter(report => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const name = report.user.name?.toLowerCase() || "";
            const email = report.user.email?.toLowerCase() || "";
            if (!name.includes(query) && !email.includes(query)) {
                return false;
            }
        }
        return true;
    });

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>
                        Shift Reports
                    </h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        Review dispatcher performance and shift reports
                    </p>
                </div>
            </header>

            {/* Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
                <StatCard
                    icon={<FileText size={20} />}
                    label="Today"
                    value={stats.today}
                    color="var(--accent)"
                />
                <StatCard
                    icon={<Clock size={20} />}
                    label="This Week"
                    value={stats.thisWeek}
                    color="var(--info, #3b82f6)"
                />
                <StatCard
                    icon={<TrendingUp size={20} />}
                    label="This Month"
                    value={stats.thisMonth}
                    color="var(--success)"
                />
                <StatCard
                    icon={<AlertTriangle size={20} />}
                    label="Pending Review"
                    value={stats.pending}
                    color="var(--warning)"
                />
                <StatCard
                    icon={<AlertTriangle size={20} />}
                    label="Flagged"
                    value={stats.flagged}
                    color="var(--danger)"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab("reports")}
                    className={`btn ${activeTab === "reports" ? "btn-primary" : "btn-outline"}`}
                >
                    <FileText size={16} /> Reports
                </button>
                <button
                    onClick={() => setActiveTab("performance")}
                    className={`btn ${activeTab === "performance" ? "btn-primary" : "btn-outline"}`}
                >
                    <BarChart3 size={16} /> Team Performance
                </button>
            </div>

            {activeTab === "reports" && (
                <>
                    {/* Filters */}
                    <div className="glass-card" style={{ padding: "1rem 1.5rem" }}>
                        <div className="flex items-center gap-4">
                            <Filter size={18} className="text-accent" />
                            <div className="flex items-center gap-2" style={{ flex: 1 }}>
                                <div style={{ position: "relative", flex: 1, maxWidth: "300px" }}>
                                    <Search
                                        size={16}
                                        style={{
                                            position: "absolute",
                                            left: "0.75rem",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            color: "var(--text-secondary)",
                                        }}
                                    />
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Search by name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ paddingLeft: "2.5rem" }}
                                    />
                                </div>

                                <select
                                    className="input"
                                    value={filterDispatcher}
                                    onChange={(e) => setFilterDispatcher(e.target.value)}
                                    style={{ width: "200px" }}
                                >
                                    <option value="">All Dispatchers</option>
                                    {dispatchers.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name || d.email}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    className="input"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    style={{ width: "160px" }}
                                >
                                    <option value="">All Status</option>
                                    <option value="SUBMITTED">Pending Review</option>
                                    <option value="REVIEWED">Reviewed</option>
                                    <option value="FLAGGED">Flagged</option>
                                </select>

                                <button onClick={handleFilter} className="btn btn-primary" disabled={loading}>
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Reports Table */}
                    <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                                    <th style={thStyle}>Dispatcher</th>
                                    <th style={thStyle}>Date</th>
                                    <th style={thStyle}>Duration</th>
                                    <th style={thStyle}>Calls</th>
                                    <th style={thStyle}>Emails</th>
                                    <th style={thStyle}>Quotes</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={thStyle}>Score</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReports.map((report) => (
                                    <tr
                                        key={report.id}
                                        style={{
                                            borderBottom: "1px solid var(--glass-border)",
                                            transition: "background 0.15s",
                                        }}
                                        className="hover-row"
                                    >
                                        <td style={tdStyle}>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>
                                                    {report.user.name || "Unknown"}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                                    {report.user.email}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>{formatDate(report.createdAt)}</td>
                                        <td style={tdStyle}>{formatDuration(report.shift.totalHours)}</td>
                                        <td style={tdStyle}>
                                            <span className="flex items-center gap-1">
                                                <Phone size={14} /> {report.callsReceived}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span className="flex items-center gap-1">
                                                <Mail size={14} /> {report.emailsSent}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>{report.quotesGiven}</td>
                                        <td style={tdStyle}>
                                            <span
                                                style={{
                                                    padding: "0.25rem 0.75rem",
                                                    borderRadius: "50px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 500,
                                                    background: `${STATUS_COLORS[report.status]}20`,
                                                    color: STATUS_COLORS[report.status],
                                                }}
                                            >
                                                {STATUS_LABELS[report.status]}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            {report.performanceScore ? (
                                                <span
                                                    style={{
                                                        fontWeight: 600,
                                                        color: getScoreColor(report.performanceScore),
                                                    }}
                                                >
                                                    {report.performanceScore}/100
                                                </span>
                                            ) : (
                                                <span style={{ color: "var(--text-secondary)" }}>-</span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setSelectedReport(report)}
                                                    className="btn-icon"
                                                    title="View Details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setReviewModal(report);
                                                        setPerformanceScore(report.performanceScore || 0);
                                                        setAdminFeedback(report.adminFeedback || "");
                                                    }}
                                                    className="btn-icon"
                                                    title="Review"
                                                >
                                                    <MessageSquare size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredReports.length === 0 && (
                            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
                                No reports found
                            </div>
                        )}
                    </div>

                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        Showing {filteredReports.length} of {total} reports
                    </p>
                </>
            )}

            {activeTab === "performance" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "1.5rem" }}>
                    {/* Team Leaderboard */}
                    <div className="glass-card">
                        <div className="flex items-center gap-2" style={{ marginBottom: "1.5rem" }}>
                            <Award className="text-accent" />
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                                Dispatcher Leaderboard
                            </h2>
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                                    <th style={thStyle}>Rank</th>
                                    <th style={thStyle}>Dispatcher</th>
                                    <th style={thStyle}>Reports</th>
                                    <th style={thStyle}>Hours</th>
                                    <th style={thStyle}>Avg Score</th>
                                    <th style={thStyle}>Calls</th>
                                    <th style={thStyle}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamPerformance.dispatchers.map((dispatcher, index) => (
                                    <tr
                                        key={dispatcher.id}
                                        style={{ borderBottom: "1px solid var(--glass-border)" }}
                                        className="hover-row"
                                    >
                                        <td style={tdStyle}>
                                            <span
                                                style={{
                                                    width: "28px",
                                                    height: "28px",
                                                    borderRadius: "50%",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontWeight: 600,
                                                    fontSize: "0.875rem",
                                                    background:
                                                        index === 0
                                                            ? "linear-gradient(135deg, #ffd700, #ffb700)"
                                                            : index === 1
                                                            ? "linear-gradient(135deg, #c0c0c0, #a0a0a0)"
                                                            : index === 2
                                                            ? "linear-gradient(135deg, #cd7f32, #b87333)"
                                                            : "var(--glass-bg)",
                                                    color: index < 3 ? "#000" : "var(--text-primary)",
                                                }}
                                            >
                                                {index + 1}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{dispatcher.name || "Unknown"}</div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                                    {dispatcher.email}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>{dispatcher.totalReports}</td>
                                        <td style={tdStyle}>{dispatcher.totalHours}h</td>
                                        <td style={tdStyle}>
                                            <span
                                                style={{
                                                    fontWeight: 600,
                                                    color: getScoreColor(dispatcher.avgPerformanceScore),
                                                }}
                                            >
                                                {dispatcher.avgPerformanceScore || "-"}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>{dispatcher.totalCalls}</td>
                                        <td style={tdStyle}>
                                            <button
                                                onClick={() => handleViewDispatcherPerformance(dispatcher.id)}
                                                className="btn btn-outline"
                                                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                                            >
                                                Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Team Summary / Individual Performance */}
                    <div className="flex flex-col gap-4">
                        <div className="glass-card">
                            <h3 className="font-display" style={{ fontSize: "1rem", marginBottom: "1rem" }}>
                                Team Summary
                            </h3>
                            <div className="flex flex-col gap-3">
                                <SummaryRow
                                    label="Total Reports"
                                    value={teamPerformance.teamTotals.totalReports}
                                />
                                <SummaryRow
                                    label="Total Hours"
                                    value={`${teamPerformance.teamTotals.totalHours}h`}
                                />
                                <SummaryRow
                                    label="Avg Performance"
                                    value={`${teamPerformance.teamTotals.avgPerformanceScore}/100`}
                                    color={getScoreColor(teamPerformance.teamTotals.avgPerformanceScore)}
                                />
                                <SummaryRow label="Total Calls" value={teamPerformance.teamTotals.totalCalls} />
                                <SummaryRow label="Total Emails" value={teamPerformance.teamTotals.totalEmails} />
                                <SummaryRow label="Total Quotes" value={teamPerformance.teamTotals.totalQuotes} />
                            </div>
                        </div>

                        {/* Individual Dispatcher Performance */}
                        {dispatcherPerformance && (
                            <div className="glass-card">
                                <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
                                    <h3 className="font-display" style={{ fontSize: "1rem" }}>
                                        Dispatcher Details
                                    </h3>
                                    <button
                                        onClick={() => {
                                            setDispatcherPerformance(null);
                                            setSelectedDispatcher(null);
                                        }}
                                        className="btn-icon"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <SummaryRow label="Total Reports" value={dispatcherPerformance.totalReports} />
                                    <SummaryRow label="Total Hours" value={`${dispatcherPerformance.totalHours}h`} />
                                    <SummaryRow
                                        label="Avg Performance"
                                        value={`${dispatcherPerformance.averages.performanceScore}/100`}
                                        color={getScoreColor(dispatcherPerformance.averages.performanceScore)}
                                    />
                                    <SummaryRow
                                        label="Avg Self Rating"
                                        value={`${dispatcherPerformance.averages.shiftRating}/5`}
                                    />
                                    <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
                                        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                                            Per Shift Averages
                                        </div>
                                        <SummaryRow label="Calls" value={dispatcherPerformance.averages.callsPerShift} />
                                        <SummaryRow label="Emails" value={dispatcherPerformance.averages.emailsPerShift} />
                                        <SummaryRow label="Quotes" value={dispatcherPerformance.averages.quotesPerShift} />
                                    </div>
                                    <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
                                        <SummaryRow
                                            label="Pending Review"
                                            value={dispatcherPerformance.statusCounts.pending}
                                        />
                                        <SummaryRow
                                            label="Flagged"
                                            value={dispatcherPerformance.statusCounts.flagged}
                                            color="var(--danger)"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Report Detail Modal */}
            {selectedReport && (
                <div
                    className="modal-overlay"
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 100,
                        padding: "2rem",
                    }}
                    onClick={() => setSelectedReport(null)}
                >
                    <div
                        className="glass-card animate-fade-in"
                        style={{ maxWidth: "700px", width: "100%", maxHeight: "80vh", overflow: "auto" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                            <div>
                                <h2 className="font-display" style={{ fontSize: "1.5rem" }}>
                                    Shift Report Details
                                </h2>
                                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                    {selectedReport.user.name} - {formatDate(selectedReport.createdAt)}
                                </p>
                            </div>
                            <button onClick={() => setSelectedReport(null)} className="btn-icon">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Metrics Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                            <MetricBox label="Calls" value={selectedReport.callsReceived} icon={<Phone size={16} />} />
                            <MetricBox label="Emails" value={selectedReport.emailsSent} icon={<Mail size={16} />} />
                            <MetricBox label="Quotes" value={selectedReport.quotesGiven} icon={<FileText size={16} />} />
                            <MetricBox label="Duration" value={formatDuration(selectedReport.shift.totalHours)} icon={<Clock size={16} />} />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                            <MetricBox label="Reservations" value={selectedReport.totalReservationsHandled} />
                        </div>

                        {/* Linked Quotes Section */}
                        {selectedReport.shift.quotes && selectedReport.shift.quotes.length > 0 && (
                            <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "0.5rem" }}>
                                <div style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <FileText size={16} style={{ color: "var(--accent)" }} />
                                    Quotes Created During Shift ({selectedReport.shift.quotes.length})
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {selectedReport.shift.quotes.map((quote) => (
                                        <div
                                            key={quote.id}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "0.5rem 0.75rem",
                                                background: "rgba(255, 255, 255, 0.02)",
                                                borderRadius: "0.375rem",
                                                fontSize: "0.875rem",
                                            }}
                                        >
                                            <div>
                                                <span style={{ fontWeight: 500 }}>{quote.clientName}</span>
                                                <span style={{ color: "var(--text-secondary)", marginLeft: "0.5rem" }}>
                                                    ({quote.serviceType})
                                                </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                {quote.estimatedAmount && (
                                                    <span style={{ color: "var(--success)" }}>
                                                        ${quote.estimatedAmount.toFixed(2)}
                                                    </span>
                                                )}
                                                <span
                                                    style={{
                                                        padding: "0.125rem 0.5rem",
                                                        borderRadius: "9999px",
                                                        fontSize: "0.75rem",
                                                        fontWeight: 500,
                                                        background: quote.status === "CONVERTED"
                                                            ? "var(--success)"
                                                            : quote.status === "FOLLOWING_UP"
                                                            ? "var(--warning)"
                                                            : "var(--bg-secondary)",
                                                        color: quote.status === "CONVERTED" || quote.status === "FOLLOWING_UP"
                                                            ? "black"
                                                            : "var(--text-primary)",
                                                    }}
                                                >
                                                    {quote.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Narrative Sections */}
                        {selectedReport.incidents && (
                            <NarrativeSection title="Incidents" content={selectedReport.incidents} color="var(--danger)" />
                        )}
                        {selectedReport.achievements && (
                            <NarrativeSection title="Achievements" content={selectedReport.achievements} color="var(--success)" />
                        )}
                        {selectedReport.challenges && (
                            <NarrativeSection title="Challenges" content={selectedReport.challenges} color="var(--warning)" />
                        )}
                        {selectedReport.generalComments && (
                            <NarrativeSection title="General Comments" content={selectedReport.generalComments} />
                        )}
                        {selectedReport.handoffNotes && (
                            <NarrativeSection title="Handoff Notes" content={selectedReport.handoffNotes} />
                        )}
                        {selectedReport.newIdeas && (
                            <NarrativeSection title="New Ideas" content={selectedReport.newIdeas} color="var(--accent)" />
                        )}

                        {/* Self Rating */}
                        {selectedReport.shiftRating && (
                            <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "0.5rem" }}>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                                    Self Rating
                                </div>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            size={20}
                                            fill={star <= selectedReport.shiftRating! ? "#ffd700" : "transparent"}
                                            color={star <= selectedReport.shiftRating! ? "#ffd700" : "var(--text-secondary)"}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Admin Review Section */}
                        {selectedReport.performanceScore !== null && (
                            <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(var(--accent-rgb), 0.1)", borderRadius: "0.5rem", border: "1px solid var(--accent)" }}>
                                <div style={{ fontSize: "0.75rem", color: "var(--accent)", marginBottom: "0.5rem" }}>
                                    Admin Review
                                </div>
                                <div className="flex items-center gap-4" style={{ marginBottom: "0.5rem" }}>
                                    <span style={{ fontWeight: 600, color: getScoreColor(selectedReport.performanceScore) }}>
                                        Score: {selectedReport.performanceScore}/100
                                    </span>
                                    {selectedReport.reviewedBy && (
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                            by {selectedReport.reviewedBy.name}
                                        </span>
                                    )}
                                </div>
                                {selectedReport.adminFeedback && (
                                    <p style={{ fontSize: "0.875rem" }}>{selectedReport.adminFeedback}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {reviewModal && (
                <div
                    className="modal-overlay"
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 100,
                        padding: "2rem",
                    }}
                    onClick={() => setReviewModal(null)}
                >
                    <div
                        className="glass-card animate-fade-in"
                        style={{ maxWidth: "500px", width: "100%" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between" style={{ marginBottom: "1.5rem" }}>
                            <h2 className="font-display" style={{ fontSize: "1.5rem" }}>
                                Review Report
                            </h2>
                            <button onClick={() => setReviewModal(null)} className="btn-icon">
                                <X size={20} />
                            </button>
                        </div>

                        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                            Reviewing report from <strong>{reviewModal.user.name}</strong> on{" "}
                            {formatDate(reviewModal.createdAt)}
                        </p>

                        <div className="flex flex-col gap-4">
                            {/* Performance Score */}
                            <div>
                                <label style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", display: "block" }}>
                                    Performance Score (0-100)
                                </label>
                                <input
                                    type="number"
                                    className="input"
                                    min="0"
                                    max="100"
                                    value={performanceScore}
                                    onChange={(e) => setPerformanceScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                />
                                <div
                                    style={{
                                        marginTop: "0.5rem",
                                        height: "8px",
                                        borderRadius: "4px",
                                        background: "var(--glass-border)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${performanceScore}%`,
                                            background: getScoreColor(performanceScore),
                                            transition: "width 0.3s, background 0.3s",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", display: "block" }}>
                                    Status
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setReviewStatus("REVIEWED")}
                                        className={`btn ${reviewStatus === "REVIEWED" ? "btn-primary" : "btn-outline"}`}
                                        style={{ flex: 1 }}
                                    >
                                        <CheckCircle size={16} /> Approve
                                    </button>
                                    <button
                                        onClick={() => setReviewStatus("FLAGGED")}
                                        className={`btn ${reviewStatus === "FLAGGED" ? "" : "btn-outline"}`}
                                        style={{
                                            flex: 1,
                                            background: reviewStatus === "FLAGGED" ? "var(--danger)" : undefined,
                                            borderColor: reviewStatus === "FLAGGED" ? "var(--danger)" : undefined,
                                        }}
                                    >
                                        <AlertTriangle size={16} /> Flag
                                    </button>
                                </div>
                            </div>

                            {/* Feedback */}
                            <div>
                                <label style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem", display: "block" }}>
                                    Feedback (Optional)
                                </label>
                                <textarea
                                    className="input"
                                    rows={4}
                                    value={adminFeedback}
                                    onChange={(e) => setAdminFeedback(e.target.value)}
                                    placeholder="Provide feedback for the dispatcher..."
                                    style={{ resize: "none" }}
                                />
                            </div>

                            <button onClick={handleReview} className="btn btn-primary" disabled={loading}>
                                {loading ? "Submitting..." : "Submit Review"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .hover-row:hover {
                    background: rgba(255, 255, 255, 0.03);
                }
            `}</style>
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: "1rem",
    textAlign: "left",
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
};

const tdStyle: React.CSSProperties = {
    padding: "1rem",
    fontSize: "0.875rem",
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
    return (
        <div className="glass-card" style={{ padding: "1.25rem" }}>
            <div className="flex items-center gap-3">
                <div style={{ color }}>{icon}</div>
                <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{label}</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</div>
                </div>
            </div>
        </div>
    );
}

function SummaryRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="flex justify-between items-center">
            <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>{label}</span>
            <span style={{ fontWeight: 600, color: color || "var(--text-primary)" }}>{value}</span>
        </div>
    );
}

function MetricBox({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
    return (
        <div style={{ padding: "0.75rem", background: "rgba(255, 255, 255, 0.03)", borderRadius: "0.5rem", textAlign: "center" }}>
            <div className="flex items-center justify-center gap-1" style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                {icon}
                {label}
            </div>
            <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{value}</div>
        </div>
    );
}

function NarrativeSection({ title, content, color }: { title: string; content: string; color?: string }) {
    return (
        <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.75rem", color: color || "var(--text-secondary)", marginBottom: "0.25rem", fontWeight: 500 }}>
                {title}
            </div>
            <p style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{content}</p>
        </div>
    );
}
