"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    MessageSquare,
    AlertCircle,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import ClockButton from "./ClockButton";
import { canLogout } from "@/lib/clockActions";

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
        SUPER_ADMIN: { label: "Admin", icon: <ShieldCheck size={10} />, className: "badge-super-admin" },
        ADMIN: { label: "Admin", icon: <Shield size={10} />, className: "badge-admin" },
        ACCOUNTING: { label: "Accounting", icon: <Calculator size={10} />, className: "badge-accounting" },
        DISPATCHER: { label: "Dispatcher", icon: <Briefcase size={10} />, className: "badge-dispatcher" },
    }[role] || { label: role, icon: null, className: "" };

    return (
        <span className={`role-badge ${config.className}`}>
            {config.icon}
            <span>{config.label}</span>
        </span>
    );
}

// Live clock component
function LiveClock() {
    const [time, setTime] = useState<string>("");

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            }));
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <span className="system-clock">{time || "--:--"}</span>
    );
}

export default function Navbar() {
    const { data: session } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [logoutError, setLogoutError] = useState<string | null>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

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

    // Clear logout error after 5 seconds
    useEffect(() => {
        if (logoutError) {
            const timer = setTimeout(() => setLogoutError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [logoutError]);

    const handleLogout = useCallback(async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);
        setLogoutError(null);

        try {
            const result = await canLogout();

            if (!result.allowed) {
                setLogoutError(result.reason || "Cannot logout at this time");
                // Redirect to shift report if they have an active shift
                if (result.hasActiveShift && !result.hasSubmittedReport) {
                    router.push("/reports/shift");
                }
                return;
            }

            await signOut();
        } catch (error) {
            console.error("Logout check failed:", error);
            // On error, allow logout anyway
            await signOut();
        } finally {
            setIsLoggingOut(false);
        }
    }, [isLoggingOut, router]);

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
            {/* Logout Error Toast */}
            {logoutError && (
                <div className="logout-error-toast" role="alert">
                    <AlertCircle size={18} />
                    <span>{logoutError}</span>
                    <button onClick={() => setLogoutError(null)} aria-label="Dismiss">
                        <X size={16} />
                    </button>
                </div>
            )}

            <nav className="navbar" role="navigation" aria-label="Main navigation">
                <div className="navbar-inner">
                    <div className="navbar-left">
                        <Link href="/dashboard" className="navbar-brand" aria-label="NeboOps Dashboard">
                            <span className="brand-name">NeboOps</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="nav-links desktop-nav">
                        <NavLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" />

                        {!isSuperAdmin && (
                            <>
                                <NavLink href="/schedule" icon={<Calendar size={16} />} label="Schedule" />
                                {isDispatcher && (
                                    <>
                                        <ClockButton />
                                        <NavLink href="/reports/shift" icon={<ClipboardList size={16} />} label="Report" />
                                    </>
                                )}
                            </>
                        )}

                        <NavLink href="/affiliates" icon={<Users size={16} />} label="Affiliates" />
                        <NavLink href="/sops" icon={<BookOpen size={16} />} label="SOPs" />
                        <NavLink href="/sms" icon={<MessageSquare size={16} />} label="SMS" />

                        {hasAccountingAccess && (
                            <NavLink href="/accounting" icon={<Calculator size={16} />} label="Accounting" />
                        )}

                        {isAdmin && (
                            <>
                                <div className="nav-divider" />
                                <NavDropdown
                                    label="Admin"
                                    icon={<Shield size={16} />}
                                    badge={isSuperAdmin ? "SA" : undefined}
                                >
                                    <div className="dropdown-section">
                                        <span className="dropdown-section-label">Scheduling</span>
                                        <NavLink href="/admin/scheduler" icon={<CalendarClock size={14} />} label="Dispatcher Scheduler" />
                                        <NavLink href="/admin/requests" icon={<FileEdit size={14} />} label="Pending Requests" />
                                    </div>
                                    <div className="dropdown-section">
                                        <span className="dropdown-section-label">Team Management</span>
                                        <NavLink href="/admin/tasks" icon={<CheckSquare size={14} />} label="Admin Tasks" />
                                        <NavLink href="/admin/notes" icon={<StickyNote size={14} />} label="Global Notes" />
                                        <NavLink href="/admin/sops" icon={<BookOpen size={14} />} label="Manage SOPs" />
                                        <NavLink href="/admin/reports" icon={<FileText size={14} />} label="Shift Reports" />
                                        <NavLink href="/admin/hours" icon={<Clock size={14} />} label="Hours Tracking" />
                                        <NavLink href="/admin/sms" icon={<MessageSquare size={14} />} label="SMS Dashboard" />
                                        <NavLink href="/admin/analytics" icon={<BarChart3 size={14} />} label="Analytics" />
                                    </div>
                                    {isSuperAdmin && (
                                        <div className="dropdown-section">
                                            <span className="dropdown-section-label">System</span>
                                            <NavLink href="/admin/users" icon={<UserCog size={14} />} label="User Management" />
                                            <NavLink href="/admin/audit" icon={<History size={14} />} label="Audit Log" />
                                        </div>
                                    )}
                                </NavDropdown>
                            </>
                        )}
                    </div>

                    <div className="navbar-right">
                        <LiveClock />
                        <div className="nav-divider" />
                        <NotificationBell />
                        <NavLink href="/settings" icon={<Settings size={16} />} label="Settings" />
                        <div className="nav-divider" />
                        <div className="user-section">
                            <span className="user-name">{session.user.name?.split(' ')[0] || 'User'}</span>
                            <RoleBadge role={role} />
                        </div>
                        <button
                            onClick={handleLogout}
                            className="nav-link logout-btn"
                            aria-label="Sign out"
                            disabled={isLoggingOut}
                        >
                            <LogOut size={16} />
                        </button>

                        {/* Mobile Menu Button */}
                        <button
                            className="mobile-menu-btn"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-expanded={mobileMenuOpen}
                            aria-controls="mobile-nav"
                            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                        >
                            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
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
                        <span className="mobile-section-label">Operations</span>
                        <NavLink href="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" onClick={closeMobileMenu} />
                        {!isSuperAdmin && (
                            <NavLink href="/schedule" icon={<Calendar size={16} />} label="My Schedule" onClick={closeMobileMenu} />
                        )}
                        {isDispatcher && (
                            <NavLink href="/reports/shift" icon={<ClipboardList size={16} />} label="Shift Report" onClick={closeMobileMenu} />
                        )}
                        <NavLink href="/affiliates" icon={<Users size={16} />} label="Affiliates" onClick={closeMobileMenu} />
                        <NavLink href="/sops" icon={<BookOpen size={16} />} label="SOPs" onClick={closeMobileMenu} />
                        <NavLink href="/sms" icon={<MessageSquare size={16} />} label="SMS" onClick={closeMobileMenu} />
                    </div>

                    {hasAccountingAccess && (
                        <div className="mobile-nav-section">
                            <span className="mobile-section-label">Accounting</span>
                            <NavLink href="/accounting" icon={<Calculator size={16} />} label="Accounting Dashboard" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {isAdmin && (
                        <div className="mobile-nav-section">
                            <span className="mobile-section-label">Admin - Scheduling</span>
                            <NavLink href="/admin/scheduler" icon={<CalendarClock size={16} />} label="Dispatcher Scheduler" onClick={closeMobileMenu} />
                            <NavLink href="/admin/requests" icon={<FileEdit size={16} />} label="Pending Requests" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {isAdmin && (
                        <div className="mobile-nav-section">
                            <span className="mobile-section-label">Admin - Team</span>
                            <NavLink href="/admin/tasks" icon={<CheckSquare size={16} />} label="Admin Tasks" onClick={closeMobileMenu} />
                            <NavLink href="/admin/notes" icon={<StickyNote size={16} />} label="Global Notes" onClick={closeMobileMenu} />
                            <NavLink href="/admin/sops" icon={<BookOpen size={16} />} label="Manage SOPs" onClick={closeMobileMenu} />
                            <NavLink href="/admin/reports" icon={<FileText size={16} />} label="Shift Reports" onClick={closeMobileMenu} />
                            <NavLink href="/admin/hours" icon={<Clock size={16} />} label="Hours Tracking" onClick={closeMobileMenu} />
                            <NavLink href="/admin/sms" icon={<MessageSquare size={16} />} label="SMS Dashboard" onClick={closeMobileMenu} />
                            <NavLink href="/admin/analytics" icon={<BarChart3 size={16} />} label="Analytics" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {isSuperAdmin && (
                        <div className="mobile-nav-section">
                            <span className="mobile-section-label">System</span>
                            <NavLink href="/admin/users" icon={<UserCog size={16} />} label="User Management" onClick={closeMobileMenu} />
                            <NavLink href="/admin/audit" icon={<History size={16} />} label="Audit Log" onClick={closeMobileMenu} />
                        </div>
                    )}

                    <div className="mobile-nav-section">
                        <span className="mobile-section-label">Account</span>
                        <NavLink href="/settings" icon={<Settings size={16} />} label="Settings" onClick={closeMobileMenu} />
                        <button
                            onClick={() => {
                                handleLogout();
                                closeMobileMenu();
                            }}
                            className="nav-link logout-btn"
                            disabled={isLoggingOut}
                        >
                            <LogOut size={16} />
                            <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                /* Logout Error Toast */
                .logout-error-toast {
                    position: fixed;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--danger-soft);
                    border: 1px solid var(--danger-border);
                    color: var(--danger);
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 0.875rem;
                    z-index: 1000;
                    box-shadow: var(--shadow-lg);
                    animation: slideDown 0.3s ease;
                    max-width: 90%;
                }

                .logout-error-toast button {
                    background: none;
                    border: none;
                    color: var(--danger);
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: var(--radius-sm);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                    transition: opacity 0.15s ease;
                }

                .logout-error-toast button:hover {
                    opacity: 1;
                }

                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }

                /* Navbar Base */
                .navbar {
                    background: var(--bg-card);
                    border-bottom: 1px solid var(--border);
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                .navbar-inner {
                    max-width: 1600px;
                    margin: 0 auto;
                    padding: 0 1.5rem;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .navbar-left {
                    display: flex;
                    align-items: center;
                }

                .navbar-brand {
                    display: flex;
                    align-items: center;
                    text-decoration: none;
                }

                .brand-name {
                    font-family: var(--font-display);
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--accent);
                }

                .navbar-right {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .user-section {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.375rem 0.75rem;
                }

                .user-name {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .system-clock {
                    font-family: var(--font-mono);
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    padding: 0.375rem 0.75rem;
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
                    font-family: var(--font-sans);
                    font-weight: 500;
                    font-size: 0.875rem;
                    transition: all 0.15s ease;
                    text-decoration: none;
                    background: none;
                    border: none;
                    cursor: pointer;
                    white-space: nowrap;
                }

                :global(.nav-link:hover) {
                    color: var(--text-primary);
                    background: var(--bg-hover);
                }

                :global(.nav-link-active) {
                    color: var(--accent);
                    background: var(--accent-soft);
                }

                :global(.nav-link-active:hover) {
                    background: var(--accent-soft);
                }

                :global(.logout-btn:hover) {
                    color: var(--danger) !important;
                    background: var(--danger-soft) !important;
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
                    opacity: 0.6;
                }

                .dropdown-arrow.open {
                    transform: rotate(180deg);
                }

                .nav-badge {
                    font-family: var(--font-mono);
                    font-size: 0.625rem;
                    font-weight: 600;
                    background: var(--danger);
                    color: white;
                    padding: 0.125rem 0.375rem;
                    border-radius: var(--radius-sm);
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
                    box-shadow: var(--shadow-lg);
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
                    margin-bottom: 0.375rem;
                }

                .dropdown-section-label {
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 0.375rem 0.75rem;
                    display: block;
                }

                /* Role Badge */
                :global(.role-badge) {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.6875rem;
                    font-weight: 500;
                    padding: 0.25rem 0.5rem;
                    border-radius: var(--radius-sm);
                }

                :global(.badge-super-admin) {
                    background: var(--danger-soft);
                    color: var(--danger);
                }

                :global(.badge-admin) {
                    background: var(--warning-soft);
                    color: #9A6B1F;
                }

                :global(.badge-dispatcher) {
                    background: var(--success-soft);
                    color: var(--success);
                }

                :global(.badge-accounting) {
                    background: var(--info-soft);
                    color: var(--info);
                }

                /* Mobile Menu Button */
                .mobile-menu-btn {
                    display: none;
                    background: transparent;
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                    cursor: pointer;
                    padding: 0.5rem;
                    border-radius: var(--radius-md);
                    transition: all 0.15s ease;
                }

                .mobile-menu-btn:hover {
                    background: var(--bg-hover);
                }

                /* Mobile Overlay */
                .mobile-nav-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(30, 36, 48, 0.5);
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
                    background: var(--bg-card);
                    border-left: 1px solid var(--border);
                    z-index: 200;
                    transform: translateX(100%);
                    transition: transform 0.25s ease;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    box-shadow: var(--shadow-xl);
                }

                .mobile-nav-drawer.open {
                    transform: translateX(0);
                }

                .mobile-nav-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--border);
                    background: var(--bg-muted);
                }

                .mobile-user-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .mobile-avatar {
                    width: 40px;
                    height: 40px;
                    background: var(--accent-soft);
                    color: var(--accent);
                    border-radius: var(--radius-md);
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
                    font-size: 0.9375rem;
                    color: var(--text-primary);
                }

                .mobile-close-btn {
                    background: transparent;
                    border: 1px solid var(--border);
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
                    margin-bottom: 0.5rem;
                }

                .mobile-section-label {
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 0.375rem 0.5rem;
                }

                /* Responsive */
                @media (max-width: 1100px) {
                    .desktop-nav {
                        display: none !important;
                    }

                    .user-section {
                        display: none;
                    }

                    .system-clock {
                        display: none;
                    }

                    .mobile-menu-btn {
                        display: flex;
                    }
                }
            `}</style>
        </>
    );
}
