import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllSOPs } from "@/lib/sopActions";
import dynamic from "next/dynamic";

const SOPsAdminClient = dynamic(() => import("./SOPsAdminClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">Manage SOPs</h1></div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function SOPsAdminPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const sops = await getAllSOPs({ includeUnpublished: true });

    return <SOPsAdminClient initialSOPs={sops} />;
}
