"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Clock,
    Calendar,
    Shield,
    TrendingUp,
    StickyNote,
    User,
    Crown,
    Users,
} from "lucide-react";
import { createActiveShift } from "@/lib/actions";
import { useState } from "react";
import QuotesPanel from "@/components/QuotesPanel";
import ActiveUsersPanel from "@/components/ActiveUsersPanel";
import RecentReportsPanel from "@/components/RecentReportsPanel";
import EventsPanel from "@/components/EventsPanel";

interface GlobalNote {
    id: string;
    title: string;
    content: string;
    createdAt: Date;
    author: { id: string; name: string | null };
}

interface Quote {
    id: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    serviceType: string;
    pickupDate: Date | null;
    pickupLocation: string | null;
    dropoffLocation: string | null;
    estimatedAmount: number | null;
    notes: string | null;
    status: "PENDING" | "FOLLOWING_UP" | "CONVERTED" | "LOST" | "EXPIRED";
    followUpCount: number;
    lastFollowUp: Date | null;
    nextFollowUp: Date | null;
    followUpNotes: string | null;
    createdBy: { id: string; name: string | null };
    assignedTo: { id: string; name: string | null } | null;
    createdAt: Date;
}

interface OnlineUser {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    currentPage?: string | null;
    lastSeenAt?: Date;
    clockIn?: Date;
    shiftId?: string;
}

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

interface Event {
    id: string;
    title: string;
    description: string | null;
    eventDate: Date;
    endDate: Date | null;
    eventType: "GAME_DAY" | "CONCERT" | "CONFERENCE" | "HOLIDAY" | "PROMOTION" | "GENERAL";
    location: string | null;
    notes: string | null;
    expectedVolume: string | null;
    staffingNotes: string | null;
    createdBy: { id: string; name: string | null };
    createdAt: Date;
}

interface Props {
    initialStats: {
        userCount: number;
        activeShift: { id: string } | null;
        isSuperAdmin: boolean;
    };
    globalNotes: GlobalNote[];
    pendingQuotes: Quote[];
    onlineUsers: OnlineUser[];
    activeShiftUsers: OnlineUser[];
    recentReports: ShiftReport[];
    upcomingEvents: Event[];
    userId: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}

