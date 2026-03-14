/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// FIFA World Cup 2026 Matches for Dallas and Houston
const fifaEvents = [
    // ===============================
    // DALLAS (AT&T Stadium, Arlington) - 9 Matches
    // ===============================
    {
        title: "FIFA World Cup - Group Stage Match 1",
        description: "FIFA World Cup 2026 Group Stage match at AT&T Stadium. Expect extremely high demand for transportation services.",
        eventDate: new Date("2026-06-14T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "World Cup match day - All hands on deck. Coordinate with DFW airport for international arrivals. Pre-position vehicles near stadium.",
    },
    {
        title: "FIFA World Cup - Group Stage Match 2",
        description: "FIFA World Cup 2026 Group Stage match at AT&T Stadium.",
        eventDate: new Date("2026-06-17T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "World Cup match day - Full staffing required. Monitor traffic patterns around stadium.",
    },
    {
        title: "FIFA World Cup - Group Stage Match 3",
        description: "FIFA World Cup 2026 Group Stage match at AT&T Stadium.",
        eventDate: new Date("2026-06-22T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "World Cup match day - Full staffing required.",
    },
    {
        title: "FIFA World Cup - Group Stage Match 4",
        description: "FIFA World Cup 2026 Group Stage match at AT&T Stadium.",
        eventDate: new Date("2026-06-25T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "World Cup match day - Full staffing required.",
    },
    {
        title: "FIFA World Cup - Group Stage Match 5",
        description: "FIFA World Cup 2026 Group Stage match at AT&T Stadium.",
        eventDate: new Date("2026-06-27T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "World Cup match day - Full staffing required.",
    },
    {
        title: "FIFA World Cup - Round of 32 (Match 1)",
        description: "FIFA World Cup 2026 Round of 32 knockout match at AT&T Stadium. Higher stakes = higher demand.",
        eventDate: new Date("2026-06-30T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "Knockout round - Expect surge in demand. VIP transportation likely increased.",
    },
    {
        title: "FIFA World Cup - Round of 32 (Match 2)",
        description: "FIFA World Cup 2026 Round of 32 knockout match at AT&T Stadium.",
        eventDate: new Date("2026-07-03T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "Knockout round - Full staffing required.",
    },
    {
        title: "FIFA World Cup - Round of 16",
        description: "FIFA World Cup 2026 Round of 16 knockout match at AT&T Stadium.",
        eventDate: new Date("2026-07-06T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "Round of 16 - High-profile match. Maximum staffing.",
    },
    {
        title: "FIFA World Cup - SEMIFINAL",
        description: "FIFA World Cup 2026 SEMIFINAL at AT&T Stadium! One of only two semifinal matches in the entire tournament.",
        eventDate: new Date("2026-07-14T12:00:00"),
        eventType: "GAME_DAY",
        location: "AT&T Stadium, Arlington",
        expectedVolume: "HIGH",
        staffingNotes: "SEMIFINAL - Maximum priority! Expect global VIPs, media, and massive crowds. All resources deployed. Pre-book vehicles, coordinate with hotels.",
    },

    // ===============================
    // HOUSTON (NRG Stadium) - 7 Matches
    // ===============================
    {
        title: "FIFA World Cup - Germany vs Curacao",
        description: "FIFA World Cup 2026 Group Stage: Germany vs Curacao at NRG Stadium, Houston.",
        eventDate: new Date("2026-06-14T12:00:00"),
        eventType: "GAME_DAY",
        location: "NRG Stadium, Houston",
        expectedVolume: "HIGH",
        staffingNotes: "World Cup match day - Houston market. Coordinate with IAH and HOU airports.",
    },
    {
        title: "FIFA World Cup - Portugal vs TBD",
        description: "FIFA World Cup 2026 Group Stage: Portugal match at NRG Stadium, Houston.",
        eventDate: new Date("2026-06-17T12:00:00"),
        eventType: "GAME_DAY",
        location: "NRG Stadium, Houston",
        expectedVolume: "HIGH",
        staffingNotes: "Portugal match - Expect high European tourist demand.",
    },
    {
        title: "FIFA World Cup - Netherlands vs TBD",
        description: "FIFA World Cup 2026 Group Stage: Netherlands match at NRG Stadium, Houston.",
        eventDate: new Date("2026-06-20T12:00:00"),
        eventType: "GAME_DAY",
        location: "NRG Stadium, Houston",
        expectedVolume: "HIGH",
        staffingNotes: "Netherlands match - Full staffing for Houston market.",
    },
    {
        title: "FIFA World Cup - Portugal vs Uzbekistan",
        description: "FIFA World Cup 2026 Group Stage: Portugal vs Uzbekistan at NRG Stadium, Houston.",
        eventDate: new Date("2026-06-23T12:00:00"),
        eventType: "GAME_DAY",
        location: "NRG Stadium, Houston",
        expectedVolume: "HIGH",
        staffingNotes: "Portugal's second match - High demand expected.",
    },
    {
        title: "FIFA World Cup - Cabo Verde vs Saudi Arabia",
        description: "FIFA World Cup 2026 Group Stage: Cabo Verde vs Saudi Arabia at NRG Stadium, Houston.",
        eventDate: new Date("2026-06-26T12:00:00"),
        eventType: "GAME_DAY",
        location: "NRG Stadium, Houston",
        expectedVolume: "HIGH",
        staffingNotes: "International matchup - Diverse crowd expected.",
    },
    {
        title: "FIFA World Cup - Round of 32 (Houston)",
        description: "FIFA World Cup 2026 Round of 32 knockout match at NRG Stadium, Houston. Group C winner vs Group F runner-up.",
        eventDate: new Date("2026-06-29T12:00:00"),
        eventType: "GAME_DAY",
        location: "NRG Stadium, Houston",
        expectedVolume: "HIGH",
        staffingNotes: "Knockout round in Houston - Increased demand for premium services.",
    },
    {
        title: "FIFA World Cup - Round of 16 (Houston)",
        description: "FIFA World Cup 2026 Round of 16 knockout match at NRG Stadium, Houston.",
        eventDate: new Date("2026-07-04T12:00:00"),
        eventType: "GAME_DAY",
        location: "NRG Stadium, Houston",
        expectedVolume: "HIGH",
        staffingNotes: "July 4th + World Cup Round of 16! Double high-demand event. Maximum staffing.",
    },
];

async function main() {
    // Get an admin user to associate with the events
    const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
    });

    if (!adminUser) {
        console.error('ERROR: No admin user found. Please run the main seed first.');
        process.exit(1);
    }

    console.log(`\n⚽ Adding FIFA World Cup 2026 Events (using admin: ${adminUser.name})...\n`);

    let created = 0;
    let skipped = 0;

    for (const event of fifaEvents) {
        // Check if event already exists (by title and date)
        const existing = await prisma.event.findFirst({
            where: {
                title: event.title,
                eventDate: event.eventDate,
            },
        });

        if (existing) {
            console.log(`  ⏭️  Skipped (exists): ${event.title}`);
            skipped++;
            continue;
        }

        await prisma.event.create({
            data: {
                ...event,
                createdById: adminUser.id,
            },
        });
        console.log(`  ✓ Created: ${event.title} - ${event.eventDate.toLocaleDateString()}`);
        created++;
    }

    console.log(`\n✅ FIFA World Cup 2026 events seeded!`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`\n📍 Dallas (AT&T Stadium): 9 matches including SEMIFINAL`);
    console.log(`📍 Houston (NRG Stadium): 7 matches`);
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
