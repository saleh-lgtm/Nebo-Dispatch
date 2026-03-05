import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

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

        // Validate file type
        const validExtensions = [".xlsx", ".xls"];
        const hasValidExtension = validExtensions.some((ext) =>
            file.name.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
            return NextResponse.json(
                { error: "Invalid file type. Please upload an Excel file (.xlsx or .xls)" },
                { status: 400 }
            );
        }

        // Parse Excel
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
        console.error("Excel parsing error:", error);
        return NextResponse.json(
            { error: "Failed to parse Excel file", details: String(error) },
            { status: 500 }
        );
    }
}
