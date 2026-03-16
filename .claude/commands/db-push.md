---
description: Push Prisma schema changes to Supabase and regenerate client
---
Run in sequence:
1. `npx prisma db push`
2. `npx prisma generate`
If db push fails, diagnose connection vs schema conflict. For destructive changes, warn me before proceeding.
