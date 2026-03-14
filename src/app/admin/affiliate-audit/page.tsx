import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    getAffiliateAuditConfigs,
    getAvailableAffiliatesForAudit,
    getAffiliateAuditStats,
} from "@/lib/affiliateAuditActions";
import dynamic from "next/dynamic";

const AffiliateAuditClient = dynamic(() => import("./AffiliateAuditClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Affiliate Portal Audit Configuration</h1>
            </div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function AffiliateAuditPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [configs, availableAffiliates, stats] = await Promise.all([
        getAffiliateAuditConfigs(),
        getAvailableAffiliatesForAudit(),
        getAffiliateAuditStats(),
    ]);

    return (
        <AffiliateAuditClient
            initialConfigs={configs}
            availableAffiliates={availableAffiliates}
            stats={stats}
        />
    );
}
