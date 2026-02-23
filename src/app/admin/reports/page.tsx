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
    const [{ reports, total }, stats, teamPerformance, dispatchers] = await Promise.all([
        getAllShiftReports({ limit: 20 }),
        getReportStats(),
        getTeamPerformance(),
        prisma.user.findMany({
            where: { role: "DISPATCHER", isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
        }),
    ]);

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