export default function DashboardClient({
    initialStats,
    globalNotes,
    pendingQuotes,
    onlineUsers,
    activeShiftUsers,
    recentReports,
    upcomingEvents,
    userId,
    isAdmin,
    isSuperAdmin,
}: Props) {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    if (!session) return null;

    const hasActiveShift = initialStats.activeShift !== null;

    const handleClockToggle = async () => {
        setLoading(true);
        if (hasActiveShift) {
            router.push("/reports/shift");
        } else {
            await createActiveShift(session.user.id);
            router.refresh();
        }
        setLoading(false);
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    return (
        <div className="animate-fade-in" style={{ padding: "1.5rem" }}>
            <header style={{ marginBottom: "2rem" }}>
                <div className="flex items-center gap-3">
                    <h1 className="font-display" style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
                        Welcome, {session.user.name}
                    </h1>
                    {isSuperAdmin && (
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                padding: "0.25rem 0.75rem",
                                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(251, 191, 36, 0.2))",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: "9999px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "var(--danger)",
                            }}
                        >
                            <Crown size={12} />
                            Super Admin
                        </span>
                    )}
                </div>
                <p style={{ color: "var(--text-secondary)" }}>
                    {isSuperAdmin
                        ? "Super Administrator Dashboard"
                        : isAdmin
                        ? "Administrator Dashboard"
                        : "Dispatcher Portal"}{" "}
                    &bull;{" "}
                    {new Date().toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    })}
                </p>
            </header>

            {/* Stats Grid */}
            <div
                className="grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "1.5rem",
                    marginBottom: "2rem",
                }}
            >
                {/* Clock In/Out - Only for non-super-admin */}
                {!isSuperAdmin && (
                    <div className="glass-card">
                        <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                            <div
                                style={{
                                    padding: "0.75rem",
                                    background: "rgba(183, 175, 163, 0.1)",
                                    borderRadius: "0.75rem",
                                    color: "var(--accent)",
                                }}
                            >
                                <Clock size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Status</p>
                                <h3 style={{ fontSize: "1.25rem" }}>
                                    {hasActiveShift ? "Shift Active" : "Off Duty"}
                                </h3>
                            </div>
                        </div>
                        <button
                            onClick={handleClockToggle}
                            className="btn btn-primary"
                            style={{ width: "100%" }}
                            disabled={loading}
                        >
                            {hasActiveShift ? "Submit Shift Report" : "Clock In"}
                        </button>
                    </div>
                )}

                {/* Active Users - For admins */}
                {isAdmin && (
                    <div className="glass-card">
                        <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                            <div
                                style={{
                                    padding: "0.75rem",
                                    background: "rgba(34, 197, 94, 0.1)",
                                    borderRadius: "0.75rem",
                                    color: "var(--success)",
                                }}
                            >
                                <Users size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Online Now</p>
                                <h3 style={{ fontSize: "1.25rem" }}>{onlineUsers.length} Active</h3>
                            </div>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            {activeShiftUsers.length} on shift
                        </p>
                    </div>
                )}

                {/* Total Users - For admins */}
                {isAdmin && (
                    <div className="glass-card">
                        <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                            <div
                                style={{
                                    padding: "0.75rem",
                                    background: "rgba(183, 175, 163, 0.1)",
                                    borderRadius: "0.75rem",
                                    color: "var(--accent)",
                                }}
                            >
                                <Shield size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Total Users</p>
                                <h3 style={{ fontSize: "1.25rem" }}>{initialStats.userCount} Registered</h3>
                            </div>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Manage team access</p>
                    </div>
                )}

                {/* Pending Quotes */}
                <div className="glass-card">
                    <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                        <div
                            style={{
                                padding: "0.75rem",
                                background: "rgba(251, 191, 36, 0.1)",
                                borderRadius: "0.75rem",
                                color: "var(--warning)",
                            }}
                        >
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Pending Quotes</p>
                            <h3 style={{ fontSize: "1.25rem" }}>
                                {pendingQuotes.filter((q) => q.status === "PENDING" || q.status === "FOLLOWING_UP").length}{" "}
                                to Follow
                            </h3>
                        </div>
                    </div>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                        Track & convert leads
                    </p>
                </div>

                {/* Schedule - For non-super-admin */}
                {!isSuperAdmin && (
                    <div className="glass-card">
                        <div className="flex items-center gap-4" style={{ marginBottom: "1rem" }}>
                            <div
                                style={{
                                    padding: "0.75rem",
                                    background: "rgba(16, 185, 129, 0.1)",
                                    borderRadius: "0.75rem",
                                    color: "var(--success)",
                                }}
                            >
                                <Calendar size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>Next Shift</p>
                                <h3 style={{ fontSize: "1.25rem" }}>Check Schedule</h3>
                            </div>
                        </div>
                        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                            View your upcoming shifts
                        </p>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isSuperAdmin ? "2fr 1fr" : "1fr 1fr",
                    gap: "1.5rem",
                }}
            >
                {/* Left Column */}
                <div className="flex flex-col gap-6">
                    {/* Quotes Follow-up Panel */}
                    <QuotesPanel quotes={pendingQuotes} userId={userId} isAdmin={isAdmin} />

                    {/* Recent Reports - Super admin sees all, dispatchers see their own */}
                    <RecentReportsPanel
                        reports={recentReports}
                        isAdmin={isSuperAdmin}
                        currentUserId={userId}
                    />

                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-6">
                    {/* Upcoming Events Panel */}
                    <EventsPanel events={upcomingEvents} isAdmin={isAdmin} />

                    {/* Active Users Panel - For admins */}
                    {isAdmin && (
                        <ActiveUsersPanel
                            initialOnlineUsers={onlineUsers}
                            initialActiveShiftUsers={activeShiftUsers}
                            currentUserId={userId}
                        />
                    )}

                    {/* Global Notes */}
                    <section className="glass-card" style={{ background: "var(--bg-secondary)" }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: "1.5rem" }}>
                            <StickyNote size={20} className="text-accent" />
                            <h2 className="font-display" style={{ fontSize: "1.25rem" }}>
                                Global Notes
                            </h2>
                        </div>
                        <div className="flex flex-col gap-4">
                            {globalNotes.length > 0 ? (
                                globalNotes.slice(0, 5).map((note) => (
                                    <div
                                        key={note.id}
                                        style={{
                                            padding: "1rem",
                                            borderLeft: "4px solid var(--accent)",
                                            background: "var(--bg-primary)",
                                            borderRadius: "0.5rem",
                                        }}
                                    >
                                        <h4
                                            style={{
                                                fontSize: "1rem",
                                                marginBottom: "0.5rem",
                                                color: "var(--accent)",
                                            }}
                                        >
                                            {note.title}
                                        </h4>
                                        <p
                                            style={{
                                                fontSize: "0.875rem",
                                                color: "var(--text-secondary)",
                                                marginBottom: "0.5rem",
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            {note.content.length > 150
                                                ? `${note.content.slice(0, 150)}...`
                                                : note.content}
                                        </p>
                                        <div
                                            className="flex items-center gap-3"
                                            style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}
                                        >
                                            <span className="flex items-center gap-1">
                                                <User size={10} />
                                                {note.author.name || "Admin"}
                                            </span>
                                            <span>{formatDate(note.createdAt)}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div
                                    style={{
                                        textAlign: "center",
                                        padding: "2rem 0",
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    <StickyNote size={32} style={{ opacity: 0.2, marginBottom: "0.5rem" }} />
                                    <p style={{ fontSize: "0.875rem" }}>No announcements at this time.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {/* Mobile-responsive styles */}
            <style jsx>{`
                @media (max-width: 1024px) {
                    .grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}
