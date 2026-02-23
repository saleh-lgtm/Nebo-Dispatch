import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatchers, getWeekSchedules } from "@/lib/schedulerActions";
import dynamic from "next/dynamic";

const NewSchedulerClient = dynamic(() => import("./NewSchedulerClient"), {
    loading: () => <SchedulerLoading />,
});

function SchedulerLoading() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Dispatcher Scheduler</h1>
            </div>
            <div className="skeleton-card" style={{ height: "500px" }} />
        </div>
    );
}

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
        <NewSchedulerClient
            dispatchers={dispatchers}
            initialSchedules={schedules}
            initialWeekStart={currentWeekStart.toISOString()}
        />
    );
}
