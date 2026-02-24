// Standard service types for pricing grid
export const SERVICE_TYPES = [
    "Airport Transfer",
    "Hourly Service",
    "Point to Point",
    "City Tour",
    "Long Distance",
    "Event Service",
    "Corporate Account",
    "Wedding",
    "Custom",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];
