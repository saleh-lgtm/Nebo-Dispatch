import { getVehicles, getFleetStats } from "@/lib/fleetActions";
import { requireAdmin } from "@/lib/auth-helpers";
import FleetClient from "./FleetClient";

export default async function FleetPage() {
    await requireAdmin();

    const [vehiclesResult, statsResult] = await Promise.all([
        getVehicles(),
        getFleetStats(),
    ]);

    return (
        <FleetClient
            initialVehicles={vehiclesResult.success ? vehiclesResult.data : []}
            stats={statsResult.success ? statsResult.data : { totalVehicles: 0, activeVehicles: 0, expiringDocuments: 0, expiredDocuments: 0 }}
        />
    );
}
