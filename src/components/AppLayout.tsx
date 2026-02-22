"use client";

import { useSession } from "next-auth/react";
import Navbar from "./Navbar";
import SuperAdminSidebar from "./SuperAdminSidebar";

interface Props {
    children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
    const { data: session, status } = useSession();

    // Show nothing while loading
    if (status === "loading") {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
                background: "var(--bg-primary)"
            }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    // Not logged in - show regular navbar (handles redirect)
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

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    // Super Admin gets sidebar layout
    if (isSuperAdmin) {
        return (
            <>
                <SuperAdminSidebar user={session.user} />
                <div className="sa-main-wrapper">
                    <main className="sa-main-content animate-fade-in">
                        {children}
                    </main>
                    <footer className="sa-footer">
                        &copy; {new Date().getFullYear()} Nebo Rides. All rights reserved.
                    </footer>
                </div>

                <style jsx>{`
                    .sa-main-wrapper {
                        margin-left: 260px;
                        min-height: 100vh;
                        display: flex;
                        flex-direction: column;
                        transition: margin-left 0.2s ease;
                    }

                    .sa-main-content {
                        flex: 1;
                        padding: 2rem;
                        max-width: 1400px;
                        width: 100%;
                        margin: 0 auto;
                    }

                    .sa-footer {
                        padding: 1.5rem 2rem;
                        text-align: center;
                        color: var(--text-secondary);
                        font-size: 0.8125rem;
                        border-top: 1px solid var(--border);
                    }

                    @media (max-width: 1024px) {
                        .sa-main-wrapper {
                            margin-left: 70px;
                        }
                    }
                `}</style>
            </>
        );
    }

    // Regular users get top navbar layout
    return (
        <>
            <Navbar />
            <main className="container animate-fade-in" style={{ padding: "2rem 0", flex: 1 }}>
                {children}
            </main>
            <footer className="container" style={{ padding: "2rem 0", textAlign: "center", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                &copy; {new Date().getFullYear()} Nebo Rides. All rights reserved.
            </footer>
        </>
    );
}
