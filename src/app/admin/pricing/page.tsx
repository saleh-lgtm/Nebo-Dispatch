import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRoutePricingStats, getImportHistory } from "@/lib/routePricingActions";
import dynamic from "next/dynamic";

const PricingAdminClient = dynamic(() => import("./PricingAdminClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Route Pricing</h1>
            </div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function PricingAdminPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [stats, importHistory] = await Promise.all([
        getRoutePricingStats(),
        getImportHistory(5),
    ]);

    return <PricingAdminClient initialStats={stats} importHistory={importHistory} />;
}
