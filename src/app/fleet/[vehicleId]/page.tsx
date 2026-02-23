import { getVehicleById } from "@/lib/fleetActions";
import { requireAdmin } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import VehicleDetailClient from "./VehicleDetailClient";

interface Props {
    params: Promise<{ vehicleId: string }>;
}

export default async function VehicleDetailPage({ params }: Props) {
    await requireAdmin();

    const { vehicleId } = await params;
    const vehicle = await getVehicleById(vehicleId);

    if (!vehicle) {
        notFound();
    }

    return <VehicleDetailClient vehicle={vehicle} />;
}
