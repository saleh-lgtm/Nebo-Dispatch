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
import styles from "./Dashboard.module.css";

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
        <div className={styles.dashboard}>
            {/* Header */}
            <header className={styles.header}>
                <div>
                    <div className={styles.headerTop}>
                        <h1 className={styles.title}>Welcome back, {session.user.name}</h1>
                        {isSuperAdmin && (
                            <span className={styles.adminBadge}>
                                <Crown size={12} />
                                Super Admin
                            </span>
                        )}
                    </div>
                    <p className={styles.subtitle}>
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
            <div className={styles.statsGrid}>
                {/* Clock In/Out - dispatchers only */}
                {!isSuperAdmin && (
                    <div className={`${styles.statCard} ${hasActiveShift ? styles.statCardActive : ''}`}>
                        <div className={styles.statContent}>
                            <div className={`${styles.statIcon} ${hasActiveShift ? styles.iconSuccess : styles.iconPrimary}`}>
                                <Clock size={22} />
                            </div>
                            <div className={styles.statText}>
                                <span className={styles.statLabel}>Status</span>
                                <span className={styles.statValue}>{hasActiveShift ? "On Shift" : "Off Duty"}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleClockToggle}
                            className={`${styles.statBtn} ${hasActiveShift ? styles.statBtnSuccess : styles.statBtnPrimary}`}
                            disabled={loading}
                        >
                            {hasActiveShift ? "Submit Report" : "Clock In"}
                            <ArrowRight size={16} />
                        </button>
                        {hasActiveShift && <div className={styles.liveDot} />}
                    </div>
                )}

                {/* Team Members - admin only */}
                {isAdmin && (
                    <div className={styles.statCard}>
                        <div className={styles.statContent}>
                            <div className={`${styles.statIcon} ${styles.iconInfo}`}>
                                <Shield size={22} />
                            </div>
                            <div className={styles.statText}>
                                <span className={styles.statLabel}>Team Members</span>
                                <span className={styles.statValue}>{initialStats.userCount} total</span>
                            </div>
                        </div>
                        <div className={styles.statFooter}>
                            <PlayCircle size={14} />
                            <span>{activeShiftUsers.length} on shift</span>
                        </div>
                    </div>
                )}

                {/* Pending Quotes - priority for all */}
                <div className={styles.statCard}>
                    <div className={styles.statContent}>
                        <div className={`${styles.statIcon} ${styles.iconWarning}`}>
                            <TrendingUp size={22} />
                        </div>
                        <div className={styles.statText}>
                            <span className={styles.statLabel}>Pending Quotes</span>
                            <span className={styles.statValue}>
                                {pendingQuotes.filter((q) => q.status === "PENDING" || q.status === "FOLLOWING_UP").length} leads
                            </span>
                        </div>
                    </div>
                    <div className={styles.statFooter}>
                        <span>Track & convert leads</span>
                    </div>
                </div>

                {/* Upcoming Events - admin only */}
                {isAdmin && (
                    <div className={styles.statCard}>
                        <div className={styles.statContent}>
                            <div className={`${styles.statIcon} ${styles.iconPrimary}`}>
                                <Calendar size={22} />
                            </div>
                            <div className={styles.statText}>
                                <span className={styles.statLabel}>Upcoming Events</span>
                                <span className={styles.statValue}>{upcomingEvents.length} events</span>
                            </div>
                        </div>
                        <div className={styles.statFooter}>
                            <span>Next 30 days</span>
                        </div>
                    </div>
                )}

                {/* Pending Confirmations - admin only */}
                {isAdmin && (
                    <div className={styles.statCard}>
                        <div className={styles.statContent}>
                            <div className={`${styles.statIcon} ${styles.iconSuccess}`}>
                                <Clock size={22} />
                            </div>
                            <div className={styles.statText}>
                                <span className={styles.statLabel}>Confirmations Due</span>
                                <span className={styles.statValue}>{upcomingConfirmations.length} pending</span>
                            </div>
                        </div>
                        <div className={styles.statFooter}>
                            <span>Next 3 hours</span>
                        </div>
                    </div>
                )}

                {/* Next Shift - dispatchers only */}
                {!isSuperAdmin && (
                    <div className={styles.statCard}>
                        <div className={styles.statContent}>
                            <div className={`${styles.statIcon} ${styles.iconInfo}`}>
                                <Calendar size={22} />
                            </div>
                            <div className={styles.statText}>
                                <span className={styles.statLabel}>Next Shift</span>
                                <span className={styles.statValue}>
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
                        <div className={styles.statFooter}>
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
            <div className={styles.contentGrid}>
                <div className={styles.contentCol}>
                    {/* 2-Hour Confirmations - Top Priority */}
                    <ConfirmationWidget confirmations={upcomingConfirmations} />

                    {/* My Tasks - Priority */}
                    {myTasks.length > 0 && <TasksPanel tasks={myTasks} />}

                    {/* Global Notes - Important announcements */}
                    <div className={styles.notesCard}>
                        <div className={styles.cardHeader}>
                            <StickyNote size={18} className={styles.headerIcon} />
                            <h3 className={styles.cardTitle}>Global Notes</h3>
                        </div>
                        <div className={styles.notesList}>
                            {globalNotes.length > 0 ? (
                                globalNotes.slice(0, 5).map((note) => (
                                    <div key={note.id} className={styles.noteItem}>
                                        <h4 className={styles.noteTitle}>{note.title}</h4>
                                        <p className={styles.noteContent}>
                                            {note.content.length > 120
                                                ? `${note.content.slice(0, 120)}...`
                                                : note.content}
                                        </p>
                                        <div className={styles.noteMeta}>
                                            <span><User size={10} /> {note.author.name || "Admin"}</span>
                                            <span>{formatDate(note.createdAt)}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyState}>
                                    <StickyNote size={32} />
                                    <p>No announcements</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <QuotesPanel quotes={pendingQuotes} />
                </div>

                <div className={styles.contentCol}>
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
                <div className={styles.adminSection}>
                    <ActiveUsersPanel
                        initialOnlineUsers={onlineUsers}
                        initialActiveShiftUsers={activeShiftUsers}
                        currentUserId={userId}
                    />
                </div>
            )}
        </div>
    );
}
