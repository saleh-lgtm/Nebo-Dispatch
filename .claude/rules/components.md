# Component Rules
- Client components MUST use the *Client.tsx suffix and have "use client" as the first line
- Page files (page.tsx) are Server Components — they fetch data and pass to the Client component
- Page files must check auth via getServerSession(authOptions) and redirect to /login if no session
- Admin routes must check role: if not ADMIN or SUPER_ADMIN, redirect to /dashboard
- Use CSS Modules (.module.css) for component styles — NOT Tailwind, NOT inline styles, NOT globals.css
- Co-locate CSS Module files next to their component
- Shared UI primitives go in src/components/ui/
- Feature-specific components stay in their src/app/[feature]/ directory
- Import shared components from @/components/, never with relative paths outside the current feature
