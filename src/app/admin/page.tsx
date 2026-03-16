import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    getAdminDashboardStats,
    getDispatcherAccessList,
    getDispatcherAnalytics,
    getRecentActivity,
    type AdminDashboardStats,
    type DispatcherAccessConfig,
    type DispatcherAnalytics,
} from "@/lib/adminDashboardActions";
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

    const [statsResult, dispatchersResult, analyticsResult, activityResult] = await Promise.all([
        getAdminDashboardStats(),
        getDispatcherAccessList(),
        getDispatcherAnalytics(),
        getRecentActivity(10),
    ]);

    // Check if data is available, redirect to error page if not
    if (!statsResult.success || !statsResult.data) {
        redirect("/dashboard?error=admin-data-unavailable");
    }

    const defaultActivity = { recentLogins: [], recentReports: [], recentQuotes: [] };

    return (
        <AdminDashboardClient
            stats={statsResult.data as AdminDashboardStats}
            dispatchers={(dispatchersResult.data ?? []) as DispatcherAccessConfig[]}
            analytics={(analyticsResult.data ?? []) as DispatcherAnalytics[]}
            activity={activityResult.data ?? defaultActivity}
            isSuperAdmin={session.user.role === "SUPER_ADMIN"}
        />
    );
}
