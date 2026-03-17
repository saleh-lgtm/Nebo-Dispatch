"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    Clock,
    Calendar,
    Shield,
    TrendingUp,
    Crown,
    ArrowRight,
    PlayCircle,
    DollarSign,
    ChevronDown,
    Award,
} from "lucide-react";
import { createActiveShift } from "@/lib/actions";
import { useState, useCallback } from "react";
import QuotesPanel from "@/components/QuotesPanel";
import ActiveUsersPanel from "@/components/ActiveUsersPanel";
import RecentReportsPanel from "@/components/RecentReportsPanel";
import EventsPanel from "@/components/EventsPanel";
import TasksPanel from "@/components/TasksPanel";
import AdminTaskProgressPanel from "@/components/AdminTaskProgressPanel";
import DashboardConfirmationWidget from "@/components/confirmations/DashboardConfirmationWidget";
import AnnouncementsCard from "@/components/AnnouncementsCard";
import ShiftNotesCard from "@/components/ShiftNotesCard";
import RoutePriceLookup from "@/components/pricing/RoutePriceLookup";
import type { DashboardNotesData } from "@/types/note";
import styles from "./Dashboard.module.css";

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
    date: Date;
    startHour: number;
    endHour: number;
    market: string | null;
}

function formatHour(hour: number): string {
    const period = hour >= 12 ? "PM" : "AM";
    const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h}${period}`;
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
    dashboardNotes: DashboardNotesData;
    pendingQuotes: Quote[];
    onlineUsers: OnlineUser[];
    activeShiftUsers: OnlineUser[];
    recentReports: ShiftReport[];
    upcomingEvents: Event[];
    nextShift: NextShift | null;
    myTasks: Task[];
    taskProgress: TaskWithProgress[];
    upcomingConfirmations: Confirmation[];
    accountabilityScore: number;
    userId: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}

export default function DashboardClient({
    initialStats,
    dashboardNotes,
    pendingQuotes,
    onlineUsers,
    activeShiftUsers,
    recentReports,
    upcomingEvents,
    nextShift,
    myTasks,
    taskProgress,
    upcomingConfirmations,
    accountabilityScore,
    userId,
    isAdmin,
    isSuperAdmin,
}: Props) {
    const { data: session } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showRateLookup, setShowRateLookup] = useState(false);

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

                {/* Accountability Score - dispatchers and admins */}
                {!isSuperAdmin && (
                    <div className={styles.statCard}>
                        <div className={styles.statContent}>
                            <div className={`${styles.statIcon} ${accountabilityScore >= 90 ? styles.iconSuccess : accountabilityScore >= 70 ? styles.iconWarning : styles.iconDanger}`}>
                                <Award size={22} />
                            </div>
                            <div className={styles.statText}>
                                <span className={styles.statLabel}>Accountability</span>
                                <span className={styles.statValue}>{accountabilityScore}</span>
                            </div>
                        </div>
                        <div className={styles.statFooter}>
                            <span>{accountabilityScore >= 90 ? 'Good standing' : accountabilityScore >= 70 ? 'Needs improvement' : 'At risk'}</span>
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
                                        new Date(nextShift.date).toLocaleDateString(undefined, {
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
                                    {formatHour(nextShift.startHour)} - {formatHour(nextShift.endHour)}
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
                    <DashboardConfirmationWidget confirmations={upcomingConfirmations} />

                    {/* Quick Rate Lookup Widget */}
                    <div className={styles.notesCard}>
                        <button
                            onClick={() => setShowRateLookup(!showRateLookup)}
                            className={styles.rateLookupToggle}
                        >
                            <div className={styles.cardHeader} style={{ marginBottom: 0 }}>
                                <DollarSign size={18} className={styles.headerIcon} />
                                <span className={styles.cardTitle}>Quick Rate Lookup</span>
                            </div>
                            <ChevronDown
                                size={18}
                                style={{
                                    transition: "transform 0.2s",
                                    transform: showRateLookup ? "rotate(180deg)" : "rotate(0deg)",
                                }}
                            />
                        </button>
                        {showRateLookup && (
                            <div style={{ marginTop: "1rem" }}>
                                <RoutePriceLookup />
                            </div>
                        )}
                    </div>

                    {/* My Tasks - Priority */}
                    {myTasks.length > 0 && <TasksPanel tasks={myTasks} />}

                    {/* Company Announcements */}
                    <AnnouncementsCard
                        announcements={dashboardNotes.announcements}
                        unacknowledgedCount={dashboardNotes.unacknowledgedCount}
                    />

                    {/* Active Shift Notes (Handoffs) */}
                    <ShiftNotesCard
                        notes={dashboardNotes.shiftNotes}
                        hasActiveShift={hasActiveShift}
                    />

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
