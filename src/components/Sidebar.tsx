"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    LayoutDashboard,
    CalendarClock,
    Calendar,
    FileEdit,
    Users,
    UserCog,
    UserPlus,
    Clock,
    Phone,
    CheckSquare,
    StickyNote,
    MessageSquare,
    Car,
    Network,
    BookOpen,
    FileText,
    BarChart3,
    Calculator,
    History,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Menu,
    X,
    ShieldCheck,
    Shield,
    Briefcase,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import ClockButton from "./ClockButton";
import styles from "./Sidebar.module.css";

interface NavItemProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    collapsed: boolean;
    onClick?: () => void;
}

function NavItem({ href, icon, label, collapsed, onClick }: NavItemProps) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(href + "/");

    return (
        <Link
            href={href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            title={collapsed ? label : undefined}
            onClick={onClick}
        >
            <span className={styles.navIcon}>{icon}</span>
            <span className={styles.navLabel}>{label}</span>
        </Link>
    );
}

interface NavGroupProps {
    title: string;
    children: React.ReactNode;
    collapsed: boolean;
}

function NavGroup({ title, children, collapsed }: NavGroupProps) {
    return (
        <div className={styles.navGroup}>
            {!collapsed && <span className={styles.navGroupTitle}>{title}</span>}
            {collapsed && <div className={styles.navGroupDivider} />}
            <div className={styles.navGroupItems}>{children}</div>
        </div>
    );
}

interface Props {
    user: {
        name?: string | null;
        email?: string | null;
        role?: string;
    };
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof ShieldCheck; color: string }> = {
    SUPER_ADMIN: { label: "Super Admin", icon: ShieldCheck, color: "#ef4444" },
    ADMIN: { label: "Admin", icon: Shield, color: "#f59e0b" },
    ACCOUNTING: { label: "Accounting", icon: Calculator, color: "#3b82f6" },
    DISPATCHER: { label: "Dispatcher", icon: Briefcase, color: "#22c55e" },
};

