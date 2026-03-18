/**
 * Centralized Navigation Configuration
 *
 * All sidebar navigation is defined here. Sidebar.tsx consumes this config
 * and renders dynamically based on the current user's role.
 *
 * Array order defines display order (no priority field needed).
 */

import {
    LayoutDashboard,
    Calendar,
    Clock,
    ClipboardList,
    MessageSquare,
    Contact,
    Car,
    Globe,
    Phone,
    BookOpen,
    Network,
    Gauge,
    CalendarClock,
    Users,
    FileEdit,
    CheckSquare,
    StickyNote,
    Calculator,
    DollarSign,
    FileSearch,
    FileText,
    Trophy,
    UserCog,
    Cog,
    History,
    Settings,
    LogOut,
    type LucideIcon,
} from "lucide-react";

// ============================================
// Types
// ============================================

export type Role = "SUPER_ADMIN" | "ADMIN" | "ACCOUNTING" | "DISPATCHER";

export interface NavItem {
    id: string;
    label: string;
    href: string;
    icon: LucideIcon;
    roles?: Role[]; // If specified, only these roles see this item (within their group)
    badgeKey?: keyof BadgeCounts;
    isComponent?: boolean; // True for ClockButton (renders component instead of link)
}

export interface NavGroup {
    id: string;
    title: string;
    items: NavItem[];
    collapsedByDefault?: boolean;
}

export interface BadgeCounts {
    pendingConfirmations: number;
    unreadSms: number;
    pendingRequests: number;
    pendingTasks: number;
    newTbrTrips: number;
    pendingBillingTasks: number;
}

// ============================================
// Footer Items (shared across all roles)
// ============================================

export const FOOTER_ITEMS: NavItem[] = [
    {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
    },
    {
        id: "signout",
        label: "Sign Out",
        href: "#signout", // Handled as action, not navigation
        icon: LogOut,
    },
];

// ============================================
// DISPATCHER Navigation
// ============================================

export const DISPATCHER_NAV: NavGroup[] = [
    {
        id: "my-shift",
        title: "My Shift",
        items: [
            {
                id: "dashboard",
                label: "Dashboard",
                href: "/dashboard",
                icon: LayoutDashboard,
            },
            {
                id: "schedule",
                label: "My Schedule",
                href: "/schedule",
                icon: Calendar,
            },
            {
                id: "clock",
                label: "Clock In/Out",
                href: "#clock",
                icon: Clock,
                isComponent: true,
            },
            {
                id: "shift-report",
                label: "Shift Report",
                href: "/reports/shift",
                icon: ClipboardList,
            },
        ],
    },
    {
        id: "communications",
        title: "Communications",
        items: [
            {
                id: "sms",
                label: "SMS Center",
                href: "/sms",
                icon: MessageSquare,
            },
            {
                id: "directory",
                label: "Directory",
                href: "/dispatcher/directory",
                icon: Contact,
            },
        ],
    },
    {
        id: "operations",
        title: "Operations",
        items: [
            {
                id: "fleet",
                label: "Fleet",
                href: "/fleet",
                icon: Car,
            },
            {
                id: "tbr-trips",
                label: "TBR Trips",
                href: "/tbr-trips",
                icon: Globe,
            },
            {
                id: "confirmations",
                label: "Confirmations",
                href: "/confirmations", // TODO: Create dispatcher confirmations page
                icon: Phone,
            },
        ],
    },
    {
        id: "resources",
        title: "Resources",
        items: [
            {
                id: "sops",
                label: "SOPs",
                href: "/sops",
                icon: BookOpen,
            },
            {
                id: "network",
                label: "Network",
                href: "/network",
                icon: Network,
            },
            {
                id: "portals",
                label: "Portals",
                href: "/portals",
                icon: Globe,
            },
        ],
    },
];

// ============================================
// ADMIN / SUPER_ADMIN Navigation
// ============================================

