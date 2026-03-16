import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getContacts, getMyContacts } from "@/lib/contactActions";
import { getPortals, getMyPortals } from "@/lib/portalActions";
import dynamic from "next/dynamic";

const DirectoryClient = dynamic(() => import("./DirectoryClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">Directory</h1></div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function DispatcherDirectoryPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "");

    // Fetch data based on role
    const [approvedContactsResult, myContactsResult, approvedPortalsResult, myPortalsResult] = await Promise.all([
        getContacts(),
        getMyContacts(),
        getPortals(),
        getMyPortals(),
    ]);

    return (
        <DirectoryClient
            approvedContacts={approvedContactsResult.success ? approvedContactsResult.data : []}
            myContacts={myContactsResult.success ? myContactsResult.data : []}
            approvedPortals={approvedPortalsResult.data ?? []}
            myPortals={myPortalsResult.data ?? []}
            isAdmin={isAdmin}
            currentUserId={session.user.id}
        />
    );
}
