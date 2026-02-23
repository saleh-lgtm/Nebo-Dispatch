"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    LayoutDashboard,
    CalendarClock,
    Users,
    UserCog,
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
    Briefcase,
    FileEdit,
    Calculator,
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
            className={`sa-nav-item ${isActive ? "active" : ""}`}
            title={collapsed ? label : undefined}
        >
            <span className="sa-nav-icon">{icon}</span>
            {!collapsed && <span className="sa-nav-label">{label}</span>}
        </Link>
    );
}

interface NavSectionProps {
    title: string;
    children: React.ReactNode;
    collapsed: boolean;
}

function NavSection({ title, children, collapsed }: NavSectionProps) {
    return (
        <div className="sa-nav-section">
            {!collapsed && <span className="sa-nav-section-title">{title}</span>}
            {collapsed && <div className="sa-nav-divider" />}
            <div className="sa-nav-section-items">{children}</div>
        </div>
    );
}

interface Props {
    user: {
        name?: string | null;
        email?: string | null;
    };
}

export default function SuperAdminSidebar({ user }: Props) {
    const [collapsed, setCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Auto-collapse on mobile
    useEffect(() => {
        if (isMobile) setCollapsed(true);
    }, [isMobile]);

    return (
        <>
            <aside className={`sa-sidebar ${collapsed ? "collapsed" : ""}`}>
                {/* Header */}
                <div className="sa-sidebar-header">
                    <Link href="/dashboard" className="sa-brand">
                        <Image src="/logo.png" alt="Nebo" className="sa-brand-logo" width={32} height={32} priority />
                        {!collapsed && <span className="sa-brand-text">Nebo Admin</span>}
                    </Link>
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="sa-collapse-btn"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                {/* User Info */}
                <div className="sa-user-card">
                    <div className="sa-user-avatar">
                        {(user.name || user.email || "A").charAt(0).toUpperCase()}
                    </div>
                    {!collapsed && (
                        <div className="sa-user-info">
                            <span className="sa-user-name">{user.name || "Admin"}</span>
                            <span className="sa-user-role">
                                <ShieldCheck size={10} /> Super Admin
                            </span>
                        </div>
                    )}
                    <div className="sa-user-actions">
                        <NotificationBell />
                    </div>
                </div>

                {/* Navigation */}
                <nav className="sa-nav">
                    <NavSection title="Overview" collapsed={collapsed}>
                        <NavItem href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" collapsed={collapsed} />
                    </NavSection>

                    <NavSection title="Scheduling" collapsed={collapsed}>
                        <NavItem href="/admin/scheduler" icon={<CalendarClock size={18} />} label="Dispatcher Scheduler" collapsed={collapsed} />
                        <NavItem href="/admin/requests" icon={<FileEdit size={18} />} label="Pending Requests" collapsed={collapsed} />
                    </NavSection>

                    <NavSection title="Team Management" collapsed={collapsed}>
                        <NavItem href="/admin/users" icon={<UserCog size={18} />} label="User Management" collapsed={collapsed} />
                        <NavItem href="/admin/hours" icon={<Clock size={18} />} label="Hours Tracking" collapsed={collapsed} />
                        <NavItem href="/admin/tasks" icon={<CheckSquare size={18} />} label="Admin Tasks" collapsed={collapsed} />
                        <NavItem href="/admin/notes" icon={<StickyNote size={18} />} label="Global Notes" collapsed={collapsed} />
                    </NavSection>

                    <NavSection title="Content" collapsed={collapsed}>
                        <NavItem href="/affiliates" icon={<Users size={18} />} label="Affiliates" collapsed={collapsed} />
                        <NavItem href="/admin/sops" icon={<BookOpen size={18} />} label="Manage SOPs" collapsed={collapsed} />
                    </NavSection>

                    <NavSection title="Reports & Analytics" collapsed={collapsed}>
                        <NavItem href="/admin/reports" icon={<FileText size={18} />} label="Shift Reports" collapsed={collapsed} />
                        <NavItem href="/admin/analytics" icon={<BarChart3 size={18} />} label="Analytics" collapsed={collapsed} />
                        <NavItem href="/accounting" icon={<Calculator size={18} />} label="Accounting" collapsed={collapsed} />
                    </NavSection>

                    <NavSection title="System" collapsed={collapsed}>
                        <NavItem href="/admin/audit" icon={<History size={18} />} label="Audit Log" collapsed={collapsed} />
                        <NavItem href="/settings" icon={<Settings size={18} />} label="Settings" collapsed={collapsed} />
                    </NavSection>
                </nav>

                {/* Footer */}
                <div className="sa-sidebar-footer">
                    <button onClick={() => signOut()} className="sa-logout-btn" title={collapsed ? "Sign Out" : undefined}>
                        <LogOut size={18} />
                        {!collapsed && <span>Sign Out</span>}
                    </button>
                </div>
            </aside>

            <style jsx>{`
                .sa-sidebar {
                    position: fixed;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 260px;
                    background: var(--bg-card);
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    z-index: 100;
                    transition: width 0.2s ease;
                }

                .sa-sidebar.collapsed {
                    width: 70px;
                }

                .sa-sidebar-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                    min-height: 60px;
                }

                .sa-brand {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    text-decoration: none;
                    overflow: hidden;
                }

                .sa-brand-logo {
                    height: 28px;
                    width: auto;
                    flex-shrink: 0;
                }

                .sa-brand-text {
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--text-primary);
                    white-space: nowrap;
                }

                .sa-collapse-btn {
                    background: var(--bg-hover);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 0.375rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                    flex-shrink: 0;
                }

                .sa-collapse-btn:hover {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                }

                .sa-sidebar.collapsed .sa-collapse-btn {
                    margin: 0 auto;
                }

                /* User Card */
                .sa-user-card {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border);
                    background: var(--bg-secondary);
                }

                .sa-user-avatar {
                    width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, var(--danger) 0%, #ff8a8a 100%);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 0.875rem;
                    flex-shrink: 0;
                }

                .sa-user-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                    overflow: hidden;
                }

                .sa-user-name {
                    font-weight: 600;
                    font-size: 0.8125rem;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .sa-user-role {
                    font-size: 0.6875rem;
                    color: var(--danger);
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .sa-user-actions {
                    margin-left: auto;
                }

                .sa-sidebar.collapsed .sa-user-actions {
                    display: none;
                }

                .sa-sidebar.collapsed .sa-user-card {
                    justify-content: center;
                    padding: 0.75rem;
                }

                /* Navigation */
                .sa-nav {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.5rem;
                }

                .sa-nav-section {
                    margin-bottom: 0.5rem;
                }

                .sa-nav-section-title {
                    font-size: 0.625rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    padding: 0.5rem 0.75rem 0.375rem;
                    display: block;
                }

                .sa-nav-divider {
                    height: 1px;
                    background: var(--border);
                    margin: 0.5rem 0.5rem 0.25rem;
                }

                .sa-nav-section-items {
                    display: flex;
                    flex-direction: column;
                    gap: 0.125rem;
                }

                :global(.sa-nav-item) {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.8125rem;
                    transition: all 0.15s ease;
                    text-decoration: none;
                    white-space: nowrap;
                }

                :global(.sa-nav-item:hover) {
                    color: var(--text-primary);
                    background: var(--bg-hover);
                }

                :global(.sa-nav-item.active) {
                    color: var(--primary);
                    background: var(--primary-soft);
                }

                :global(.sa-nav-icon) {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .sa-sidebar.collapsed :global(.sa-nav-item) {
                    justify-content: center;
                    padding: 0.625rem;
                }

                /* Footer */
                .sa-sidebar-footer {
                    padding: 0.75rem;
                    border-top: 1px solid var(--border);
                }

                .sa-logout-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.625rem;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.8125rem;
                    transition: all 0.15s ease;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                }

                .sa-logout-btn:hover {
                    color: var(--danger);
                    background: var(--danger-bg);
                }

                .sa-sidebar.collapsed .sa-logout-btn {
                    justify-content: center;
                }

                /* Scrollbar */
                .sa-nav::-webkit-scrollbar {
                    width: 4px;
                }

                .sa-nav::-webkit-scrollbar-track {
                    background: transparent;
                }

                .sa-nav::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 2px;
                }

                .sa-nav::-webkit-scrollbar-thumb:hover {
                    background: var(--text-muted);
                }
            `}</style>
        </>
    );
}
