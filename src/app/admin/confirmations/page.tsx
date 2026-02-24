import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    getConfirmationStats,
    getAllDispatcherMetrics,
    getTodayConfirmations,
} from "@/lib/tripConfirmationActions";
import ConfirmationsClient from "./ConfirmationsClient";

export const metadata = {
    title: "Confirmation Metrics | Admin",
};

export default async function ConfirmationsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN", "ACCOUNTING"].includes(
        session.user.role || ""
    );

    if (!isAdmin) {
        redirect("/dashboard");
    }

    const [stats, dispatcherMetrics, todayConfirmations] = await Promise.all([
        getConfirmationStats(30),
        getAllDispatcherMetrics(30),
        getTodayConfirmations(),
    ]);

    return (
        <ConfirmationsClient
            stats={stats}
            dispatcherMetrics={dispatcherMetrics}
            todayConfirmations={todayConfirmations}
        />
    );
}
