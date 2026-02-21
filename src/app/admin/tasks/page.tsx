import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAdminTasks } from "@/lib/taskActions";
import { getDispatchers } from "@/lib/schedulerActions";
import TasksClient from "./TasksClient";

export default async function AdminTasksPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [tasks, dispatchers] = await Promise.all([
        getAdminTasks(),
        getDispatchers(),
    ]);

    return (
        <TasksClient
            initialTasks={tasks}
            dispatchers={dispatchers}
        />
    );
}
