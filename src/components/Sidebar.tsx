"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Menu,
    X,
    ShieldCheck,
    Shield,
    Calculator,
    Briefcase,
    LogOut,
    Settings,
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import ClockButton from "./ClockButton";
import {
    getNavForRole,
    filterItemsByRole,
    type NavItem as NavItemType,
    type NavGroup as NavGroupType,
    type BadgeCounts,
    type Role,
} from "@/config/navigation";
import { getNavBadgeCounts } from "@/lib/navCountsActions";
import styles from "./Sidebar.module.css";

// ============================================
// Role Badge Config
// ============================================

const ROLE_CONFIG: Record<string, { label: string; icon: typeof ShieldCheck; color: string }> = {
    SUPER_ADMIN: { label: "Super Admin", icon: ShieldCheck, color: "#ef4444" },
    ADMIN: { label: "Admin", icon: Shield, color: "#f59e0b" },
    ACCOUNTING: { label: "Accounting", icon: Calculator, color: "#3b82f6" },
    DISPATCHER: { label: "Dispatcher", icon: Briefcase, color: "#22c55e" },
};

// ============================================
// Nav Item Component
// ============================================

interface NavItemProps {
    item: NavItemType;
    collapsed: boolean;
    badgeCount?: number;
    onClick?: () => void;
}

function NavItem({ item, collapsed, badgeCount, onClick }: NavItemProps) {
    const pathname = usePathname();
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;

    // Handle ClockButton component
    if (item.isComponent && item.id === "clock") {
        return (
            <div className={styles.clockWrapper}>
                <ClockButton />
            </div>
        );
    }

    return (
        <Link
            href={item.href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            title={collapsed ? item.label : undefined}
            onClick={onClick}
        >
            <span className={styles.navIcon}>
                <Icon size={18} />
            </span>
            <span className={styles.navLabel}>{item.label}</span>
            {badgeCount !== undefined && badgeCount > 0 && (
                <span className={styles.navBadge}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                </span>
            )}
        </Link>
    );
}

// ============================================
// Nav Group Component
// ============================================

interface NavGroupProps {
    group: NavGroupType;
    collapsed: boolean;
    userRole: Role;
    badgeCounts: BadgeCounts;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onItemClick?: () => void;
}

function NavGroup({
    group,
    collapsed,
    userRole,
    badgeCounts,
    isExpanded,
    onToggleExpand,
    onItemClick,
}: NavGroupProps) {
    const filteredItems = filterItemsByRole(group.items, userRole);

    if (filteredItems.length === 0) return null;

    const isCollapsible = group.collapsedByDefault !== undefined;
    const showItems = !isCollapsible || isExpanded;

    return (
        <div className={styles.navGroup}>
            {!collapsed && (
                <div
                    className={`${styles.navGroupTitle} ${isCollapsible ? styles.navGroupTitleClickable : ""}`}
                    onClick={isCollapsible ? onToggleExpand : undefined}
                    role={isCollapsible ? "button" : undefined}
                    aria-expanded={isCollapsible ? isExpanded : undefined}
                >
                    <span>{group.title}</span>
                    {isCollapsible && (
                        <ChevronDown
                            size={14}
                            className={isExpanded ? styles.chevronExpanded : styles.chevronCollapsed}
                        />
                    )}
                </div>
            )}
            {collapsed && <div className={styles.navGroupDivider} />}
            {showItems && (
                <div className={styles.navGroupItems}>
                    {filteredItems.map((item) => (
                        <NavItem
                            key={item.id}
                            item={item}
                            collapsed={collapsed}
                            badgeCount={item.badgeKey ? badgeCounts[item.badgeKey] : undefined}
                            onClick={onItemClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// Main Sidebar Component
// ============================================

interface Props {
    user: {
        name?: string | null;
        email?: string | null;
        role?: string;
    };
}

export default function Sidebar({ user }: Props) {
    const role = (user.role || "DISPATCHER") as Role;
    const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.DISPATCHER;
    const RoleIcon = roleConfig.icon;
    const navGroups = getNavForRole(role);

    // UI State
    const [collapsed, setCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Track which collapsible groups are expanded (by group id)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
        // Start with collapsedByDefault groups collapsed
        const initialExpanded = new Set<string>();
        navGroups.forEach((group) => {
            if (!group.collapsedByDefault) {
                initialExpanded.add(group.id);
            }
        });
        return initialExpanded;
    });

    // Badge counts for admin users
    const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({
        pendingConfirmations: 0,
        unreadSms: 0,
        pendingRequests: 0,
        pendingTasks: 0,
        newTbrTrips: 0,
    });

    // Check mobile viewport
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

    // Load collapsed state from localStorage - valid initialization pattern
    useEffect(() => {
        if (!isMobile) {
            const saved = localStorage.getItem("sidebar-collapsed");
            if (saved !== null) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setCollapsed(saved === "true");
            }
        }
    }, [isMobile]);

    // Fetch badge counts for admin users (with polling)
    useEffect(() => {
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            return;
        }

        const fetchCounts = async () => {
            try {
                const counts = await getNavBadgeCounts();
                setBadgeCounts(counts);
            } catch (error) {
                console.error("Failed to fetch badge counts:", error);
            }
        };

        // Initial fetch
        fetchCounts();

        // Poll every 60 seconds
        const interval = setInterval(fetchCounts, 60000);
        return () => clearInterval(interval);
    }, [role]);

    const toggleCollapsed = useCallback(() => {
        const newState = !collapsed;
        setCollapsed(newState);
        if (!isMobile) {
            localStorage.setItem("sidebar-collapsed", String(newState));
        }
    }, [collapsed, isMobile]);

    const toggleGroupExpanded = useCallback((groupId: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    }, []);

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
                {navGroups.map((group) => (
                    <NavGroup
                        key={group.id}
                        group={group}
                        collapsed={collapsed}
                        userRole={role}
                        badgeCounts={badgeCounts}
                        isExpanded={expandedGroups.has(group.id)}
                        onToggleExpand={() => toggleGroupExpanded(group.id)}
                        onItemClick={isMobile ? closeMobileMenu : undefined}
                    />
                ))}
            </nav>

            {/* Footer */}
            <div className={styles.footer}>
                <Link
                    href="/settings"
                    className={styles.footerLink}
                    title={collapsed ? "Settings" : undefined}
                    onClick={isMobile ? closeMobileMenu : undefined}
                >
                    <Settings size={18} />
                    <span>Settings</span>
                </Link>
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
