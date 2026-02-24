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
    ArrowRight,
    PlayCircle,
} from "lucide-react";
import { createActiveShift } from "@/lib/actions";
import { useState } from "react";
import QuotesPanel from "@/components/QuotesPanel";
import ActiveUsersPanel from "@/components/ActiveUsersPanel";
import RecentReportsPanel from "@/components/RecentReportsPanel";
import EventsPanel from "@/components/EventsPanel";
import TasksPanel from "@/components/TasksPanel";
import AdminTaskProgressPanel from "@/components/AdminTaskProgressPanel";
import ConfirmationWidget from "@/components/ConfirmationWidget";

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
    source: string | null;
    dateOfService: Date | null;
    pickupDate: Date | null;
    pickupLocation: string | null;
    dropoffLocation: string | null;
    estimatedAmount: number | null;
    notes: string | null;
    status: "PENDING" | "FOLLOWING_UP" | "CONVERTED" | "LOST" | "EXPIRED";
    outcome: "WON" | "LOST" | null;
    outcomeReason: string | null;
    followUpCount: number;
    lastFollowUp: Date | null;
    nextFollowUp: Date | null;
    lastActionAt: Date | null;
    actionCount: number;
    isFlagged: boolean;
    expiresAt: Date;
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

interface Task {
    id: string;
    title: string;
    description: string | null;
    priority: number;
    dueDate?: Date | null;
    assignToAll: boolean;
    createdBy?: { id: string; name: string | null };
    isCompleted: boolean;
    completedAt: Date | null;
    completionNotes: string | null;
}

interface TaskWithProgress {
    id: string;
    title: string;
    description: string | null;
    priority: number;
    dueDate: Date | null;
    assignToAll: boolean;
    assignedTo: { id: string; name: string | null } | null;
    createdBy: { id: string; name: string | null };
    completions: {
        userId: string;
        completedAt: Date;
        notes: string | null;
        user: { id: string; name: string | null };
    }[];
    targetCount: number;
    completedCount: number;
    progress: number;
    isOverdue: boolean;
}

interface Confirmation {
    id: string;
    tripNumber: string;
    pickupAt: Date | string;
    dueAt: Date | string;
    passengerName: string;
    driverName: string;
    status: string;
    completedAt: Date | string | null;
    completedBy: { id: string; name: string | null } | null;
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
    myTasks: Task[];
    taskProgress: TaskWithProgress[];
    upcomingConfirmations: Confirmation[];
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
    myTasks,
    taskProgress,
    upcomingConfirmations,
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
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div>
                    <div className="header-top">
                        <h1>Welcome back, {session.user.name}</h1>
                        {isSuperAdmin && (
                            <span className="admin-badge">
                                <Crown size={12} />
                                Super Admin
                            </span>
                        )}
                    </div>
                    <p className="header-subtitle">
                        {new Date().toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="stats-grid">
                {/* Clock In/Out - dispatchers only */}
                {!isSuperAdmin && (
                    <div className={`stat-card ${hasActiveShift ? 'stat-active' : ''}`}>
                        <div className="stat-content">
                            <div className={`stat-icon ${hasActiveShift ? 'icon-success' : 'icon-primary'}`}>
                                <Clock size={22} />
                            </div>
                            <div className="stat-text">
                                <span className="stat-label">Status</span>
                                <span className="stat-value">{hasActiveShift ? "On Shift" : "Off Duty"}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleClockToggle}
                            className={`stat-btn ${hasActiveShift ? 'btn-success' : 'btn-primary'}`}
                            disabled={loading}
                        >
                            {hasActiveShift ? "Submit Report" : "Clock In"}
                            <ArrowRight size={16} />
                        </button>
                        {hasActiveShift && <div className="live-dot" />}
                    </div>
                )}

                {/* Team Members - admin only */}
                {isAdmin && (
                    <div className="stat-card">
                        <div className="stat-content">
                            <div className="stat-icon icon-info">
                                <Shield size={22} />
                            </div>
                            <div className="stat-text">
                                <span className="stat-label">Team Members</span>
                                <span className="stat-value">{initialStats.userCount} total</span>
                            </div>
                        </div>
                        <div className="stat-footer">
                            <PlayCircle size={14} />
                            <span>{activeShiftUsers.length} on shift</span>
                        </div>
                    </div>
                )}

