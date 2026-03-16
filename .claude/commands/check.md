---
description: Run typecheck, lint, and production build to verify everything works
---
Run these checks in sequence and report results for each:
1. `npx tsc --noEmit` — TypeScript type checking
2. `npm run lint` — ESLint
3. `NEXT_BUILD_TURBOPACK=0 npm run build` — Production build
For each step, if it passes say ✅ and move on. If it fails, show errors and offer to fix. After all three, give summary: "X/3 passed"
