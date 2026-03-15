import { DispatcherFeature } from "@prisma/client";

// Feature list for dispatcher permission management
export const DISPATCHER_FEATURES: { key: DispatcherFeature; label: string; description: string }[] = [
    { key: "QUOTES", label: "Quotes", description: "Create and manage customer quotes" },
    { key: "CONTACTS", label: "Contacts", description: "View and manage contact directory" },
    { key: "SMS", label: "SMS", description: "Send SMS messages to clients" },
    { key: "FLEET", label: "Fleet", description: "View fleet vehicle information" },
    { key: "SCHEDULER", label: "Scheduler", description: "View work schedules" },
    { key: "REPORTS", label: "Reports", description: "Submit shift reports" },
    { key: "DIRECTORY", label: "Directory", description: "View company directory" },
    { key: "CONFIRMATIONS", label: "Confirmations", description: "Handle trip confirmations" },
    { key: "TBR_TRIPS", label: "TBR Trips", description: "View TBR Global trips" },
    { key: "NOTES", label: "Notes", description: "View and create global notes" },
    { key: "TASKS", label: "Tasks", description: "View assigned tasks" },
    { key: "ANALYTICS", label: "Analytics", description: "View performance analytics" },
];

// Common task presets for dispatcher assignments
export const TASK_PRESETS = [
    "TBR Trip Management",
    "Retail Quote Handling",
    "Trip Confirmations",
    "Client Communications",
    "Fleet Coordination",
    "Affiliate Dispatch",
    "Airport Runs",
    "Event Coordination",
    "VIP Client Services",
    "After-Hours Support",
];