                {/* Pending Quotes - priority for all */}
                <div className="stat-card">
                    <div className="stat-content">
                        <div className="stat-icon icon-warning">
                            <TrendingUp size={22} />
                        </div>
                        <div className="stat-text">
                            <span className="stat-label">Pending Quotes</span>
                            <span className="stat-value">
                                {pendingQuotes.filter((q) => q.status === "PENDING" || q.status === "FOLLOWING_UP").length} leads
                            </span>
                        </div>
                    </div>
                    <div className="stat-footer">
                        <span>Track & convert leads</span>
                    </div>
                </div>

                {/* Upcoming Events - admin only */}
                {isAdmin && (
                    <div className="stat-card">
                        <div className="stat-content">
                            <div className="stat-icon icon-primary">
                                <Calendar size={22} />
                            </div>
                            <div className="stat-text">
                                <span className="stat-label">Upcoming Events</span>
                                <span className="stat-value">{upcomingEvents.length} events</span>
                            </div>
                        </div>
                        <div className="stat-footer">
                            <span>Next 30 days</span>
                        </div>
                    </div>
                )}

                {/* Pending Confirmations - admin only */}
                {isAdmin && (
                    <div className="stat-card">
                        <div className="stat-content">
                            <div className="stat-icon icon-success">
                                <Clock size={22} />
                            </div>
                            <div className="stat-text">
                                <span className="stat-label">Confirmations Due</span>
                                <span className="stat-value">{upcomingConfirmations.length} pending</span>
                            </div>
                        </div>
                        <div className="stat-footer">
                            <span>Next 3 hours</span>
                        </div>
                    </div>
                )}

