import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTbrTrips, getTbrDashboardStats } from "@/lib/domains/tbr";
import TbrTripsClient from "./TbrTripsClient";

export const metadata = {
    title: "TBR Trips | Nebo Dispatch",
    description: "Manage TBR Global trips and sync with LimoAnywhere",
};

export default async function TbrTripsPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        redirect("/login");
    }

    // Fetch initial data
    const [tripsResult, stats] = await Promise.all([
        getTbrTrips({ limit: 50 }),
        getTbrDashboardStats(),
    ]);

    return (
        <TbrTripsClient
            initialTrips={tripsResult.trips}
            totalTrips={tripsResult.total}
            stats={stats}
        />
    );
}
