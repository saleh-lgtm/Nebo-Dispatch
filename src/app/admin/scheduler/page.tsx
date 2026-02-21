import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatchers, getWeekSchedules } from "@/lib/schedulerActions";
import SchedulerClient from "./SchedulerClient";

// Helper to get start of week (Sunday 00:00:00)
function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

export default async function SchedulerPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN") {
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
