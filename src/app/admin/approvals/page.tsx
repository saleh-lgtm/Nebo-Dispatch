import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPendingUsers } from "@/lib/signupActions";
import { getPendingPortals } from "@/lib/portalActions";
import { getPendingContacts } from "@/lib/contactActions";
import dynamic from "next/dynamic";

const ApprovalsClient = dynamic(() => import("./ApprovalsClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">Approvals</h1></div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function AdminApprovalsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    // Only ADMIN and SUPER_ADMIN can access approvals
    if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
        redirect("/dashboard");
    }

    const [pendingUsersResult, pendingPortalsResult, pendingContactsResult] = await Promise.all([
        getPendingUsers(),
        getPendingPortals(),
        getPendingContacts(),
    ]);

    return (
        <ApprovalsClient
            pendingUsers={pendingUsersResult}
            pendingPortals={pendingPortalsResult.data ?? []}
            pendingContacts={pendingContactsResult.success ? pendingContactsResult.data : []}
            currentUserId={session.user.id}
        />
    );
}
