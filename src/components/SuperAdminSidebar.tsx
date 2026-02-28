"use client";

import { useState, useEffect, useCallback } from "react";
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
    ChevronDown,
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
    Zap,
    Users,
    Activity,
    Radio,
} from "lucide-react";
import NotificationBell from "./NotificationBell";

interface NavItemProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    collapsed: boolean;
    shortcut?: string;
}

function NavItem({ href, icon, label, collapsed, shortcut }: NavItemProps) {
    const pathname = usePathname();
    const isActive = pathname === href || pathname.startsWith(href + "/");

    return (
        <Link
            href={href}
            className={`cc-nav-item ${isActive ? "active" : ""}`}
            title={collapsed ? label : undefined}
        >
            <span className="cc-nav-icon">{icon}</span>
            {!collapsed && (
                <>
                    <span className="cc-nav-label">{label}</span>
                    {shortcut && <span className="cc-nav-shortcut">{shortcut}</span>}
                </>
            )}
            {isActive && <span className="cc-nav-indicator" />}
        </Link>
    );
}

interface NavSectionProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    collapsed: boolean;
    defaultOpen?: boolean;
}

function NavSection({ title, icon, children, collapsed, defaultOpen = true }: NavSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`cc-nav-section ${isOpen ? "open" : ""}`}>
            {!collapsed ? (
                <button
                    className="cc-nav-section-header"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                >
                    {icon && <span className="cc-section-icon">{icon}</span>}
                    <span className="cc-nav-section-title">{title}</span>
                    <ChevronDown size={14} className="cc-section-chevron" />
                </button>
            ) : (
                <div className="cc-nav-divider" />
            )}
            <div className={`cc-nav-section-items ${!isOpen && !collapsed ? "collapsed" : ""}`}>
                {children}
            </div>
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

