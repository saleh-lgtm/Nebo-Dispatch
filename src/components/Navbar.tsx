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
import styles from "./Navbar.module.css";

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
            className={isActive ? styles.navLinkActive : styles.navLink}
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
        <div className={styles.navDropdown} ref={dropdownRef}>
            <button
                className={`${isActive ? styles.navLinkActive : styles.navLink} ${styles.navDropdownTrigger}`}
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-haspopup="true"
            >
                {icon}
                <span>{label}</span>
                {badge && <span className={styles.navBadge}>{badge}</span>}
                <ChevronDown size={14} className={open ? styles.dropdownArrowOpen : styles.dropdownArrow} />
            </button>
            {open && (
                <div className={styles.navDropdownMenu}>
                    {children}
                </div>
            )}
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    const config = {
        SUPER_ADMIN: { label: "Admin", icon: <ShieldCheck size={10} />, className: styles.badgeSuperAdmin },
        ADMIN: { label: "Admin", icon: <Shield size={10} />, className: styles.badgeAdmin },
        ACCOUNTING: { label: "Accounting", icon: <Calculator size={10} />, className: styles.badgeAccounting },
        DISPATCHER: { label: "Dispatcher", icon: <Briefcase size={10} />, className: styles.badgeDispatcher },
    }[role] || { label: role, icon: null, className: styles.roleBadge };

    return (
        <span className={config.className}>
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
        <span className={styles.systemClock}>{time || "--:--"}</span>
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
                setIsLoggingOut(false);
                return;
            }

            // Clear any session-specific data before logout
            if (typeof window !== "undefined") {
                // Clear shift report draft dismissal flags
                Object.keys(sessionStorage).forEach((key) => {
                    if (key.includes("shift-report-draft") || key.includes("-dismissed")) {
                        sessionStorage.removeItem(key);
                    }
                });
            }

            // Properly configure signOut with redirect
            await signOut({
                callbackUrl: "/login",
                redirect: true
            });
        } catch (error) {
            console.error("Logout failed:", error);
            setLogoutError("Failed to logout. Please try again.");
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
                <div className={styles.logoutErrorToast} role="alert">
                    <AlertCircle size={18} />
                    <span>{logoutError}</span>
                    <button onClick={() => setLogoutError(null)} aria-label="Dismiss">
                        <X size={16} />
                    </button>
                </div>
            )}

            <nav className={styles.navbar} role="navigation" aria-label="Main navigation">
                <div className={styles.navbarInner}>
                    <div className={styles.navbarLeft}>
                        <Link href="/dashboard" className={styles.navbarBrand} aria-label="NeboOps Dashboard">
                            <span className={styles.brandName}>NeboOps</span>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <div className={styles.desktopNav}>
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
                                <div className={styles.navDivider} />
                                <NavDropdown
                                    label="Admin"
                                    icon={<Shield size={16} />}
                                    badge={isSuperAdmin ? "SA" : undefined}
                                >
                                    <div className={styles.dropdownSection}>
                                        <span className={styles.dropdownSectionLabel}>Scheduling</span>
                                        <NavLink href="/admin/scheduler" icon={<CalendarClock size={14} />} label="Dispatcher Scheduler" />
                                        <NavLink href="/admin/requests" icon={<FileEdit size={14} />} label="Pending Requests" />
                                    </div>
                                    <div className={styles.dropdownSection}>
                                        <span className={styles.dropdownSectionLabel}>Team Management</span>
                                        <NavLink href="/admin/tasks" icon={<CheckSquare size={14} />} label="Admin Tasks" />
                                        <NavLink href="/admin/notes" icon={<StickyNote size={14} />} label="Global Notes" />
                                        <NavLink href="/admin/sops" icon={<BookOpen size={14} />} label="Manage SOPs" />
                                        <NavLink href="/admin/reports" icon={<FileText size={14} />} label="Shift Reports" />
                                        <NavLink href="/admin/hours" icon={<Clock size={14} />} label="Hours Tracking" />
                                        <NavLink href="/admin/sms" icon={<MessageSquare size={14} />} label="SMS Dashboard" />
                                        <NavLink href="/admin/analytics" icon={<BarChart3 size={14} />} label="Analytics" />
                                    </div>
                                    {isSuperAdmin && (
                                        <div className={styles.dropdownSection}>
                                            <span className={styles.dropdownSectionLabel}>System</span>
                                            <NavLink href="/admin/users" icon={<UserCog size={14} />} label="User Management" />
                                            <NavLink href="/admin/audit" icon={<History size={14} />} label="Audit Log" />
                                        </div>
                                    )}
                                </NavDropdown>
                            </>
                        )}
                    </div>

                    <div className={styles.navbarRight}>
                        <LiveClock />
                        <div className={styles.navDivider} />
                        <NotificationBell />
                        <NavLink href="/settings" icon={<Settings size={16} />} label="Settings" />
                        <div className={styles.navDivider} />
                        <div className={styles.userSection}>
                            <span className={styles.userName}>{session.user.name?.split(' ')[0] || 'User'}</span>
                            <RoleBadge role={role} />
                        </div>
                        <button
                            onClick={handleLogout}
                            className={styles.logoutBtn}
                            aria-label="Sign out"
                            disabled={isLoggingOut}
                        >
                            <LogOut size={16} />
                        </button>

                        {/* Mobile Menu Button */}
                        <button
                            className={styles.mobileMenuBtn}
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
                <div className={styles.mobileNavOverlay} onClick={closeMobileMenu} aria-hidden="true" />
            )}

            {/* Mobile Navigation Drawer */}
            <div
                id="mobile-nav"
                className={mobileMenuOpen ? styles.mobileNavDrawerOpen : styles.mobileNavDrawer}
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
            >
                <div className={styles.mobileNavHeader}>
                    <div className={styles.mobileUserInfo}>
                        <div className={styles.mobileAvatar}>
                            {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.mobileUserDetails}>
                            <span className={styles.mobileUserName}>{session.user.name || "User"}</span>
                            <RoleBadge role={role} />
                        </div>
                    </div>
                    <button onClick={closeMobileMenu} className={styles.mobileCloseBtn} aria-label="Close menu">
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.mobileNavContent}>
                    <div className={styles.mobileNavSection}>
                        <span className={styles.mobileSectionLabel}>Operations</span>
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
                        <div className={styles.mobileNavSection}>
                            <span className={styles.mobileSectionLabel}>Accounting</span>
                            <NavLink href="/accounting" icon={<Calculator size={16} />} label="Accounting Dashboard" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {isAdmin && (
                        <div className={styles.mobileNavSection}>
                            <span className={styles.mobileSectionLabel}>Admin - Scheduling</span>
                            <NavLink href="/admin/scheduler" icon={<CalendarClock size={16} />} label="Dispatcher Scheduler" onClick={closeMobileMenu} />
                            <NavLink href="/admin/requests" icon={<FileEdit size={16} />} label="Pending Requests" onClick={closeMobileMenu} />
                        </div>
                    )}

                    {isAdmin && (
                        <div className={styles.mobileNavSection}>
                            <span className={styles.mobileSectionLabel}>Admin - Team</span>
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
                        <div className={styles.mobileNavSection}>
                            <span className={styles.mobileSectionLabel}>System</span>
                            <NavLink href="/admin/users" icon={<UserCog size={16} />} label="User Management" onClick={closeMobileMenu} />
                            <NavLink href="/admin/audit" icon={<History size={16} />} label="Audit Log" onClick={closeMobileMenu} />
                        </div>
                    )}

                    <div className={styles.mobileNavSection}>
                        <span className={styles.mobileSectionLabel}>Account</span>
                        <NavLink href="/settings" icon={<Settings size={16} />} label="Settings" onClick={closeMobileMenu} />
                        <button
                            onClick={() => {
                                handleLogout();
                                closeMobileMenu();
                            }}
                            className={styles.logoutBtn}
                            disabled={isLoggingOut}
                        >
                            <LogOut size={16} />
                            <span>{isLoggingOut ? "Signing out..." : "Sign Out"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
