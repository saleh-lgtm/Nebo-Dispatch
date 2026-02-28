"use client";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

// Dynamic imports for heavy layout components - improves initial load
const Navbar = dynamic(() => import("./Navbar"), {
    loading: () => <NavbarSkeleton />,
    ssr: false,
});

const Sidebar = dynamic(() => import("./Sidebar"), {
    loading: () => <SidebarSkeleton />,
    ssr: false,
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
            <div className="skeleton" style={{ width: "100%", height: "60px" }} />
            <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
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
