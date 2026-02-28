import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatchers, getWeekSchedules } from "@/lib/schedulerActions";
import dynamic from "next/dynamic";

const CommandSchedulerClient = dynamic(() => import("./CommandSchedulerClient"), {
    loading: () => <SchedulerLoading />,
});

function SchedulerLoading() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 60px)',
            background: '#05070a',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
        }}>
            <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(0, 240, 255, 0.1)',
                borderTopColor: '#00f0ff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
            }} />
            <span style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#6b7a8f',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
            }}>
                Loading Command Center...
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
        <CommandSchedulerClient
            dispatchers={dispatchers}
            initialSchedules={schedules}
            initialWeekStart={currentWeekStart.toISOString()}
        />
    );
}
