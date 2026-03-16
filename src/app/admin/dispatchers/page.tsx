import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDispatcherAccessList, getDispatcherAnalytics } from "@/lib/adminDashboardActions";
import dynamic from "next/dynamic";

const DispatcherManagementClient = dynamic(() => import("./DispatcherManagementClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Dispatcher Management</h1>
            </div>
            <div className="skeleton-card" style={{ height: "500px" }} />
        </div>
    ),
});

export default async function DispatcherManagementPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
        redirect("/dashboard");
    }

    const [dispatchersResult, analyticsResult] = await Promise.all([
        getDispatcherAccessList(),
        getDispatcherAnalytics(),
    ]);

    return (
        <DispatcherManagementClient
            dispatchers={dispatchersResult.data ?? []}
            analytics={analyticsResult.data ?? []}
        />
    );
}
