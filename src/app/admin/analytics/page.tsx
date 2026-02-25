import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPerformanceMetrics, getDispatcherComparison, getDailyTrend } from "@/lib/analyticsActions";
import { getDispatcherHours } from "@/lib/hoursActions";
import { getConfirmationStats } from "@/lib/tripConfirmationActions";
import dynamic from "next/dynamic";

const AnalyticsClient = dynamic(() => import("./AnalyticsClient"), {
    loading: () => <AnalyticsLoading />,
});

function AnalyticsLoading() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Analytics Dashboard</h1>
            </div>
            <div className="skeleton-grid">
                <div className="skeleton-card" style={{ height: "120px" }} />
                <div className="skeleton-card" style={{ height: "120px" }} />
                <div className="skeleton-card" style={{ height: "120px" }} />
                <div className="skeleton-card" style={{ height: "120px" }} />
            </div>
        </div>
    );
}

export default async function AnalyticsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    // Default to last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const [metrics, comparison, dailyTrend, hours, confirmationStats] = await Promise.all([
        getPerformanceMetrics(startDate, endDate),
        getDispatcherComparison(startDate, endDate),
        getDailyTrend(startDate, endDate),
        getDispatcherHours(startDate, endDate),
        getConfirmationStats(30),
    ]);

    const confirmationSummary = {
        total: confirmationStats.total,
        completed: confirmationStats.completed,
        expired: confirmationStats.expired,
        onTimeRate: confirmationStats.onTimeRate,
    };

    return (
        <AnalyticsClient
            initialMetrics={metrics}
            initialComparison={comparison}
            initialDailyTrend={dailyTrend}
            initialHours={hours}
            initialStartDate={startDate.toISOString().split("T")[0]}
            initialEndDate={endDate.toISOString().split("T")[0]}
            confirmationSummary={confirmationSummary}
        />
    );
}
