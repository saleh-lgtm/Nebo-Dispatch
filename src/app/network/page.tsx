import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNetworkPartners, getPendingPartnerCounts } from "@/lib/networkActions";
import dynamic from "next/dynamic";

const NetworkClient = dynamic(() => import("./NetworkClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Network</h1>
            </div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function NetworkPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // Get all partners
    const partners = await getNetworkPartners({
        status: isAdmin ? "all" : "approved",
    });

    const pendingCounts = isAdmin
        ? await getPendingPartnerCounts()
        : { farmInCount: 0, farmOutCount: 0, iosCount: 0, houseChauffeurCount: 0 };

    return (
        <NetworkClient
            initialPartners={partners}
            session={session}
            isAdmin={isAdmin}
            pendingCounts={pendingCounts}
        />
    );
}
