import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const protectedRoutes = [
    "/dashboard",
    "/schedule",
    "/reports",
    "/affiliates",
    "/settings",
    "/admin",
    "/accounting",
];

// Routes only for unauthenticated users
const authRoutes = ["/login"];

// Routes that should redirect logged-in users to dashboard
const publicOnlyRoutes = ["/", "/login"];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Get the token (session)
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    });

    const isAuthenticated = !!token;

    // Check if the route is protected
    const isProtectedRoute = protectedRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
    );

    // Check if it's a public-only route (redirect logged-in users)
    const isPublicOnlyRoute = publicOnlyRoutes.includes(pathname);

    // If trying to access protected route without auth, redirect to login
    if (isProtectedRoute && !isAuthenticated) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // If authenticated user tries to access login or home page, redirect to dashboard
    if (isPublicOnlyRoute && isAuthenticated) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Check role-based access for admin routes
    if (pathname.startsWith("/admin") && isAuthenticated) {
        const userRole = token.role as string;

        // Only ADMIN and SUPER_ADMIN can access admin routes
        if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }

        // Only SUPER_ADMIN can access user management and audit
        if (
            (pathname.startsWith("/admin/users") || pathname.startsWith("/admin/audit")) &&
            userRole !== "SUPER_ADMIN"
        ) {
            return NextResponse.redirect(new URL("/admin/scheduler", request.url));
        }
    }

    // Check role-based access for accounting routes
    if (pathname.startsWith("/accounting") && isAuthenticated) {
        const userRole = token.role as string;

        // Only ACCOUNTING, ADMIN, and SUPER_ADMIN can access accounting routes
        if (userRole !== "ACCOUNTING" && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - api routes
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico
         * - public files (images, etc)
         */
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
    ],
};
