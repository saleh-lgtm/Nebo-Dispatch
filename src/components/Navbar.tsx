"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
    LayoutDashboard,
    Calendar,
    CalendarClock,
    ClipboardList,
    Users,
    LogOut,
    User as UserIcon,
    StickyNote,
    Settings,
    FileEdit,
    Menu,
    X,
    BarChart3,
    FileText,
} from "lucide-react";

interface NavLinkProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
}

function NavLink({ href, icon, label, onClick }: NavLinkProps) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(href + "/");

    return (
        <Link
            href={href}
            onClick={onClick}
            className={`nav-link ${isActive ? "nav-link-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}

export default function Navbar() {
    const { data: session } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [mobileMenuOpen]);

    if (!session) return null;

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const isAdmin = session.user.role === "ADMIN" || isSuperAdmin;

    const closeMobileMenu = () => setMobileMenuOpen(false);

    const mainLinks = (
        <>
            <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={closeMobileMenu} />
            <NavLink href="/schedule" icon={<Calendar size={18} />} label="Schedule" onClick={closeMobileMenu} />
            {!isAdmin && (
                <NavLink href="/reports/shift" icon={<ClipboardList size={18} />} label="Shift Report" onClick={closeMobileMenu} />
            )}
            <NavLink href="/affiliates" icon={<Users size={18} />} label="Affiliates" onClick={closeMobileMenu} />
        </>
    );

    const adminLinks = isAdmin && (
        <>
            <div className="nav-divider hide-mobile" />
            <span className="nav-section-label show-mobile">Admin</span>
            <NavLink href="/admin/scheduler" icon={<CalendarClock size={18} />} label="Scheduler" onClick={closeMobileMenu} />
            <NavLink href="/admin/notes" icon={<StickyNote size={18} />} label="Notes" onClick={closeMobileMenu} />
            <NavLink href="/admin/requests" icon={<FileEdit size={18} />} label="Requests" onClick={closeMobileMenu} />
            <NavLink href="/admin/analytics" icon={<BarChart3 size={18} />} label="Analytics" onClick={closeMobileMenu} />
            {isSuperAdmin && (
                <>
                    <NavLink href="/admin/users" icon={<UserIcon size={18} />} label="Users" onClick={closeMobileMenu} />
                    <NavLink href="/admin/audit" icon={<FileText size={18} />} label="Audit Log" onClick={closeMobileMenu} />
                </>
            )}
        </>
    );

    const settingsLinks = (
        <>
            <div className="nav-divider hide-mobile" />
            <NavLink href="/settings" icon={<Settings size={18} />} label="Settings" onClick={closeMobileMenu} />
        </>
    );

    return (
        <>
            <nav
                className="glass sticky-top"
                style={{ borderBottom: "1px solid var(--glass-border)", padding: "0.75rem 0", zIndex: 100 }}
                role="navigation"
                aria-label="Main navigation"
            >
                <div className="container flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2" aria-label="Nebo Rides Dashboard">
                        <img src="/logo.png" alt="" style={{ height: "32px", width: "auto" }} aria-hidden="true" />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="nav-links desktop hide-mobile">
                        {mainLinks}
                        {adminLinks}
                        {settingsLinks}
                        <div className="nav-divider" />
                        <button
                            onClick={() => signOut()}
                            className="nav-link"
                            aria-label="Sign out"
                        >
                            <LogOut size={18} />
                            <span>Logout</span>
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="mobile-menu-btn show-mobile"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-expanded={mobileMenuOpen}
                        aria-controls="mobile-nav"
                        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Navigation Overlay */}
            {mobileMenuOpen && (
                <div
                    className="mobile-nav-overlay open"
                    onClick={closeMobileMenu}
                    aria-hidden="true"
                />
            )}

            {/* Mobile Navigation Drawer */}
            <div
                id="mobile-nav"
                className={`mobile-nav-drawer ${mobileMenuOpen ? "open" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
            >
                <div className="flex items-center justify-between mb-6">
                    <span className="font-display text-lg">Menu</span>
                    <button
                        onClick={closeMobileMenu}
                        className="btn btn-ghost btn-icon"
                        aria-label="Close menu"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="nav-section-label">Main</span>
                    {mainLinks}
                    {adminLinks}
                    {settingsLinks}

                    <div className="nav-divider" style={{ margin: "1rem 0" }} />

                    <div className="flex items-center gap-3 px-2 py-2" style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        <UserIcon size={16} />
                        <span>{session.user.name || session.user.email}</span>
                    </div>

                    <button
                        onClick={() => {
                            signOut();
                            closeMobileMenu();
                        }}
                        className="nav-link"
                        style={{ color: "var(--danger)" }}
                    >
                        <LogOut size={18} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>

            <style jsx>{`
                .nav-links {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .nav-divider {
                    width: 1px;
                    height: 24px;
                    background: var(--border);
                    margin: 0 0.5rem;
                }

                .nav-section-label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 0.5rem 0;
                    margin-top: 0.5rem;
                }

                :global(.nav-link) {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                    text-decoration: none;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                }

                :global(.nav-link:hover) {
                    color: var(--text-primary);
                    background: rgba(255, 255, 255, 0.05);
                }

                :global(.nav-link-active) {
                    color: var(--accent);
                    background: rgba(183, 175, 163, 0.1);
                }

                .mobile-menu-btn {
                    display: none;
                    background: none;
                    border: none;
                    color: var(--text-primary);
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                }

                .mobile-menu-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                @media (max-width: 768px) {
                    .hide-mobile {
                        display: none !important;
                    }

                    .show-mobile {
                        display: flex !important;
                    }

                    .mobile-menu-btn {
                        display: flex;
                    }

                    .nav-divider {
                        width: 100%;
                        height: 1px;
                        margin: 0.5rem 0;
                    }
                }

                @media (min-width: 769px) {
                    .show-mobile {
                        display: none !important;
                    }
                }
            `}</style>
        </>
    );
}
