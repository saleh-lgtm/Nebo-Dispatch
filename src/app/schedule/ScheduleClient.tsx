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
    session: any;
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
                    <span className="flex items-center gap-1" style={{ color: "var(--warning)" }}>
                        <Clock size={14} /> Pending
                    </span>
                );
            case "APPROVED":
                return (
                    <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
                        <CheckCircle2 size={14} /> Approved
                    </span>
                );
            case "REJECTED":
                return (
                    <span className="flex items-center gap-1" style={{ color: "var(--danger)" }}>
                        <XCircle size={14} /> Rejected
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

    return (
        <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: "1.5rem" }}>
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>
                        My Schedule
                    </h1>
                    <p style={{ color: "var(--text-secondary)" }}>
                        View shifts and manage scheduling requests
                    </p>
                </div>
                <button onClick={() => setShowRequestForm(true)} className="btn btn-primary">
                    <Edit3 size={18} />
                    <span>New Request</span>
                </button>
            </header>

            <div className="glass-card overflow-hidden" style={{ padding: 0 }}>
                {/* Tabs */}
                <div className="flex border-b border-white/10" style={{ overflowX: "auto" }}>
                    <button
                        onClick={() => setActiveTab("upcoming")}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap px-4 ${
                            activeTab === "upcoming"
                                ? "text-accent border-b-2 border-accent"
                                : "text-secondary hover:text-white"
                        }`}
                    >
                        <CalendarIcon size={14} style={{ display: "inline", marginRight: "0.5rem" }} />
                        Upcoming
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap px-4 ${
                            activeTab === "history"
                                ? "text-accent border-b-2 border-accent"
                                : "text-secondary hover:text-white"
                        }`}
                    >
                        <Clock size={14} style={{ display: "inline", marginRight: "0.5rem" }} />
                        History
                    </button>
                    <button
                        onClick={() => setActiveTab("requests")}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap px-4 ${
                            activeTab === "requests"
                                ? "text-accent border-b-2 border-accent"
                                : "text-secondary hover:text-white"
                        }`}
                    >
                        <FileEdit size={14} style={{ display: "inline", marginRight: "0.5rem" }} />
                        Requests
                    </button>
                    <button
                        onClick={() => setActiveTab("timeoff")}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap px-4 ${
                            activeTab === "timeoff"
                                ? "text-accent border-b-2 border-accent"
                                : "text-secondary hover:text-white"
                        }`}
                    >
                        <Palmtree size={14} style={{ display: "inline", marginRight: "0.5rem" }} />
                        Time Off
                        {pendingTimeOff > 0 && (
                            <span style={{
                                marginLeft: "0.5rem",
                                background: "var(--warning)",
                                color: "#000",
                                padding: "0.125rem 0.375rem",
                                borderRadius: "9999px",
                                fontSize: "0.65rem",
                                fontWeight: 700,
                            }}>
                                {pendingTimeOff}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("swap")}
                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap px-4 ${
                            activeTab === "swap"
                                ? "text-accent border-b-2 border-accent"
                                : "text-secondary hover:text-white"
                        }`}
                    >
                        <ArrowLeftRight size={14} style={{ display: "inline", marginRight: "0.5rem" }} />
                        Shift Swap
                        {pendingSwaps > 0 && (
                            <span style={{
                                marginLeft: "0.5rem",
                                background: "var(--warning)",
                                color: "#000",
                                padding: "0.125rem 0.375rem",
                                borderRadius: "9999px",
                                fontSize: "0.65rem",
                                fontWeight: 700,
                            }}>
                                {pendingSwaps}
                            </span>
                        )}
                    </button>
                </div>

                <div style={{ padding: "1.5rem" }}>
                    {/* Upcoming Shifts Tab */}
                    {activeTab === "upcoming" && (
                        <div className="flex flex-col gap-4">
                            {upcomingShifts.length > 0 ? (
                                upcomingShifts.map((shift) => (
                                    <div
                                        key={shift.id}
                                        className="flex items-center gap-6 p-4 rounded-xl bg-white/5 border border-white/10"
                                    >
                                        <div className="flex flex-col items-center justify-center bg-accent/20 rounded-lg p-3 min-w-[80px]">
                                            <span className="text-xs uppercase font-bold text-accent">
                                                {new Date(shift.shiftStart).toLocaleDateString(undefined, {
                                                    month: "short",
                                                })}
                                            </span>
                                            <span className="text-2xl font-display leading-tight">
                                                {new Date(shift.shiftStart).getDate()}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-display" style={{ fontSize: "1.125rem" }}>
                                                {formatTime(shift.shiftStart)} - {formatTime(shift.shiftEnd)}
                                            </h3>
                                            <p className="text-sm text-secondary">
                                                {new Date(shift.shiftStart).toLocaleDateString(undefined, {
                                                    weekday: "long",
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-success">
                                            <CheckCircle2 size={16} />
                                            <span className="text-xs font-bold uppercase tracking-wide">
                                                Confirmed
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center gap-3">
                                    <CalendarIcon size={48} className="text-accent opacity-20" />
                                    <p className="text-secondary italic">No upcoming shifts scheduled.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Shift History Tab */}
                    {activeTab === "history" && (
                        <div className="flex flex-col gap-4">
                            {pastShifts.length > 0 ? (
                                pastShifts.map((shift) => (
                                    <div
                                        key={shift.id}
                                        className="flex items-center gap-6 p-4 rounded-xl bg-white/5 border border-white/10 opacity-70"
                                    >
                                        <div className="flex flex-col items-center justify-center bg-white/10 rounded-lg p-3 min-w-[80px]">
                                            <span className="text-xs uppercase font-bold text-secondary">
                                                {new Date(shift.shiftStart).toLocaleDateString(undefined, {
                                                    month: "short",
                                                })}
                                            </span>
                                            <span className="text-2xl font-display leading-tight">
                                                {new Date(shift.shiftStart).getDate()}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-display" style={{ fontSize: "1.125rem" }}>
                                                {formatTime(shift.shiftStart)} - {formatTime(shift.shiftEnd)}
                                            </h3>
                                            <p className="text-sm text-secondary">
                                                {new Date(shift.shiftStart).toLocaleDateString(undefined, {
                                                    weekday: "long",
                                                    year: "numeric",
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-secondary">
                                            <Clock size={16} />
                                            <span className="text-xs font-bold uppercase tracking-wide">
                                                Completed
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center gap-3">
                                    <Clock size={48} className="text-accent opacity-20" />
                                    <p className="text-secondary italic">No shift history available.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* My Requests Tab */}
                    {activeTab === "requests" && (
                        <div className="flex flex-col gap-4">
                            {requests.length > 0 ? (
                                requests.map((request) => (
                                    <div
                                        key={request.id}
                                        className="p-4 rounded-xl bg-white/5 border border-white/10"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span
                                                    style={{
                                                        padding: "0.25rem 0.5rem",
                                                        borderRadius: "4px",
                                                        fontSize: "0.7rem",
                                                        fontWeight: 600,
                                                        background: "rgba(183, 175, 163, 0.1)",
                                                        color: "var(--accent)",
                                                    }}
                                                >
                                                    {TYPE_LABELS[request.type]}
                                                </span>
                                                <p
                                                    style={{
                                                        fontSize: "0.75rem",
                                                        color: "var(--text-secondary)",
                                                        marginTop: "0.5rem",
                                                    }}
                                                >
                                                    Submitted {formatDateTime(request.createdAt)}
                                                </p>
                                            </div>
                                            {getStatusBadge(request.status)}
                                        </div>

                                        {request.reason && (
                                            <div
                                                className="flex items-start gap-2 mb-3"
                                                style={{
                                                    padding: "0.75rem",
                                                    background: "rgba(255, 255, 255, 0.02)",
                                                    borderRadius: "0.5rem",
                                                }}
                                            >
                                                <MessageSquare
                                                    size={14}
                                                    style={{ color: "var(--text-secondary)", marginTop: 2 }}
                                                />
                                                <p style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                                                    {request.reason}
                                                </p>
                                            </div>
                                        )}

                                        {request.adminNotes && (
                                            <div
                                                className="flex items-start gap-2"
                                                style={{
                                                    padding: "0.75rem",
                                                    background:
                                                        request.status === "APPROVED"
                                                            ? "rgba(34, 197, 94, 0.1)"
                                                            : "rgba(239, 68, 68, 0.1)",
                                                    borderRadius: "0.5rem",
                                                    border: `1px solid ${
                                                        request.status === "APPROVED"
                                                            ? "rgba(34, 197, 94, 0.2)"
                                                            : "rgba(239, 68, 68, 0.2)"
                                                    }`,
                                                }}
                                            >
                                                <AlertCircle
                                                    size={14}
                                                    style={{
                                                        color:
                                                            request.status === "APPROVED"
                                                                ? "var(--success)"
                                                                : "var(--danger)",
                                                        marginTop: 2,
                                                    }}
                                                />
                                                <div>
                                                    <p
                                                        style={{
                                                            fontSize: "0.7rem",
                                                            fontWeight: 600,
                                                            color:
                                                                request.status === "APPROVED"
                                                                    ? "var(--success)"
                                                                    : "var(--danger)",
                                                            marginBottom: "0.25rem",
                                                        }}
                                                    >
                                                        Admin Response
                                                    </p>
                                                    <p style={{ fontSize: "0.875rem" }}>{request.adminNotes}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 flex flex-col items-center gap-3">
                                    <FileEdit size={48} className="text-accent opacity-20" />
                                    <p className="text-secondary italic">
                                        No requests submitted yet. Click &quot;New Request&quot; to get started.
                                    </p>
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

            {/* Request Modal */}
            {showRequestForm && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowRequestForm(false);
                    }}
                >
                    <div className="glass-card w-full max-w-lg animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <Edit3 className="text-accent" />
                                <h2 className="font-display" style={{ fontSize: "1.5rem" }}>
                                    Submit Request
                                </h2>
                            </div>
                            <button onClick={() => setShowRequestForm(false)} className="btn-icon">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitRequest} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-secondary uppercase tracking-wider font-bold">
                                    Request Type
                                </label>
                                <select
                                    className="input w-full"
                                    value={requestType}
                                    onChange={(e) =>
                                        setRequestType(
                                            e.target.value as "HOURS_MODIFICATION" | "SCHEDULE_CHANGE" | "REVIEW"
                                        )
                                    }
                                >
                                    <option value="SCHEDULE_CHANGE">Schedule Change</option>
                                    <option value="HOURS_MODIFICATION">Hours Modification</option>
                                    <option value="REVIEW">Schedule Review</option>
                                </select>
                            </div>

                            {allShifts.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-secondary uppercase tracking-wider font-bold">
                                        Related Shift (Optional)
                                    </label>
                                    <select
                                        className="input w-full"
                                        value={selectedScheduleId}
                                        onChange={(e) => setSelectedScheduleId(e.target.value)}
                                    >
                                        <option value="">Select a shift...</option>
                                        {allShifts.map((shift) => (
                                            <option key={shift.id} value={shift.id}>
                                                {formatDate(shift.shiftStart)} {formatTime(shift.shiftStart)} -{" "}
                                                {formatTime(shift.shiftEnd)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {requestType === "SCHEDULE_CHANGE" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-secondary uppercase tracking-wider font-bold">
                                            Requested Start
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="input"
                                            value={requestedStart}
                                            onChange={(e) => setRequestedStart(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs text-secondary uppercase tracking-wider font-bold">
                                            Requested End
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="input"
                                            value={requestedEnd}
                                            onChange={(e) => setRequestedEnd(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-secondary uppercase tracking-wider font-bold">
                                    Reason / Explanation
                                </label>
                                <textarea
                                    required
                                    placeholder="Explain your request details here..."
                                    className="input"
                                    style={{ height: "120px", resize: "vertical" }}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                            </div>

                            <div className="flex items-start gap-2 p-3 bg-accent/10 rounded-lg border border-accent/20">
                                <AlertCircle size={14} className="text-accent mt-0.5" />
                                <p className="text-xs text-secondary leading-normal">
                                    Your request will be reviewed by an administrator. You can track its
                                    status in the &quot;My Requests&quot; tab.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRequestForm(false)}
                                    className="btn btn-outline"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary flex items-center gap-2"
                                    disabled={loading}
                                >
                                    <Send size={16} />
                                    <span>{loading ? "Submitting..." : "Submit Request"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
