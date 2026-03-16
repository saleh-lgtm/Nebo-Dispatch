import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Clearing schedule data...')

  const templateShifts = await prisma.scheduleTemplateShift.deleteMany({})
  console.log(`Deleted ${templateShifts.count} template shifts`)

  const templates = await prisma.scheduleTemplate.deleteMany({})
  console.log(`Deleted ${templates.count} templates`)

  const schedules = await prisma.schedule.deleteMany({})
  console.log(`Deleted ${schedules.count} schedules`)

  console.log('Done — schedule tables cleared')
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect()
  await pool.end()
})
