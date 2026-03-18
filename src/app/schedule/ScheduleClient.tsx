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
    CalendarPlus,
    Copy,
    Check,
    Download,
} from "lucide-react";
import { createDetailedRequest } from "@/lib/requestActions";
import { getCalendarSubscriptionUrl, getCalendarDownloadUrl } from "@/lib/calendarExportActions";
import TimeOffPanel from "@/components/TimeOffPanel";
import ShiftSwapPanel from "@/components/ShiftSwapPanel";
import ToggleGroup from "@/components/ui/ToggleGroup";

interface Schedule {
    id: string;
    date: Date;
    startHour: number;
    endHour: number;
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
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [urlCopied, setUrlCopied] = useState(false);
    const [loadingCalendar, setLoadingCalendar] = useState(false);

    // Form state
    const [requestType, setRequestType] = useState<"HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW">("SCHEDULE_CHANGE");
    const [reason, setReason] = useState("");
    const [selectedScheduleId, setSelectedScheduleId] = useState("");
    const [requestedStart, setRequestedStart] = useState("");
    const [requestedEnd, setRequestedEnd] = useState("");
    const [loading, setLoading] = useState(false);

    const handleOpenCalendarModal = async () => {
        setShowCalendarModal(true);
        if (!calendarUrl) {
            setLoadingCalendar(true);
            try {
                const [subResult, dlResult] = await Promise.all([
                    getCalendarSubscriptionUrl(userId),
                    getCalendarDownloadUrl(userId),
                ]);
                if (subResult.success && subResult.data) setCalendarUrl(subResult.data);
                if (dlResult.success && dlResult.data) setDownloadUrl(dlResult.data);
            } catch (error) {
                console.error("Failed to get calendar URL:", error);
            } finally {
                setLoadingCalendar(false);
            }
        }
    };

