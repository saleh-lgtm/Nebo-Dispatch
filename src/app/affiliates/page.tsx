import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAffiliatesWithStatus, getPendingAffiliatesCount } from "@/lib/affiliateActions";
import AffiliateClient from "./AffiliateClient";

export default async function AffiliatesPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // Admins see all affiliates, dispatchers only see approved
    const affiliates = await getAffiliatesWithStatus(isAdmin ? "all" : "approved");
    const pendingCount = isAdmin ? await getPendingAffiliatesCount() : 0;

    return (
        <AffiliateClient
            initialAffiliates={affiliates}
            session={session}
            isAdmin={isAdmin}
            pendingCount={pendingCount}
        />
    );
}
