"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Users,
    CheckCircle,
    FileText,
    Clock,
    MessageSquare,
    UserCheck,
    TrendingUp,
    Settings,
    Shield,
    LogIn,
    Quote,
    X,
    ChevronRight,
} from "lucide-react";
import {
    AdminDashboardStats,
    DispatcherAccessConfig,
    DispatcherAnalytics,
    updateDispatcherFeatureAccess,
    updateDispatcherTaskConfig,
} from "@/lib/adminDashboardActions";
import { DISPATCHER_FEATURES, TASK_PRESETS } from "@/lib/adminConstants";
import { DispatcherFeature, PermissionLevel } from "@prisma/client";
import styles from "./AdminDashboard.module.css";

type TabType = "overview" | "permissions" | "analytics";

interface Props {
    stats: AdminDashboardStats;
    dispatchers: DispatcherAccessConfig[];
    analytics: DispatcherAnalytics[];
    activity: {
        recentLogins: { id: string; name: string | null; lastLogin: Date | null }[];
        recentReports: { id: string; user: { name: string | null }; status: string; createdAt: Date }[];
        recentQuotes: { id: string; clientName: string; status: string; createdAt: Date; createdBy: { name: string | null } }[];
    };
    isSuperAdmin: boolean;
}

export default function AdminDashboardClient({
    stats,
    dispatchers,
    analytics,
    activity,
    isSuperAdmin: _isSuperAdmin,
}: Props) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [selectedDispatcher, setSelectedDispatcher] = useState<DispatcherAccessConfig | null>(null);
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const handlePermissionChange = async (
        userId: string,
        feature: DispatcherFeature,
        permission: PermissionLevel
    ) => {
        setSaving(true);
        try {
            await updateDispatcherFeatureAccess(userId, feature, permission);
            router.refresh();
        } catch (error) {
            console.error("Failed to update permission:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleTaskConfigSave = async (
        primaryTask: string | null,
        secondaryTask: string | null,
        notes: string | null
    ) => {
        if (!selectedDispatcher) return;
        setSaving(true);
        try {
            await updateDispatcherTaskConfig(selectedDispatcher.userId, {
                primaryTask,
                secondaryTask,
                notes,
            });
            router.refresh();
            setTaskModalOpen(false);
            setSelectedDispatcher(null);
        } catch (error) {
            console.error("Failed to update task config:", error);
        } finally {
            setSaving(false);
        }
    };

    const formatTimeAgo = (date: Date | null) => {
        if (!date) return "Never";
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerIcon}>
                        <LayoutDashboard size={28} />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>Admin Dashboard</h1>
                        <p className={styles.headerSubtitle}>
                            System overview, dispatcher management, and analytics
                        </p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("overview")}
                >
                    <LayoutDashboard size={16} />
                    Overview
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "permissions" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("permissions")}
                >
                    <Shield size={16} />
                    Permissions
                </button>
                <button
                    className={`${styles.tab} ${activeTab === "analytics" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("analytics")}
                >
                    <TrendingUp size={16} />
                    Analytics
                </button>
            </div>

            {activeTab === "overview" && (
                <>
                    {/* Stats Grid */}
                    <div className={styles.statsGrid}>
                        {/* Users */}
                        <div className={styles.statCard}>
                            <div className={styles.statHeader}>
                                <div className={`${styles.statIconWrapper} ${styles.users}`}>
                                    <Users size={20} />
                                </div>
                                <span className={styles.statTitle}>Users</span>
                            </div>
                            <div className={styles.statBody}>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>{stats.users.total}</div>
                                    <div className={styles.statLabel}>Total</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>{stats.users.dispatchers}</div>
                                    <div className={styles.statLabel}>Dispatchers</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${stats.users.pendingApproval > 0 ? styles.warning : ""}`}>
                                        {stats.users.pendingApproval}
                                    </div>
                                    <div className={styles.statLabel}>Pending</div>
                                </div>
                            </div>
                        </div>

                        {/* Confirmations */}
                        <div className={styles.statCard}>
                            <div className={styles.statHeader}>
                                <div className={`${styles.statIconWrapper} ${styles.confirmations}`}>
                                    <CheckCircle size={20} />
                                </div>
                                <span className={styles.statTitle}>Confirmations</span>
                            </div>
                            <div className={styles.statBody}>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>{stats.confirmations.pending}</div>
                                    <div className={styles.statLabel}>Pending</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${stats.confirmations.overdue > 0 ? styles.danger : ""}`}>
                                        {stats.confirmations.overdue}
                                    </div>
                                    <div className={styles.statLabel}>Overdue</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${styles.success}`}>
                                        {stats.confirmations.completedToday}
                                    </div>
                                    <div className={styles.statLabel}>Today</div>
                                </div>
                            </div>
                        </div>

                        {/* Quotes */}
                        <div className={styles.statCard}>
                            <div className={styles.statHeader}>
                                <div className={`${styles.statIconWrapper} ${styles.quotes}`}>
                                    <FileText size={20} />
                                </div>
                                <span className={styles.statTitle}>Quotes Today</span>
                            </div>
                            <div className={styles.statBody}>
                                <div className={styles.statItem}>
                                    <div className={styles.statValue}>{stats.quotes.pendingToday}</div>
                                    <div className={styles.statLabel}>Pending</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${styles.success}`}>
                                        {stats.quotes.convertedToday}
                                    </div>
                                    <div className={styles.statLabel}>Converted</div>
                                </div>
                            </div>
                        </div>

                        {/* Shifts */}
                        <div className={styles.statCard}>
                            <div className={styles.statHeader}>
                                <div className={`${styles.statIconWrapper} ${styles.shifts}`}>
                                    <Clock size={20} />
                                </div>
                                <span className={styles.statTitle}>Shifts</span>
                            </div>
                            <div className={styles.statBody}>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${styles.success}`}>
                                        {stats.shifts.activeNow}
                                    </div>
                                    <div className={styles.statLabel}>Active</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${stats.shifts.reportsToReview > 0 ? styles.warning : ""}`}>
                                        {stats.shifts.reportsToReview}
                                    </div>
                                    <div className={styles.statLabel}>To Review</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${stats.shifts.flaggedReports > 0 ? styles.danger : ""}`}>
                                        {stats.shifts.flaggedReports}
                                    </div>
                                    <div className={styles.statLabel}>Flagged</div>
                                </div>
                            </div>
                        </div>

                        {/* Requests */}
                        <div className={styles.statCard}>
                            <div className={styles.statHeader}>
                                <div className={`${styles.statIconWrapper} ${styles.requests}`}>
                                    <UserCheck size={20} />
                                </div>
                                <span className={styles.statTitle}>Requests</span>
                            </div>
                            <div className={styles.statBody}>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${stats.requests.pendingTimeOff > 0 ? styles.warning : ""}`}>
                                        {stats.requests.pendingTimeOff}
                                    </div>
                                    <div className={styles.statLabel}>Time Off</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${stats.requests.pendingSwaps > 0 ? styles.warning : ""}`}>
                                        {stats.requests.pendingSwaps}
                                    </div>
                                    <div className={styles.statLabel}>Swaps</div>
                                </div>
                            </div>
                        </div>

                        {/* Contacts */}
                        <div className={styles.statCard}>
                            <div className={styles.statHeader}>
                                <div className={`${styles.statIconWrapper} ${styles.contacts}`}>
                                    <MessageSquare size={20} />
                                </div>
                                <span className={styles.statTitle}>Contacts</span>
                            </div>
                            <div className={styles.statBody}>
                                <div className={styles.statItem}>
                                    <div className={`${styles.statValue} ${stats.contacts.pendingApproval > 0 ? styles.warning : ""}`}>
                                        {stats.contacts.pendingApproval}
                                    </div>
                                    <div className={styles.statLabel}>Pending Approval</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>
                                <ChevronRight size={18} />
                                Quick Actions
                            </h2>
                        </div>
                        <div className={styles.quickActions}>
                            <Link href="/admin/approvals" className={styles.quickAction}>
                                <div className={`${styles.quickActionIcon} ${styles.blue}`}>
                                    <UserCheck size={18} />
                                </div>
                                <span className={styles.quickActionText}>User Approvals</span>
                                {stats.users.pendingApproval > 0 && (
                                    <span className={styles.quickActionBadge}>{stats.users.pendingApproval}</span>
                                )}
                            </Link>
                            <Link href="/admin/confirmations" className={styles.quickAction}>
                                <div className={`${styles.quickActionIcon} ${styles.orange}`}>
                                    <CheckCircle size={18} />
                                </div>
                                <span className={styles.quickActionText}>Trip Confirmations</span>
                                {stats.confirmations.overdue > 0 && (
                                    <span className={styles.quickActionBadge}>{stats.confirmations.overdue}</span>
                                )}
                            </Link>
                            <Link href="/admin/reports" className={styles.quickAction}>
                                <div className={`${styles.quickActionIcon} ${styles.purple}`}>
                                    <FileText size={18} />
                                </div>
                                <span className={styles.quickActionText}>Review Reports</span>
                                {stats.shifts.reportsToReview > 0 && (
                                    <span className={styles.quickActionBadge}>{stats.shifts.reportsToReview}</span>
                                )}
                            </Link>
                            <Link href="/admin/requests" className={styles.quickAction}>
                                <div className={`${styles.quickActionIcon} ${styles.pink}`}>
                                    <Clock size={18} />
                                </div>
                                <span className={styles.quickActionText}>Time Off Requests</span>
                                {stats.requests.pendingTimeOff > 0 && (
                                    <span className={styles.quickActionBadge}>{stats.requests.pendingTimeOff}</span>
                                )}
                            </Link>
                            <Link href="/admin/contacts" className={styles.quickAction}>
                                <div className={`${styles.quickActionIcon} ${styles.green}`}>
                                    <Users size={18} />
                                </div>
                                <span className={styles.quickActionText}>Contact Management</span>
                            </Link>
                            <Link href="/admin/sms" className={styles.quickAction}>
                                <div className={`${styles.quickActionIcon} ${styles.blue}`}>
                                    <MessageSquare size={18} />
                                </div>
                                <span className={styles.quickActionText}>SMS Center</span>
                            </Link>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>
                                <Clock size={18} />
                                Recent Activity
                            </h2>
                        </div>
                        <div className={styles.activityList}>
                            {activity.recentLogins.slice(0, 5).map((login) => (
                                <div key={login.id} className={styles.activityItem}>
                                    <div className={`${styles.activityIcon} ${styles.login}`}>
                                        <LogIn size={14} />
                                    </div>
                                    <div className={styles.activityContent}>
                                        <div className={styles.activityTitle}>{login.name || "Unknown"}</div>
                                        <div className={styles.activityMeta}>Logged in</div>
                                    </div>
                                    <span className={styles.activityTime}>{formatTimeAgo(login.lastLogin)}</span>
                                </div>
                            ))}
                            {activity.recentReports.slice(0, 3).map((report) => (
                                <div key={report.id} className={styles.activityItem}>
                                    <div className={`${styles.activityIcon} ${styles.report}`}>
                                        <FileText size={14} />
                                    </div>
                                    <div className={styles.activityContent}>
                                        <div className={styles.activityTitle}>{report.user.name || "Unknown"}</div>
                                        <div className={styles.activityMeta}>
                                            Shift report {report.status.toLowerCase()}
                                        </div>
                                    </div>
                                    <span className={styles.activityTime}>{formatTimeAgo(report.createdAt)}</span>
                                </div>
                            ))}
                            {activity.recentQuotes.slice(0, 3).map((quote) => (
                                <div key={quote.id} className={styles.activityItem}>
                                    <div className={`${styles.activityIcon} ${styles.quote}`}>
                                        <Quote size={14} />
                                    </div>
                                    <div className={styles.activityContent}>
                                        <div className={styles.activityTitle}>{quote.clientName}</div>
                                        <div className={styles.activityMeta}>
                                            Quote by {quote.createdBy.name || "Unknown"}
                                        </div>
                                    </div>
                                    <span className={styles.activityTime}>{formatTimeAgo(quote.createdAt)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === "permissions" && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <Shield size={18} />
                            Dispatcher Feature Access
                        </h2>
                    </div>
                    {dispatchers.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Users size={48} />
                            <h3>No Dispatchers</h3>
                            <p>No active dispatchers found in the system.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className={styles.dispatcherTable}>
                                <thead>
                                    <tr>
                                        <th>Dispatcher</th>
                                        <th>Tasks</th>
                                        {DISPATCHER_FEATURES.slice(0, 6).map((f) => (
                                            <th key={f.key} title={f.description}>{f.label}</th>
                                        ))}
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dispatchers.map((dispatcher) => (
                                        <tr key={dispatcher.userId}>
                                            <td>
                                                <div className={styles.dispatcherName}>{dispatcher.userName}</div>
                                                <div className={styles.dispatcherEmail}>{dispatcher.email}</div>
                                            </td>
                                            <td>
                                                {dispatcher.taskConfig?.primaryTask && (
                                                    <span className={`${styles.taskBadge} ${styles.primary}`}>
                                                        {dispatcher.taskConfig.primaryTask}
                                                    </span>
                                                )}
                                                {dispatcher.taskConfig?.secondaryTask && (
                                                    <span className={`${styles.taskBadge} ${styles.secondary}`}>
                                                        {dispatcher.taskConfig.secondaryTask}
                                                    </span>
                                                )}
                                                {!dispatcher.taskConfig?.primaryTask && !dispatcher.taskConfig?.secondaryTask && (
                                                    <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                                                        Not assigned
                                                    </span>
                                                )}
                                            </td>
                                            {DISPATCHER_FEATURES.slice(0, 6).map((feature) => (
                                                <td key={feature.key}>
                                                    <div className={styles.permissionToggle}>
                                                        {(["NONE", "READ", "EDIT"] as PermissionLevel[]).map((level) => (
                                                            <button
                                                                key={level}
                                                                type="button"
                                                                className={`${styles.permissionBtn} ${
                                                                    dispatcher.permissions[feature.key] === level
                                                                        ? level === "NONE"
                                                                            ? styles.activeNone
                                                                            : level === "READ"
                                                                            ? styles.activeRead
                                                                            : styles.activeEdit
                                                                        : ""
                                                                }`}
                                                                onClick={() => handlePermissionChange(dispatcher.userId, feature.key, level)}
                                                                disabled={saving}
                                                            >
                                                                {level === "NONE" ? "-" : level === "READ" ? "R" : "E"}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                            ))}
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => {
                                                        setSelectedDispatcher(dispatcher);
                                                        setTaskModalOpen(true);
                                                    }}
                                                    title="Configure tasks"
                                                >
                                                    <Settings size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--bg-muted)", borderRadius: "8px" }}>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            <strong>Permission Levels:</strong>{" "}
                            <span style={{ color: "var(--danger)" }}>-</span> = No access,{" "}
                            <span style={{ color: "#92400e" }}>R</span> = Read only,{" "}
                            <span style={{ color: "#166534" }}>E</span> = Full edit access
                        </p>
                    </div>
                </div>
            )}

            {activeTab === "analytics" && (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>
                            <TrendingUp size={18} />
                            Dispatcher Performance (This Month)
                        </h2>
                    </div>
                    {analytics.length === 0 ? (
                        <div className={styles.emptyState}>
                            <TrendingUp size={48} />
                            <h3>No Data</h3>
                            <p>No dispatcher activity data available.</p>
                        </div>
                    ) : (
                        <div className={styles.analyticsGrid}>
                            {analytics.map((dispatcher) => (
                                <div key={dispatcher.userId} className={styles.analyticsCard}>
                                    <div className={styles.analyticsHeader}>
                                        <span className={styles.analyticsName}>{dispatcher.userName}</span>
                                        <div className={styles.analyticsTasks}>
                                            {dispatcher.primaryTask && (
                                                <span className={`${styles.taskBadge} ${styles.primary}`}>
                                                    {dispatcher.primaryTask}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.analyticsStats}>
                                        <div className={styles.analyticsStat}>
                                            <div className={styles.analyticsStatValue}>{dispatcher.stats.shiftsThisMonth}</div>
                                            <div className={styles.analyticsStatLabel}>Shifts</div>
                                        </div>
                                        <div className={styles.analyticsStat}>
                                            <div className={styles.analyticsStatValue}>{dispatcher.stats.hoursThisMonth}</div>
                                            <div className={styles.analyticsStatLabel}>Hours</div>
                                        </div>
                                        <div className={styles.analyticsStat}>
                                            <div className={styles.analyticsStatValue}>{dispatcher.stats.quotesCreated}</div>
                                            <div className={styles.analyticsStatLabel}>Quotes</div>
                                        </div>
                                        <div className={styles.analyticsStat}>
                                            <div className={styles.analyticsStatValue}>{dispatcher.stats.quotesConverted}</div>
                                            <div className={styles.analyticsStatLabel}>Converted</div>
                                        </div>
                                        <div className={styles.analyticsStat}>
                                            <div className={styles.analyticsStatValue}>{dispatcher.stats.confirmationsCompleted}</div>
                                            <div className={styles.analyticsStatLabel}>Confirms</div>
                                        </div>
                                        <div className={styles.analyticsStat}>
                                            <div className={styles.analyticsStatValue}>
                                                {dispatcher.stats.reportsSubmitted}
                                                {dispatcher.stats.flaggedReports > 0 && (
                                                    <span style={{ color: "var(--danger)", fontSize: "0.7rem" }}>
                                                        {" "}({dispatcher.stats.flaggedReports})
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.analyticsStatLabel}>Reports</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Task Config Modal */}
            {taskModalOpen && selectedDispatcher && (
                <TaskConfigModal
                    dispatcher={selectedDispatcher}
                    onClose={() => {
                        setTaskModalOpen(false);
                        setSelectedDispatcher(null);
                    }}
                    onSave={handleTaskConfigSave}
                    saving={saving}
                />
            )}
        </div>
    );
}

// Task Config Modal Component
function TaskConfigModal({
    dispatcher,
    onClose,
    onSave,
    saving,
}: {
    dispatcher: DispatcherAccessConfig;
    onClose: () => void;
    onSave: (primary: string | null, secondary: string | null, notes: string | null) => void;
    saving: boolean;
}) {
    const [primaryTask, setPrimaryTask] = useState(dispatcher.taskConfig?.primaryTask || "");
    const [secondaryTask, setSecondaryTask] = useState(dispatcher.taskConfig?.secondaryTask || "");
    const [notes, setNotes] = useState(dispatcher.taskConfig?.notes || "");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(
            primaryTask.trim() || null,
            secondaryTask.trim() || null,
            notes.trim() || null
        );
    };

    return (
        <div className={styles.modal} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>
                        Configure Tasks - {dispatcher.userName}
                    </h3>
                    <button type="button" className={styles.modalClose} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className={styles.modalBody}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Primary Task</label>
                            <select
                                className={styles.formSelect}
                                value={primaryTask}
                                onChange={(e) => setPrimaryTask(e.target.value)}
                            >
                                <option value="">Select primary task...</option>
                                {TASK_PRESETS.map((task) => (
                                    <option key={task} value={task}>{task}</option>
                                ))}
                            </select>
                            <div className={styles.presetChips}>
                                {TASK_PRESETS.slice(0, 4).map((task) => (
                                    <button
                                        key={task}
                                        type="button"
                                        className={styles.presetChip}
                                        onClick={() => setPrimaryTask(task)}
                                    >
                                        {task}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Secondary Task</label>
                            <select
                                className={styles.formSelect}
                                value={secondaryTask}
                                onChange={(e) => setSecondaryTask(e.target.value)}
                            >
                                <option value="">Select secondary task...</option>
                                {TASK_PRESETS.map((task) => (
                                    <option key={task} value={task}>{task}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Notes</label>
                            <textarea
                                className={styles.formTextarea}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Any additional notes about this dispatcher's responsibilities..."
                            />
                        </div>
                    </div>
                    <div className={styles.modalFooter}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? "Saving..." : "Save Configuration"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
