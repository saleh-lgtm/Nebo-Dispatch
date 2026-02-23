import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPendingRequests, getAllRequests, getRequestCounts } from "@/lib/adminRequestActions";
import dynamic from "next/dynamic";

const RequestsClient = dynamic(() => import("./RequestsClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">Pending Requests</h1></div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function AdminRequestsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [pendingRequests, allRequests, counts] = await Promise.all([
        getPendingRequests(),
        getAllRequests(),
        getRequestCounts(),
    ]);

    return (
        <RequestsClient
            pendingRequests={pendingRequests}
            allRequests={allRequests}
            counts={counts}
        />
    );
}
