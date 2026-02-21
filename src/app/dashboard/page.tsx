import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getGlobalNotes } from "@/lib/notesActions";
import { getPendingQuotes } from "@/lib/quoteActions";
import { getOnlineUsers, getActiveShiftUsers } from "@/lib/presenceActions";
import { getUpcomingEvents } from "@/lib/eventActions";
import { getUserNextShift } from "@/lib/schedulerActions";
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
        nextShift,
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
                shift: { select: { clockIn: true, clockOut: true, totalHours: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        }),

        // Upcoming events
        getUpcomingEvents(10),

        // Next scheduled shift for non-super-admin
        isSuperAdmin ? Promise.resolve(null) : getUserNextShift(session.user.id),
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
            pendingQuotes={pendingQuotes as unknown as Parameters<typeof DashboardClient>[0]["pendingQuotes"]}
            onlineUsers={onlineUsers}
            activeShiftUsers={activeShiftUsers}
            recentReports={recentReports as unknown as Parameters<typeof DashboardClient>[0]["recentReports"]}
            upcomingEvents={upcomingEvents}
            nextShift={nextShift}
            userId={session.user.id}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
        />
    );
}
