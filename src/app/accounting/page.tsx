import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAccountingStats, getFlaggedReservations } from "@/lib/accountingActions";
import AccountingClient from "./AccountingClient";

export default async function AccountingPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    // Check if user has accounting access
    const hasAccess =
        session.user.role === "ACCOUNTING" ||
        session.user.role === "ADMIN" ||
        session.user.role === "SUPER_ADMIN";

    if (!hasAccess) {
        redirect("/dashboard");
    }

    // Fetch initial data
    const [stats, flaggedData] = await Promise.all([
        getAccountingStats(),
        getFlaggedReservations({ limit: 20 }),
    ]);

    return (
        <AccountingClient
            initialStats={stats}
            initialFlags={flaggedData.flags as unknown as Parameters<typeof AccountingClient>[0]["initialFlags"]}
            totalFlags={flaggedData.total}
            userRole={session.user.role}
        />
    );
}
