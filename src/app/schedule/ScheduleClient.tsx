"use client";

import { useState } from "react";
import {
    Calendar as CalendarIcon,
    Clock,
    Edit3,
    Send,
    AlertCircle,
    CheckCircle2,
    XCircle,
    FileEdit,
    X,
    MessageSquare,
    Palmtree,
    ArrowLeftRight,
    CalendarDays,
    History,
    Bell,
} from "lucide-react";
import { createDetailedRequest } from "@/lib/requestActions";
import TimeOffPanel from "@/components/TimeOffPanel";
import ShiftSwapPanel from "@/components/ShiftSwapPanel";

interface Schedule {
    id: string;
    shiftStart: Date;
    shiftEnd: Date;
    isPublished: boolean;
    userId: string;
    user?: { id: string; name: string | null };
}

interface Request {
    id: string;
    type: "HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW" | "TIME_OFF" | "SHIFT_SWAP";
    status: "PENDING" | "APPROVED" | "REJECTED";
    reason: string | null;
    requestedStart: Date | null;
    requestedEnd: Date | null;
    adminNotes: string | null;
    createdAt: Date;
    schedule: Schedule | null;
}

interface TimeOffRequest {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    type: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    reviewedById: string | null;
    reviewedBy: { id: string; name: string | null } | null;
    reviewedAt: Date | null;
    adminNotes: string | null;
    createdAt: Date;
    user?: { id: string; name: string | null; email: string | null };
}

interface SwapRequest {
    id: string;
    requesterId: string;
    targetUserId: string;
    requesterShiftId: string;
    targetShiftId: string;
    status: "PENDING_TARGET" | "PENDING_ADMIN" | "APPROVED" | "REJECTED" | "CANCELLED";
    reason: string | null;
    targetResponse: string | null;
    adminNotes: string | null;
    createdAt: Date;
    requester?: { id: string; name: string | null };
    targetUser?: { id: string; name: string | null };
    requesterShift: Schedule;
    targetShift: Schedule;
    reviewedBy?: { id: string; name: string | null } | null;
}

interface Props {
    initialSchedule: Schedule[];
    requests: Request[];
    upcomingShifts: Schedule[];
    pastShifts: Schedule[];
    myTimeOffRequests: TimeOffRequest[];
    pendingTimeOffRequests: TimeOffRequest[];
    swapRequestsData: { madeRequests: SwapRequest[]; receivedRequests: SwapRequest[] };
    pendingSwapRequests: { pendingTargetRequests: SwapRequest[]; pendingAdminRequests: SwapRequest[] };
    mySchedules: Schedule[];
    session: { user: { id: string; name?: string | null; email?: string | null; role: string } };
    isAdmin: boolean;
    userId: string;
}

const TYPE_LABELS: Record<string, string> = {
    HOURS_MODIFICATION: "Hours Modification",
    SCHEDULE_CHANGE: "Schedule Change",
    REVIEW: "Review Request",
    TIME_OFF: "Time Off",
    SHIFT_SWAP: "Shift Swap",
};

type TabType = "upcoming" | "history" | "requests" | "timeoff" | "swap";

