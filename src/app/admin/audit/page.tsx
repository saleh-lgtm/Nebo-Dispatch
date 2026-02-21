import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAuditLogs, getAuditStats } from "@/lib/auditActions";
import { getAllUsers } from "@/lib/userManagementActions";
import AuditClient from "./AuditClient";

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
