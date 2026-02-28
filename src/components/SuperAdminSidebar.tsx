"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    LayoutDashboard,
    CalendarClock,
    UserCog,
    UserPlus,
    FileText,
    BarChart3,
    History,
    Settings,
    LogOut,
    StickyNote,
    CheckSquare,
    BookOpen,
    Clock,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    Shield,
    Briefcase,
    FileEdit,
    Calculator,
    MessageSquare,
    Car,
    Network,
    Calendar,
    ClipboardList,
    Phone,
    Menu,
    X,
} from "lucide-react";
import NotificationBell from "./NotificationBell";

interface NavItemProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    collapsed: boolean;
}

function NavItem({ href, icon, label, collapsed }: NavItemProps) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(href + "/");

    return (
        <Link
            href={href}
            className={`nav-item ${isActive ? "active" : ""}`}
            title={collapsed ? label : undefined}
        >
            <span className="nav-icon">{icon}</span>
            {!collapsed && <span className="nav-label">{label}</span>}
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
        <div className="nav-group">
            {!collapsed && <span className="nav-group-title">{title}</span>}
            {collapsed && <div className="nav-group-divider" />}
            <div className="nav-group-items">{children}</div>
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

export default function SuperAdminSidebar({ user }: Props) {
    const role = user.role || "DISPATCHER";
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isAccounting = role === "ACCOUNTING";
    const isAdmin = role === "ADMIN" || isSuperAdmin || isAccounting;
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

    const closeMobileMenu = () => setMobileOpen(false);

    const sidebarContent = (
        <>
            {/* Header */}
            <div className="sidebar-header">
                <Link href="/dashboard" className="brand" onClick={isMobile ? closeMobileMenu : undefined}>
                    <Image src="/logo.png" alt="Nebo" width={32} height={32} priority className="brand-logo" />
                    {!collapsed && <span className="brand-text">NeboOps</span>}
                </Link>
                {!isMobile && (
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="collapse-btn"
                        aria-label={collapsed ? "Expand" : "Collapse"}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                )}
            </div>

            {/* User Card */}
            <div className="user-card">
                <div className="user-avatar" style={{ background: roleConfig.color }}>
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                    <div className="user-info">
                        <span className="user-name">{user.name || "User"}</span>
                        <span className="user-role">
                            <RoleIcon size={10} />
                            {roleConfig.label}
                        </span>
                    </div>
                )}
                {!collapsed && (
                    <div className="user-actions">
                        <NotificationBell />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="nav">
                {/* Main */}
                <NavGroup title="Main" collapsed={collapsed}>
                    <NavItem href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" collapsed={collapsed} />
                </NavGroup>

                {/* Dispatcher */}
                {isDispatcher && (
                    <NavGroup title="My Shift" collapsed={collapsed}>
                        <NavItem href="/schedule" icon={<Calendar size={18} />} label="My Schedule" collapsed={collapsed} />
                        <NavItem href="/reports/shift" icon={<ClipboardList size={18} />} label="Shift Report" collapsed={collapsed} />
                    </NavGroup>
                )}

                {/* Scheduling */}
                {isAdmin && (
                    <NavGroup title="Scheduling" collapsed={collapsed}>
                        <NavItem href="/admin/scheduler" icon={<CalendarClock size={18} />} label="Schedule Builder" collapsed={collapsed} />
                        <NavItem href="/admin/requests" icon={<FileEdit size={18} />} label="Time Off & Swaps" collapsed={collapsed} />
                    </NavGroup>
                )}

                {/* Team */}
                {isAdmin && (
                    <NavGroup title="Team" collapsed={collapsed}>
                        {isSuperAdmin && (
                            <NavItem href="/admin/users" icon={<UserCog size={18} />} label="Users" collapsed={collapsed} />
                        )}
                        <NavItem href="/admin/approvals" icon={<UserPlus size={18} />} label="Approvals" collapsed={collapsed} />
                        <NavItem href="/admin/hours" icon={<Clock size={18} />} label="Hours" collapsed={collapsed} />
                        <NavItem href="/admin/confirmations" icon={<Phone size={18} />} label="Confirmations" collapsed={collapsed} />
                        <NavItem href="/admin/tasks" icon={<CheckSquare size={18} />} label="Tasks" collapsed={collapsed} />
                        <NavItem href="/admin/notes" icon={<StickyNote size={18} />} label="Notes" collapsed={collapsed} />
                        <NavItem href="/admin/sms" icon={<MessageSquare size={18} />} label="Messaging" collapsed={collapsed} />
                    </NavGroup>
                )}

                {/* Operations */}
                <NavGroup title="Operations" collapsed={collapsed}>
                    <NavItem href="/fleet" icon={<Car size={18} />} label="Fleet" collapsed={collapsed} />
                    <NavItem href="/network" icon={<Network size={18} />} label="Affiliates" collapsed={collapsed} />
                    <NavItem href={isAdmin ? "/admin/sops" : "/sops"} icon={<BookOpen size={18} />} label="SOPs" collapsed={collapsed} />
                    <NavItem href="/sms" icon={<MessageSquare size={18} />} label="SMS Center" collapsed={collapsed} />
                </NavGroup>

                {/* Reports */}
                {(isAdmin || hasAccountingAccess) && (
                    <NavGroup title="Reports" collapsed={collapsed}>
                        {isAdmin && (
                            <>
                                <NavItem href="/admin/reports" icon={<FileText size={18} />} label="Shift Reports" collapsed={collapsed} />
                                <NavItem href="/admin/analytics" icon={<BarChart3 size={18} />} label="Analytics" collapsed={collapsed} />
                            </>
                        )}
                        {hasAccountingAccess && (
                            <NavItem href="/accounting" icon={<Calculator size={18} />} label="Accounting" collapsed={collapsed} />
                        )}
                    </NavGroup>
                )}

                {/* System */}
                <NavGroup title="System" collapsed={collapsed}>
                    {isSuperAdmin && (
                        <NavItem href="/admin/audit" icon={<History size={18} />} label="Audit Log" collapsed={collapsed} />
                    )}
                    <NavItem href="/settings" icon={<Settings size={18} />} label="Settings" collapsed={collapsed} />
                </NavGroup>
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <button onClick={() => signOut()} className="logout-btn" title={collapsed ? "Sign Out" : undefined}>
                    <LogOut size={18} />
                    {!collapsed && <span>Sign Out</span>}
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Toggle */}
            {isMobile && (
                <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
                    {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                </button>
            )}

            {/* Mobile Overlay */}
            {isMobile && mobileOpen && <div className="mobile-overlay" onClick={closeMobileMenu} />}

            {/* Sidebar */}
            <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${isMobile ? "mobile" : ""} ${mobileOpen ? "open" : ""}`}>
                {sidebarContent}
            </aside>

            <style jsx>{`
                .sidebar {
                    position: fixed;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 240px;
                    background: var(--bg-card);
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    z-index: 100;
                    transition: width 0.2s ease, transform 0.2s ease;
                }

                .sidebar.collapsed {
                    width: 68px;
                }

                .sidebar.mobile {
                    transform: translateX(-100%);
                    width: 260px;
                    box-shadow: none;
                }

                .sidebar.mobile.open {
                    transform: translateX(0);
                    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
                }

                /* Header */
                .sidebar-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                    min-height: 60px;
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    text-decoration: none;
                }

                .brand-text {
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--text-primary);
                }

                .collapse-btn {
                    width: 28px;
                    height: 28px;
                    background: var(--bg-hover);
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                }

                .collapse-btn:hover {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                }

                .sidebar.collapsed .collapse-btn {
                    margin: 0 auto;
                }

                /* User Card */
                .user-card {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    padding: 0.875rem 1rem;
                    border-bottom: 1px solid var(--border);
                    background: var(--bg-secondary);
                }

                .user-avatar {
                    width: 34px;
                    height: 34px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 600;
                    font-size: 0.875rem;
                    flex-shrink: 0;
                }

                .user-info {
                    flex: 1;
                    min-width: 0;
                }

                .user-name {
                    display: block;
                    font-weight: 600;
                    font-size: 0.8125rem;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .user-role {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                    font-weight: 500;
                }

                .user-actions {
                    flex-shrink: 0;
                }

                .sidebar.collapsed .user-card {
                    justify-content: center;
                    padding: 0.75rem;
                }

                /* Navigation */
                .nav {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.5rem;
                }

                .nav-group {
                    margin-bottom: 0.25rem;
                }

                .nav-group-title {
                    display: block;
                    font-size: 0.625rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    padding: 0.625rem 0.75rem 0.375rem;
                }

                .nav-group-divider {
                    height: 1px;
                    background: var(--border);
                    margin: 0.5rem;
                }

                .nav-group-items {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }

                :global(.nav-item) {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.8125rem;
                    text-decoration: none;
                    transition: all 0.15s ease;
                }

                :global(.nav-item:hover) {
                    color: var(--text-primary);
                    background: var(--bg-hover);
                }

                :global(.nav-item.active) {
                    color: var(--accent);
                    background: rgba(238, 79, 39, 0.12);
                }

                :global(.nav-icon) {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.85;
                }

                :global(.nav-item.active .nav-icon) {
                    opacity: 1;
                }

                .sidebar.collapsed :global(.nav-item) {
                    justify-content: center;
                    padding: 0.625rem;
                }

                /* Footer */
                .sidebar-footer {
                    padding: 0.75rem;
                    border-top: 1px solid var(--border);
                }

                .logout-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.8125rem;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.15s ease;
                }

                .logout-btn:hover {
                    color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                }

                .sidebar.collapsed .logout-btn {
                    justify-content: center;
                }

                /* Mobile */
                .mobile-toggle {
                    position: fixed;
                    top: 0.75rem;
                    left: 0.75rem;
                    z-index: 150;
                    width: 40px;
                    height: 40px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }

                .mobile-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 90;
                }

                /* Scrollbar */
                .nav::-webkit-scrollbar {
                    width: 4px;
                }

                .nav::-webkit-scrollbar-track {
                    background: transparent;
                }

                .nav::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 2px;
                }
            `}</style>
        </>
    );
}
