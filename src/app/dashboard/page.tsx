import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDashboardNotes } from "@/lib/notesActions";
import { getPendingQuotes } from "@/lib/domains/quotes";
import { getOnlineUsers, getActiveShiftUsers } from "@/lib/presenceActions";
import { getUpcomingEvents } from "@/lib/eventActions";
import { getUserNextShift } from "@/lib/schedulerActions";
import { getMyTasks, getTaskProgress } from "@/lib/taskActions";
import { getUpcomingConfirmations } from "@/lib/tripConfirmationActions";
import dynamic from "next/dynamic";

// Dynamic import with loading skeleton for better initial load
const DashboardClient = dynamic(() => import("./DashboardClient"), {
    loading: () => <DashboardSkeleton />,
});

function DashboardSkeleton() {
    return (
        <div className="dashboard" style={{ padding: "1.5rem", maxWidth: "1500px", margin: "0 auto" }}>
            {/* Header skeleton */}
            <div style={{ marginBottom: "1.5rem" }}>
                <div className="skeleton skeleton-title" style={{ width: "250px", height: "32px", marginBottom: "8px" }} />
                <div className="skeleton skeleton-text" style={{ width: "180px", height: "16px" }} />
            </div>

            {/* Stats grid skeleton */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem"
            }}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-card" style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "1.25rem",
                        height: "120px"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                            <div className="skeleton" style={{ width: "44px", height: "44px", borderRadius: "8px" }} />
                            <div>
                                <div className="skeleton" style={{ width: "60px", height: "12px", marginBottom: "6px" }} />
                                <div className="skeleton" style={{ width: "80px", height: "20px" }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content grid skeleton */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div className="skeleton-card" style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "1.25rem",
                        height: "300px"
                    }} />
                    <div className="skeleton-card" style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "1.25rem",
                        height: "250px"
                    }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div className="skeleton-card" style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "1.25rem",
                        height: "280px"
                    }} />
                </div>
            </div>
        </div>
    );
}

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    // Parallel data fetching with error handling
    // Wrap each promise to prevent one failure from crashing the whole page
    const safePromise = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
        promise.catch((err) => {
            console.error("Dashboard data fetch error:", err);
            return fallback;
        });

    const [
        userCount,
        activeShift,
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
    ] = await Promise.all([
        // User count for admins
        safePromise(
            isAdmin ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(0),
            0
        ),

        // Active shift for non-super-admin (super admin doesn't need to clock in)
        safePromise(
            isSuperAdmin
                ? Promise.resolve(null)
                : prisma.shift.findFirst({
                    where: { userId: session.user.id, clockOut: null },
                }),
            null
        ),

        // Dashboard notes (announcements + shift notes)
        safePromise(
            getDashboardNotes(session.user.id).then(r => r.success && r.data ? r.data : { announcements: [], shiftNotes: [], unacknowledgedCount: 0 }),
            { announcements: [], shiftNotes: [], unacknowledgedCount: 0 }
        ),

        // Pending quotes (for follow-up panel)
        safePromise(getPendingQuotes(), []),

        // Online users
        safePromise(getOnlineUsers().then(r => r.success ? r.data : []), []),

        // Users with active shifts
        safePromise(getActiveShiftUsers().then(r => r.success ? r.data : []), []),

        // Recent reports - for super admin show all, for dispatchers show their own
        safePromise(
            prisma.shiftReport.findMany({
                where: isSuperAdmin ? {} : { userId: session.user.id },
                include: {
                    user: { select: { id: true, name: true } },
                    shift: { select: { clockIn: true, clockOut: true, totalHours: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            }),
            []
        ),

        // Upcoming events
        safePromise(getUpcomingEvents(10).then(r => r.success ? r.data : []), []),

        // Next scheduled shift for non-super-admin
        safePromise(
            isSuperAdmin ? Promise.resolve(null) : getUserNextShift(session.user.id),
            null
        ),

        // Tasks assigned to this user
        safePromise(getMyTasks(session.user.id).then(r => r.success ? r.data : []), []),

        // Task progress for admins
        safePromise(isAdmin ? getTaskProgress().then(r => r.success ? r.data : []) : Promise.resolve([]), []),

        // Upcoming confirmations (next 10 trips within 24 hours)
        safePromise(getUpcomingConfirmations(10), []),
    ]);

    const stats = {
        userCount,
        activeShift: activeShift ? { id: activeShift.id } : null,
        isSuperAdmin,
    };

    return (
        <DashboardClient
            initialStats={stats}
            dashboardNotes={dashboardNotes}
            pendingQuotes={pendingQuotes as never}
            onlineUsers={onlineUsers}
            activeShiftUsers={activeShiftUsers}
            recentReports={recentReports as never}
            upcomingEvents={upcomingEvents}
            nextShift={nextShift}
            myTasks={myTasks}
            taskProgress={taskProgress}
            upcomingConfirmations={upcomingConfirmations as never}
            userId={session.user.id}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
        />
    );
}
