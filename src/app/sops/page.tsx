import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSOPsByCategory, getFavoriteSOPs, getUnacknowledgedSOPs } from "@/lib/sopActions";
import SOPsClient from "./SOPsClient";

export default async function SOPsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const [sopsByCategory, favoriteSOPs, unacknowledgedSOPs] = await Promise.all([
        getSOPsByCategory(),
        getFavoriteSOPs(),
        getUnacknowledgedSOPs(session.user.id),
    ]);

    return (
        <SOPsClient
            sopsByCategory={sopsByCategory}
            favoriteSOPs={favoriteSOPs}
            unacknowledgedSOPs={unacknowledgedSOPs}
        />
    );
}
