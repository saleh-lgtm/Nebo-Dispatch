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

    const [{ logs, total }, stats, users] = await Promise.all([
        getAuditLogs({ limit: 50 }),
        getAuditStats(30),
        getAllUsers(),
    ]);

    return (
        <AuditClient
            initialLogs={logs}
            totalLogs={total}
            stats={stats}
            users={users}
        />
    );
}
