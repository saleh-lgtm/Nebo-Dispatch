import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSMSHistory, getSMSStats } from "@/lib/twilioActions";
import dynamic from "next/dynamic";

const SMSClient = dynamic(() => import("./SMSClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">SMS Dashboard</h1>
            </div>
            <div className="skeleton-grid">
                <div className="skeleton-card" style={{ height: "100px" }} />
                <div className="skeleton-card" style={{ height: "100px" }} />
                <div className="skeleton-card" style={{ height: "100px" }} />
                <div className="skeleton-card" style={{ height: "100px" }} />
            </div>
        </div>
    ),
});

export default async function SMSPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    // Only admins can access SMS dashboard
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    if (!isAdmin) {
        redirect("/dashboard");
    }

    // Fetch initial data
    const [historyData, stats] = await Promise.all([
        getSMSHistory({ limit: 50 }),
        getSMSStats(),
    ]);

    return (
        <SMSClient
            initialLogs={historyData.logs as any}
            totalLogs={historyData.total}
            initialStats={stats}
        />
    );
}
