"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, Calendar, CalendarClock, ClipboardList, Users, LogOut, User as UserIcon } from "lucide-react";

export default function Navbar() {
    const { data: session } = useSession();

    if (!session) return null;

    const isAdmin = session.user.role === "ADMIN";

    return (
        <nav className="glass sticky-top" style={{ borderBottom: '1px solid var(--glass-border)', padding: '0.75rem 0', zIndex: 100 }}>
            <div className="container flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <img src="/logo.png" alt="Nebo Rides" style={{ height: "32px", width: "auto" }} />
                </Link>

                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="flex items-center gap-2 nav-link">
                        <LayoutDashboard size={18} />
                        <span>Dashboard</span>
                    </Link>

                    <Link href="/schedule" className="flex items-center gap-2 nav-link">
                        <Calendar size={18} />
                        <span>Schedule</span>
                    </Link>

                    {!isAdmin && (
                        <Link href="/reports/shift" className="flex items-center gap-2 nav-link">
                            <ClipboardList size={18} />
                            <span>Shift Report</span>
                        </Link>
                    )}

                    <Link href="/affiliates" className="flex items-center gap-2 nav-link">
                        <Users size={18} />
                        <span>Affiliates</span>
                    </Link>

                    {isAdmin && (
                        <>
                            <Link href="/admin/scheduler" className="flex items-center gap-2 nav-link">
                                <CalendarClock size={18} />
                                <span>Scheduler</span>
                            </Link>
                            <Link href="/admin/analytics" className="flex items-center gap-2 nav-link">
                                <LayoutDashboard size={18} />
                                <span>Analytics</span>
                            </Link>
                            <Link href="/admin/users" className="flex items-center gap-2 nav-link">
                                <UserIcon size={18} />
                                <span>Users</span>
                            </Link>
                        </>
                    )}

                    <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.5rem' }} />

                    <button
                        onClick={() => signOut()}
                        className="logout-btn"
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'inherit', fontSize: '1rem', padding: '0', transition: 'color 0.2s' }}
                    >
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>

        </nav>
    );
}
