import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllUsers, getUserStats } from "@/lib/userManagementActions";
import dynamic from "next/dynamic";

const UsersClient = dynamic(() => import("./UsersClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">User Management</h1></div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function AdminUsersPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    // Only SUPER_ADMIN can access user management
    if (session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [users, stats] = await Promise.all([
        getAllUsers(),
        getUserStats(),
    ]);

    return (
        <UsersClient
            users={users}
            stats={stats}
            currentUserId={session.user.id}
        />
    );
}
