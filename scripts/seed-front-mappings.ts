/**
 * Seed Front teammate mappings
 *
 * Maps Front app teammates to NeboOps users by name match.
 * Run with: npx dotenvx run -- npx tsx scripts/seed-front-mappings.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FRONT_TEAMMATES = [
    { frontTeammateId: "tea_mqwrk", frontName: "Bara Esieed", frontEmail: "admin@neborides.com", neboEmail: "bara@nebo.com" },
    { frontTeammateId: "tea_msbog", frontName: "Manny As", frontEmail: "manny@neborides.net", neboEmail: "manny@nebo.com" },
    { frontTeammateId: "tea_mso68", frontName: "Abood Alzarou", frontEmail: "joe@neborides.net", neboEmail: "joe@nebo.com" },
    { frontTeammateId: "tea_msokg", frontName: "Zaher Afghani", frontEmail: "zack@neborides.net", neboEmail: "zack@nebo.com" },
    { frontTeammateId: "tea_msoo0", frontName: "Mustafa Zalloum", frontEmail: "luke@neborides.net", neboEmail: "luke@nebo.com" },
    { frontTeammateId: "tea_msov4", frontName: "Moe Fawzey", frontEmail: "moe@neborides.net", neboEmail: "moe@nebo.com" },
    { frontTeammateId: "tea_n6bhc", frontName: "Mike Alhaj", frontEmail: "reemalhaj73@gmail.com", neboEmail: "alhajmo73@yahoo.com" },
];

async function main() {
    console.log("Seeding Front teammate mappings...\n");

    for (const tm of FRONT_TEAMMATES) {
        const user = await prisma.user.findUnique({
            where: { email: tm.neboEmail },
            select: { id: true, name: true, email: true },
        });

        if (!user) {
            console.log(`SKIP: No NeboOps user found for ${tm.frontName} (${tm.neboEmail})`);
            continue;
        }

        await prisma.frontTeammateMapping.upsert({
            where: { userId: user.id },
            update: {
                frontTeammateId: tm.frontTeammateId,
                frontName: tm.frontName,
                frontEmail: tm.frontEmail,
            },
            create: {
                userId: user.id,
                frontTeammateId: tm.frontTeammateId,
                frontName: tm.frontName,
                frontEmail: tm.frontEmail,
            },
        });

        console.log(`MAPPED: ${tm.frontName} (${tm.frontEmail}) → ${user.name} (${user.email})`);
    }

    console.log("\nDone!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
