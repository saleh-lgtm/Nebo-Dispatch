import { getVehicles, getFleetStats } from "@/lib/fleetActions";
import { requireAdmin } from "@/lib/auth-helpers";
import FleetClient from "./FleetClient";

export default async function FleetPage() {
    await requireAdmin();

    const [vehicles, stats] = await Promise.all([
        getVehicles(),
        getFleetStats(),
    ]);

    return <FleetClient initialVehicles={vehicles} stats={stats} />;
}
