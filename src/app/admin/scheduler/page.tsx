import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatchers, getWeekSchedules } from "@/lib/schedulerActions";
import SchedulerClient from "./SchedulerClient";

// Helper to get start of week (Sunday 00:00:00 UTC)
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

export default async function SchedulerPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const dispatchers = await getDispatchers();
    const currentWeekStart = getWeekStart(new Date());
    const schedules = await getWeekSchedules(currentWeekStart);

    return (
        <SchedulerClient
            dispatchers={dispatchers}
            initialSchedules={schedules}
            initialWeekStart={currentWeekStart.toISOString()}
        />
    );
}
