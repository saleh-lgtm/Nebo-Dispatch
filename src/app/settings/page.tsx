import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const SettingsClient = dynamic(() => import("./SettingsClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
            </div>
            <div className="skeleton-card" style={{ height: "300px" }} />
        </div>
    ),
});

export default async function SettingsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    return (
        <SettingsClient
            userName={session.user.name || "User"}
            userEmail={session.user.email || ""}
        />
    );
}
