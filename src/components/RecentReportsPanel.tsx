"use client";

import { useState } from "react";
import {
    FileText,
    Star,
    Phone,
    Mail,
    Calendar,
    ChevronRight,
    X,
    Clock,
    User,
    TrendingUp,
    MessageSquare,
    Award,
    AlertTriangle,
} from "lucide-react";

interface ShiftReport {
    id: string;
    status: string;
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
    adminFeedback: string | null;
    performanceScore: number | null;
    createdAt: Date;
    shift: {
        clockIn: Date;
        clockOut: Date | null;
    };
    user: {
        id: string;
        name: string | null;
    };
}

interface Props {
    reports: ShiftReport[];
    isAdmin: boolean;
    currentUserId: string;
}

export default function RecentReportsPanel({ reports, isAdmin, currentUserId }: Props) {
    const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const getShiftDuration = (clockIn: Date, clockOut: Date | null) => {
        if (!clockOut) return "Active";
        const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    const renderStars = (rating: number | null) => {
        if (!rating) return null;
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={12}
                        fill={star <= rating ? "var(--warning)" : "transparent"}
                        color={star <= rating ? "var(--warning)" : "var(--border)"}
                    />
                ))}
            </div>
        );
    };

    return (
        <>
            <section className="glass-card">
                <div className="flex items-center gap-2" style={{ marginBottom: "1.5rem" }}>
                    <FileText size={20} className="text-accent" />
                    <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                        {isAdmin ? "Recent Shift Reports" : "My Shift Reports"}
                    </h2>
                </div>

                {reports.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-secondary)" }}>
                        <FileText size={32} style={{ opacity: 0.2, marginBottom: "0.5rem" }} />
                        <p style={{ fontSize: "0.875rem" }}>No shift reports found.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {reports.slice(0, 5).map((report) => (
                            <div
                                key={report.id}
                                onClick={() => setSelectedReport(report)}
                                style={{
                                    padding: "1rem",
                                    borderRadius: "0.75rem",
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border)",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                                className="hover-lift"
                            >
                                <div className="flex items-start justify-between" style={{ marginBottom: "0.5rem" }}>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            {isAdmin && (
                                                <span style={{ fontWeight: 600 }}>{report.user.name}</span>
                                            )}
                                            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                                                {formatDate(report.createdAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2" style={{ marginTop: "0.25rem" }}>
                                            {renderStars(report.shiftRating)}
                                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                                {getShiftDuration(report.shift.clockIn, report.shift.clockOut)}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} style={{ color: "var(--text-secondary)" }} />
                                </div>

                                <div className="flex items-center gap-4" style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                    <span className="flex items-center gap-1">
                                        <Phone size={12} />
                                        {report.callsReceived}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Mail size={12} />
                                        {report.emailsSent}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <FileText size={12} />
                                        {report.quotesGiven}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <TrendingUp size={12} />
                                        {report.totalReservationsHandled} res
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Report Detail Modal */}
            {selectedReport && (
                <ReportDetailModal
                    report={selectedReport}
                    onClose={() => setSelectedReport(null)}
                    isAdmin={isAdmin}
                />
            )}
        </>
    );
}

function ReportDetailModal({
    report,
    onClose,
    isAdmin,
}: {
    report: ShiftReport;
    onClose: () => void;
    isAdmin: boolean;
}) {
    const formatDateTime = (date: Date) => {
        return new Date(date).toLocaleString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const getShiftDuration = (clockIn: Date, clockOut: Date | null) => {
        if (!clockOut) return "Active";
        const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "1rem",
                overflow: "auto",
            }}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                className="glass-card animate-fade-in"
                style={{ width: "100%", maxWidth: "700px", maxHeight: "90vh", overflow: "auto" }}
            >
                {/* Header */}
                <div className="flex items-start justify-between" style={{ marginBottom: "1.5rem" }}>
                    <div>
                        <h3 className="font-display" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>
                            Shift Report
                        </h3>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            {report.user.name} • {formatDateTime(report.createdAt)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="icon-btn"
                        style={{ padding: "0.5rem" }}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Shift Info */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "1rem",
                        padding: "1rem",
                        background: "var(--bg-secondary)",
                        borderRadius: "0.75rem",
                        marginBottom: "1.5rem",
                    }}
                >
                    <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                            Clock In
                        </p>
                        <p style={{ fontWeight: 500 }}>
                            {new Date(report.shift.clockIn).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                            })}
                        </p>
                    </div>
                    <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                            Clock Out
                        </p>
                        <p style={{ fontWeight: 500 }}>
                            {report.shift.clockOut
                                ? new Date(report.shift.clockOut).toLocaleTimeString(undefined, {
                                      hour: "numeric",
                                      minute: "2-digit",
                                  })
                                : "Active"}
                        </p>
                    </div>
                    <div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
                            Duration
                        </p>
                        <p style={{ fontWeight: 500 }}>
                            {getShiftDuration(report.shift.clockIn, report.shift.clockOut)}
                        </p>
                    </div>
                </div>

                {/* Self Rating */}
                {report.shiftRating && (
                    <div style={{ marginBottom: "1.5rem" }}>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                            Self Assessment
                        </p>
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    size={24}
                                    fill={star <= report.shiftRating! ? "var(--warning)" : "transparent"}
                                    color={star <= report.shiftRating! ? "var(--warning)" : "var(--border)"}
                                />
                            ))}
                            <span style={{ marginLeft: "0.5rem", color: "var(--text-secondary)" }}>
                                {report.shiftRating === 1 && "Difficult shift"}
                                {report.shiftRating === 2 && "Below average"}
                                {report.shiftRating === 3 && "Average shift"}
                                {report.shiftRating === 4 && "Good shift"}
                                {report.shiftRating === 5 && "Excellent shift!"}
                            </span>
                        </div>
                    </div>
                )}

                {/* Metrics */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: "1rem",
                        marginBottom: "1.5rem",
                    }}
                >
                    <MetricCard icon={<Phone size={16} />} label="Calls" value={report.callsReceived} />
                    <MetricCard icon={<Mail size={16} />} label="Emails" value={report.emailsSent} />
                    <MetricCard icon={<FileText size={16} />} label="Quotes" value={report.quotesGiven} />
                    <MetricCard icon={<TrendingUp size={16} />} label="Reservations" value={report.totalReservationsHandled} />
                    <MetricCard
                        icon={<MessageSquare size={16} />}
                        label="Complaints"
                        value={`${report.complaintsResolved}/${report.complaintsReceived}`}
                        color={report.complaintsReceived > 0 ? "var(--warning)" : undefined}
                    />
                    <MetricCard
                        icon={<AlertTriangle size={16} />}
                        label="Escalations"
                        value={report.escalations}
                        color={report.escalations > 0 ? "var(--danger)" : undefined}
                    />
                </div>

                {/* Narrative sections */}
                <div className="flex flex-col gap-4">
                    {report.achievements && (
                        <NarrativeSection
                            icon={<Award size={16} style={{ color: "var(--success)" }} />}
                            title="Achievements"
                            content={report.achievements}
                        />
                    )}
                    {report.challenges && (
                        <NarrativeSection
                            icon={<AlertTriangle size={16} style={{ color: "var(--warning)" }} />}
                            title="Challenges"
                            content={report.challenges}
                        />
                    )}
                    {report.incidents && (
                        <NarrativeSection
                            icon={<AlertTriangle size={16} style={{ color: "var(--danger)" }} />}
                            title="Incidents"
                            content={report.incidents}
                        />
                    )}
                    {report.generalComments && (
                        <NarrativeSection
                            icon={<MessageSquare size={16} />}
                            title="General Comments"
                            content={report.generalComments}
                        />
                    )}
                    {report.handoffNotes && (
                        <NarrativeSection
                            icon={<Clock size={16} />}
                            title="Handoff Notes"
                            content={report.handoffNotes}
                        />
                    )}
                    {report.newIdeas && (
                        <NarrativeSection
                            icon={<Award size={16} style={{ color: "var(--accent)" }} />}
                            title="New Ideas"
                            content={report.newIdeas}
                        />
                    )}
                </div>

                {/* Admin feedback (if any) */}
                {report.adminFeedback && (
                    <div
                        style={{
                            marginTop: "1.5rem",
                            padding: "1rem",
                            background: "rgba(56, 189, 248, 0.1)",
                            borderRadius: "0.75rem",
                            borderLeft: "4px solid var(--accent)",
                        }}
                    >
                        <p style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.5rem" }}>
                            Admin Feedback
                        </p>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            {report.adminFeedback}
                        </p>
                        {report.performanceScore && (
                            <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                                Score: <strong>{report.performanceScore}/100</strong>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function MetricCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    color?: string;
}) {
    return (
        <div
            style={{
                padding: "0.75rem",
                background: "var(--bg-secondary)",
                borderRadius: "0.5rem",
                textAlign: "center",
            }}
        >
            <div style={{ color: color || "var(--text-secondary)", marginBottom: "0.25rem" }}>{icon}</div>
            <p style={{ fontSize: "1.25rem", fontWeight: 600, color: color || "var(--text-primary)" }}>{value}</p>
            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{label}</p>
        </div>
    );
}

function NarrativeSection({
    icon,
    title,
    content,
}: {
    icon: React.ReactNode;
    title: string;
    content: string;
}) {
    return (
        <div>
            <div className="flex items-center gap-2" style={{ marginBottom: "0.5rem" }}>
                {icon}
                <p style={{ fontSize: "0.875rem", fontWeight: 500 }}>{title}</p>
            </div>
            <p
                style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    paddingLeft: "1.5rem",
                }}
            >
                {content}
            </p>
        </div>
    );
}