export default function ScheduleClient({
    initialSchedule,
    requests: initialRequests,
    upcomingShifts,
    pastShifts,
    myTimeOffRequests,
    pendingTimeOffRequests,
    swapRequestsData,
    pendingSwapRequests,
    mySchedules,
    session,
    isAdmin,
    userId,
}: Props) {
    const [activeTab, setActiveTab] = useState<TabType>("upcoming");
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [requests, setRequests] = useState<Request[]>(initialRequests);

    // Form state
    const [requestType, setRequestType] = useState<"HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW">("SCHEDULE_CHANGE");
    const [reason, setReason] = useState("");
    const [selectedScheduleId, setSelectedScheduleId] = useState("");
    const [requestedStart, setRequestedStart] = useState("");
    const [requestedEnd, setRequestedEnd] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) return;

        setLoading(true);
        try {
            const newRequest = await createDetailedRequest({
                userId: session.user.id,
                type: requestType,
                reason: reason.trim(),
                scheduleId: selectedScheduleId || undefined,
                requestedStart: requestedStart ? new Date(requestedStart) : undefined,
                requestedEnd: requestedEnd ? new Date(requestedEnd) : undefined,
            });

            if (newRequest) {
                setRequests((prev) => [newRequest as Request, ...prev]);
                setShowRequestForm(false);
                setReason("");
                setSelectedScheduleId("");
                setRequestedStart("");
                setRequestedEnd("");
            }
        } catch (error) {
            console.error("Failed to submit request:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatDateTime = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PENDING":
                return (
                    <span className="status-badge status-pending">
                        <Clock size={12} /> Pending
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="status-badge status-approved">
                        <CheckCircle2 size={12} /> Approved
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="status-badge status-rejected">
                        <XCircle size={12} /> Rejected
                    </span>
                );
            default:
                return status;
        }
    };

    const allShifts = [...upcomingShifts, ...initialSchedule].filter(
        (shift, index, self) => index === self.findIndex((s) => s.id === shift.id)
    );

    // Count pending items for badges
    const pendingTimeOff = myTimeOffRequests.filter(r => r.status === "PENDING").length;
    const pendingSwaps = swapRequestsData.madeRequests.filter(r => r.status === "PENDING_TARGET" || r.status === "PENDING_ADMIN").length +
        pendingSwapRequests.pendingTargetRequests.length;
    const pendingRequests = requests.filter(r => r.status === "PENDING").length;

    // Get next shift
    const nextShift = upcomingShifts[0];

    // Calculate hours until next shift
    const getHoursUntil = (date: Date) => {
        const now = new Date();
        const diff = new Date(date).getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ${hours % 24}h`;
        return `${hours}h`;
    };

    const tabs = [
        { id: "upcoming" as TabType, label: "Upcoming", icon: CalendarDays, count: upcomingShifts.length },
        { id: "history" as TabType, label: "History", icon: History, count: pastShifts.length },
        { id: "requests" as TabType, label: "Requests", icon: FileEdit, count: pendingRequests },
        { id: "timeoff" as TabType, label: "Time Off", icon: Palmtree, count: pendingTimeOff },
        { id: "swap" as TabType, label: "Swap", icon: ArrowLeftRight, count: pendingSwaps },
    ];

    return (
        <div className="schedule-page animate-fade-in">
            {/* Header */}
            <header className="schedule-header">
                <div>
                    <h1 className="font-display schedule-title">My Schedule</h1>
                    <p className="schedule-subtitle">Manage your shifts and requests</p>
                </div>
                <button onClick={() => setShowRequestForm(true)} className="btn btn-primary">
                    <Edit3 size={18} />
                    <span>New Request</span>
                </button>
            </header>

            {/* Bento Grid Layout */}
            <div className="bento-grid">
                {/* Next Shift Card - Spans 2 columns */}
                <div className="bento-card bento-card-featured">
                    <div className="bento-card-header">
                        <div className="bento-icon-accent">
                            <CalendarIcon size={20} />
                        </div>
                        <span className="bento-card-label">Next Shift</span>
                    </div>
                    {nextShift ? (
                        <div className="next-shift-content">
                            <div className="next-shift-date">
                                <span className="next-shift-day">
                                    {new Date(nextShift.shiftStart).getDate()}
                                </span>
                                <span className="next-shift-month">
                                    {new Date(nextShift.shiftStart).toLocaleDateString(undefined, { month: "short" })}
                                </span>
                            </div>
                            <div className="next-shift-details">
                                <h3 className="next-shift-time">
                                    {formatTime(nextShift.shiftStart)} - {formatTime(nextShift.shiftEnd)}
                                </h3>
                                <p className="next-shift-weekday">
                                    {new Date(nextShift.shiftStart).toLocaleDateString(undefined, { weekday: "long" })}
                                </p>
                                <div className="next-shift-countdown">
                                    <Clock size={14} />
                                    <span>In {getHoursUntil(nextShift.shiftStart)}</span>
                                </div>
                            </div>
                            <div className="next-shift-status">
                                <CheckCircle2 size={18} />
                                <span>Confirmed</span>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state-mini">
                            <CalendarIcon size={32} />
                            <p>No upcoming shifts</p>
                        </div>
                    )}
                </div>

                {/* Quick Stats */}
                <div className="bento-card">
                    <div className="bento-card-header">
                        <div className="bento-icon">
                            <CalendarDays size={18} />
                        </div>
                        <span className="bento-card-label">This Week</span>
                    </div>
                    <div className="stat-value">{upcomingShifts.filter(s => {
                        const shiftDate = new Date(s.shiftStart);
                        const now = new Date();
                        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                        return shiftDate <= weekEnd;
                    }).length}</div>
                    <div className="stat-label">Shifts scheduled</div>
                </div>

                <div className="bento-card">
                    <div className="bento-card-header">
                        <div className="bento-icon">
                            <Bell size={18} />
                        </div>
                        <span className="bento-card-label">Pending</span>
                    </div>
                    <div className="stat-value stat-warning">{pendingRequests + pendingTimeOff + pendingSwaps}</div>
                    <div className="stat-label">Awaiting response</div>
                </div>

                {/* Tab Navigation - Full width */}
                <div className="bento-card bento-card-full">
                    <div className="schedule-tabs">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`schedule-tab ${activeTab === tab.id ? "schedule-tab-active" : ""}`}
                            >
                                <tab.icon size={16} />
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`tab-badge ${activeTab === tab.id ? "tab-badge-active" : ""}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="tab-content">
                        {/* Upcoming Shifts Tab */}
                        {activeTab === "upcoming" && (
                            <div className="shifts-list">
                                {upcomingShifts.length > 0 ? (
                                    upcomingShifts.map((shift) => (
                                        <div key={shift.id} className="shift-card">
                                            <div className="shift-date-badge">
                                                <span className="shift-date-month">
                                                    {new Date(shift.shiftStart).toLocaleDateString(undefined, { month: "short" })}
                                                </span>
                                                <span className="shift-date-day">
                                                    {new Date(shift.shiftStart).getDate()}
                                                </span>
                                            </div>
                                            <div className="shift-info">
                                                <h4 className="shift-time">
                                                    {formatTime(shift.shiftStart)} - {formatTime(shift.shiftEnd)}
                                                </h4>
                                                <p className="shift-weekday">
                                                    {new Date(shift.shiftStart).toLocaleDateString(undefined, { weekday: "long" })}
                                                </p>
                                            </div>
                                            <div className="shift-status shift-status-confirmed">
                                                <CheckCircle2 size={14} />
                                                <span>Confirmed</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <CalendarIcon size={48} />
                                        <h3>No upcoming shifts</h3>
                                        <p>Check back later for new assignments</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Shift History Tab */}
                        {activeTab === "history" && (
                            <div className="shifts-list">
                                {pastShifts.length > 0 ? (
                                    pastShifts.map((shift) => (
                                        <div key={shift.id} className="shift-card shift-card-past">
                                            <div className="shift-date-badge shift-date-badge-past">
                                                <span className="shift-date-month">
                                                    {new Date(shift.shiftStart).toLocaleDateString(undefined, { month: "short" })}
                                                </span>
                                                <span className="shift-date-day">
                                                    {new Date(shift.shiftStart).getDate()}
                                                </span>
                                            </div>
                                            <div className="shift-info">
                                                <h4 className="shift-time">
                                                    {formatTime(shift.shiftStart)} - {formatTime(shift.shiftEnd)}
                                                </h4>
                                                <p className="shift-weekday">
                                                    {new Date(shift.shiftStart).toLocaleDateString(undefined, {
                                                        weekday: "long",
                                                        year: "numeric",
                                                    })}
                                                </p>
                                            </div>
                                            <div className="shift-status shift-status-completed">
                                                <Clock size={14} />
                                                <span>Completed</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <History size={48} />
                                        <h3>No shift history</h3>
                                        <p>Your completed shifts will appear here</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* My Requests Tab */}
                        {activeTab === "requests" && (
                            <div className="requests-list">
                                {requests.length > 0 ? (
                                    requests.map((request) => (
                                        <div key={request.id} className="request-card">
                                            <div className="request-header">
                                                <div>
                                                    <span className="request-type-badge">
                                                        {TYPE_LABELS[request.type]}
                                                    </span>
                                                    <p className="request-date">
                                                        Submitted {formatDateTime(request.createdAt)}
                                                    </p>
                                                </div>
                                                {getStatusBadge(request.status)}
                                            </div>

                                            {request.reason && (
                                                <div className="request-reason">
                                                    <MessageSquare size={14} />
                                                    <p>{request.reason}</p>
                                                </div>
                                            )}

                                            {request.adminNotes && (
                                                <div className={`admin-response ${request.status === "APPROVED" ? "admin-response-approved" : "admin-response-rejected"}`}>
                                                    <AlertCircle size={14} />
                                                    <div>
                                                        <p className="admin-response-label">Admin Response</p>
                                                        <p>{request.adminNotes}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <FileEdit size={48} />
                                        <h3>No requests yet</h3>
                                        <p>Click &quot;New Request&quot; to submit one</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Time Off Tab */}
                        {activeTab === "timeoff" && (
                            <TimeOffPanel
                                myRequests={myTimeOffRequests}
                                pendingRequests={pendingTimeOffRequests}
                                isAdmin={isAdmin}
                            />
                        )}

                        {/* Shift Swap Tab */}
                        {activeTab === "swap" && (
                            <ShiftSwapPanel
                                madeRequests={swapRequestsData.madeRequests}
                                receivedRequests={swapRequestsData.receivedRequests}
                                pendingTargetRequests={pendingSwapRequests.pendingTargetRequests}
                                pendingAdminRequests={pendingSwapRequests.pendingAdminRequests}
                                myShifts={mySchedules}
                                isAdmin={isAdmin}
                                userId={userId}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Request Modal */}
            {showRequestForm && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRequestForm(false); }}>
                    <div className="modal-content glass-card animate-scale-in">
                        <div className="modal-header">
                            <div className="modal-title-group">
                                <Edit3 className="text-accent" />
                                <h2 className="font-display modal-title">Submit Request</h2>
                            </div>
                            <button onClick={() => setShowRequestForm(false)} className="btn-icon">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitRequest} className="modal-form">
                            <div className="form-group">
                                <label className="form-label">Request Type</label>
                                <select
                                    className="input"
                                    value={requestType}
                                    onChange={(e) => setRequestType(e.target.value as "HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW")}
                                >
                                    <option value="SCHEDULE_CHANGE">Schedule Change</option>
                                    <option value="HOURS_MODIFICATION">Hours Modification</option>
                                    <option value="REVIEW">Schedule Review</option>
                                </select>
                            </div>

                            {allShifts.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">Related Shift (Optional)</label>
                                    <select
                                        className="input"
                                        value={selectedScheduleId}
                                        onChange={(e) => setSelectedScheduleId(e.target.value)}
                                    >
                                        <option value="">Select a shift...</option>
                                        {allShifts.map((shift) => (
                                            <option key={shift.id} value={shift.id}>
                                                {formatDate(shift.shiftStart)} {formatTime(shift.shiftStart)} - {formatTime(shift.shiftEnd)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {requestType === "SCHEDULE_CHANGE" && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Requested Start</label>
                                        <input
                                            type="datetime-local"
                                            className="input"
                                            value={requestedStart}
                                            onChange={(e) => setRequestedStart(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Requested End</label>
                                        <input
                                            type="datetime-local"
                                            className="input"
                                            value={requestedEnd}
                                            onChange={(e) => setRequestedEnd(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Reason / Explanation</label>
                                <textarea
                                    required
                                    placeholder="Explain your request details here..."
                                    className="input"
                                    style={{ height: "120px", resize: "vertical" }}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                            </div>

                            <div className="info-banner">
                                <AlertCircle size={14} />
                                <p>Your request will be reviewed by an administrator. Track its status in the Requests tab.</p>
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowRequestForm(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    <Send size={16} />
                                    <span>{loading ? "Submitting..." : "Submit Request"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .schedule-page {
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .schedule-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .schedule-title {
                    font-size: 2rem;
                    margin-bottom: 0.25rem;
                }

                .schedule-subtitle {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }

                /* Bento Grid */
                .bento-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                }

                @media (max-width: 1024px) {
                    .bento-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 640px) {
                    .bento-grid {
                        grid-template-columns: 1fr;
                    }
                }

                .bento-card {
                    background: var(--glass);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--radius-xl);
                    padding: 1.5rem;
                    box-shadow: var(--shadow-sm);
                    transition: all var(--transition-normal);
                }

                .bento-card:hover {
                    box-shadow: var(--shadow-md);
                    border-color: var(--border-hover);
                }

                .bento-card-featured {
                    grid-column: span 2;
                    background: linear-gradient(135deg, var(--bg-elevated) 0%, var(--glass) 100%);
                    border-color: var(--accent-glow);
                }

                @media (max-width: 640px) {
                    .bento-card-featured {
                        grid-column: span 1;
                    }
                }

                .bento-card-full {
                    grid-column: 1 / -1;
                }

                .bento-card-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }

                .bento-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: var(--radius-md);
                    background: var(--accent-soft);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent);
                }

                .bento-icon-accent {
                    width: 40px;
                    height: 40px;
                    border-radius: var(--radius-md);
                    background: var(--accent);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-inverse);
                }

                .bento-card-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-secondary);
                }

                /* Stats */
                .stat-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1;
                    margin-bottom: 0.25rem;
                }

                .stat-value.stat-warning {
                    color: var(--warning);
                }

                .stat-label {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                /* Next Shift Card */
                .next-shift-content {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    flex-wrap: wrap;
                }

                .next-shift-date {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: var(--accent);
                    color: var(--text-inverse);
                    border-radius: var(--radius-lg);
                    padding: 1rem 1.25rem;
                    min-width: 80px;
                }

                .next-shift-day {
                    font-size: 2rem;
                    font-weight: 700;
                    line-height: 1;
                }

                .next-shift-month {
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .next-shift-details {
                    flex: 1;
                    min-width: 150px;
                }

                .next-shift-time {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .next-shift-weekday {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }

                .next-shift-countdown {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--accent);
                    background: var(--accent-soft);
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                }

                .next-shift-status {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--success);
                }

                /* Tabs */
                .schedule-tabs {
                    display: flex;
                    gap: 0.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--border);
                    margin-bottom: 1.5rem;
                    overflow-x: auto;
                }

                .schedule-tab {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                    white-space: nowrap;
                }

                .schedule-tab:hover {
                    background: var(--accent-soft);
                    color: var(--text-primary);
                }

                .schedule-tab-active {
                    background: var(--accent);
                    color: var(--text-inverse);
                }

                .schedule-tab-active:hover {
                    background: var(--accent-hover);
                    color: var(--text-inverse);
                }

                .tab-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 0.375rem;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    background: var(--accent-soft);
                    color: var(--accent);
                }

                .tab-badge-active {
                    background: rgba(255, 255, 255, 0.2);
                    color: var(--text-inverse);
                }

                /* Shifts List */
                .shifts-list,
                .requests-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .shift-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    transition: all var(--transition-fast);
                    cursor: pointer;
                }

                .shift-card:hover {
                    border-color: var(--accent-glow);
                    box-shadow: var(--shadow-sm);
                }

                .shift-card-past {
                    opacity: 0.7;
                }

                .shift-date-badge {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 56px;
                    height: 56px;
                    background: var(--accent-soft);
                    border-radius: var(--radius-md);
                    flex-shrink: 0;
                }

                .shift-date-badge-past {
                    background: var(--bg-muted);
                }

                .shift-date-month {
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--accent);
                }

                .shift-date-badge-past .shift-date-month {
                    color: var(--text-secondary);
                }

                .shift-date-day {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1;
                }

                .shift-info {
                    flex: 1;
                    min-width: 0;
                }

                .shift-time {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.125rem;
                }

                .shift-weekday {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }

                .shift-status {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 0.375rem 0.625rem;
                    border-radius: var(--radius-sm);
                }

                .shift-status-confirmed {
                    color: var(--success);
                    background: var(--success-bg);
                }

                .shift-status-completed {
                    color: var(--text-secondary);
                    background: var(--bg-muted);
                }

                /* Request Cards */
                .request-card {
                    padding: 1.25rem;
                    background: var(--bg-elevated);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                }

                .request-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .request-type-badge {
                    display: inline-block;
                    padding: 0.25rem 0.625rem;
                    border-radius: var(--radius-sm);
                    font-size: 0.7rem;
                    font-weight: 600;
                    background: var(--accent-soft);
                    color: var(--accent);
                }

                .request-date {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    margin-top: 0.375rem;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 0.25rem 0.5rem;
                    border-radius: var(--radius-sm);
                }

                .status-pending {
                    color: var(--warning);
                    background: var(--warning-bg);
                }

                .status-approved {
                    color: var(--success);
                    background: var(--success-bg);
                }

                .status-rejected {
                    color: var(--danger);
                    background: var(--danger-bg);
                }

                .request-reason {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.875rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                    margin-bottom: 0.75rem;
                }

                .request-reason svg {
                    flex-shrink: 0;
                    color: var(--text-secondary);
                    margin-top: 2px;
                }

                .request-reason p {
                    font-size: 0.875rem;
                    line-height: 1.5;
                    color: var(--text-primary);
                }

                .admin-response {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.875rem;
                    border-radius: var(--radius-md);
                    border: 1px solid;
                }

                .admin-response svg {
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .admin-response-approved {
                    background: var(--success-bg);
                    border-color: var(--success-border);
                }

                .admin-response-approved svg,
                .admin-response-approved .admin-response-label {
                    color: var(--success);
                }

                .admin-response-rejected {
                    background: var(--danger-bg);
                    border-color: var(--danger-border);
                }

                .admin-response-rejected svg,
                .admin-response-rejected .admin-response-label {
                    color: var(--danger);
                }

                .admin-response-label {
                    font-size: 0.7rem;
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }

                .admin-response p:last-child {
                    font-size: 0.875rem;
                }

                /* Empty State */
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem 1rem;
                    text-align: center;
                }

                .empty-state svg {
                    color: var(--accent);
                    opacity: 0.3;
                    margin-bottom: 1rem;
                }

                .empty-state h3 {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .empty-state p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                .empty-state-mini {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem 1rem;
                    text-align: center;
                }

                .empty-state-mini svg {
                    color: var(--text-muted);
                    margin-bottom: 0.75rem;
                }

                .empty-state-mini p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    padding: 1rem;
                }

                .modal-content {
                    width: 100%;
                    max-width: 500px;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1.5rem;
                }

                .modal-title-group {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .modal-title {
                    font-size: 1.5rem;
                }

                .modal-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .form-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-secondary);
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                @media (max-width: 480px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }

                .info-banner {
                    display: flex;
                    gap: 0.75rem;
                    padding: 0.875rem;
                    background: var(--accent-soft);
                    border: 1px solid var(--border-accent);
                    border-radius: var(--radius-md);
                }

                .info-banner svg {
                    flex-shrink: 0;
                    color: var(--accent);
                    margin-top: 2px;
                }

                .info-banner p {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    line-height: 1.5;
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    margin-top: 0.5rem;
                }

                .btn-icon {
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: var(--radius-sm);
                    color: var(--text-secondary);
                    transition: all var(--transition-fast);
                }

                .btn-icon:hover {
                    background: var(--bg-muted);
                    color: var(--text-primary);
                }
            `}</style>
        </div>
    );
}
