import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllUsers, getUserStats } from "@/lib/userManagementActions";
import UsersClient from "./UsersClient";

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
