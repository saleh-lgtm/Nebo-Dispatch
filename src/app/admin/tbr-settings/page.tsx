import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getVehicleMappings } from "@/lib/vehicleMappingActions";
import dynamic from "next/dynamic";

const TbrSettingsClient = dynamic(() => import("./TbrSettingsClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">TBR Vehicle Mappings</h1>
            </div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function TbrSettingsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const mappings = await getVehicleMappings();

    return <TbrSettingsClient initialMappings={mappings} />;
}
