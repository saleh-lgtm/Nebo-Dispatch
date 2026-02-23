import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTaskProgress } from "@/lib/taskActions";
import { getDispatchers } from "@/lib/schedulerActions";
import dynamic from "next/dynamic";

const TasksClient = dynamic(() => import("./TasksClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">Admin Tasks</h1></div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function AdminTasksPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [tasks, dispatchers] = await Promise.all([
        getTaskProgress(),
        getDispatchers(),
    ]);

    return (
        <TasksClient
            initialTasks={tasks}
            dispatchers={dispatchers}
        />
    );
}