    const handleCopyCalendarUrl = async () => {
        if (!calendarUrl) return;
        try {
            // Convert webcal:// back to https:// for copying
            const httpsUrl = calendarUrl.replace(/^webcal:\/\//, "https://");
            await navigator.clipboard.writeText(httpsUrl);
            setUrlCopied(true);
            setTimeout(() => setUrlCopied(false), 2000);
        } catch (error) {
            console.error("Failed to copy URL:", error);
        }
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) return;

        setLoading(true);
        try {
            const result = await createDetailedRequest({
                userId: session.user.id,
                type: requestType,
                reason: reason.trim(),
                scheduleId: selectedScheduleId || undefined,
                requestedStart: requestedStart ? new Date(requestedStart) : undefined,
                requestedEnd: requestedEnd ? new Date(requestedEnd) : undefined,
            });

            if (result.success && result.data) {
                setRequests((prev) => [result.data as Request, ...prev]);
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

    // Format hour integer to display time (e.g., 6 -> "6:00 AM", 14 -> "2:00 PM")
    const formatHour = (hour: number) => {
        if (hour === 0) return "12:00 AM";
        if (hour < 12) return `${hour}:00 AM`;
        if (hour === 12) return "12:00 PM";
        return `${hour - 12}:00 PM`;
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
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

    // Get shift duration accounting for overnight shifts
    const getShiftDuration = (startHour: number, endHour: number) => {
        const hours = endHour > startHour
            ? endHour - startHour
            : (24 - startHour) + endHour;
        return `${hours}h`;
    };

    // Get time until shift starts
    const getTimeUntil = (date: Date, startHour: number) => {
        const now = new Date();
        const shiftDate = new Date(date);
        shiftDate.setHours(startHour, 0, 0, 0);
        const diff = shiftDate.getTime() - now.getTime();
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

                {/* Mobile Next Shift Card (shows on tablet/mobile) */}
                {upcomingShifts[0] && (
                    <div className="mobile-next-shift">
                        <div className="mobile-next-shift__label">
                            <CalendarIcon size={12} />
                            <span>Next Shift</span>
                        </div>
                        <div className="mobile-next-shift__content">
                            <div>
                                <div className="mobile-next-shift__date">
                                    {formatDate(upcomingShifts[0].date)}
                                </div>
                                <div className="mobile-next-shift__time">
                                    {formatHour(upcomingShifts[0].startHour)} - {formatHour(upcomingShifts[0].endHour)}
                                </div>
                            </div>
                            <div className="mobile-next-shift__countdown">
                                <Clock size={12} />
                                <span>{getTimeUntil(upcomingShifts[0].date, upcomingShifts[0].startHour)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="schedule-content">
                    {/* Shifts View */}
                    {activeView === "shifts" && (
                        <>
                            <div className="content-header">
                                <ToggleGroup
                                    options={[
                                        { value: "upcoming", label: "Upcoming" },
                                        { value: "past", label: "Past" },
                                    ]}
                                    value={shiftFilter}
                                    onChange={(v) => setShiftFilter(v as "upcoming" | "past")}
                                    size="sm"
                                />
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
                                                <span className="date-day">{new Date(shift.date).getDate()}</span>
                                                <span className="date-month">
                                                    {new Date(shift.date).toLocaleDateString(undefined, { month: "short" })}
                                                </span>
                                            </div>
                                            <div className="shift-details">
                                                <div className="shift-time">
                                                    {formatHour(shift.startHour)} - {formatHour(shift.endHour)}
                                                </div>
                                                <div className="shift-meta">
                                                    {new Date(shift.date).toLocaleDateString(undefined, { weekday: "long" })}
                                                    <span className="dot">•</span>
                                                    {getShiftDuration(shift.startHour, shift.endHour)}
                                                </div>
                                            </div>
                                            {shiftFilter === "upcoming" && (
                                                <div className="shift-status">
                                                    {isToday(shift.date) ? (
                                                        <span className="status-today">Today</span>
                                                    ) : isTomorrow(shift.date) ? (
                                                        <span className="status-tomorrow">Tomorrow</span>
                                                    ) : (
                                                        <span className="status-upcoming">{getTimeUntil(shift.date, shift.startHour)}</span>
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
                            {formatFullDate(upcomingShifts[0].date)}
                        </div>
                        <div className="next-shift-time">
                            {formatHour(upcomingShifts[0].startHour)} - {formatHour(upcomingShifts[0].endHour)}
                        </div>
                        <div className="next-shift-countdown">
                            <Clock size={14} />
                            <span>{getTimeUntil(upcomingShifts[0].date, upcomingShifts[0].startHour)}</span>
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
                            <span className="detail-value">{formatFullDate(selectedShift.date)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Time</span>
                            <span className="detail-value">{formatHour(selectedShift.startHour)} - {formatHour(selectedShift.endHour)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Duration</span>
                            <span className="detail-value">{getShiftDuration(selectedShift.startHour, selectedShift.endHour)}</span>
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
                        <button onClick={handleOpenCalendarModal} className="action-btn action-btn--secondary">
                            <CalendarPlus size={16} />
                            <span>Subscribe to Calendar</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile FAB */}
            <button
                onClick={() => setShowRequestForm(true)}
                className="mobile-fab"
                aria-label="New Request"
            >
                <Plus size={24} />
            </button>

            {/* Calendar Subscription Modal */}
            {showCalendarModal && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCalendarModal(false); }}>
                    <div className="modal-content modal-content--small">
                        <div className="modal-header">
                            <h2>Subscribe to Calendar</h2>
                            <button onClick={() => setShowCalendarModal(false)} className="close-btn">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {loadingCalendar ? (
                                <div className="calendar-loading">
                                    <div className="spinner" />
                                    <p>Generating calendar link...</p>
                                </div>
                            ) : (
                                <>
                                    <p className="calendar-info">
                                        Subscribe to your schedule in your favorite calendar app (Google Calendar, Apple Calendar, Outlook, etc.)
                                    </p>

                                    <div className="calendar-url-container">
                                        <input
                                            type="text"
                                            readOnly
                                            value={calendarUrl?.replace(/^webcal:\/\//, "https://") || ""}
                                            className="calendar-url-input"
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                        />
                                        <button
                                            onClick={handleCopyCalendarUrl}
                                            className="copy-btn"
                                            title="Copy URL"
                                        >
                                            {urlCopied ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>

                                    <div className="calendar-actions">
                                        <a
                                            href={calendarUrl || "#"}
                                            className="calendar-btn calendar-btn--primary"
                                        >
                                            <CalendarPlus size={16} />
                                            Open in Calendar App
                                        </a>
                                        <a
                                            href={downloadUrl || "#"}
                                            className="calendar-btn calendar-btn--secondary"
                                            download="nebo-schedule.ics"
                                        >
                                            <Download size={16} />
                                            Download .ics File
                                        </a>
                                    </div>

                                    <p className="calendar-note">
                                        Note: Changes to your schedule will automatically sync when you subscribe.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                                                {formatDate(shift.date)} {formatHour(shift.startHour)} - {formatHour(shift.endHour)}
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
                        padding: 1rem;
                        gap: 1rem;
                    }
                    .schedule-sidebar {
                        display: none;
                    }
                }

                @media (max-width: 640px) {
                    .schedule-layout {
                        padding: 0.75rem;
                        padding-bottom: 5rem; /* Space for mobile nav */
                    }
                    .schedule-header h1 {
                        font-size: 1.25rem;
                    }
                    .schedule-header p {
                        font-size: 0.75rem;
                    }
                    .btn {
                        padding: 0.5rem 0.75rem;
                        font-size: 0.8125rem;
                    }
                    .btn span {
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
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }

                @media (max-width: 640px) {
                    .schedule-nav {
                        width: 100%;
                        justify-content: stretch;
                    }
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
                    white-space: nowrap;
                    flex: 1;
                    justify-content: center;
                }

                @media (max-width: 640px) {
                    .nav-item {
                        padding: 0.75rem 0.5rem;
                        font-size: 0.75rem;
                        flex-direction: column;
                        gap: 0.25rem;
                    }
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

                /* Mobile Next Shift Card */
                .mobile-next-shift {
                    display: none;
                    padding: 1rem;
                    background: linear-gradient(135deg, var(--primary) 0%, #16A34A 100%);
                    border-radius: var(--radius-lg);
                    color: white;
                    margin-bottom: 1rem;
                }

                @media (max-width: 1024px) {
                    .mobile-next-shift {
                        display: block;
                    }
                }

                .mobile-next-shift__label {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    opacity: 0.9;
                    margin-bottom: 0.5rem;
                }

                .mobile-next-shift__content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .mobile-next-shift__date {
                    font-size: 0.875rem;
                    font-weight: 500;
                    margin-bottom: 0.125rem;
                }

                .mobile-next-shift__time {
                    font-size: 1.25rem;
                    font-weight: 700;
                }

                .mobile-next-shift__countdown {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.75rem;
                    font-weight: 500;
                    padding: 0.25rem 0.5rem;
                    background: rgba(255,255,255,0.2);
                    border-radius: 9999px;
                }

                /* Content */
                .schedule-content {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    flex: 1;
                }

                @media (max-width: 640px) {
                    .schedule-content {
                        padding: 1rem;
                        border-radius: var(--radius-md);
                    }
                }

                .content-header {
                    margin-bottom: 1rem;
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
                    -webkit-tap-highlight-color: transparent;
                }

                @media (max-width: 640px) {
                    .shift-item {
                        padding: 0.875rem;
                        gap: 0.75rem;
                    }
                }

                .shift-item:hover {
                    border-color: var(--border-hover);
                }

                .shift-item:active {
                    transform: scale(0.99);
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

                @media (max-width: 640px) {
                    .shift-date {
                        width: 44px;
                        height: 44px;
                    }
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

                @media (max-width: 640px) {
                    .modal-overlay {
                        align-items: flex-end;
                        padding: 0;
                    }
                }

                .modal-content {
                    width: 100%;
                    max-width: 480px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-xl);
                    overflow: hidden;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                @media (max-width: 640px) {
                    .modal-content {
                        max-width: 100%;
                        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
                        max-height: 85vh;
                    }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                    position: sticky;
                    top: 0;
                    background: var(--bg-card);
                    z-index: 1;
                }

                @media (max-width: 640px) {
                    .modal-header {
                        padding: 1rem;
                    }
                    .modal-header::before {
                        content: '';
                        position: absolute;
                        top: 0.5rem;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 2.5rem;
                        height: 0.25rem;
                        background: var(--border);
                        border-radius: 9999px;
                    }
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
                    padding: 0.5rem;
                    border-radius: var(--radius-sm);
                    transition: all 0.15s ease;
                    min-width: 44px;
                    min-height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
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

                @media (max-width: 640px) {
                    .modal-form {
                        padding: 1rem;
                        padding-bottom: 2rem;
                    }
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

                @media (max-width: 640px) {
                    .modal-footer {
                        flex-direction: column-reverse;
                    }
                    .modal-footer .btn {
                        width: 100%;
                        justify-content: center;
                        padding: 0.875rem;
                    }
                }

                /* Mobile FAB (Floating Action Button) */
                .mobile-fab {
                    display: none;
                    position: fixed;
                    bottom: 1.5rem;
                    right: 1.5rem;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: var(--primary);
                    color: white;
                    border: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    cursor: pointer;
                    z-index: 100;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .mobile-fab:active {
                    transform: scale(0.95);
                }

                @media (max-width: 640px) {
                    .mobile-fab {
                        display: flex;
                    }
                    .schedule-header .btn {
                        display: none;
                    }
                }

                /* Calendar Modal Styles */
                .modal-content--small {
                    max-width: 420px;
                }

                .modal-body {
                    padding: 1.5rem;
                }

                .calendar-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    padding: 2rem;
                }

                .calendar-loading .spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--border);
                    border-top-color: var(--primary);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .calendar-info {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    line-height: 1.5;
                    margin-bottom: 1rem;
                }

                .calendar-url-container {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .calendar-url-input {
                    flex: 1;
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-primary);
                    font-size: 0.8rem;
                    font-family: monospace;
                }

                .copy-btn {
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .copy-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .calendar-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }

                .calendar-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.875rem 1rem;
                    border-radius: var(--radius-md);
                    font-weight: 500;
                    font-size: 0.875rem;
                    text-decoration: none;
                    transition: all 0.15s ease;
                }

                .calendar-btn--primary {
                    background: var(--primary);
                    color: white;
                }

                .calendar-btn--primary:hover {
                    background: var(--primary-hover);
                }

                .calendar-btn--secondary {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                }

                .calendar-btn--secondary:hover {
                    background: var(--bg-hover);
                }

                .calendar-note {
                    font-size: 0.75rem;
                    color: var(--text-dim);
                    text-align: center;
                }

                .action-btn--secondary {
                    background: var(--bg-secondary) !important;
                    border-color: var(--border) !important;
                }

                .action-btn--secondary:hover {
                    background: var(--bg-hover) !important;
                }
            `}</style>
        </div>
    );
}
