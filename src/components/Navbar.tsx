"use client";

import { useState, useEffect, useRef } from "react";
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
    StickyNote,
    Settings,
    FileEdit,
    Menu,
    X,
    BarChart3,
    FileText,
    ChevronDown,
    Shield,
    ShieldCheck,
    Briefcase,
    History,
    UserCog,
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

interface DropdownProps {
    label: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    badge?: string;
}

function NavDropdown({ label, icon, children, badge }: DropdownProps) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    // Check if any child link is active
    const isActive = pathname.startsWith("/admin");

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close on route change
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    return (
        <div className="nav-dropdown" ref={dropdownRef}>
            <button
                className={`nav-link nav-dropdown-trigger ${isActive ? "nav-link-active" : ""}`}
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-haspopup="true"
            >
                {icon}
                <span>{label}</span>
                {badge && <span className="nav-badge">{badge}</span>}
                <ChevronDown size={14} className={`dropdown-arrow ${open ? "open" : ""}`} />
            </button>
            {open && (
                <div className="nav-dropdown-menu">
                    {children}
                </div>
            )}
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    const config = {
        SUPER_ADMIN: { label: "Super Admin", icon: <ShieldCheck size={12} />, className: "badge-super-admin" },
        ADMIN: { label: "Admin", icon: <Shield size={12} />, className: "badge-admin" },
        DISPATCHER: { label: "Dispatcher", icon: <Briefcase size={12} />, className: "badge-dispatcher" },
    }[role] || { label: role, icon: null, className: "" };

    return (
        <span className={`role-badge ${config.className}`}>
            {config.icon}
            <span>{config.label}</span>
        </span>
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

    const role = session.user.role;
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAdmin = role === "ADMIN" || isSuperAdmin;
    const isDispatcher = role === "DISPATCHER";

    const closeMobileMenu = () => setMobileMenuOpen(false);

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
                        {/* Common Links */}
                        <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
                        <NavLink href="/schedule" icon={<Calendar size={18} />} label="Schedule" />

                        {/* Dispatcher-only: Shift Report */}
                        {isDispatcher && (
                            <NavLink href="/reports/shift" icon={<ClipboardList size={18} />} label="Shift Report" />
                        )}

                        <NavLink href="/affiliates" icon={<Users size={18} />} label="Affiliates" />

                        {/* Admin Dropdown */}
                        {isAdmin && (
                            <>
                                <div className="nav-divider" />
                                <NavDropdown
                                    label="Admin"
                                    icon={<Shield size={18} />}
                                    badge={isSuperAdmin ? "SA" : undefined}
                                >
                                    <div className="dropdown-section">
                                        <span className="dropdown-section-label">Management</span>
                                        <NavLink href="/admin/scheduler" icon={<CalendarClock size={16} />} label="Scheduler" />
                                        <NavLink href="/admin/requests" icon={<FileEdit size={16} />} label="Requests" />
                                        <NavLink href="/admin/notes" icon={<StickyNote size={16} />} label="Notes" />
                                    </div>
                                    <div className="dropdown-section">
                                        <span className="dropdown-section-label">Reports</span>
                                        <NavLink href="/admin/reports" icon={<FileText size={16} />} label="Shift Reports" />
                                        <NavLink href="/admin/analytics" icon={<BarChart3 size={16} />} label="Analytics" />
                                    </div>
                                    {isSuperAdmin && (
                                        <div className="dropdown-section">
                                            <span className="dropdown-section-label">System</span>
                                            <NavLink href="/admin/users" icon={<UserCog size={16} />} label="User Management" />
                                            <NavLink href="/admin/audit" icon={<History size={16} />} label="Audit Log" />
                                        </div>
                                    )}
                                </NavDropdown>
                            </>
                        )}

                        <div className="nav-divider" />
                        <NavLink href="/settings" icon={<Settings size={18} />} label="Settings" />

                        <div className="nav-divider" />
                        <button
                            onClick={() => signOut()}
                            className="nav-link logout-btn"
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
                {/* User Info Header */}
                <div className="mobile-nav-header">
                    <div className="flex items-center gap-3">
                        <div className="avatar avatar-sm">
                            {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium" style={{ fontSize: "0.875rem" }}>
                                {session.user.name || "User"}
                            </span>
                            <RoleBadge role={role} />
                        </div>
                    </div>
                    <button
                        onClick={closeMobileMenu}
                        className="icon-btn"
                        aria-label="Close menu"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="mobile-nav-content">
                    {/* Main Section */}
                    <div className="mobile-nav-section">
                        <span className="nav-section-label">Main</span>
                        <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={closeMobileMenu} />
                        <NavLink href="/schedule" icon={<Calendar size={18} />} label="My Schedule" onClick={closeMobileMenu} />
                        {isDispatcher && (
                            <NavLink href="/reports/shift" icon={<ClipboardList size={18} />} label="Shift Report" onClick={closeMobileMenu} />
                        )}
                        <NavLink href="/affiliates" icon={<Users size={18} />} label="Affiliates" onClick={closeMobileMenu} />
                    </div>

                    {/* Admin Section */}
                    {isAdmin && (
                        <div className="mobile-nav-section">
                            <span className="nav-section-label">
                                <Shield size={12} />
                                Admin Tools
                            </span>
                            <NavLink href="/admin/scheduler" icon={<CalendarClock size={18} />} label="Scheduler" onClick={closeMobileMenu} />
                            <NavLink href="/admin/requests" icon={<FileEdit size={18} />} label="Requests" onClick={closeMobileMenu} />
                            <NavLink href="/admin/notes" icon={<StickyNote size={18} />} label="Notes" onClick={closeMobileMenu} />
                            <NavLink href="/admin/reports" icon={<FileText size={18} />} label="Shift Reports" onClick={closeMobileMenu} />
                            <NavLink href="/admin/analytics" icon={<BarChart3 size={18} />} label="Analytics" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {/* Super Admin Section */}
                    {isSuperAdmin && (
                        <div className="mobile-nav-section">
                            <span className="nav-section-label">
                                <ShieldCheck size={12} />
                                System
                            </span>
                            <NavLink href="/admin/users" icon={<UserCog size={18} />} label="User Management" onClick={closeMobileMenu} />
                            <NavLink href="/admin/audit" icon={<History size={18} />} label="Audit Log" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {/* Settings Section */}
                    <div className="mobile-nav-section">
                        <span className="nav-section-label">Account</span>
                        <NavLink href="/settings" icon={<Settings size={18} />} label="Settings" onClick={closeMobileMenu} />
                        <button
                            onClick={() => {
                                signOut();
                                closeMobileMenu();
                            }}
                            className="nav-link logout-btn"
                        >
                            <LogOut size={18} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .nav-links {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .nav-divider {
                    width: 1px;
                    height: 24px;
                    background: var(--border);
                    margin: 0 0.5rem;
                }

                .nav-section-label {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    padding: 0.5rem 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                /* Dropdown Styles */
                .nav-dropdown {
                    position: relative;
                }

                .nav-dropdown-trigger {
                    display: flex !important;
                    align-items: center !important;
                    gap: 0.5rem !important;
                }

                .dropdown-arrow {
                    transition: transform var(--transition-fast);
                    margin-left: 0.25rem;
                }

                .dropdown-arrow.open {
                    transform: rotate(180deg);
                }

                .nav-badge {
                    font-size: 0.625rem;
                    font-weight: 700;
                    background: var(--accent);
                    color: var(--bg-primary);
                    padding: 0.125rem 0.375rem;
                    border-radius: 0.25rem;
                    margin-left: 0.25rem;
                }

                .nav-dropdown-menu {
                    position: absolute;
                    top: calc(100% + 0.5rem);
                    right: 0;
                    min-width: 220px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 0.75rem;
                    padding: 0.5rem;
                    box-shadow: var(--shadow-lg);
                    animation: dropdownFadeIn 0.15s ease;
                    z-index: 50;
                }

                @keyframes dropdownFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .dropdown-section {
                    padding: 0.5rem 0;
                }

                .dropdown-section:not(:last-child) {
                    border-bottom: 1px solid var(--border);
                }

                .dropdown-section-label {
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    padding: 0.25rem 0.75rem 0.5rem;
                    display: block;
                }

                /* Role Badge */
                :global(.role-badge) {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.65rem;
                    font-weight: 600;
                    padding: 0.125rem 0.5rem;
                    border-radius: 0.25rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                :global(.badge-super-admin) {
                    background: rgba(239, 68, 68, 0.15);
                    color: var(--danger);
                }

                :global(.badge-admin) {
                    background: rgba(245, 158, 11, 0.15);
                    color: var(--warning);
                }

                :global(.badge-dispatcher) {
                    background: rgba(34, 197, 94, 0.15);
                    color: var(--success);
                }

                /* Nav Link Styles */
                :global(.nav-link) {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.875rem;
                    transition: all var(--transition-fast);
                    text-decoration: none;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                    position: relative;
                    white-space: nowrap;
                }

                :global(.nav-link:hover) {
                    color: var(--text-primary);
                    background: rgba(255, 255, 255, 0.08);
                }

                :global(.nav-link:active) {
                    transform: scale(0.98);
                }

                :global(.nav-link-active) {
                    color: var(--accent);
                    background: rgba(183, 175, 163, 0.12);
                }

                :global(.nav-link-active:hover) {
                    background: rgba(183, 175, 163, 0.18);
                }

                :global(.logout-btn:hover) {
                    color: var(--danger) !important;
                    background: var(--danger-glow) !important;
                }

                /* Mobile Styles */
                .mobile-menu-btn {
                    display: none;
                    background: none;
                    border: none;
                    color: var(--text-primary);
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    transition: all var(--transition-fast);
                }

                .mobile-menu-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                }

                .mobile-menu-btn:active {
                    transform: scale(0.95);
                }

                .mobile-nav-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--border);
                    margin-bottom: 1rem;
                }

                .mobile-nav-content {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .mobile-nav-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    padding-bottom: 0.5rem;
                }

                .mobile-nav-section:not(:last-child) {
                    border-bottom: 1px solid var(--border);
                    margin-bottom: 0.5rem;
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
