"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    DollarSign,
    Upload,
    FileSpreadsheet,
    Clock,
    MapPin,
    Car,
    TrendingUp,
    AlertCircle,
    CheckCircle,
    Loader2,
    History,
    X,
} from "lucide-react";
import {
    importRoutePrices,
    clearRoutePrices,
    importRoutePricesBatch,
    logRoutePriceImport,
    RoutePriceRow,
    ImportResult,
    RoutePricingStats
} from "@/lib/routePricingActions";

interface ImportHistoryItem {
    id: string;
    fileName: string;
    fileSize: number;
    rowsImported: number;
    rowsSkipped: number;
    durationMs: number;
    importedAt: Date;
    importedBy: { id: string; name: string | null };
}

interface Props {
    initialStats: RoutePricingStats;
    importHistory: ImportHistoryItem[];
}

export default function PricingAdminClient({ initialStats, importHistory }: Props) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [stats] = useState(initialStats);
    const [history] = useState(importHistory);

    // Upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<RoutePriceRow[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        setParseError(null);
        setParsedRows([]);
        setImportResult(null);
        setIsParsing(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/pricing/import", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to parse file");
            }

            setParsedRows(data.rows);
        } catch (error) {
            setParseError(error instanceof Error ? error.message : "Failed to parse file");
        } finally {
            setIsParsing(false);
        }
    };

    const handleImport = async () => {
        if (parsedRows.length === 0) return;

        setIsImporting(true);
        setImportResult(null);
        setImportProgress(null);

        const startTime = Date.now();
        const BATCH_SIZE = 10000;
        const fileName = selectedFile?.name || "unknown.xlsx";
        const fileSize = selectedFile?.size || 0;

        try {
            // For large imports (>10K rows), use batch approach
            if (parsedRows.length > BATCH_SIZE) {
                const totalBatches = Math.ceil(parsedRows.length / BATCH_SIZE);
                let totalImported = 0;
                let totalSkipped = 0;
                const allErrors: Array<{ row: number; message: string }> = [];

                // Step 1: Clear existing data
                setImportProgress({ current: 0, total: totalBatches + 1 });
                await clearRoutePrices();

                // Step 2: Import in batches
                for (let i = 0; i < totalBatches; i++) {
                    setImportProgress({ current: i + 1, total: totalBatches + 1 });

                    const batchStart = i * BATCH_SIZE;
                    const batchRows = parsedRows.slice(batchStart, batchStart + BATCH_SIZE);

                    const result = await importRoutePricesBatch(batchRows, i);
                    totalImported += result.imported;
                    totalSkipped += batchRows.length - result.imported;
                    allErrors.push(...result.errors);
                }

                // Step 3: Log the import
                const durationMs = Date.now() - startTime;
                await logRoutePriceImport(fileName, fileSize, totalImported, totalSkipped, durationMs, allErrors);

                setImportResult({
                    success: true,
                    rowsImported: totalImported,
                    rowsSkipped: totalSkipped,
                    errors: allErrors.slice(0, 100),
                    durationMs,
                });

                router.refresh();
            } else {
                // For smaller imports, use the simple approach
                const result = await importRoutePrices(parsedRows, fileName, fileSize);
                setImportResult(result);

                if (result.success) {
                    router.refresh();
                }
            }
        } catch (error) {
            setImportResult({
                success: false,
                rowsImported: 0,
                rowsSkipped: parsedRows.length,
                errors: [{ row: 0, message: error instanceof Error ? error.message : "Import failed" }],
                durationMs: Date.now() - startTime,
            });
        } finally {
            setIsImporting(false);
            setImportProgress(null);
        }
    };

    const resetUpload = () => {
        setSelectedFile(null);
        setParsedRows([]);
        setParseError(null);
        setImportResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-content">
                    <DollarSign size={28} className="page-header-icon" />
                    <div>
                        <h1 className="page-title">Route Pricing</h1>
                        <p className="page-subtitle">
                            Import and manage route pricing from Excel
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid" style={{ marginBottom: "1.5rem" }}>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: "var(--primary-light)" }}>
                        <MapPin size={20} style={{ color: "var(--primary)" }} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.totalRoutes.toLocaleString()}</span>
                        <span className="stat-label">Total Routes</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: "#dbeafe" }}>
                        <Car size={20} style={{ color: "#2563eb" }} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.vehicleCodes}</span>
                        <span className="stat-label">Vehicle Types</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: "#dcfce7" }}>
                        <MapPin size={20} style={{ color: "#16a34a" }} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.uniqueZones.toLocaleString()}</span>
                        <span className="stat-label">Unique Zones</span>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: "#fef3c7" }}>
                        <TrendingUp size={20} style={{ color: "#d97706" }} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">
                            ${stats.priceRange.min.toFixed(0)} - ${stats.priceRange.max.toFixed(0)}
                        </span>
                        <span className="stat-label">Price Range</span>
                    </div>
                </div>
            </div>

            {/* Last Import Info */}
            {stats.lastImport && (
                <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
                        <Clock size={16} />
                        <span>
                            Last imported <strong>{stats.lastImport.rowsImported.toLocaleString()}</strong> routes
                            from <strong>{stats.lastImport.fileName}</strong> by {stats.lastImport.importedBy}
                            {" "}on {formatDate(stats.lastImport.importedAt)}
                        </span>
                    </div>
                </div>
            )}

            {/* Upload Section */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
                <div className="card-header">
                    <h2 className="card-title">
                        <Upload size={20} />
                        Import Route Pricing
                    </h2>
                </div>
                <div className="card-body">
                    {/* File Input */}
                    <div
                        style={{
                            border: "2px dashed var(--border)",
                            borderRadius: "0.5rem",
                            padding: "2rem",
                            textAlign: "center",
                            backgroundColor: selectedFile ? "var(--success-light)" : "var(--bg-secondary)",
                            cursor: isImporting ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                        }}
                        onClick={() => !isImporting && fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileSelect}
                            style={{ display: "none" }}
                            disabled={isImporting}
                        />

                        {isParsing ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                                <Loader2 size={32} className="animate-spin" style={{ color: "var(--primary)" }} />
                                <span>Parsing Excel file...</span>
                            </div>
                        ) : selectedFile ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                                <FileSpreadsheet size={32} style={{ color: "var(--success)" }} />
                                <span style={{ fontWeight: 500 }}>{selectedFile.name}</span>
                                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                    {formatFileSize(selectedFile.size)}
                                </span>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                                <FileSpreadsheet size={32} style={{ color: "var(--text-secondary)" }} />
                                <span style={{ fontWeight: 500 }}>Click to select Excel file</span>
                                <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                    Accepts .xlsx or .xls files
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Parse Error */}
                    {parseError && (
                        <div
                            style={{
                                marginTop: "1rem",
                                padding: "0.75rem",
                                backgroundColor: "var(--error-light)",
                                borderRadius: "0.5rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                color: "var(--error)",
                            }}
                        >
                            <AlertCircle size={20} />
                            <span>{parseError}</span>
                        </div>
                    )}

                    {/* Parsed Results Preview */}
                    {parsedRows.length > 0 && !importResult && (
                        <div style={{ marginTop: "1rem" }}>
                            <div
                                style={{
                                    padding: "0.75rem",
                                    backgroundColor: "var(--info-light)",
                                    borderRadius: "0.5rem",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <CheckCircle size={20} style={{ color: "var(--success)" }} />
                                    <span>
                                        Found <strong>{parsedRows.length.toLocaleString()}</strong> valid routes
                                    </span>
                                </div>
                                <button
                                    onClick={resetUpload}
                                    className="btn btn-ghost"
                                    style={{ padding: "0.25rem" }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Sample Preview */}
                            <div style={{ marginTop: "1rem", overflowX: "auto" }}>
                                <table className="table" style={{ fontSize: "0.875rem" }}>
                                    <thead>
                                        <tr>
                                            <th>Vehicle</th>
                                            <th>From</th>
                                            <th>To</th>
                                            <th style={{ textAlign: "right" }}>Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedRows.slice(0, 5).map((row, i) => (
                                            <tr key={i}>
                                                <td>{row.vehicleCode}</td>
                                                <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {row.zoneFrom}
                                                </td>
                                                <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {row.zoneTo}
                                                </td>
                                                <td style={{ textAlign: "right" }}>${row.rate.toFixed(0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedRows.length > 5 && (
                                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                                        ...and {(parsedRows.length - 5).toLocaleString()} more rows
                                    </p>
                                )}
                            </div>

                            {/* Import Button */}
                            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                                <button onClick={resetUpload} className="btn btn-secondary" disabled={isImporting}>
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImport}
                                    className="btn btn-primary"
                                    disabled={isImporting}
                                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                                >
                                    {isImporting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            {importProgress
                                                ? `Batch ${importProgress.current}/${importProgress.total}...`
                                                : "Importing..."}
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Import {parsedRows.length.toLocaleString()} Routes
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Import Result */}
                    {importResult && (
                        <div
                            style={{
                                marginTop: "1rem",
                                padding: "1rem",
                                backgroundColor: importResult.success ? "var(--success-light)" : "var(--error-light)",
                                borderRadius: "0.5rem",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                {importResult.success ? (
                                    <CheckCircle size={20} style={{ color: "var(--success)" }} />
                                ) : (
                                    <AlertCircle size={20} style={{ color: "var(--error)" }} />
                                )}
                                <span style={{ fontWeight: 500 }}>
                                    {importResult.success ? "Import Successful!" : "Import Failed"}
                                </span>
                            </div>
                            <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                                <p>Imported: {importResult.rowsImported.toLocaleString()} routes</p>
                                {importResult.rowsSkipped > 0 && (
                                    <p>Skipped: {importResult.rowsSkipped.toLocaleString()} rows</p>
                                )}
                                <p>Duration: {formatDuration(importResult.durationMs)}</p>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div style={{ marginTop: "0.5rem" }}>
                                    <p style={{ fontWeight: 500, fontSize: "0.875rem" }}>Errors:</p>
                                    <ul style={{ fontSize: "0.75rem", marginLeft: "1rem" }}>
                                        {importResult.errors.slice(0, 5).map((err, i) => (
                                            <li key={i}>Row {err.row}: {err.message}</li>
                                        ))}
                                        {importResult.errors.length > 5 && (
                                            <li>...and {importResult.errors.length - 5} more errors</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            <button
                                onClick={resetUpload}
                                className="btn btn-secondary"
                                style={{ marginTop: "1rem" }}
                            >
                                Upload Another File
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Import History */}
            {history.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">
                            <History size={20} />
                            Import History
                        </h2>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>File</th>
                                    <th>Rows</th>
                                    <th>Duration</th>
                                    <th>Imported By</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <FileSpreadsheet size={16} style={{ color: "var(--success)" }} />
                                                <span>{item.fileName}</span>
                                            </div>
                                        </td>
                                        <td>{item.rowsImported.toLocaleString()}</td>
                                        <td>{formatDuration(item.durationMs)}</td>
                                        <td>{item.importedBy.name || "Unknown"}</td>
                                        <td>{formatDate(item.importedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
