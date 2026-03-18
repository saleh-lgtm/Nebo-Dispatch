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
                <h1 className="page-title">Dispatcher Scorecard</h1>
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

export default async function ScorecardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    // Default to this month
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const result = await getTeamScorecard({ from, to });

    return (
        <ScorecardClient
            initialData={result.data ?? []}
            initialFrom={from.toISOString()}
            initialTo={to.toISOString()}
        />
    );
}
