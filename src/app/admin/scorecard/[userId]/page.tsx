import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatcherScorecard, getDispatcherRecentActivity } from "@/lib/scorecardActions";
import dynamic from "next/dynamic";

const ScorecardDetailClient = dynamic(() => import("./ScorecardDetailClient"), {
    loading: () => <DetailLoading />,
});

function DetailLoading() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Dispatcher Detail</h1>
            </div>
            <div className="skeleton-grid">
                <div className="skeleton-card" style={{ height: "100px", gridColumn: "1 / -1" }} />
                <div className="skeleton-card" style={{ height: "200px" }} />
                <div className="skeleton-card" style={{ height: "200px" }} />
                <div className="skeleton-card" style={{ height: "200px" }} />
            </div>
        </div>
    );
}

export default async function ScorecardDetailPage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const { userId } = await params;

    // Default to this month
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const [scorecardResult, activityResult] = await Promise.all([
        getDispatcherScorecard(userId, { from, to }),
        getDispatcherRecentActivity(userId, 20),
    ]);

    if (!scorecardResult.success || !scorecardResult.data) {
        redirect("/admin/scorecard");
    }

    return (
        <ScorecardDetailClient
            scorecard={scorecardResult.data}
            recentActivity={activityResult.data ?? []}
            initialFrom={from.toISOString()}
            initialTo={to.toISOString()}
        />
    );
}
