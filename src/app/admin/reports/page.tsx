import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getAllShiftReports, getReportStats, getTeamPerformance } from "@/lib/shiftReportActions";
import dynamic from "next/dynamic";

const ReportsClient = dynamic(() => import("./ReportsClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">Shift Reports</h1></div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function AdminReportsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    // Get initial data
    const [reportsResult, statsResult, teamPerfResult, dispatchers] = await Promise.all([
        getAllShiftReports({ limit: 20 }),
        getReportStats(),
        getTeamPerformance(),
        prisma.user.findMany({
            where: { role: "DISPATCHER", isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
        }),
    ]);

    const { reports, total } = reportsResult.data ?? { reports: [], total: 0 };
    const stats = statsResult.data ?? { today: 0, thisWeek: 0, thisMonth: 0, pending: 0, flagged: 0 };
    const teamPerformance = teamPerfResult.data ?? { dispatchers: [], teamTotals: { totalReports: 0, totalHours: 0, totalCalls: 0, totalEmails: 0, totalQuotes: 0, avgPerformanceScore: 0 } };

    return (
        <ReportsClient
            initialReports={reports}
            totalReports={total}
            stats={stats}
            teamPerformance={teamPerformance}
            dispatchers={dispatchers}
        />
    );
}
