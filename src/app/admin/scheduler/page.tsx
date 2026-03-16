import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatchers, getWeekSchedules } from "@/lib/schedulerActions";
import { getWeekStart } from "@/types/schedule";
import SchedulerWrapper from "./SchedulerWrapper";

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
    const weekData = await getWeekSchedules(currentWeekStart);

    return (
        <SchedulerWrapper
            dispatchers={dispatchers}
            initialSchedules={weekData.schedules}
            initialWeekStart={currentWeekStart.toISOString()}
        />
    );
}