                {/* Next Shift - dispatchers only */}
                {!isSuperAdmin && (
                    <div className="stat-card">
                        <div className="stat-content">
                            <div className="stat-icon icon-info">
                                <Calendar size={22} />
                            </div>
                            <div className="stat-text">
                                <span className="stat-label">Next Shift</span>
                                <span className="stat-value">
                                    {nextShift ? (
                                        new Date(nextShift.shiftStart).toLocaleDateString(undefined, {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                        })
                                    ) : (
                                        "Not scheduled"
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="stat-footer">
                            {nextShift ? (
                                <span>
                                    {new Date(nextShift.shiftStart).toLocaleTimeString(undefined, {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                    {' - '}
                                    {new Date(nextShift.shiftEnd).toLocaleTimeString(undefined, {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                </span>
                            ) : (
                                <span>Check schedule</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="content-grid">
                <div className="content-col">
                    {/* 2-Hour Confirmations - Top Priority */}
                    <ConfirmationWidget confirmations={upcomingConfirmations} />

                    {/* My Tasks - Priority */}
                    {myTasks.length > 0 && <TasksPanel tasks={myTasks} />}

                    {/* Global Notes - Important announcements */}
                    <div className="card notes-card">
                        <div className="card-header">
                            <StickyNote size={18} className="header-icon" />
                            <h3>Global Notes</h3>
                        </div>
                        <div className="notes-list">
                            {globalNotes.length > 0 ? (
                                globalNotes.slice(0, 5).map((note) => (
                                    <div key={note.id} className="note-item">
                                        <h4>{note.title}</h4>
                                        <p>
                                            {note.content.length > 120
                                                ? `${note.content.slice(0, 120)}...`
                                                : note.content}
                                        </p>
                                        <div className="note-meta">
                                            <span><User size={10} /> {note.author.name || "Admin"}</span>
                                            <span>{formatDate(note.createdAt)}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <StickyNote size={32} />
                                    <p>No announcements</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <QuotesPanel quotes={pendingQuotes} />
                </div>

                <div className="content-col">
                    <EventsPanel events={upcomingEvents} isAdmin={isAdmin} />

                    {/* Admin Task Progress */}
                    {isAdmin && taskProgress.length > 0 && (
                        <AdminTaskProgressPanel tasks={taskProgress} />
                    )}

                    <RecentReportsPanel
                        reports={recentReports}
                        isAdmin={isSuperAdmin}
                        currentUserId={userId}
                    />
                </div>
            </div>

            {/* Admin Only: Team Activity (Lower Priority) */}
            {isAdmin && (
                <div className="admin-section">
                    <ActiveUsersPanel
                        initialOnlineUsers={onlineUsers}
                        initialActiveShiftUsers={activeShiftUsers}
                        currentUserId={userId}
                    />
                </div>
            )}

            <style jsx>{`
                .dashboard {
                    padding: 1.5rem;
                    max-width: 1500px;
                    margin: 0 auto;
                }

                .dashboard-header {
                    margin-bottom: 1.5rem;
                }

                .header-top {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }

                .dashboard-header h1 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .admin-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.625rem;
                    background: var(--danger-bg);
                    border: 1px solid var(--danger-border);
                    border-radius: 9999px;
                    font-size: 0.625rem;
                    font-weight: 600;
                    color: var(--danger);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .header-subtitle {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    margin-top: 0.25rem;
                }

                /* Stats Grid */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card {
                    position: relative;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                    transition: all 0.2s ease;
                }

                .stat-card:hover {
                    border-color: var(--border-hover);
                }

                .stat-card.stat-active {
                    border-color: var(--success-border);
                    background: linear-gradient(135deg, var(--success-bg) 0%, var(--bg-card) 100%);
                }

                .stat-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .stat-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .icon-primary {
                    background: var(--primary-soft);
                    color: var(--primary);
                }

                .icon-success {
                    background: var(--success-bg);
                    color: var(--success);
                }

                .icon-warning {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                .icon-info {
                    background: var(--info-bg);
                    color: var(--info);
                }

                .stat-text {
                    display: flex;
                    flex-direction: column;
                }

                .stat-label {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .stat-value {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .stat-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.625rem 1rem;
                    border: none;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    font-family: inherit;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .stat-btn.btn-primary {
                    background: var(--primary);
                    color: white;
                }

                .stat-btn.btn-primary:hover:not(:disabled) {
                    background: var(--primary-hover);
                }

                .stat-btn.btn-success {
                    background: var(--success);
                    color: var(--text-inverse);
                }

                .stat-btn.btn-success:hover:not(:disabled) {
                    background: #16A34A;
                }

                .stat-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .stat-footer {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                }

                .live-dot {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    width: 8px;
                    height: 8px;
                    background: var(--success);
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }

                /* Content Grid */
                .content-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }

                .content-col {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                /* Notes Card */
                .notes-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .card-header :global(.header-icon) {
                    color: var(--primary);
                }

                .card-header h3 {
                    font-size: 1rem;
                    font-weight: 600;
                }

                .notes-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .note-item {
                    padding: 0.875rem;
                    background: var(--bg-secondary);
                    border-left: 3px solid var(--primary);
                    border-radius: 0 var(--radius-md) var(--radius-md) 0;
                    transition: background 0.15s;
                }

                .note-item:hover {
                    background: var(--bg-hover);
                }

                .note-item h4 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--primary);
                    margin-bottom: 0.375rem;
                }

                .note-item p {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    line-height: 1.5;
                    margin-bottom: 0.5rem;
                }

                .note-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                }

                .note-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .empty-state {
                    text-align: center;
                    padding: 2rem 0;
                    color: var(--text-muted);
                }

                .empty-state :global(svg) {
                    opacity: 0.3;
                    margin-bottom: 0.5rem;
                }

                .empty-state p {
                    font-size: 0.875rem;
                }

                /* Admin Section - Lower Priority */
                .admin-section {
                    margin-top: 1.5rem;
                }

                /* Responsive */
                @media (max-width: 1024px) {
                    .content-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 768px) {
                    .dashboard {
                        padding: 1rem;
                    }

                    .dashboard-header h1 {
                        font-size: 1.25rem;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