const ROLE_CONFIG: Record<string, { label: string; icon: typeof ShieldCheck; color: string; glow: string }> = {
    SUPER_ADMIN: { label: "Command", icon: ShieldCheck, color: "#ef4444", glow: "0 0 20px rgba(239, 68, 68, 0.4)" },
    ADMIN: { label: "Operations", icon: Shield, color: "#f59e0b", glow: "0 0 20px rgba(245, 158, 11, 0.4)" },
    ACCOUNTING: { label: "Finance", icon: Calculator, color: "#3b82f6", glow: "0 0 20px rgba(59, 130, 246, 0.4)" },
    DISPATCHER: { label: "Dispatch", icon: Briefcase, color: "#22c55e", glow: "0 0 20px rgba(34, 197, 94, 0.4)" },
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
    const [currentTime, setCurrentTime] = useState<string>("");

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

    // Live clock
    useEffect(() => {
        const updateTime = () => {
            setCurrentTime(new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            }));
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    // Keyboard shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "[") {
            e.preventDefault();
            setCollapsed(c => !c);
        }
    }, []);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    const toggleMobile = () => setMobileOpen(!mobileOpen);

    const sidebarContent = (
        <>
            {/* Accent Line */}
            <div className="cc-accent-line" />

            {/* Header */}
            <div className="cc-sidebar-header">
                <Link href="/dashboard" className="cc-brand">
                    <div className="cc-brand-icon">
                        <Image src="/logo.png" alt="Nebo" width={28} height={28} priority />
                    </div>
                    {!collapsed && (
                        <div className="cc-brand-text">
                            <span className="cc-brand-name">NEBO</span>
                            <span className="cc-brand-sub">COMMAND</span>
                        </div>
                    )}
                </Link>
                {!isMobile && (
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="cc-collapse-btn"
                        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        title={`Toggle sidebar (⌘[)`}
                    >
                        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                )}
            </div>

            {/* Status Bar */}
            <div className="cc-status-bar">
                <div className="cc-status-indicator">
                    <span className="cc-status-dot" />
                    {!collapsed && <span className="cc-status-text">ONLINE</span>}
                </div>
                {!collapsed && <span className="cc-status-time">{currentTime}</span>}
            </div>

            {/* User Card */}
            <div className="cc-user-card">
                <div className="cc-user-avatar" style={{ borderColor: roleConfig.color }}>
                    {(user.name || user.email || "U").charAt(0).toUpperCase()}
                </div>
                {!collapsed && (
                    <div className="cc-user-info">
                        <span className="cc-user-name">{user.name || "Operator"}</span>
                        <span className="cc-user-role" style={{ color: roleConfig.color }}>
                            <RoleIcon size={10} />
                            {roleConfig.label}
                        </span>
                    </div>
                )}
                <div className="cc-user-actions">
                    <NotificationBell />
                </div>
            </div>

            {/* Navigation */}
            <nav className="cc-nav">
                {/* Command Center */}
                <NavSection title="Command Center" icon={<Radio size={14} />} collapsed={collapsed}>
                    <NavItem href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" collapsed={collapsed} shortcut="⌘D" />
                </NavSection>

                {/* Dispatcher Workstation */}
                {isDispatcher && (
                    <NavSection title="My Workstation" icon={<Zap size={14} />} collapsed={collapsed}>
                        <NavItem href="/schedule" icon={<Calendar size={18} />} label="My Schedule" collapsed={collapsed} />
                        <NavItem href="/reports/shift" icon={<ClipboardList size={18} />} label="End of Shift" collapsed={collapsed} />
                    </NavSection>
                )}

                {/* Scheduling */}
                {isAdmin && (
                    <NavSection title="Scheduling" icon={<CalendarClock size={14} />} collapsed={collapsed}>
                        <NavItem href="/admin/scheduler" icon={<CalendarClock size={18} />} label="Schedule Builder" collapsed={collapsed} />
                        <NavItem href="/admin/requests" icon={<FileEdit size={18} />} label="Time Off & Swaps" collapsed={collapsed} />
                    </NavSection>
                )}

                {/* Team Operations */}
                {isAdmin && (
                    <NavSection title="Team Operations" icon={<Users size={14} />} collapsed={collapsed}>
                        {isSuperAdmin && (
                            <NavItem href="/admin/users" icon={<UserCog size={18} />} label="User Management" collapsed={collapsed} />
                        )}
                        <NavItem href="/admin/approvals" icon={<UserPlus size={18} />} label="Approvals" collapsed={collapsed} />
                        <NavItem href="/admin/hours" icon={<Clock size={18} />} label="Work Hours" collapsed={collapsed} />
                        <NavItem href="/admin/confirmations" icon={<Phone size={18} />} label="Confirmations" collapsed={collapsed} />
                        <NavItem href="/admin/tasks" icon={<CheckSquare size={18} />} label="Tasks" collapsed={collapsed} />
                        <NavItem href="/admin/notes" icon={<StickyNote size={18} />} label="Shift Notes" collapsed={collapsed} />
                        <NavItem href="/admin/sms" icon={<MessageSquare size={18} />} label="Team Messaging" collapsed={collapsed} />
                    </NavSection>
                )}

                {/* Operations */}
                <NavSection title="Operations" icon={<Activity size={14} />} collapsed={collapsed}>
                    <NavItem href="/fleet" icon={<Car size={18} />} label="Fleet" collapsed={collapsed} />
                    <NavItem href="/network" icon={<Network size={18} />} label="Affiliates" collapsed={collapsed} />
                    {isAdmin ? (
                        <NavItem href="/admin/sops" icon={<BookOpen size={18} />} label="SOPs" collapsed={collapsed} />
                    ) : (
                        <NavItem href="/sops" icon={<BookOpen size={18} />} label="SOPs" collapsed={collapsed} />
                    )}
                    <NavItem href="/sms" icon={<MessageSquare size={18} />} label="SMS Center" collapsed={collapsed} />
                </NavSection>

                {/* Intelligence */}
                {(isAdmin || hasAccountingAccess) && (
                    <NavSection title="Intelligence" icon={<BarChart3 size={14} />} collapsed={collapsed} defaultOpen={false}>
                        {isAdmin && (
                            <>
                                <NavItem href="/admin/reports" icon={<FileText size={18} />} label="Shift Reports" collapsed={collapsed} />
                                <NavItem href="/admin/analytics" icon={<BarChart3 size={18} />} label="Analytics" collapsed={collapsed} />
                            </>
                        )}
                        {hasAccountingAccess && (
                            <NavItem href="/accounting" icon={<Calculator size={18} />} label="Accounting" collapsed={collapsed} />
                        )}
                    </NavSection>
                )}

                {/* System */}
                <NavSection title="System" icon={<Settings size={14} />} collapsed={collapsed} defaultOpen={false}>
                    {isSuperAdmin && (
                        <NavItem href="/admin/audit" icon={<History size={18} />} label="Audit Log" collapsed={collapsed} />
                    )}
                    <NavItem href="/settings" icon={<Settings size={18} />} label="Settings" collapsed={collapsed} />
                </NavSection>
            </nav>

            {/* Footer */}
            <div className="cc-sidebar-footer">
                <button onClick={() => signOut()} className="cc-logout-btn" title={collapsed ? "Sign Out" : undefined}>
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
                <button className="cc-mobile-toggle" onClick={toggleMobile} aria-label="Toggle menu">
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            )}

            {/* Mobile Overlay */}
            {isMobile && mobileOpen && (
                <div className="cc-mobile-overlay" onClick={() => setMobileOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`cc-sidebar ${collapsed ? "collapsed" : ""} ${isMobile ? "mobile" : ""} ${mobileOpen ? "open" : ""}`}>
                {sidebarContent}
            </aside>

            <style jsx>{`
                .cc-sidebar {
                    position: fixed;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 280px;
                    background: linear-gradient(180deg, var(--bg-card) 0%, rgba(14, 9, 24, 0.98) 100%);
                    border-right: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    z-index: 100;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    overflow: hidden;
                }

                .cc-sidebar.collapsed {
                    width: 72px;
                }

                .cc-sidebar.mobile {
                    transform: translateX(-100%);
                    width: 280px;
                }

                .cc-sidebar.mobile.open {
                    transform: translateX(0);
                    box-shadow: 20px 0 60px rgba(0, 0, 0, 0.5);
                }

                /* Accent Line */
                .cc-accent-line {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 3px;
                    height: 100%;
                    background: linear-gradient(180deg, var(--accent) 0%, transparent 100%);
                    opacity: 0.6;
                    transition: opacity 0.3s ease;
                }

                .cc-sidebar:hover .cc-accent-line {
                    opacity: 1;
                    box-shadow: 0 0 20px var(--accent);
                }

                /* Header */
                .cc-sidebar-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1.25rem 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }

                .cc-brand {
                    display: flex;
                    align-items: center;
                    gap: 0.875rem;
                    text-decoration: none;
                }

                .cc-brand-icon {
                    width: 36px;
                    height: 36px;
                    background: rgba(238, 79, 39, 0.1);
                    border: 1px solid rgba(238, 79, 39, 0.3);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                .cc-brand:hover .cc-brand-icon {
                    background: rgba(238, 79, 39, 0.2);
                    border-color: var(--accent);
                    box-shadow: 0 0 20px rgba(238, 79, 39, 0.3);
                }

                .cc-brand-text {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.1;
                }

                .cc-brand-name {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    letter-spacing: 0.15em;
                }

                .cc-brand-sub {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.625rem;
                    color: var(--accent);
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                }

                .cc-collapse-btn {
                    width: 28px;
                    height: 28px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 6px;
                    color: var(--text-muted);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .cc-collapse-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: var(--text-primary);
                    border-color: rgba(255, 255, 255, 0.15);
                }

                /* Status Bar */
                .cc-status-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.625rem 1rem;
                    background: rgba(34, 197, 94, 0.05);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                }

                .cc-status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .cc-status-dot {
                    width: 8px;
                    height: 8px;
                    background: #22c55e;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
                    50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
                }

                .cc-status-text {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.625rem;
                    font-weight: 600;
                    color: #22c55e;
                    letter-spacing: 0.1em;
                }

                .cc-status-time {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.6875rem;
                    color: var(--text-muted);
                    letter-spacing: 0.05em;
                }

                .cc-sidebar.collapsed .cc-status-bar {
                    justify-content: center;
                    padding: 0.625rem 0.5rem;
                }

                /* User Card */
                .cc-user-card {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }

                .cc-user-avatar {
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.06);
                    border: 2px solid var(--accent);
                    color: var(--text-primary);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 1rem;
                    flex-shrink: 0;
                    transition: all 0.3s ease;
                }

                .cc-user-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    overflow: hidden;
                    flex: 1;
                }

                .cc-user-name {
                    font-weight: 600;
                    font-size: 0.875rem;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .cc-user-role {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.625rem;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .cc-user-actions {
                    margin-left: auto;
                }

                .cc-sidebar.collapsed .cc-user-card {
                    justify-content: center;
                    padding: 0.875rem 0.5rem;
                }

                .cc-sidebar.collapsed .cc-user-actions {
                    display: none;
                }

                /* Navigation */
                .cc-nav {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.75rem 0.5rem;
                }

                .cc-nav-section {
                    margin-bottom: 0.375rem;
                }

                .cc-nav-section-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s ease;
                }

                .cc-nav-section-header:hover {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 8px;
                }

                .cc-section-icon {
                    color: var(--text-muted);
                    display: flex;
                    align-items: center;
                }

                .cc-nav-section-title {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.6875rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    flex: 1;
                    text-align: left;
                }

                .cc-section-chevron {
                    color: var(--text-muted);
                    transition: transform 0.2s ease;
                }

                .cc-nav-section.open .cc-section-chevron {
                    transform: rotate(180deg);
                }

                .cc-nav-divider {
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
                    margin: 0.75rem 0.5rem;
                }

                .cc-nav-section-items {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    overflow: hidden;
                    max-height: 500px;
                    transition: max-height 0.3s ease, opacity 0.2s ease;
                }

                .cc-nav-section-items.collapsed {
                    max-height: 0;
                    opacity: 0;
                }

                :global(.cc-nav-item) {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.625rem 0.875rem;
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.8125rem;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    white-space: nowrap;
                    margin-left: 0.25rem;
                }

                :global(.cc-nav-item:hover) {
                    color: var(--text-primary);
                    background: rgba(255, 255, 255, 0.05);
                }

                :global(.cc-nav-item.active) {
                    color: var(--accent);
                    background: rgba(238, 79, 39, 0.1);
                }

                :global(.cc-nav-item.active:hover) {
                    background: rgba(238, 79, 39, 0.15);
                }

                :global(.cc-nav-icon) {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.8;
                }

                :global(.cc-nav-item.active .cc-nav-icon) {
                    opacity: 1;
                }

                :global(.cc-nav-label) {
                    flex: 1;
                }

                :global(.cc-nav-shortcut) {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.625rem;
                    color: var(--text-muted);
                    background: rgba(255, 255, 255, 0.05);
                    padding: 0.125rem 0.375rem;
                    border-radius: 4px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }

                :global(.cc-nav-indicator) {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 3px;
                    height: 60%;
                    background: var(--accent);
                    border-radius: 0 2px 2px 0;
                    box-shadow: 0 0 10px var(--accent);
                }

                .cc-sidebar.collapsed :global(.cc-nav-item) {
                    justify-content: center;
                    padding: 0.75rem;
                    margin-left: 0;
                }

                /* Footer */
                .cc-sidebar-footer {
                    padding: 0.75rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                }

                .cc-logout-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    width: 100%;
                    padding: 0.625rem 0.875rem;
                    border-radius: 8px;
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 0.8125rem;
                    transition: all 0.2s ease;
                    background: none;
                    border: 1px solid transparent;
                    cursor: pointer;
                    font-family: inherit;
                }

                .cc-logout-btn:hover {
                    color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.2);
                }

                /* Mobile */
                .cc-mobile-toggle {
                    position: fixed;
                    top: 1rem;
                    left: 1rem;
                    z-index: 150;
                    width: 44px;
                    height: 44px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    color: var(--text-primary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                }

                .cc-mobile-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 90;
                }

                /* Scrollbar */
                .cc-nav::-webkit-scrollbar {
                    width: 4px;
                }

                .cc-nav::-webkit-scrollbar-track {
                    background: transparent;
                }

                .cc-nav::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                }

                .cc-nav::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </>
    );
}
