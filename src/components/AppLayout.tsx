"use client";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

// Dynamic imports for layout components
// Sidebar: SSR enabled to prevent layout shift and ensure immediate functionality
const Navbar = dynamic(() => import("./Navbar"), {
    loading: () => <NavbarSkeleton />,
    ssr: false,
});

const Sidebar = dynamic(() => import("./Sidebar"), {
    loading: () => <SidebarSkeleton />,
    ssr: true, // Enable SSR to prevent layout shift
});

function NavbarSkeleton() {
    return (
        <nav className="navbar-skeleton">
            <div className="skeleton" style={{ width: "32px", height: "32px", borderRadius: "8px" }} />
            <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton" style={{ width: "70px", height: "32px", borderRadius: "6px" }} />
                ))}
            </div>
        </nav>
    );
}

function SidebarSkeleton() {
    return (
        <aside className="sidebar-skeleton">
            {/* Header */}
            <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid var(--border)" }}>
                <div className="skeleton" style={{ width: "100px", height: "24px", borderRadius: "4px" }} />
            </div>
            {/* User card */}
            <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div className="skeleton" style={{ width: "38px", height: "38px", borderRadius: "6px", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div className="skeleton" style={{ width: "80%", height: "14px", borderRadius: "4px" }} />
                    <div className="skeleton" style={{ width: "50%", height: "10px", borderRadius: "4px" }} />
                </div>
            </div>
            {/* Nav items */}
            <div style={{ padding: "0.75rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="skeleton" style={{ width: "100%", height: "36px", borderRadius: "6px" }} />
                ))}
            </div>
        </aside>
    );
}

function LoadingSpinner() {
    return (
        <div className="app-loading">
            <div className="spinner" />
        </div>
    );
}

interface Props {
    children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
    const { data: session, status } = useSession();

    // Show loading spinner while checking auth
    if (status === "loading") {
        return <LoadingSpinner />;
    }

    // Not logged in - show minimal layout
    if (!session) {
        return (
            <>
                <Navbar />
                <main className="container animate-fade-in" style={{ padding: "2rem 0", flex: 1 }}>
                    {children}
                </main>
            </>
        );
    }

    // All authenticated users get sidebar layout
    return (
        <>
            <Sidebar user={session.user} />
            <div className="sa-main-wrapper">
                <main className="sa-main-content animate-fade-in">
                    {children}
                </main>
                <footer className="sa-footer">
                    &copy; {new Date().getFullYear()} Nebo Rides. All rights reserved.
                </footer>
            </div>
        </>
    );
}
