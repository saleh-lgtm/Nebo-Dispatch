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
    CheckSquare,
    BookOpen,
    Clock,
    Calculator,
} from "lucide-react";
import NotificationBell from "./NotificationBell";

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
    activePrefix?: string | string[];
}

function NavDropdown({ label, icon, children, badge, activePrefix = "/admin" }: DropdownProps) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    const prefixes = Array.isArray(activePrefix) ? activePrefix : [activePrefix];
    const isActive = prefixes.some(prefix => pathname.startsWith(prefix));

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
        ACCOUNTING: { label: "Accounting", icon: <Calculator size={12} />, className: "badge-accounting" },
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

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

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
    const isAccounting = role === "ACCOUNTING";
    const hasAccountingAccess = isAccounting || isAdmin;
    const isDispatcher = role === "DISPATCHER";

    const closeMobileMenu = () => setMobileMenuOpen(false);

    return (
        <>
            <nav className="navbar" role="navigation" aria-label="Main navigation">
                <div className="navbar-inner">
                    <Link href="/dashboard" className="navbar-brand" aria-label="Nebo Rides Dashboard">
                        <img src="/logo.png" alt="" className="brand-logo" aria-hidden="true" />
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="nav-links desktop-nav">
                        <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />

                        {!isSuperAdmin && (
                            <>
                                <NavLink href="/schedule" icon={<Calendar size={18} />} label="Schedule" />
                                {isDispatcher && (
                                    <NavLink href="/reports/shift" icon={<ClipboardList size={18} />} label="Shift Report" />
                                )}
                            </>
                        )}

                        <NavLink href="/affiliates" icon={<Users size={18} />} label="Affiliates" />
                        <NavLink href="/sops" icon={<BookOpen size={18} />} label="SOPs" />

                        {hasAccountingAccess && (
                            <NavLink href="/accounting" icon={<Calculator size={18} />} label="Accounting" />
                        )}

                        {isAdmin && (
                            <>
                                <div className="nav-divider" />
                                <NavDropdown
                                    label="Admin"
                                    icon={<Shield size={18} />}
                                    badge={isSuperAdmin ? "SA" : undefined}
                                >
                                    <div className="dropdown-section">
                                        <span className="dropdown-section-label">Scheduling</span>
                                        <NavLink href="/admin/scheduler" icon={<CalendarClock size={16} />} label="Dispatcher Scheduler" />
                                        <NavLink href="/admin/requests" icon={<FileEdit size={16} />} label="Pending Requests" />
                                    </div>
                                    <div className="dropdown-section">
                                        <span className="dropdown-section-label">Team</span>
                                        <NavLink href="/admin/tasks" icon={<CheckSquare size={16} />} label="Admin Tasks" />
                                        <NavLink href="/admin/notes" icon={<StickyNote size={16} />} label="Global Notes" />
                                        <NavLink href="/admin/sops" icon={<BookOpen size={16} />} label="Manage SOPs" />
                                        <NavLink href="/admin/reports" icon={<FileText size={16} />} label="Shift Reports" />
                                        <NavLink href="/admin/hours" icon={<Clock size={16} />} label="Hours Tracking" />
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
                        <NotificationBell />
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
                        className="mobile-menu-btn"
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
                <div className="mobile-nav-overlay" onClick={closeMobileMenu} aria-hidden="true" />
            )}

            {/* Mobile Navigation Drawer */}
            <div
                id="mobile-nav"
                className={`mobile-nav-drawer ${mobileMenuOpen ? "open" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
            >
                <div className="mobile-nav-header">
                    <div className="mobile-user-info">
                        <div className="mobile-avatar">
                            {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className="mobile-user-details">
                            <span className="mobile-user-name">{session.user.name || "User"}</span>
                            <RoleBadge role={role} />
                        </div>
                    </div>
                    <button onClick={closeMobileMenu} className="mobile-close-btn" aria-label="Close menu">
                        <X size={20} />
                    </button>
                </div>

                <div className="mobile-nav-content">
                    <div className="mobile-nav-section">
                        <span className="mobile-section-label">Main</span>
                        <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" onClick={closeMobileMenu} />
                        {!isSuperAdmin && (
                            <NavLink href="/schedule" icon={<Calendar size={18} />} label="My Schedule" onClick={closeMobileMenu} />
                        )}
                        {isDispatcher && (
                            <NavLink href="/reports/shift" icon={<ClipboardList size={18} />} label="Shift Report" onClick={closeMobileMenu} />
                        )}
                        <NavLink href="/affiliates" icon={<Users size={18} />} label="Affiliates" onClick={closeMobileMenu} />
                        <NavLink href="/sops" icon={<BookOpen size={18} />} label="SOPs" onClick={closeMobileMenu} />
                    </div>

                    {hasAccountingAccess && (
                        <div className="mobile-nav-section">
                            <span className="mobile-section-label">
                                <Calculator size={12} />
                                Accounting
                            </span>
                            <NavLink href="/accounting" icon={<Calculator size={18} />} label="Accounting Dashboard" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {isAdmin && (
                        <div className="mobile-nav-section">
                            <span className="mobile-section-label">
                                <Shield size={12} />
                                Admin - Scheduling
                            </span>
                            <NavLink href="/admin/scheduler" icon={<CalendarClock size={18} />} label="Dispatcher Scheduler" onClick={closeMobileMenu} />
                            <NavLink href="/admin/requests" icon={<FileEdit size={18} />} label="Pending Requests" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {isAdmin && (
                        <div className="mobile-nav-section">
                            <span className="mobile-section-label">
                                <Shield size={12} />
                                Admin - Team
                            </span>
                            <NavLink href="/admin/tasks" icon={<CheckSquare size={18} />} label="Admin Tasks" onClick={closeMobileMenu} />
                            <NavLink href="/admin/notes" icon={<StickyNote size={18} />} label="Global Notes" onClick={closeMobileMenu} />
                            <NavLink href="/admin/sops" icon={<BookOpen size={18} />} label="Manage SOPs" onClick={closeMobileMenu} />
                            <NavLink href="/admin/reports" icon={<FileText size={18} />} label="Shift Reports" onClick={closeMobileMenu} />
                            <NavLink href="/admin/hours" icon={<Clock size={18} />} label="Hours Tracking" onClick={closeMobileMenu} />
                            <NavLink href="/admin/analytics" icon={<BarChart3 size={18} />} label="Analytics" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {isSuperAdmin && (
                        <div className="mobile-nav-section">
                            <span className="mobile-section-label">
                                <ShieldCheck size={12} />
                                System
                            </span>
                            <NavLink href="/admin/users" icon={<UserCog size={18} />} label="User Management" onClick={closeMobileMenu} />
                            <NavLink href="/admin/audit" icon={<History size={18} />} label="Audit Log" onClick={closeMobileMenu} />
                        </div>
                    )}

                    <div className="mobile-nav-section">
                        <span className="mobile-section-label">Account</span>
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
                /* Navbar Base */
                .navbar {
                    background: var(--bg-card);
                    border-bottom: 1px solid var(--border);
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                .navbar-inner {
                    max-width: 1500px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .navbar-brand {
                    display: flex;
                    align-items: center;
                }

                .brand-logo {
                    height: 32px;
                    width: auto;
                }

                /* Desktop Navigation */
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

                /* Nav Link Styles */
                :global(.nav-link) {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.8125rem;
                    transition: all 0.15s ease;
                    text-decoration: none;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                    white-space: nowrap;
                }

                :global(.nav-link:hover) {
                    color: var(--text-primary);
                    background: var(--bg-hover);
                }

                :global(.nav-link-active) {
                    color: var(--primary);
                    background: var(--primary-soft);
                }

                :global(.nav-link-active:hover) {
                    background: var(--primary-soft);
                }

                :global(.logout-btn:hover) {
                    color: var(--danger) !important;
                    background: var(--danger-bg) !important;
                }

                /* Dropdown */
                .nav-dropdown {
                    position: relative;
                }

                .nav-dropdown-trigger {
                    display: flex !important;
                    align-items: center !important;
                    gap: 0.5rem !important;
                }

                .dropdown-arrow {
                    transition: transform 0.15s ease;
                    margin-left: 0.25rem;
                }

                .dropdown-arrow.open {
                    transform: rotate(180deg);
                }

                .nav-badge {
                    font-size: 0.625rem;
                    font-weight: 700;
                    background: var(--primary);
                    color: white;
                    padding: 0.125rem 0.375rem;
                    border-radius: 0.25rem;
                    margin-left: 0.25rem;
                }

                .nav-dropdown-menu {
                    position: absolute;
                    top: calc(100% + 0.5rem);
                    right: 0;
                    min-width: 240px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 0.5rem;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    animation: dropdownFade 0.15s ease;
                    z-index: 50;
                }

                @keyframes dropdownFade {
                    from {
                        opacity: 0;
                        transform: translateY(-4px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .dropdown-section {
                    padding: 0.375rem 0;
                }

                .dropdown-section:not(:last-child) {
                    border-bottom: 1px solid var(--border);
                }

                .dropdown-section-label {
                    font-size: 0.625rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    padding: 0.25rem 0.75rem 0.375rem;
                    display: block;
                }

                /* Role Badge */
                :global(.role-badge) {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.625rem;
                    font-weight: 600;
                    padding: 0.125rem 0.5rem;
                    border-radius: 0.25rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                :global(.badge-super-admin) {
                    background: var(--danger-bg);
                    color: var(--danger);
                }

                :global(.badge-admin) {
                    background: var(--warning-bg);
                    color: var(--warning);
                }

                :global(.badge-dispatcher) {
                    background: var(--success-bg);
                    color: var(--success);
                }

                :global(.badge-accounting) {
                    background: rgba(168, 85, 247, 0.15);
                    color: #c084fc;
                }

                /* Mobile Menu Button */
                .mobile-menu-btn {
                    display: none;
                    background: none;
                    border: none;
                    color: var(--text-primary);
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: var(--radius-md);
                    transition: background 0.15s ease;
                }

                .mobile-menu-btn:hover {
                    background: var(--bg-hover);
                }

                /* Mobile Overlay */
                .mobile-nav-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 150;
                    animation: fadeIn 0.2s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                /* Mobile Drawer */
                .mobile-nav-drawer {
                    position: fixed;
                    top: 0;
                    right: 0;
                    width: 300px;
                    max-width: 85vw;
                    height: 100vh;
                    background: var(--bg-primary);
                    border-left: 1px solid var(--border);
                    z-index: 200;
                    transform: translateX(100%);
                    transition: transform 0.25s ease;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                }

                .mobile-nav-drawer.open {
                    transform: translateX(0);
                }

                .mobile-nav-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem;
                    border-bottom: 1px solid var(--border);
                }

                .mobile-user-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .mobile-avatar {
                    width: 40px;
                    height: 40px;
                    background: var(--primary-soft);
                    color: var(--primary);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 1rem;
                }

                .mobile-user-details {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .mobile-user-name {
                    font-weight: 600;
                    font-size: 0.875rem;
                    color: var(--text-primary);
                }

                .mobile-close-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: var(--radius-md);
                    transition: all 0.15s ease;
                }

                .mobile-close-btn:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .mobile-nav-content {
                    flex: 1;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .mobile-nav-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    padding-bottom: 0.75rem;
                }

                .mobile-nav-section:not(:last-child) {
                    border-bottom: 1px solid var(--border);
                    margin-bottom: 0.75rem;
                }

                .mobile-section-label {
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    padding: 0.375rem 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                /* Responsive */
                @media (max-width: 900px) {
                    .desktop-nav {
                        display: none !important;
                    }

                    .mobile-menu-btn {
                        display: flex;
                    }
                }
            `}</style>
        </>
    );
}
