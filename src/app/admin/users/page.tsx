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

    const [usersResult, statsResult] = await Promise.all([
        getAllUsers(),
        getUserStats(),
    ]);

    const users = usersResult.success && usersResult.data ? usersResult.data : [] as never[];
    const stats = statsResult.success && statsResult.data ? statsResult.data : { total: 0, byRole: { superAdmins: 0, admins: 0, dispatchers: 0 }, active: 0, inactive: 0 };

    return (
        <UsersClient
            users={users}
            stats={stats}
            currentUserId={session.user.id}
        />
    );
}
