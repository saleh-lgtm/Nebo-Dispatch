import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const email = "Saleh@nebo.com";
    const password = process.env.SUPER_ADMIN_PASSWORD || "NeboAdmin2024!";

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
    });

    if (existingUser) {
        // Update to SUPER_ADMIN if not already
        if (existingUser.role !== "SUPER_ADMIN") {
            await prisma.user.update({
                where: { id: existingUser.id },
                data: { role: "SUPER_ADMIN" },
            });
            console.log(`Updated ${email} to SUPER_ADMIN role`);
        } else {
            console.log(`${email} is already a SUPER_ADMIN`);
        }
        return;
    }

    // Create new super admin
    const hashedPassword = await hash(password, 12);

    const user = await prisma.user.create({
        data: {
            email: email.toLowerCase(),
            name: "Saleh",
            password: hashedPassword,
            role: "SUPER_ADMIN",
            isActive: true,
            emailVerified: new Date(),
        },
    });

    console.log(`Created SUPER_ADMIN user: ${user.email}`);
    console.log(`Password: ${password}`);
    console.log("\nIMPORTANT: Change this password after first login!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
