---
description: Scaffold a new app route with page + client component pattern
---
Create a new route at `src/app/$ARGUMENTS/` with:
1. page.tsx — Server Component with getServerSession auth check, redirect to /login if no session, passes data to Client component
2. [Name]Client.tsx — Client Component with "use client" directive
3. [Name].module.css — CSS Module with base container styles
Follow the exact patterns from existing pages like src/app/fleet/page.tsx. Add navigation link to the appropriate nav section.
