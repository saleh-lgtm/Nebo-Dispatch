import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAffiliates } from "@/lib/actions";
import AffiliateClient from "./AffiliateClient";

export default async function AffiliatesPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const affiliates = await getAffiliates(true); // Only show approved by default

    return (
        <AffiliateClient
            initialAffiliates={affiliates}
            session={session}
        />
    );
}
