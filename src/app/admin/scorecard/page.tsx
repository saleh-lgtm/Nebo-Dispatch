import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTeamScorecard } from "@/lib/scorecardActions";
import dynamic from "next/dynamic";

const ScorecardClient = dynamic(() => import("./ScorecardClient"), {
    loading: () => <ScorecardLoading />,
});

function ScorecardLoading() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Performance Dashboard</h1>
            </div>
            <div className="skeleton-grid">
                <div className="skeleton-card" style={{ height: "60px" }} />
                <div className="skeleton-card" style={{ height: "60px" }} />
                <div className="skeleton-card" style={{ height: "60px" }} />
                <div className="skeleton-card" style={{ height: "400px", gridColumn: "1 / -1" }} />
            </div>
        </div>
    );
}

const VALID_TABS = ["scorecard", "trends", "hours"] as const;
type TabValue = (typeof VALID_TABS)[number];

export default async function ScorecardPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const params = await searchParams;
    const tab: TabValue = VALID_TABS.includes(params.tab as TabValue)
        ? (params.tab as TabValue)
        : "scorecard";

    // Default to this month
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    // Only scorecard tab needs SSR data — trends and hours fetch client-side
    let scorecardData: Awaited<ReturnType<typeof getTeamScorecard>>["data"] = undefined;

    if (tab === "scorecard") {
        const result = await getTeamScorecard({ from, to });
        scorecardData = result.data;
    }

    return (
        <ScorecardClient
            initialTab={tab}
            initialScorecardData={scorecardData ?? []}
            initialFrom={from.toISOString()}
            initialTo={to.toISOString()}
        />
    );
}
