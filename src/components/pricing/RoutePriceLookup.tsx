"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Search,
    MapPin,
    Car,
    DollarSign,
    Copy,
    Check,
    X,
    Loader2,
} from "lucide-react";
import {
    searchRoutePrices,
    getZoneSuggestions,
    getVehicleCodes,
    RoutePriceResult,
} from "@/lib/routePricingActions";
import styles from "./RoutePriceLookup.module.css";

interface Props {
    onClose?: () => void;
    onSelectPrice?: (price: number) => void;
}

export default function RoutePriceLookup({ onClose, onSelectPrice }: Props) {
    const [zoneFrom, setZoneFrom] = useState("");
    const [zoneTo, setZoneTo] = useState("");
    const [vehicleCode, setVehicleCode] = useState("");
    const [vehicleCodes, setVehicleCodes] = useState<string[]>([]);

    const [fromSuggestions, setFromSuggestions] = useState<string[]>([]);
    const [toSuggestions, setToSuggestions] = useState<string[]>([]);
    const [showFromSuggestions, setShowFromSuggestions] = useState(false);
    const [showToSuggestions, setShowToSuggestions] = useState(false);

    const [results, setResults] = useState<RoutePriceResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Load vehicle codes on mount
    useEffect(() => {
        getVehicleCodes().then(setVehicleCodes).catch(console.error);
    }, []);

    // Debounced zone suggestions
    useEffect(() => {
        if (zoneFrom.length < 2) {
            setFromSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const suggestions = await getZoneSuggestions(zoneFrom, "from", 10);
                setFromSuggestions(suggestions);
            } catch (error) {
                console.error("Failed to get suggestions:", error);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [zoneFrom]);

    useEffect(() => {
        if (zoneTo.length < 2) {
            setToSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const suggestions = await getZoneSuggestions(zoneTo, "to", 10);
                setToSuggestions(suggestions);
            } catch (error) {
                console.error("Failed to get suggestions:", error);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [zoneTo]);

    // Search when inputs change
    const handleSearch = useCallback(async () => {
        if (!zoneFrom && !zoneTo) {
            setResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const searchResults = await searchRoutePrices({
                zoneFrom: zoneFrom || undefined,
                zoneTo: zoneTo || undefined,
                vehicleCode: vehicleCode || undefined,
                limit: 50,
            });
            setResults(searchResults);
        } catch (error) {
            console.error("Search failed:", error);
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [zoneFrom, zoneTo, vehicleCode]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(handleSearch, 300);
        return () => clearTimeout(timer);
    }, [handleSearch]);

    const handleCopyPrice = async (result: RoutePriceResult) => {
        try {
            await navigator.clipboard.writeText(result.rate.toString());
            setCopiedId(result.id);
            setTimeout(() => setCopiedId(null), 2000);

            if (onSelectPrice) {
                onSelectPrice(result.rate);
            }
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    const handleSelectSuggestion = (value: string, type: "from" | "to") => {
        if (type === "from") {
            setZoneFrom(value);
            setShowFromSuggestions(false);
        } else {
            setZoneTo(value);
            setShowToSuggestions(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <DollarSign size={20} />
                    <span>Route Price Lookup</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className={styles.closeBtn}>
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Search Inputs */}
            <div className={styles.searchSection}>
                {/* Zone From */}
                <div className={styles.inputGroup}>
                    <label className={styles.label}>
                        <MapPin size={14} />
                        From Zone
                    </label>
                    <div className={styles.inputWrapper}>
                        <input
                            type="text"
                            value={zoneFrom}
                            onChange={(e) => setZoneFrom(e.target.value)}
                            onFocus={() => setShowFromSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowFromSuggestions(false), 200)}
                            placeholder="e.g., DFW, Dallas TX 75225"
                            className={styles.input}
                        />
                        {showFromSuggestions && fromSuggestions.length > 0 && (
                            <ul className={styles.suggestions}>
                                {fromSuggestions.map((s, i) => (
                                    <li
                                        key={i}
                                        onClick={() => handleSelectSuggestion(s, "from")}
                                        className={styles.suggestionItem}
                                    >
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Zone To */}
                <div className={styles.inputGroup}>
                    <label className={styles.label}>
                        <MapPin size={14} />
                        To Zone
                    </label>
                    <div className={styles.inputWrapper}>
                        <input
                            type="text"
                            value={zoneTo}
                            onChange={(e) => setZoneTo(e.target.value)}
                            onFocus={() => setShowToSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowToSuggestions(false), 200)}
                            placeholder="e.g., AUS, Austin TX 78701"
                            className={styles.input}
                        />
                        {showToSuggestions && toSuggestions.length > 0 && (
                            <ul className={styles.suggestions}>
                                {toSuggestions.map((s, i) => (
                                    <li
                                        key={i}
                                        onClick={() => handleSelectSuggestion(s, "to")}
                                        className={styles.suggestionItem}
                                    >
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Vehicle Type */}
                <div className={styles.inputGroup}>
                    <label className={styles.label}>
                        <Car size={14} />
                        Vehicle Type
                    </label>
                    <select
                        value={vehicleCode}
                        onChange={(e) => setVehicleCode(e.target.value)}
                        className={styles.select}
                    >
                        <option value="">All Vehicles</option>
                        {vehicleCodes.map((code) => (
                            <option key={code} value={code}>
                                {code}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Results */}
            <div className={styles.resultsSection}>
                {isSearching ? (
                    <div className={styles.loading}>
                        <Loader2 size={24} className="animate-spin" />
                        <span>Searching...</span>
                    </div>
                ) : results.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Search size={32} />
                        <span>
                            {zoneFrom || zoneTo
                                ? "No routes found. Try different zones."
                                : "Enter zones to search for prices"}
                        </span>
                    </div>
                ) : (
                    <>
                        <div className={styles.resultsCount}>
                            Found {results.length} route{results.length !== 1 ? "s" : ""}
                        </div>
                        <div className={styles.resultsTable}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th className={styles.priceCol}>Price</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((result) => (
                                        <tr key={result.id}>
                                            <td className={styles.vehicleCell}>
                                                {result.vehicleCode}
                                            </td>
                                            <td className={styles.zoneCell} title={result.zoneFrom}>
                                                {result.zoneFrom}
                                            </td>
                                            <td className={styles.zoneCell} title={result.zoneTo}>
                                                {result.zoneTo}
                                            </td>
                                            <td className={styles.priceCell}>
                                                ${result.rate.toFixed(0)}
                                            </td>
                                            <td className={styles.actionCell}>
                                                <button
                                                    onClick={() => handleCopyPrice(result)}
                                                    className={styles.copyBtn}
                                                    title="Copy price"
                                                >
                                                    {copiedId === result.id ? (
                                                        <Check size={14} />
                                                    ) : (
                                                        <Copy size={14} />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
