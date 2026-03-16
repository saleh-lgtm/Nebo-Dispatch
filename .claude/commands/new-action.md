---
description: Create a new server action file following project conventions
---
Create `src/lib/$ARGUMENTS.ts` with "use server" directive. Import prisma from @/lib/prisma, getServerSession and authOptions from auth. Each exported function must: check auth, validate with Zod, wrap in try/catch, return { success: boolean, data?: T, error?: string }. Follow existing patterns in src/lib/quoteActions.ts.