export const ADMIN_NAV: NavGroup[] = [
    {
        id: "dashboard",
        title: "Dashboard",
        items: [
            {
                id: "admin-overview",
                label: "Operations Overview",
                href: "/admin",
                icon: Gauge,
            },
            {
                id: "dispatcher-view",
                label: "Dispatcher Dashboard",
                href: "/dashboard",
                icon: LayoutDashboard,
            },
        ],
    },
    {
        id: "daily-operations",
        title: "Daily Operations",
        items: [
            {
                id: "confirmations",
                label: "Confirmations",
                href: "/admin/confirmations",
                icon: Phone,
                badgeKey: "pendingConfirmations",
            },
            {
                id: "scheduler",
                label: "Schedule Builder",
                href: "/admin/scheduler",
                icon: CalendarClock,
            },
            {
                id: "sms-dashboard",
                label: "SMS Dashboard",
                href: "/admin/sms",
                icon: MessageSquare,
                badgeKey: "unreadSms",
            },
            {
                id: "tbr-trips",
                label: "TBR Trips",
                href: "/tbr-trips",
                icon: Globe,
                badgeKey: "newTbrTrips",
            },
        ],
    },
    {
        id: "team-management",
        title: "Team Management",
        items: [
            {
                id: "dispatchers",
                label: "Dispatchers",
                href: "/admin/dispatchers",
                icon: Users,
            },
            {
                id: "requests",
                label: "Requests & Approvals",
                href: "/admin/requests",
                icon: FileEdit,
                badgeKey: "pendingRequests",
            },
            {
                id: "hours",
                label: "Hours Tracking",
                href: "/admin/hours",
                icon: Clock,
            },
            {
                id: "tasks",
                label: "Admin Tasks",
                href: "/admin/tasks",
                icon: CheckSquare,
                badgeKey: "pendingTasks",
            },
            {
                id: "notes",
                label: "Global Notes",
                href: "/admin/notes",
                icon: StickyNote,
            },
        ],
    },
    {
        id: "network-fleet",
        title: "Network & Fleet",
        items: [
            {
                id: "fleet",
                label: "Fleet",
                href: "/fleet",
                icon: Car,
            },
            {
                id: "affiliates",
                label: "Affiliates",
                href: "/affiliates",
                icon: Users,
            },
            {
                id: "network",
                label: "Network",
                href: "/network",
                icon: Network,
            },
        ],
    },
    {
        id: "finance",
        title: "Finance",
        items: [
            {
                id: "accounting",
                label: "Accounting",
                href: "/accounting",
                icon: Calculator,
                badgeKey: "pendingBillingTasks",
            },
            {
                id: "pricing",
                label: "Route Pricing",
                href: "/admin/pricing",
                icon: DollarSign,
            },
            {
                id: "affiliate-audit",
                label: "Affiliate Audit",
                href: "/admin/affiliate-audit",
                icon: FileSearch,
            },
        ],
    },
    {
        id: "reports",
        title: "Reports & Analytics",
        items: [
            {
                id: "shift-reports",
                label: "Shift Reports",
                href: "/admin/reports",
                icon: FileText,
            },
            {
                id: "scorecard",
                label: "Scorecard",
                href: "/admin/scorecard",
                icon: Trophy,
            },
        ],
    },
    {
        id: "system",
        title: "System",
        collapsedByDefault: true,
        items: [
            {
                id: "user-management",
                label: "User Management",
                href: "/admin/users",
                icon: UserCog,
                roles: ["SUPER_ADMIN"], // Only SUPER_ADMIN sees this
            },
            {
                id: "tbr-settings",
                label: "TBR Settings",
                href: "/admin/tbr-settings",
                icon: Cog,
            },
            {
                id: "sops-management",
                label: "SOPs Management",
                href: "/admin/sops",
                icon: BookOpen,
            },
            {
                id: "portals",
                label: "Portals",
                href: "/portals",
                icon: Globe,
            },
            {
                id: "audit-log",
                label: "Audit Log",
                href: "/admin/audit",
                icon: History,
                roles: ["SUPER_ADMIN"], // Only SUPER_ADMIN sees this
            },
            {
                id: "settings",
                label: "Settings",
                href: "/admin/settings",
                icon: Settings,
            },
        ],
    },
];

// ============================================
// ACCOUNTING Navigation
// ============================================

export const ACCOUNTING_NAV: NavGroup[] = [
    {
        id: "dashboard",
        title: "Dashboard",
        items: [
            {
                id: "overview",
                label: "Overview",
                href: "/dashboard",
                icon: LayoutDashboard,
            },
        ],
    },
    {
        id: "finance",
        title: "Finance",
        items: [
            {
                id: "accounting",
                label: "Accounting",
                href: "/accounting",
                icon: Calculator,
                badgeKey: "pendingBillingTasks",
            },
            {
                id: "pricing",
                label: "Route Pricing",
                href: "/admin/pricing",
                icon: DollarSign,
            },
            {
                id: "affiliate-audit",
                label: "Affiliate Audit",
                href: "/admin/affiliate-audit",
                icon: FileSearch,
            },
        ],
    },
    {
        id: "operations",
        title: "Operations",
        items: [
            {
                id: "fleet",
                label: "Fleet",
                href: "/fleet",
                icon: Car,
            },
            {
                id: "network",
                label: "Network",
                href: "/network",
                icon: Network,
            },
            {
                id: "affiliates",
                label: "Affiliates",
                href: "/affiliates",
                icon: Users,
            },
            {
                id: "tbr-trips",
                label: "TBR Trips",
                href: "/tbr-trips",
                icon: Globe,
            },
        ],
    },
    {
        id: "resources",
        title: "Resources",
        items: [
            {
                id: "sms",
                label: "SMS Center",
                href: "/sms",
                icon: MessageSquare,
            },
            {
                id: "sops",
                label: "SOPs",
                href: "/sops",
                icon: BookOpen,
            },
            {
                id: "directory",
                label: "Directory",
                href: "/dispatcher/directory",
                icon: Contact,
            },
            {
                id: "portals",
                label: "Portals",
                href: "/portals",
                icon: Globe,
            },
        ],
    },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get navigation groups for a specific role
 */
export function getNavForRole(role: Role): NavGroup[] {
    switch (role) {
        case "SUPER_ADMIN":
        case "ADMIN":
            return ADMIN_NAV;
        case "ACCOUNTING":
            return ACCOUNTING_NAV;
        case "DISPATCHER":
        default:
            return DISPATCHER_NAV;
    }
}

/**
 * Filter items within a group based on the user's role
 * (Some items within a group may be restricted to specific roles)
 */
export function filterItemsByRole(items: NavItem[], userRole: Role): NavItem[] {
    return items.filter((item) => {
        // If no roles specified, item is visible to all who see the group
        if (!item.roles) return true;
        // Otherwise, check if user's role is in the allowed list
        return item.roles.includes(userRole);
    });
}

/**
 * Get empty badge counts (for roles that don't show badges)
 */
export function getEmptyBadgeCounts(): BadgeCounts {
    return {
        pendingConfirmations: 0,
        unreadSms: 0,
        pendingRequests: 0,
        pendingTasks: 0,
        newTbrTrips: 0,
        pendingBillingTasks: 0,
    };
}
