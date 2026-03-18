"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import ToggleGroup from "@/components/ui/ToggleGroup";
import AffiliatePricingTab from "./AffiliatePricingTab";
import { FlagsSection } from "./components/flags";
import type { AccountingFlag, Stats } from "./components/flags";
import styles from "./Accounting.module.css";

interface PricingEntry {
    id: string;
    serviceType: string;
    flatRate: number;
    notes: string | null;
}

interface RoutePrice {
    id: string;
    pickupLocation: string;
    dropoffLocation: string;
    vehicleType: string | null;
    price: number;
    notes: string | null;
}

interface Affiliate {
    id: string;
    name: string;
    email: string;
    state: string | null;
    cities: string[];
    pricingGrid: PricingEntry[];
    routePricing: RoutePrice[];
}

interface Props {
    initialStats: Stats;
    initialFlags: AccountingFlag[];
    totalFlags: number;
    userRole: string;
    isAdmin: boolean;
    affiliates: Affiliate[];
}

export default function AccountingClient({
    initialStats,
    initialFlags,
    totalFlags,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userRole,
    isAdmin,
    affiliates,
}: Props) {
    const [mainSection, setMainSection] = useState<"flags" | "pricing">("flags");

    return (
        <div className={styles.accountingPage}>
            {/* Header */}
            <header className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.headerIcon}>
                        <Calculator size={24} />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>Accounting Dashboard</h1>
                        <p className={styles.headerSubtitle}>
                            Review flagged reservations and manage affiliate pricing
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Section Tabs */}
            <ToggleGroup
                options={[
                    { value: "flags", label: "Reservation Flags" },
                    { value: "pricing", label: "Affiliate Pricing" },
                ]}
                value={mainSection}
                onChange={(v) => setMainSection(v as "flags" | "pricing")}
            />

            {mainSection === "flags" ? (
                <FlagsSection
                    initialStats={initialStats}
                    initialFlags={initialFlags}
                    totalFlags={totalFlags}
                />
            ) : (
                <AffiliatePricingTab affiliates={affiliates} isAdmin={isAdmin} />
            )}
        </div>
    );
}
