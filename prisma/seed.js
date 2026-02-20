const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const password = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@nebo.com' },
        update: {},
        create: {
            email: 'admin@nebo.com',
            name: 'Admin User',
            password: password,
            role: 'ADMIN',
        },
    });

    const dispatcher = await prisma.user.upsert({
        where: { email: 'dispatcher@nebo.com' },
        update: {},
        create: {
            email: 'dispatcher@nebo.com',
            name: 'John Dispatcher',
            password: await bcrypt.hash('dispatcher123', 10),
            role: 'DISPATCHER',
        },
    });

    console.log({ admin, dispatcher });
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
