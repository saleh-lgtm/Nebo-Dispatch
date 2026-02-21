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
    ArrowRight,
    Sparkles,
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

interface NextShift {
    id: string;
    shiftStart: Date;
    shiftEnd: Date;
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
    nextShift: NextShift | null;
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
    nextShift,
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
        <div className="dashboard-container">
            {/* Header Section */}
            <header className="dashboard-header animate-fade-in">
                <div className="header-content">
                    <div className="greeting-row">
                        <h1 className="page-title">
                            Welcome back, <span className="name-highlight">{session.user.name}</span>
                        </h1>
                        {isSuperAdmin && (
                            <span className="super-admin-badge">
                                <Crown size={12} />
                                Super Admin
                            </span>
                        )}
                    </div>
                    <p className="page-subtitle">
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
                </div>
                <div className="header-accent" />
            </header>

            {/* Stats Grid */}
            <div className="stats-grid">
                {/* Clock In/Out - Only for non-super-admin */}
                {!isSuperAdmin && (
                    <div className={`stat-card stat-card-clock ${hasActiveShift ? 'active' : ''} animate-fade-in stagger-1`}>
                        <div className="stat-card-inner">
                            <div className="stat-icon-box" style={{ background: hasActiveShift ? 'var(--success-bg)' : 'var(--accent-soft)' }}>
                                <Clock size={22} style={{ color: hasActiveShift ? 'var(--success)' : 'var(--accent)' }} />
                            </div>
                            <div className="stat-info">
                                <p className="stat-label">Status</p>
                                <h3 className="stat-title">
                                    {hasActiveShift ? "Shift Active" : "Off Duty"}
                                </h3>
                            </div>
                        </div>
                        <button
                            onClick={handleClockToggle}
                            className={`stat-action-btn ${hasActiveShift ? 'btn-shift-active' : ''}`}
                            disabled={loading}
                        >
                            <span>{hasActiveShift ? "Submit Report" : "Clock In"}</span>
                            <ArrowRight size={16} />
                        </button>
                        {hasActiveShift && <div className="pulse-indicator" />}
                    </div>
                )}

                {/* Active Users - For admins */}
                {isAdmin && (
                    <div className="stat-card animate-fade-in stagger-2">
                        <div className="stat-card-inner">
                            <div className="stat-icon-box" style={{ background: 'var(--success-bg)' }}>
                                <Users size={22} style={{ color: 'var(--success)' }} />
                            </div>
                            <div className="stat-info">
                                <p className="stat-label">Online Now</p>
                                <h3 className="stat-title">{onlineUsers.length} Active</h3>
                            </div>
                        </div>
                        <p className="stat-meta">
                            <Sparkles size={12} />
                            {activeShiftUsers.length} on shift
                        </p>
                    </div>
                )}

                {/* Total Users - For admins */}
                {isAdmin && (
                    <div className="stat-card animate-fade-in stagger-3">
                        <div className="stat-card-inner">
                            <div className="stat-icon-box" style={{ background: 'var(--accent-soft)' }}>
                                <Shield size={22} style={{ color: 'var(--accent)' }} />
                            </div>
                            <div className="stat-info">
                                <p className="stat-label">Total Users</p>
                                <h3 className="stat-title">{initialStats.userCount} Registered</h3>
                            </div>
                        </div>
                        <p className="stat-meta">Manage team access</p>
                    </div>
                )}

                {/* Pending Quotes */}
                <div className="stat-card animate-fade-in stagger-4">
                    <div className="stat-card-inner">
                        <div className="stat-icon-box" style={{ background: 'var(--warning-bg)' }}>
                            <TrendingUp size={22} style={{ color: 'var(--warning)' }} />
                        </div>
                        <div className="stat-info">
                            <p className="stat-label">Pending Quotes</p>
                            <h3 className="stat-title">
                                {pendingQuotes.filter((q) => q.status === "PENDING" || q.status === "FOLLOWING_UP").length}{" "}
                                to Follow
                            </h3>
                        </div>
                    </div>
                    <p className="stat-meta">Track & convert leads</p>
                </div>

