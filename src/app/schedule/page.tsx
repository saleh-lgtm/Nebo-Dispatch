import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDispatcherSchedule } from "@/lib/actions";
import { getUserRequests, getUpcomingShifts, getPastShifts } from "@/lib/requestActions";
import { getMyTimeOffRequests, getPendingTimeOffRequests } from "@/lib/timeOffActions";
import { getMySwapRequests, getPendingSwapRequests } from "@/lib/shiftSwapActions";
import dynamic from "next/dynamic";

const ScheduleClient = dynamic(() => import("./ScheduleClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">My Schedule</h1>
            </div>
            <div className="skeleton-card" style={{ height: "500px" }} />
        </div>
    ),
});

export default async function SchedulePage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    const [
        schedule,
        requests,
        upcomingShifts,
        pastShifts,
        timeOffResult,
        pendingTimeOffResult,
        swapResult,
        pendingSwapResult,
        mySchedules,
    ] = await Promise.all([
        getDispatcherSchedule(session.user.id),
        getUserRequests(session.user.id),
        getUpcomingShifts(session.user.id),
        getPastShifts(session.user.id),
        getMyTimeOffRequests(),
        isAdmin ? getPendingTimeOffRequests() : Promise.resolve({ success: true as const, data: [] as never[] }),
        getMySwapRequests(),
        getPendingSwapRequests(),
        prisma.schedule.findMany({
            where: {
                userId: session.user.id,
                date: { gte: new Date() },
                isPublished: true,
            },
            orderBy: [{ date: "asc" }, { startHour: "asc" }],
            take: 20,
        }),
    ]);

    const myTimeOffRequests = timeOffResult.success && timeOffResult.data ? timeOffResult.data : [] as never[];
    const pendingTimeOffRequests = pendingTimeOffResult.success && pendingTimeOffResult.data ? pendingTimeOffResult.data : [] as never[];
    const swapRequestsData = swapResult.success && swapResult.data ? swapResult.data : { madeRequests: [] as never[], receivedRequests: [] as never[] };
    const pendingSwapRequests = pendingSwapResult.success && pendingSwapResult.data ? pendingSwapResult.data : { pendingTargetRequests: [] as never[], pendingAdminRequests: [] as never[] };

    return (
        <ScheduleClient
            initialSchedule={schedule}
            requests={requests.success ? requests.data : []}
            upcomingShifts={upcomingShifts.success ? upcomingShifts.data : []}
            pastShifts={pastShifts.success ? pastShifts.data : []}
            myTimeOffRequests={myTimeOffRequests}
            pendingTimeOffRequests={pendingTimeOffRequests}
            swapRequestsData={swapRequestsData}
            pendingSwapRequests={pendingSwapRequests}
            mySchedules={mySchedules}
            session={session}
            isAdmin={isAdmin}
            userId={session.user.id}
        />
    );
}
