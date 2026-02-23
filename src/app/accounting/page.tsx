import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAccountingStats, getFlaggedReservations } from "@/lib/accountingActions";
import dynamic from "next/dynamic";

const AccountingClient = dynamic(() => import("./AccountingClient"), {
    loading: () => <AccountingLoading />,
});

function AccountingLoading() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Accounting</h1>
            </div>
            <div className="skeleton-grid">
                <div className="skeleton-card" style={{ height: "100px" }} />
                <div className="skeleton-card" style={{ height: "100px" }} />
                <div className="skeleton-card" style={{ height: "100px" }} />
            </div>
        </div>
    );
}

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
            initialFlags={flaggedData.flags as any}
            totalFlags={flaggedData.total}
            userRole={session.user.role}
        />
    );
}
