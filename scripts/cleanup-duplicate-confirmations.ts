/**
 * One-time script: Clean up duplicate TripConfirmation records
 * Uses raw SQL for speed and to avoid connection timeout.
 *
 * Run: npx tsx scripts/cleanup-duplicate-confirmations.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    // Count duplicates first
    const countResult = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*) as cnt FROM (
            SELECT "tripNumber", "pickupAt"
            FROM "TripConfirmation"
            GROUP BY "tripNumber", "pickupAt"
            HAVING COUNT(*) > 1
        ) dupes
    `;
    console.log(`Duplicate groups (tripNumber+pickupAt): ${countResult[0].cnt}`);

    // Single SQL to delete all duplicates except the newest per group
    const deleteResult = await prisma.$executeRaw`
        DELETE FROM "TripConfirmation"
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY "tripNumber", "pickupAt"
                    ORDER BY "createdAt" DESC
                ) as rn
                FROM "TripConfirmation"
            ) ranked
            WHERE rn > 1
        )
    `;
    console.log(`Deleted ${deleteResult} duplicate records.`);

    // Verify no duplicates remain
    const verifyResult = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*) as cnt FROM (
            SELECT "tripNumber", "pickupAt"
            FROM "TripConfirmation"
            GROUP BY "tripNumber", "pickupAt"
            HAVING COUNT(*) > 1
        ) dupes
    `;
    console.log(`Remaining duplicate groups: ${verifyResult[0].cnt}`);
    console.log("Done. Run: npx prisma db push");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
