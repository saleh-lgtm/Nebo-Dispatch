import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
    getFrontTeammateMappings,
    getFrontTeammatesFromApi,
    checkFrontApiStatus,
} from "@/lib/frontActions";
import prisma from "@/lib/prisma";
import dynamic from "next/dynamic";

const SettingsClient = dynamic(() => import("./SettingsClient"), {
    loading: () => <SettingsLoading />,
});

function SettingsLoading() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
            </div>
            <div className="skeleton-grid">
                <div className="skeleton-card" style={{ height: "200px", gridColumn: "1 / -1" }} />
            </div>
        </div>
    );
}

export default async function SettingsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [mappingsResult, apiStatus, frontTeammates, neboUsers] = await Promise.all([
        getFrontTeammateMappings(),
        checkFrontApiStatus(),
        getFrontTeammatesFromApi(),
        prisma.user.findMany({
            where: { isActive: true, role: { in: ["DISPATCHER", "ADMIN", "SUPER_ADMIN"] } },
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: "asc" },
        }),
    ]);

    return (
        <SettingsClient
            initialMappings={mappingsResult.data ?? []}
            apiStatus={apiStatus.data ?? { connected: false, teammateCount: 0 }}
            frontTeammates={frontTeammates.data ?? []}
            neboUsers={neboUsers.map((u) => ({
                id: u.id,
                name: u.name ?? "Unknown",
                email: u.email ?? "",
                role: u.role,
            }))}
        />
    );
}
