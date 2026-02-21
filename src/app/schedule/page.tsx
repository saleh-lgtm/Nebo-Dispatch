import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatcherSchedule } from "@/lib/actions";
import { getUserRequests, getUpcomingShifts, getPastShifts } from "@/lib/requestActions";
import ScheduleClient from "./ScheduleClient";

export default async function SchedulePage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const [schedule, requests, upcomingShifts, pastShifts] = await Promise.all([
        getDispatcherSchedule(session.user.id),
        getUserRequests(session.user.id),
        getUpcomingShifts(session.user.id),
        getPastShifts(session.user.id),
    ]);

    return (
        <ScheduleClient
            initialSchedule={schedule}
            requests={requests}
            upcomingShifts={upcomingShifts}
            pastShifts={pastShifts}
            session={session}
        />
    );
}
