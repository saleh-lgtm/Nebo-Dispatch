import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSOPsByCategory, getFavoriteSOPs, getUnacknowledgedSOPs } from "@/lib/sopActions";
import dynamic from "next/dynamic";

const SOPsClient = dynamic(() => import("./SOPsClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Standard Operating Procedures</h1>
            </div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

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
