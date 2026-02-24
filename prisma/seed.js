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
    // SECURITY: Use environment variable for default password
    // Set SEED_DEFAULT_PASSWORD in your .env file
    const rawPassword = process.env.SEED_DEFAULT_PASSWORD;
    if (!rawPassword) {
        console.error('ERROR: SEED_DEFAULT_PASSWORD environment variable is required');
        console.error('Set it in your .env file before running the seed');
        process.exit(1);
    }
    const defaultPassword = await bcrypt.hash(rawPassword, 12);

    // Admin users
    const admins = [
        { email: 'bara@nebo.com', name: 'Bara Esieed' },
        { email: 'manny@nebo.com', name: 'Mohannad Alasmar' },
    ];

    // Dispatcher users
    const dispatchers = [
        { email: 'joe@nebo.com', name: 'Abood Alzarou' },
        { email: 'bruce@nebo.com', name: 'Bruce Henry' },
        { email: 'mike@nebo.com', name: 'Mike Hajj' },
        { email: 'moe@nebo.com', name: 'Moe Daraghmah' },
        { email: 'luke@nebo.com', name: 'Mustafa Zalloum' },
        { email: 'zack@nebo.com', name: 'Zaher Afghani' },
    ];

    console.log('Creating admin users...');
    for (const admin of admins) {
        const user = await prisma.user.upsert({
            where: { email: admin.email },
            update: { name: admin.name, role: 'ADMIN' },
            create: {
                email: admin.email,
                name: admin.name,
                password: defaultPassword,
                role: 'ADMIN',
            },
        });
        console.log(`  ✓ ${user.name} (${user.email}) - ADMIN`);
    }

    console.log('\nCreating dispatcher users...');
    for (const dispatcher of dispatchers) {
        const user = await prisma.user.upsert({
            where: { email: dispatcher.email },
            update: { name: dispatcher.name, role: 'DISPATCHER' },
            create: {
                email: dispatcher.email,
                name: dispatcher.name,
                password: defaultPassword,
                role: 'DISPATCHER',
            },
        });
        console.log(`  ✓ ${user.name} (${user.email}) - DISPATCHER`);
    }

    console.log('\n✅ All users created successfully!');
    console.log('IMPORTANT: Have users change their passwords after first login!');
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