                {/* Schedule - For non-super-admin */}
                {!isSuperAdmin && (
                    <div className="stat-card animate-fade-in stagger-5">
                        <div className="stat-card-inner">
                            <div className="stat-icon-box" style={{ background: 'var(--info-bg)' }}>
                                <Calendar size={22} style={{ color: 'var(--info)' }} />
                            </div>
                            <div className="stat-info">
                                <p className="stat-label">Next Shift</p>
                                <h3 className="stat-title">
                                    {nextShift ? (
                                        new Date(nextShift.shiftStart).toLocaleDateString(undefined, {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                        })
                                    ) : (
                                        "No Upcoming"
                                    )}
                                </h3>
                            </div>
                        </div>
                        <p className="stat-meta">
                            {nextShift ? (
                                <>
                                    {new Date(nextShift.shiftStart).toLocaleTimeString(undefined, {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                    {' - '}
                                    {new Date(nextShift.shiftEnd).toLocaleTimeString(undefined, {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                </>
                            ) : (
                                "Check schedule for updates"
                            )}
                        </p>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="content-grid">
                {/* Left Column */}
                <div className="content-column animate-fade-in stagger-6">
                    {/* Quotes Follow-up Panel */}
                    <QuotesPanel quotes={pendingQuotes} userId={userId} isAdmin={isAdmin} />

                    {/* Recent Reports */}
                    <RecentReportsPanel
                        reports={recentReports}
                        isAdmin={isSuperAdmin}
                        currentUserId={userId}
                    />
                </div>

                {/* Right Column */}
                <div className="content-column animate-fade-in stagger-7">
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
                    <section className="notes-section glass-card">
                        <div className="section-header">
                            <div className="section-icon">
                                <StickyNote size={18} />
                            </div>
                            <h2 className="section-title">Global Notes</h2>
                        </div>
                        <div className="notes-list">
                            {globalNotes.length > 0 ? (
                                globalNotes.slice(0, 5).map((note, index) => (
                                    <div
                                        key={note.id}
                                        className="note-card"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        <h4 className="note-title">{note.title}</h4>
                                        <p className="note-content">
                                            {note.content.length > 150
                                                ? `${note.content.slice(0, 150)}...`
                                                : note.content}
                                        </p>
                                        <div className="note-meta">
                                            <span className="note-author">
                                                <User size={10} />
                                                {note.author.name || "Admin"}
                                            </span>
                                            <span>{formatDate(note.createdAt)}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-notes">
                                    <StickyNote size={32} />
                                    <p>No announcements at this time.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <style jsx>{`
                .dashboard-container {
                    padding: 2rem;
                    max-width: 1600px;
                    margin: 0 auto;
                }

                .dashboard-header {
                    position: relative;
                    margin-bottom: 2.5rem;
                    padding-bottom: 1.5rem;
                }

                .header-accent {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 80px;
                    height: 3px;
                    background: linear-gradient(90deg, var(--accent) 0%, transparent 100%);
                    border-radius: 2px;
                }

                .greeting-row {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                    margin-bottom: 0.5rem;
                }

                .page-title {
                    font-family: 'Cormorant', Georgia, serif;
                    font-size: 2.25rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    letter-spacing: -0.02em;
                }

                .name-highlight {
                    background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .super-admin-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.375rem 0.875rem;
                    background: linear-gradient(135deg, rgba(248, 113, 113, 0.15), rgba(251, 191, 36, 0.15));
                    border: 1px solid rgba(248, 113, 113, 0.25);
                    border-radius: 9999px;
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: var(--danger);
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }

                .page-subtitle {
                    font-size: 0.9375rem;
                    color: var(--text-secondary);
                }

                /* Stats Grid */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.25rem;
                    margin-bottom: 2.5rem;
                }

                .stat-card {
                    position: relative;
                    background: var(--glass);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--radius-xl);
                    padding: 1.5rem;
                    transition: all 0.25s ease;
                    overflow: hidden;
                }

                .stat-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 100px;
                    height: 100px;
                    background: radial-gradient(circle at top right, var(--accent-soft) 0%, transparent 60%);
                    opacity: 0.5;
                    transition: opacity 0.25s;
                }

                .stat-card:hover {
                    border-color: var(--border-hover);
                    box-shadow: var(--shadow-lg);
                    transform: translateY(-2px);
                }

                .stat-card:hover::before {
                    opacity: 1;
                }

                .stat-card-clock.active {
                    border-color: var(--success-border);
                    background: linear-gradient(135deg, var(--success-bg) 0%, var(--glass) 100%);
                }

                .stat-card-inner {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    position: relative;
                    z-index: 1;
                }

                .stat-icon-box {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    flex-shrink: 0;
                }

                .stat-info {
                    flex: 1;
                    min-width: 0;
                }

                .stat-label {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.25rem;
                }

                .stat-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .stat-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    position: relative;
                    z-index: 1;
                }

                .stat-action-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.75rem 1rem;
                    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
                    border: none;
                    border-radius: 0.625rem;
                    color: var(--text-inverse);
                    font-size: 0.875rem;
                    font-weight: 600;
                    font-family: 'Outfit', sans-serif;
                    cursor: pointer;
                    transition: all 0.25s;
                    position: relative;
                    z-index: 1;
                }

                .stat-action-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px var(--accent-glow);
                }

                .stat-action-btn.btn-shift-active {
                    background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
                }

                .stat-action-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .pulse-indicator {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    width: 10px;
                    height: 10px;
                    background: var(--success);
                    border-radius: 50%;
                    animation: pulse 2s ease-in-out infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }

                /* Content Grid */
                .content-grid {
                    display: grid;
                    grid-template-columns: ${isSuperAdmin ? '2fr 1fr' : '1fr 1fr'};
                    gap: 1.5rem;
                }

                .content-column {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                /* Notes Section */
                .notes-section {
                    background: var(--bg-secondary);
                }

                .section-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }

                .section-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent);
                }

                .section-title {
                    font-family: 'Cormorant', serif;
                    font-size: 1.25rem;
                    font-weight: 600;
                }

                .notes-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .note-card {
                    padding: 1rem;
                    border-left: 3px solid var(--accent);
                    background: var(--bg-primary);
                    border-radius: 0 0.625rem 0.625rem 0;
                    transition: all 0.2s;
                }

                .note-card:hover {
                    background: var(--bg-elevated);
                    border-left-color: var(--accent-hover);
                }

                .note-title {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: var(--accent);
                    margin-bottom: 0.5rem;
                }

                .note-content {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    line-height: 1.6;
                    margin-bottom: 0.75rem;
                }

                .note-meta {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                }

                .note-author {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .empty-notes {
                    text-align: center;
                    padding: 2rem 0;
                    color: var(--text-secondary);
                }

                .empty-notes :global(svg) {
                    opacity: 0.2;
                    margin-bottom: 0.75rem;
                }

                .empty-notes p {
                    font-size: 0.875rem;
                }

                /* Responsive */
                @media (max-width: 1024px) {
                    .content-grid {
                        grid-template-columns: 1fr;
                    }

                    .dashboard-container {
                        padding: 1.5rem;
                    }
                }

                @media (max-width: 768px) {
                    .dashboard-container {
                        padding: 1rem;
                    }

                    .page-title {
                        font-size: 1.75rem;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
