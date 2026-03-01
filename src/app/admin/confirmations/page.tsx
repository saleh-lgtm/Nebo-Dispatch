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
    const [stats, allConfirmationsData, dispatchers] = await Promise.all([
        getConfirmationStatsOptimized(7), // Use 7 days for header stats (fast)
        getAllConfirmations({ limit: 100 }),
        getConfirmationDispatchers(),
    ]);

    return (
        <ConfirmationsClient
            stats={stats}
            allConfirmations={allConfirmationsData.confirmations}
            totalConfirmations={allConfirmationsData.total}
            dispatchers={dispatchers}
        />
    );
}
