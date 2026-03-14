import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAdminDashboardStats, getDispatcherAccessList, getDispatcherAnalytics, getRecentActivity } from "@/lib/adminDashboardActions";
import dynamic from "next/dynamic";

const AdminDashboardClient = dynamic(() => import("./AdminDashboardClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Admin Dashboard</h1>
            </div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function AdminDashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
        redirect("/dashboard");
    }

    const [stats, dispatchers, analytics, activity] = await Promise.all([
        getAdminDashboardStats(),
        getDispatcherAccessList(),
        getDispatcherAnalytics(),
        getRecentActivity(10),
    ]);

    return (
        <AdminDashboardClient
            stats={stats}
            dispatchers={dispatchers}
            analytics={analytics}
            activity={activity}
            isSuperAdmin={session.user.role === "SUPER_ADMIN"}
        />
    );
}
