import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPendingUsers } from "@/lib/signupActions";
import dynamic from "next/dynamic";

const ApprovalsClient = dynamic(() => import("./ApprovalsClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">User Approvals</h1></div>
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

    const pendingUsers = await getPendingUsers();

    return (
        <ApprovalsClient
            pendingUsers={pendingUsers}
            currentUserId={session.user.id}
        />
    );
}
