import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAuditLogs, getAuditStats } from "@/lib/auditActions";
import { getAllUsers } from "@/lib/userManagementActions";
import dynamic from "next/dynamic";

const AuditClient = dynamic(() => import("./AuditClient"), {
    loading: () => <AuditLoading />,
});

function AuditLoading() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Audit Logs</h1>
            </div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    );
}

export default async function AdminAuditPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    // Only SUPER_ADMIN can access audit logs
    if (session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [auditResult, statsResult, usersResult] = await Promise.all([
        getAuditLogs({ limit: 50 }),
        getAuditStats(30),
        getAllUsers(),
    ]);

    const { logs, total } = auditResult.success && auditResult.data ? auditResult.data : { logs: [] as never[], total: 0 };
    const stats = statsResult.success && statsResult.data ? statsResult.data : { total: 0, byAction: {} as Record<string, number>, byEntity: {} as Record<string, number>, byDay: {} as Record<string, number> };
    const users = usersResult.success && usersResult.data ? usersResult.data : [];

    return (
        <AuditClient
            initialLogs={logs}
            totalLogs={total}
            stats={stats}
            users={users}
        />
    );
}
