import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getGlobalNotes } from "@/lib/notesActions";
import { getPendingQuotes } from "@/lib/quoteActions";
import { getOnlineUsers, getActiveShiftUsers } from "@/lib/presenceActions";
import { getUpcomingEvents } from "@/lib/eventActions";
import { getMyTimeOffRequests, getPendingTimeOffRequests } from "@/lib/timeOffActions";
import { getMySwapRequests, getPendingSwapRequests } from "@/lib/shiftSwapActions";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    // Parallel data fetching
    const [
        userCount,
        activeShift,
        globalNotes,
        pendingQuotes,
        onlineUsers,
        activeShiftUsers,
        recentReports,
        upcomingEvents,
        myTimeOffRequests,
        pendingTimeOffRequests,
        swapRequestsData,
        pendingSwapRequests,
        mySchedules,
    ] = await Promise.all([
        // User count for admins
        isAdmin ? prisma.user.count({ where: { isActive: true } }) : Promise.resolve(0),

        // Active shift for non-super-admin (super admin doesn't need to clock in)
        isSuperAdmin
            ? Promise.resolve(null)
            : prisma.shift.findFirst({
                  where: { userId: session.user.id, clockOut: null },
              }),

        // Global notes
        getGlobalNotes(),

        // Pending quotes (for follow-up panel)
        getPendingQuotes(),

        // Online users
        getOnlineUsers(),

        // Users with active shifts
        getActiveShiftUsers(),

        // Recent reports - for super admin show all, for dispatchers show their own
        prisma.shiftReport.findMany({
            where: isSuperAdmin ? {} : { userId: session.user.id },
            include: {
                user: { select: { id: true, name: true } },
                shift: { select: { clockIn: true, clockOut: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        }),

        // Upcoming events
        getUpcomingEvents(10),

        // Time off requests
        getMyTimeOffRequests(),

        // Pending time off requests (for admins)
        isAdmin ? getPendingTimeOffRequests() : Promise.resolve([]),

        // Shift swap requests
        getMySwapRequests(),

        // Pending swap requests for admin approval
        getPendingSwapRequests(),

        // My upcoming schedules for shift swap
        prisma.schedule.findMany({
            where: {
                userId: session.user.id,
                shiftStart: { gte: new Date() },
                isPublished: true,
            },
            orderBy: { shiftStart: "asc" },
            take: 20,
        }),
    ]);

    const stats = {
        userCount,
        activeShift: activeShift ? { id: activeShift.id } : null,
        isSuperAdmin,
    };

    return (
        <DashboardClient
            initialStats={stats}
            globalNotes={globalNotes}
            pendingQuotes={pendingQuotes}
            onlineUsers={onlineUsers}
            activeShiftUsers={activeShiftUsers}
            recentReports={recentReports}
            upcomingEvents={upcomingEvents}
            myTimeOffRequests={myTimeOffRequests}
            pendingTimeOffRequests={pendingTimeOffRequests}
            swapRequestsData={swapRequestsData}
            pendingSwapRequests={pendingSwapRequests}
            mySchedules={mySchedules}
            userId={session.user.id}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
        />
    );
}