export default function Sidebar({ user }: Props) {
    const role = user.role || "DISPATCHER";
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAccounting = role === "ACCOUNTING";
    const isAdmin = role === "ADMIN" || isSuperAdmin;
    const isDispatcher = role === "DISPATCHER";
    const hasAccountingAccess = isAccounting || isAdmin;
    const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.DISPATCHER;
    const RoleIcon = roleConfig.icon;

    const [collapsed, setCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (mobile) setCollapsed(true);
        };
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Load collapsed state from localStorage
    useEffect(() => {
        if (!isMobile) {
            const saved = localStorage.getItem("sidebar-collapsed");
            if (saved !== null) {
                setCollapsed(saved === "true");
            }
        }
    }, [isMobile]);

    const toggleCollapsed = useCallback(() => {
        const newState = !collapsed;
        setCollapsed(newState);
        if (!isMobile) {
            localStorage.setItem("sidebar-collapsed", String(newState));
        }
    }, [collapsed, isMobile]);

    const closeMobileMenu = () => setMobileOpen(false);

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/login", redirect: true });
    };

    const sidebarContent = (
        <>
            {/* Header */}
            <div className={styles.header}>
                <Link href="/dashboard" className={styles.brand} onClick={isMobile ? closeMobileMenu : undefined}>
                    <span className={styles.brandText}>NeboOps</span>
                </Link>
                {!isMobile && (
                    <button
                        onClick={toggleCollapsed}
                        className={styles.collapseBtn}
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                )}
            </div>

            {/* User Card */}
            <div className={styles.userCard}>
                <div className={styles.userAvatar} style={{ backgroundColor: roleConfig.color }}>
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                    <span className={styles.userName}>{user.name || "User"}</span>
                    <span className={styles.userRole}>
                        <RoleIcon size={10} />
                        {roleConfig.label}
                    </span>
                </div>
                <div className={styles.userActions}>
                    <NotificationBell />
                </div>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                {/* Dashboard - Always visible */}
                <NavGroup title="Dashboard" collapsed={collapsed}>
                    <NavItem
                        href="/dashboard"
                        icon={<LayoutDashboard size={18} />}
                        label="Overview"
                        collapsed={collapsed}
                        onClick={isMobile ? closeMobileMenu : undefined}
                    />
                </NavGroup>

                {/* Scheduling */}
                <NavGroup title="Scheduling" collapsed={collapsed}>
                    {isDispatcher && (
                        <>
                            <NavItem
                                href="/schedule"
                                icon={<Calendar size={18} />}
                                label="My Schedule"
                                collapsed={collapsed}
                                onClick={isMobile ? closeMobileMenu : undefined}
                            />
                            <div className={styles.clockWrapper}>
                                <ClockButton />
                            </div>
                            <NavItem
                                href="/reports/shift"
                                icon={<ClipboardList size={18} />}
                                label="Shift Report"
                                collapsed={collapsed}
                                onClick={isMobile ? closeMobileMenu : undefined}
                            />
                        </>
                    )}
                    {isAdmin && (
                        <>
                            <NavItem
                                href="/admin/scheduler"
                                icon={<CalendarClock size={18} />}
                                label="Schedule Builder"
                                collapsed={collapsed}
                                onClick={isMobile ? closeMobileMenu : undefined}
                            />
                            <NavItem
                                href="/admin/requests"
                                icon={<FileEdit size={18} />}
                                label="Time Off & Swaps"
                                collapsed={collapsed}
                                onClick={isMobile ? closeMobileMenu : undefined}
                            />
                        </>
                    )}
                </NavGroup>

                {/* People & Team */}
                {isAdmin && (
                    <NavGroup title="People" collapsed={collapsed}>
                        {isSuperAdmin && (
                            <NavItem
                                href="/admin/users"
                                icon={<UserCog size={18} />}
                                label="User Management"
                                collapsed={collapsed}
                                onClick={isMobile ? closeMobileMenu : undefined}
                            />
                        )}
                        <NavItem
                            href="/admin/approvals"
                            icon={<UserPlus size={18} />}
                            label="Approvals"
                            collapsed={collapsed}
                            onClick={isMobile ? closeMobileMenu : undefined}
                        />
                        <NavItem
                            href="/admin/hours"
                            icon={<Clock size={18} />}
                            label="Hours Tracking"
                            collapsed={collapsed}
                            onClick={isMobile ? closeMobileMenu : undefined}
                        />
                        <NavItem
                            href="/admin/confirmations"
                            icon={<Phone size={18} />}
                            label="Confirmations"
                            collapsed={collapsed}
                            onClick={isMobile ? closeMobileMenu : undefined}
                        />
                        <NavItem
                            href="/admin/tasks"
                            icon={<CheckSquare size={18} />}
                            label="Admin Tasks"
                            collapsed={collapsed}
                            onClick={isMobile ? closeMobileMenu : undefined}
                        />
                        <NavItem
                            href="/admin/notes"
                            icon={<StickyNote size={18} />}
                            label="Global Notes"
                            collapsed={collapsed}
                            onClick={isMobile ? closeMobileMenu : undefined}
                        />
                    </NavGroup>
                )}

                {/* Communications */}
                <NavGroup title="Communications" collapsed={collapsed}>
                    <NavItem
                        href="/sms"
                        icon={<MessageSquare size={18} />}
                        label="SMS Center"
                        collapsed={collapsed}
                        onClick={isMobile ? closeMobileMenu : undefined}
                    />
                    {isAdmin && (
                        <NavItem
                            href="/admin/sms"
                            icon={<MessageSquare size={18} />}
                            label="SMS Dashboard"
                            collapsed={collapsed}
                            onClick={isMobile ? closeMobileMenu : undefined}
                        />
                    )}
                </NavGroup>

                {/* Operations */}
                <NavGroup title="Operations" collapsed={collapsed}>
                    <NavItem
                        href="/fleet"
                        icon={<Car size={18} />}
                        label="Fleet"
                        collapsed={collapsed}
                        onClick={isMobile ? closeMobileMenu : undefined}
                    />
                    <NavItem
                        href="/network"
                        icon={<Network size={18} />}
                        label="Network"
                        collapsed={collapsed}
                        onClick={isMobile ? closeMobileMenu : undefined}
                    />
                    <NavItem
                        href="/affiliates"
                        icon={<Users size={18} />}
                        label="Affiliates"
                        collapsed={collapsed}
                        onClick={isMobile ? closeMobileMenu : undefined}
                    />
                    <NavItem
                        href={isAdmin ? "/admin/sops" : "/sops"}
                        icon={<BookOpen size={18} />}
                        label="SOPs"
                        collapsed={collapsed}
                        onClick={isMobile ? closeMobileMenu : undefined}
                    />
                </NavGroup>

                {/* Reports & Analytics */}
                {(isAdmin || hasAccountingAccess) && (
                    <NavGroup title="Reports" collapsed={collapsed}>
                        {isAdmin && (
                            <>
                                <NavItem
                                    href="/admin/reports"
                                    icon={<FileText size={18} />}
                                    label="Shift Reports"
                                    collapsed={collapsed}
                                    onClick={isMobile ? closeMobileMenu : undefined}
                                />
                                <NavItem
                                    href="/admin/analytics"
                                    icon={<BarChart3 size={18} />}
                                    label="Analytics"
                                    collapsed={collapsed}
                                    onClick={isMobile ? closeMobileMenu : undefined}
                                />
                            </>
                        )}
                        {hasAccountingAccess && (
                            <NavItem
                                href="/accounting"
                                icon={<Calculator size={18} />}
                                label="Accounting"
                                collapsed={collapsed}
                                onClick={isMobile ? closeMobileMenu : undefined}
                            />
                        )}
                    </NavGroup>
                )}

                {/* Settings & System */}
                <NavGroup title="Settings" collapsed={collapsed}>
                    {isSuperAdmin && (
                        <NavItem
                            href="/admin/audit"
                            icon={<History size={18} />}
                            label="Audit Log"
                            collapsed={collapsed}
                            onClick={isMobile ? closeMobileMenu : undefined}
                        />
                    )}
                    <NavItem
                        href="/settings"
                        icon={<Settings size={18} />}
                        label="Settings"
                        collapsed={collapsed}
                        onClick={isMobile ? closeMobileMenu : undefined}
                    />
                </NavGroup>
            </nav>

            {/* Footer */}
            <div className={styles.footer}>
                <button
                    onClick={handleLogout}
                    className={styles.logoutBtn}
                    title={collapsed ? "Sign Out" : undefined}
                >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Toggle */}
            {isMobile && (
                <button
                    className={styles.mobileToggle}
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    aria-expanded={mobileOpen}
                >
                    {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            )}

            {/* Mobile Overlay */}
            {isMobile && mobileOpen && (
                <div className={styles.mobileOverlay} onClick={closeMobileMenu} aria-hidden="true" />
            )}

            {/* Sidebar */}
            <aside
                className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} ${isMobile ? styles.mobile : ""} ${mobileOpen ? styles.open : ""}`}
                role="navigation"
                aria-label="Main navigation"
            >
                {sidebarContent}
            </aside>
        </>
    );
}
