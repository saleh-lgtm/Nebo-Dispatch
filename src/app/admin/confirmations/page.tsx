import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    getConfirmationStatsOptimized,
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

    // Only fetch essential data for initial page load (Trips tab)
    // Other tabs load their data on-demand via client-side fetch
    const [statsResult, allConfirmationsResult, dispatchersResult] = await Promise.all([
        getConfirmationStatsOptimized(7), // Use 7 days for header stats (fast)
        getAllConfirmations({ limit: 100 }),
        getConfirmationDispatchers(),
    ]);

    const stats = statsResult.data ?? { total: 0, completed: 0, pending: 0, expired: 0, onTime: 0, late: 0, avgLeadTime: 0, onTimeRate: 0, completionRate: 0, byStatus: {} };
    const allConfirmationsData = allConfirmationsResult.data ?? { confirmations: [], total: 0, hasMore: false };
    const dispatchers = dispatchersResult.data ?? [];

    return (
        <ConfirmationsClient
            stats={stats}
            allConfirmations={allConfirmationsData.confirmations}
            totalConfirmations={allConfirmationsData.total}
            dispatchers={dispatchers}
            currentUser={{
                id: session.user.id,
                name: session.user.name || "Unknown",
            }}
        />
    );
}
