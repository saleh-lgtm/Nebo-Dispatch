import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPendingRequests, getAllRequests, getRequestCounts } from "@/lib/adminRequestActions";
import RequestsClient from "./RequestsClient";

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
