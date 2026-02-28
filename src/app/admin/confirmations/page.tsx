import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    getConfirmationStats,
    getAllDispatcherMetrics,
    getTodayConfirmations,
    getDispatcherAccountabilityMetrics,
    getMissedConfirmationReport,
    getAllConfirmations,
    getConfirmationDispatchers,
} from "@/lib/tripConfirmationActions";
import ConfirmationsClient from "./ConfirmationsClient";

export const metadata = {
    title: "Trip Confirmations | Command Center",
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
        allConfirmationsData,
        dispatchers,
    ] = await Promise.all([
        getConfirmationStats(30),
        getAllDispatcherMetrics(30),
        getTodayConfirmations(),
        getDispatcherAccountabilityMetrics(30),
        getMissedConfirmationReport(30),
        getAllConfirmations({ limit: 100 }),
        getConfirmationDispatchers(),
    ]);

    return (
        <ConfirmationsClient
            stats={stats}
            dispatcherMetrics={dispatcherMetrics}
            todayConfirmations={todayConfirmations}
            accountabilityMetrics={accountabilityMetrics}
            missedConfirmations={missedConfirmations}
            allConfirmations={allConfirmationsData.confirmations}
            totalConfirmations={allConfirmationsData.total}
            dispatchers={dispatchers}
        />
    );
}
