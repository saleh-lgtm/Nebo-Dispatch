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
    X,
    MessageSquare,
    Palmtree,
    ArrowLeftRight,
    ChevronRight,
    Plus,
    Filter,
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

type ViewType = "shifts" | "requests" | "timeoff" | "swap";
type FilterType = "upcoming" | "past" | "all";

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
    const [activeView, setActiveView] = useState<ViewType>("shifts");
    const [shiftFilter, setShiftFilter] = useState<FilterType>("upcoming");
    const [selectedShift, setSelectedShift] = useState<Schedule | null>(upcomingShifts[0] || null);
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
            weekday: "short",
            month: "short",
            day: "numeric",
        });
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatFullDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    const getShiftDuration = (start: Date, end: Date) => {
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    };

    const getTimeUntil = (date: Date) => {
        const now = new Date();
        const diff = new Date(date).getTime() - now.getTime();
        if (diff < 0) return "Started";
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `In ${days}d ${hours % 24}h`;
        if (hours > 0) return `In ${hours}h`;
        const minutes = Math.floor(diff / (1000 * 60));
        return `In ${minutes}m`;
    };

    const isToday = (date: Date) => {
        const today = new Date();
        const d = new Date(date);
        return d.toDateString() === today.toDateString();
    };

    const isTomorrow = (date: Date) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const d = new Date(date);
        return d.toDateString() === tomorrow.toDateString();
    };

    const allShifts = [...upcomingShifts, ...initialSchedule].filter(
        (shift, index, self) => index === self.findIndex((s) => s.id === shift.id)
    );

    // Get filtered shifts
    const filteredShifts = shiftFilter === "upcoming" ? upcomingShifts :
        shiftFilter === "past" ? pastShifts : [...upcomingShifts, ...pastShifts];

    // Counts for badges
    const pendingTimeOff = myTimeOffRequests.filter(r => r.status === "PENDING").length;
    const pendingSwaps = swapRequestsData.madeRequests.filter(r => r.status === "PENDING_TARGET" || r.status === "PENDING_ADMIN").length +
        pendingSwapRequests.pendingTargetRequests.length;
    const pendingRequests = requests.filter(r => r.status === "PENDING").length;

    const navItems = [
        { id: "shifts" as ViewType, label: "My Shifts", count: upcomingShifts.length },
        { id: "requests" as ViewType, label: "Requests", count: pendingRequests },
        { id: "timeoff" as ViewType, label: "Time Off", count: pendingTimeOff },
        { id: "swap" as ViewType, label: "Shift Swap", count: pendingSwaps },
    ];

    return (
        <div className="schedule-layout">
            {/* Main Content */}
            <div className="schedule-main">
                {/* Header */}
                <header className="schedule-header">
                    <div>
                        <h1>My Schedule</h1>
                        <p>View and manage your shifts</p>
                    </div>
                    <button onClick={() => setShowRequestForm(true)} className="btn btn-primary">
                        <Plus size={18} />
                        <span>New Request</span>
                    </button>
                </header>

                {/* Navigation */}
                <nav className="schedule-nav">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`nav-item ${activeView === item.id ? "active" : ""}`}
                        >
                            <span>{item.label}</span>
                            {item.count > 0 && (
                                <span className="nav-badge">{item.count}</span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Content */}
                <div className="schedule-content">
                    {/* Shifts View */}
                    {activeView === "shifts" && (
                        <>
                            <div className="content-header">
                                <div className="filter-tabs">
                                    <button
                                        onClick={() => setShiftFilter("upcoming")}
                                        className={`filter-tab ${shiftFilter === "upcoming" ? "active" : ""}`}
                                    >
                                        Upcoming
                                    </button>
                                    <button
                                        onClick={() => setShiftFilter("past")}
                                        className={`filter-tab ${shiftFilter === "past" ? "active" : ""}`}
                                    >
                                        Past
                                    </button>
                                </div>
                            </div>

                            <div className="shifts-list">
                                {filteredShifts.length > 0 ? (
                                    filteredShifts.map((shift) => (
                                        <div
                                            key={shift.id}
                                            onClick={() => setSelectedShift(shift)}
                                            className={`shift-item ${selectedShift?.id === shift.id ? "selected" : ""} ${shiftFilter === "past" ? "past" : ""}`}
                                        >
                                            <div className="shift-date">
                                                <span className="date-day">{new Date(shift.shiftStart).getDate()}</span>
                                                <span className="date-month">
                                                    {new Date(shift.shiftStart).toLocaleDateString(undefined, { month: "short" })}
                                                </span>
                                            </div>
                                            <div className="shift-details">
                                                <div className="shift-time">
                                                    {formatTime(shift.shiftStart)} - {formatTime(shift.shiftEnd)}
                                                </div>
                                                <div className="shift-meta">
                                                    {new Date(shift.shiftStart).toLocaleDateString(undefined, { weekday: "long" })}
                                                    <span className="dot">•</span>
                                                    {getShiftDuration(shift.shiftStart, shift.shiftEnd)}
                                                </div>
                                            </div>
                                            {shiftFilter === "upcoming" && (
                                                <div className="shift-status">
                                                    {isToday(shift.shiftStart) ? (
                                                        <span className="status-today">Today</span>
                                                    ) : isTomorrow(shift.shiftStart) ? (
                                                        <span className="status-tomorrow">Tomorrow</span>
                                                    ) : (
                                                        <span className="status-upcoming">{getTimeUntil(shift.shiftStart)}</span>
                                                    )}
                                                </div>
                                            )}
                                            <ChevronRight size={16} className="chevron" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <CalendarIcon size={40} />
                                        <h3>No {shiftFilter} shifts</h3>
                                        <p>{shiftFilter === "upcoming" ? "Check back later for new assignments" : "Your completed shifts will appear here"}</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Requests View */}
                    {activeView === "requests" && (
                        <div className="requests-list">
                            {requests.length > 0 ? (
                                requests.map((request) => (
                                    <div key={request.id} className="request-item">
                                        <div className="request-header">
                                            <span className="request-type">{TYPE_LABELS[request.type]}</span>
                                            <span className={`request-status status-${request.status.toLowerCase()}`}>
                                                {request.status === "PENDING" && <Clock size={12} />}
                                                {request.status === "APPROVED" && <CheckCircle2 size={12} />}
                                                {request.status === "REJECTED" && <XCircle size={12} />}
                                                {request.status}
                                            </span>
                                        </div>
                                        {request.reason && (
                                            <p className="request-reason">{request.reason}</p>
                                        )}
                                        <div className="request-footer">
                                            <span className="request-date">
                                                {new Date(request.createdAt).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                        {request.adminNotes && (
                                            <div className={`admin-notes ${request.status === "APPROVED" ? "approved" : "rejected"}`}>
                                                <AlertCircle size={14} />
                                                <div>
                                                    <span className="notes-label">Admin Response</span>
                                                    <p>{request.adminNotes}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <MessageSquare size={40} />
                                    <h3>No requests yet</h3>
                                    <p>Submit a new request to get started</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Time Off View */}
                    {activeView === "timeoff" && (
                        <TimeOffPanel
                            myRequests={myTimeOffRequests}
                            pendingRequests={pendingTimeOffRequests}
                            isAdmin={isAdmin}
                        />
                    )}

                    {/* Swap View */}
                    {activeView === "swap" && (
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

            {/* Sidebar */}
            <aside className="schedule-sidebar">
                {/* Next Shift Card */}
                {upcomingShifts[0] && (
                    <div className="sidebar-card next-shift-card">
                        <div className="card-label">
                            <CalendarIcon size={14} />
                            <span>Next Shift</span>
                        </div>
                        <div className="next-shift-date">
                            {formatFullDate(upcomingShifts[0].shiftStart)}
                        </div>
                        <div className="next-shift-time">
                            {formatTime(upcomingShifts[0].shiftStart)} - {formatTime(upcomingShifts[0].shiftEnd)}
                        </div>
                        <div className="next-shift-countdown">
                            <Clock size={14} />
                            <span>{getTimeUntil(upcomingShifts[0].shiftStart)}</span>
                        </div>
                    </div>
                )}

                {/* Selected Shift Details */}
                {selectedShift && activeView === "shifts" && (
                    <div className="sidebar-card">
                        <div className="card-label">
                            <CalendarIcon size={14} />
                            <span>Shift Details</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Date</span>
                            <span className="detail-value">{formatFullDate(selectedShift.shiftStart)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Time</span>
                            <span className="detail-value">{formatTime(selectedShift.shiftStart)} - {formatTime(selectedShift.shiftEnd)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Duration</span>
                            <span className="detail-value">{getShiftDuration(selectedShift.shiftStart, selectedShift.shiftEnd)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Status</span>
                            <span className="detail-value status-confirmed">
                                <CheckCircle2 size={14} />
                                Confirmed
                            </span>
                        </div>
                    </div>
                )}

                {/* Quick Stats */}
                <div className="sidebar-card">
                    <div className="card-label">
                        <Filter size={14} />
                        <span>Overview</span>
                    </div>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <span className="stat-value">{upcomingShifts.length}</span>
                            <span className="stat-label">Upcoming</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{pastShifts.length}</span>
                            <span className="stat-label">Completed</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value stat-pending">{pendingRequests}</span>
                            <span className="stat-label">Pending</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{pendingTimeOff + pendingSwaps}</span>
                            <span className="stat-label">Other</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="sidebar-card">
                    <div className="card-label">Quick Actions</div>
                    <div className="quick-actions">
                        <button onClick={() => setShowRequestForm(true)} className="action-btn">
                            <Edit3 size={16} />
                            <span>Schedule Change</span>
                        </button>
                        <button onClick={() => setActiveView("timeoff")} className="action-btn">
                            <Palmtree size={16} />
                            <span>Request Time Off</span>
                        </button>
                        <button onClick={() => setActiveView("swap")} className="action-btn">
                            <ArrowLeftRight size={16} />
                            <span>Swap Shift</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Request Modal */}
            {showRequestForm && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRequestForm(false); }}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Submit Request</h2>
                            <button onClick={() => setShowRequestForm(false)} className="close-btn">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitRequest} className="modal-form">
                            <div className="form-group">
                                <label>Request Type</label>
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
                                    <label>Related Shift (Optional)</label>
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
                                        <label>Requested Start</label>
                                        <input
                                            type="datetime-local"
                                            className="input"
                                            value={requestedStart}
                                            onChange={(e) => setRequestedStart(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Requested End</label>
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
                                <label>Reason / Explanation</label>
                                <textarea
                                    required
                                    placeholder="Explain your request..."
                                    className="input"
                                    rows={4}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowRequestForm(false)} className="btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    <Send size={16} />
                                    <span>{loading ? "Submitting..." : "Submit"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .schedule-layout {
                    display: grid;
                    grid-template-columns: 1fr 320px;
                    gap: 1.5rem;
                    padding: 1.5rem;
                    max-width: 1400px;
                    margin: 0 auto;
                    min-height: calc(100vh - 120px);
                }

                @media (max-width: 1024px) {
                    .schedule-layout {
                        grid-template-columns: 1fr;
                    }
                    .schedule-sidebar {
                        display: none;
                    }
                }

                /* Main Content */
                .schedule-main {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .schedule-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .schedule-header h1 {
                    font-size: 1.75rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .schedule-header p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                }

                /* Navigation */
                .schedule-nav {
                    display: flex;
                    gap: 0.25rem;
                    padding: 0.25rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-lg);
                    width: fit-content;
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    background: transparent;
                    border: none;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .nav-item:hover {
                    color: var(--text-primary);
                    background: var(--bg-hover);
                }

                .nav-item.active {
                    color: var(--text-primary);
                    background: var(--bg-card);
                    box-shadow: var(--shadow-sm);
                }

                .nav-badge {
                    font-size: 0.7rem;
                    font-weight: 600;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    background: var(--primary-soft);
                    color: var(--primary);
                }

                .nav-item.active .nav-badge {
                    background: var(--primary);
                    color: white;
                }

                /* Content */
                .schedule-content {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    flex: 1;
                }

                .content-header {
                    margin-bottom: 1rem;
                }

                .filter-tabs {
                    display: flex;
                    gap: 0.5rem;
                }

                .filter-tab {
                    padding: 0.5rem 1rem;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    background: transparent;
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .filter-tab:hover {
                    border-color: var(--border-hover);
                    color: var(--text-primary);
                }

                .filter-tab.active {
                    background: var(--primary);
                    border-color: var(--primary);
                    color: white;
                }

                /* Shifts List */
                .shifts-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .shift-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border: 1px solid transparent;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .shift-item:hover {
                    border-color: var(--border-hover);
                }

                .shift-item.selected {
                    border-color: var(--primary);
                    background: var(--primary-soft);
                }

                .shift-item.past {
                    opacity: 0.6;
                }

                .shift-date {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 48px;
                    height: 48px;
                    background: var(--bg-card);
                    border-radius: var(--radius-md);
                    flex-shrink: 0;
                }

                .shift-item.selected .shift-date {
                    background: var(--primary);
                }

                .date-day {
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1;
                }

                .shift-item.selected .date-day {
                    color: white;
                }

                .date-month {
                    font-size: 0.625rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--text-secondary);
                }

                .shift-item.selected .date-month {
                    color: rgba(255,255,255,0.8);
                }

                .shift-details {
                    flex: 1;
                    min-width: 0;
                }

                .shift-time {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .shift-meta {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .dot {
                    opacity: 0.5;
                }

                .shift-status {
                    flex-shrink: 0;
                }

                .status-today {
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                    background: var(--success-bg);
                    color: var(--success);
                }

                .status-tomorrow {
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 0.25rem 0.625rem;
                    border-radius: 9999px;
                    background: var(--info-bg);
                    color: var(--info);
                }

                .status-upcoming {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }

                .chevron {
                    color: var(--text-muted);
                    flex-shrink: 0;
                }

                /* Requests List */
                .requests-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .request-item {
                    padding: 1rem;
                    background: var(--bg-secondary);
                    border-radius: var(--radius-md);
                }

                .request-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .request-type {
                    font-size: 0.8125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .request-status {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    padding: 0.25rem 0.5rem;
                    border-radius: var(--radius-sm);
                }

                .status-pending {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                .status-approved {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .status-rejected {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .request-reason {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    line-height: 1.5;
                    margin-bottom: 0.5rem;
                }

                .request-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .request-date {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }

                .admin-notes {
                    display: flex;
                    gap: 0.75rem;
                    margin-top: 0.75rem;
                    padding: 0.75rem;
                    border-radius: var(--radius-sm);
                }

                .admin-notes.approved {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .admin-notes.rejected {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                .admin-notes svg {
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .notes-label {
                    font-size: 0.7rem;
                    font-weight: 600;
                    display: block;
                    margin-bottom: 0.25rem;
                }

                .admin-notes p {
                    font-size: 0.8125rem;
                    color: var(--text-primary);
                }

                /* Empty State */
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem 1rem;
                    text-align: center;
                    color: var(--text-secondary);
                }

                .empty-state svg {
                    opacity: 0.3;
                    margin-bottom: 1rem;
                }

                .empty-state h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }

                .empty-state p {
                    font-size: 0.875rem;
                }

                /* Sidebar */
                .schedule-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .sidebar-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                }

                .next-shift-card {
                    background: linear-gradient(135deg, var(--primary) 0%, #16A34A 100%);
                    border: none;
                    color: white;
                }

                .next-shift-card .card-label {
                    color: rgba(255,255,255,0.8);
                }

                .card-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                }

                .next-shift-date {
                    font-size: 1rem;
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }

                .next-shift-time {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 0.75rem;
                }

                .next-shift-countdown {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    padding: 0.375rem 0.75rem;
                    background: rgba(255,255,255,0.2);
                    border-radius: 9999px;
                }

                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.625rem 0;
                    border-bottom: 1px solid var(--border);
                }

                .detail-row:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }

                .detail-label {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                }

                .detail-value {
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .detail-value.status-confirmed {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    color: var(--success);
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .stat-item {
                    text-align: center;
                }

                .stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1;
                }

                .stat-value.stat-pending {
                    color: var(--warning);
                }

                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    margin-top: 0.25rem;
                }

                .quick-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    width: 100%;
                    padding: 0.75rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                    background: var(--bg-secondary);
                    border: 1px solid transparent;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.15s ease;
                    text-align: left;
                }

                .action-btn:hover {
                    background: var(--bg-hover);
                    border-color: var(--border);
                    color: var(--text-primary);
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 200;
                    padding: 1rem;
                }

                .modal-content {
                    width: 100%;
                    max-width: 480px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-xl);
                    overflow: hidden;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                }

                .modal-header h2 {
                    font-size: 1.125rem;
                    font-weight: 600;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: var(--radius-sm);
                    transition: all 0.15s ease;
                }

                .close-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .modal-form {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }

                .form-group label {
                    font-size: 0.8125rem;
                    font-weight: 500;
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

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    padding-top: 0.5rem;
                }
            `}</style>
        </div>
    );
}
