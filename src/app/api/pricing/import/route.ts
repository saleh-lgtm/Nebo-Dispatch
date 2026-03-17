import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel",    // .xls
    "text/csv",                    // .csv
    "application/csv",             // .csv (alternate)
]);

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export async function POST(request: NextRequest) {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is 10 MB, got ${(file.size / 1024 / 1024).toFixed(1)} MB` },
                { status: 400 }
            );
        }

        // Validate MIME type
        if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json(
                { error: `Invalid file type "${file.type}". Allowed: xlsx, xls, csv` },
                { status: 400 }
            );
        }

        // Validate file extension
        const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
            return NextResponse.json(
                { error: "Invalid file extension. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file" },
                { status: 400 }
            );
        }

        // Parse file
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with header mapping
        const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        // Map columns (handle various column name formats)
        const rows = rawData.map((row) => {
            const vehicleCode =
                row["Vehicle Code"] ||
                row["VehicleCode"] ||
                row["vehicle_code"] ||
                row["VEHICLE_CODE"] ||
                row["vehicle code"] ||
                "";

            const zoneFrom =
                row["Zone From (Code)"] ||
                row["Zone From"] ||
                row["ZoneFrom"] ||
                row["zone_from"] ||
                row["ZONE_FROM"] ||
                row["From"] ||
                row["from"] ||
                "";

            const zoneTo =
                row["Zone To (Code)"] ||
                row["Zone To"] ||
                row["ZoneTo"] ||
                row["zone_to"] ||
                row["ZONE_TO"] ||
                row["To"] ||
                row["to"] ||
                "";

            const rate =
                row["Rate"] ||
                row["rate"] ||
                row["RATE"] ||
                row["Price"] ||
                row["price"] ||
                row["PRICE"] ||
                0;

            return {
                vehicleCode: String(vehicleCode).trim(),
                zoneFrom: String(zoneFrom).trim(),
                zoneTo: String(zoneTo).trim(),
                rate: typeof rate === "number" ? rate : parseFloat(String(rate)) || 0,
            };
        });

        // Filter out empty rows
        const validRows = rows.filter(
            (row) => row.vehicleCode && row.zoneFrom && row.zoneTo && row.rate > 0
        );

        return NextResponse.json({
            success: true,
            rows: validRows,
            totalRows: validRows.length,
            skippedRows: rows.length - validRows.length,
            fileName: file.name,
            fileSize: file.size,
        });
    } catch (error) {
        console.error("File parsing error:", error);
        return NextResponse.json(
            { error: "Failed to parse file", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
