import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    getConfirmationStats,
    getAllDispatcherMetrics,
    getTodayConfirmations,
    getDispatcherAccountabilityMetrics,
    getMissedConfirmationReport,
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

    const [
        stats,
        dispatcherMetrics,
        todayConfirmations,
        accountabilityMetrics,
        missedConfirmations,
    ] = await Promise.all([
        getConfirmationStats(30),
        getAllDispatcherMetrics(30),
        getTodayConfirmations(),
        getDispatcherAccountabilityMetrics(30),
        getMissedConfirmationReport(30),
    ]);

    return (
        <ConfirmationsClient
            stats={stats}
            dispatcherMetrics={dispatcherMetrics}
            todayConfirmations={todayConfirmations}
            accountabilityMetrics={accountabilityMetrics}
            missedConfirmations={missedConfirmations}
        />
    );
}
