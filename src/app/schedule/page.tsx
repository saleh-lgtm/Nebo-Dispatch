import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDispatcherSchedule } from "@/lib/actions";
import { getUserRequests, getUpcomingShifts, getPastShifts } from "@/lib/requestActions";
import { getMyTimeOffRequests, getPendingTimeOffRequests } from "@/lib/timeOffActions";
import { getMySwapRequests, getPendingSwapRequests } from "@/lib/shiftSwapActions";
import ScheduleClient from "./ScheduleClient";

export default async function SchedulePage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    const [
        schedule,
        requests,
        upcomingShifts,
        pastShifts,
        myTimeOffRequests,
        pendingTimeOffRequests,
        swapRequestsData,
        pendingSwapRequests,
        mySchedules,
    ] = await Promise.all([
        getDispatcherSchedule(session.user.id),
        getUserRequests(session.user.id),
        getUpcomingShifts(session.user.id),
        getPastShifts(session.user.id),
        getMyTimeOffRequests(),
        isAdmin ? getPendingTimeOffRequests() : Promise.resolve([]),
        getMySwapRequests(),
        getPendingSwapRequests(),
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

    return (
        <ScheduleClient
            initialSchedule={schedule}
            requests={requests}
            upcomingShifts={upcomingShifts}
            pastShifts={pastShifts}
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
