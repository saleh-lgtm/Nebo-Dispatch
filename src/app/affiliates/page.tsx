import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAffiliatesWithStatus, getPendingAffiliatesCounts } from "@/lib/affiliateActions";
import AffiliateClient from "./AffiliateClient";

export default async function AffiliatesPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // Get all affiliates (both types)
    const affiliates = await getAffiliatesWithStatus(isAdmin ? "all" : "approved");
    const pendingCounts = isAdmin ? await getPendingAffiliatesCounts() : { farmInCount: 0, farmOutCount: 0 };

    return (
        <AffiliateClient
            initialAffiliates={affiliates}
            session={session}
            isAdmin={isAdmin}
            pendingCounts={pendingCounts}
        />
    );
}
