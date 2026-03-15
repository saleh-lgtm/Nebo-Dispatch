"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Users,
    Shield,
    ClipboardList,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Edit3,
    Eye,
    EyeOff,
    Save,
    RotateCcw,
} from "lucide-react";
import {
    DispatcherAccessConfig,
    DispatcherAnalytics,
    updateDispatcherFeatureAccess,
    updateDispatcherTaskConfig,
} from "@/lib/adminDashboardActions";
import { DISPATCHER_FEATURES, TASK_PRESETS } from "@/lib/adminConstants";
import { DispatcherFeature, PermissionLevel } from "@prisma/client";
import styles from "./DispatcherManagement.module.css";

interface Props {
    dispatchers: DispatcherAccessConfig[];
    analytics: DispatcherAnalytics[];
}

export default function DispatcherManagementClient({ dispatchers, analytics }: Props) {
    const router = useRouter();
    const [expandedDispatcher, setExpandedDispatcher] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingTasks, setEditingTasks] = useState<string | null>(null);
    const [taskForm, setTaskForm] = useState<{
        primaryTask: string;
        secondaryTask: string;
        notes: string;
    }>({ primaryTask: "", secondaryTask: "", notes: "" });

    const getAnalyticsForDispatcher = (userId: string) => {
        return analytics.find((a) => a.userId === userId);
    };

    const handlePermissionChange = async (
        userId: string,
        feature: DispatcherFeature,
        permission: PermissionLevel
    ) => {
        setSaving(`${userId}-${feature}`);
        try {
            await updateDispatcherFeatureAccess(userId, feature, permission);
            router.refresh();
        } catch (error) {
            console.error("Failed to update permission:", error);
        } finally {
            setSaving(null);
        }
    };

    const startEditingTasks = (dispatcher: DispatcherAccessConfig) => {
        setEditingTasks(dispatcher.userId);
        setTaskForm({
            primaryTask: dispatcher.taskConfig?.primaryTask || "",
            secondaryTask: dispatcher.taskConfig?.secondaryTask || "",
            notes: dispatcher.taskConfig?.notes || "",
        });
    };

    const cancelEditingTasks = () => {
        setEditingTasks(null);
        setTaskForm({ primaryTask: "", secondaryTask: "", notes: "" });
    };

    const saveTaskConfig = async (userId: string) => {
        setSaving(`${userId}-tasks`);
        try {
            await updateDispatcherTaskConfig(userId, {
                primaryTask: taskForm.primaryTask || null,
                secondaryTask: taskForm.secondaryTask || null,
                notes: taskForm.notes || null,
            });
            router.refresh();
            setEditingTasks(null);
        } catch (error) {
            console.error("Failed to update task config:", error);
        } finally {
            setSaving(null);
        }
    };

    const setAllPermissions = async (userId: string, level: PermissionLevel) => {
        setSaving(`${userId}-all`);
        try {
            for (const feature of DISPATCHER_FEATURES) {
                await updateDispatcherFeatureAccess(userId, feature.key, level);
            }
            router.refresh();
        } catch (error) {
            console.error("Failed to update permissions:", error);
        } finally {
            setSaving(null);
        }
    };

    const getPermissionIcon = (level: PermissionLevel) => {
        switch (level) {
            case "NONE":
                return <EyeOff size={14} />;
            case "READ":
                return <Eye size={14} />;
            case "EDIT":
                return <Edit3 size={14} />;
        }
    };

    const getPermissionLabel = (level: PermissionLevel) => {
        switch (level) {
            case "NONE":
                return "No Access";
            case "READ":
                return "Read Only";
            case "EDIT":
                return "Full Access";
        }
    };

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerIcon}>
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>Dispatcher Management</h1>
                        <p className={styles.headerSubtitle}>
                            Configure feature access and task assignments for dispatchers
                        </p>
                    </div>
                </div>
                <div className={styles.headerStats}>
                    <div className={styles.headerStat}>
                        <span className={styles.headerStatValue}>{dispatchers.length}</span>
                        <span className={styles.headerStatLabel}>Dispatchers</span>
                    </div>
                </div>
            </header>

            {/* Legend */}
            <div className={styles.legend}>
                <span className={styles.legendTitle}>Permission Levels:</span>
                <div className={styles.legendItems}>
                    <span className={`${styles.legendItem} ${styles.legendNone}`}>
                        <EyeOff size={12} /> No Access
                    </span>
                    <span className={`${styles.legendItem} ${styles.legendRead}`}>
                        <Eye size={12} /> Read Only
                    </span>
                    <span className={`${styles.legendItem} ${styles.legendEdit}`}>
                        <Edit3 size={12} /> Full Access
                    </span>
                </div>
            </div>

            {/* Dispatcher List */}
            <div className={styles.dispatcherList}>
                {dispatchers.length === 0 ? (
                    <div className={styles.emptyState}>
                        <Users size={48} />
                        <h3>No Dispatchers</h3>
                        <p>No active dispatchers found in the system.</p>
                    </div>
                ) : (
                    dispatchers.map((dispatcher) => {
                        const isExpanded = expandedDispatcher === dispatcher.userId;
                        const dispatcherAnalytics = getAnalyticsForDispatcher(dispatcher.userId);
                        const isEditingThis = editingTasks === dispatcher.userId;

                        return (
                            <div key={dispatcher.userId} className={styles.dispatcherCard}>
                                {/* Dispatcher Header */}
                                <div
                                    className={styles.dispatcherHeader}
                                    onClick={() => setExpandedDispatcher(isExpanded ? null : dispatcher.userId)}
                                >
                                    <div className={styles.dispatcherInfo}>
                                        <div className={styles.dispatcherAvatar}>
                                            {(dispatcher.userName || "U").charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className={styles.dispatcherName}>{dispatcher.userName}</div>
                                            <div className={styles.dispatcherEmail}>{dispatcher.email}</div>
                                        </div>
                                    </div>
                                    <div className={styles.dispatcherTasks}>
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
                                            <span className={styles.noTasks}>No tasks assigned</span>
                                        )}
                                    </div>
                                    <div className={styles.dispatcherMeta}>
                                        {dispatcherAnalytics && (
                                            <span className={styles.dispatcherStat}>
                                                {dispatcherAnalytics.stats.hoursThisMonth}h this month
                                            </span>
                                        )}
                                        <button type="button" className={styles.expandBtn}>
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className={styles.dispatcherBody}>
                                        {/* Task Assignment Section */}
                                        <div className={styles.section}>
                                            <div className={styles.sectionHeader}>
                                                <h3 className={styles.sectionTitle}>
                                                    <ClipboardList size={16} />
                                                    Task Assignment
                                                </h3>
                                                {!isEditingThis && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => startEditingTasks(dispatcher)}
                                                    >
                                                        <Edit3 size={14} />
                                                        Edit
                                                    </button>
                                                )}
                                            </div>

                                            {isEditingThis ? (
                                                <div className={styles.taskForm}>
                                                    <div className={styles.taskFormRow}>
                                                        <div className={styles.taskFormGroup}>
                                                            <label>Primary Task</label>
                                                            <select
                                                                value={taskForm.primaryTask}
                                                                onChange={(e) =>
                                                                    setTaskForm((f) => ({ ...f, primaryTask: e.target.value }))
                                                                }
                                                            >
                                                                <option value="">Select primary task...</option>
                                                                {TASK_PRESETS.map((task) => (
                                                                    <option key={task} value={task}>
                                                                        {task}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className={styles.taskFormGroup}>
                                                            <label>Secondary Task</label>
                                                            <select
                                                                value={taskForm.secondaryTask}
                                                                onChange={(e) =>
                                                                    setTaskForm((f) => ({ ...f, secondaryTask: e.target.value }))
                                                                }
                                                            >
                                                                <option value="">Select secondary task...</option>
                                                                {TASK_PRESETS.map((task) => (
                                                                    <option key={task} value={task}>
                                                                        {task}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className={styles.taskFormGroup}>
                                                        <label>Notes</label>
                                                        <textarea
                                                            value={taskForm.notes}
                                                            onChange={(e) =>
                                                                setTaskForm((f) => ({ ...f, notes: e.target.value }))
                                                            }
                                                            placeholder="Additional notes about responsibilities..."
                                                            rows={2}
                                                        />
                                                    </div>
                                                    <div className={styles.taskFormActions}>
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={cancelEditingTasks}
                                                            disabled={saving === `${dispatcher.userId}-tasks`}
                                                        >
                                                            <X size={14} />
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => saveTaskConfig(dispatcher.userId)}
                                                            disabled={saving === `${dispatcher.userId}-tasks`}
                                                        >
                                                            <Save size={14} />
                                                            {saving === `${dispatcher.userId}-tasks` ? "Saving..." : "Save"}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={styles.taskDisplay}>
                                                    <div className={styles.taskDisplayItem}>
                                                        <span className={styles.taskDisplayLabel}>Primary:</span>
                                                        <span className={styles.taskDisplayValue}>
                                                            {dispatcher.taskConfig?.primaryTask || "Not assigned"}
                                                        </span>
                                                    </div>
                                                    <div className={styles.taskDisplayItem}>
                                                        <span className={styles.taskDisplayLabel}>Secondary:</span>
                                                        <span className={styles.taskDisplayValue}>
                                                            {dispatcher.taskConfig?.secondaryTask || "Not assigned"}
                                                        </span>
                                                    </div>
                                                    {dispatcher.taskConfig?.notes && (
                                                        <div className={styles.taskDisplayItem}>
                                                            <span className={styles.taskDisplayLabel}>Notes:</span>
                                                            <span className={styles.taskDisplayValue}>
                                                                {dispatcher.taskConfig.notes}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Permissions Section */}
                                        <div className={styles.section}>
                                            <div className={styles.sectionHeader}>
                                                <h3 className={styles.sectionTitle}>
                                                    <Shield size={16} />
                                                    Feature Permissions
                                                </h3>
                                                <div className={styles.bulkActions}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setAllPermissions(dispatcher.userId, "READ")}
                                                        disabled={saving?.startsWith(dispatcher.userId)}
                                                        title="Set all to Read Only"
                                                    >
                                                        <Eye size={14} />
                                                        All Read
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setAllPermissions(dispatcher.userId, "EDIT")}
                                                        disabled={saving?.startsWith(dispatcher.userId)}
                                                        title="Set all to Full Access"
                                                    >
                                                        <Edit3 size={14} />
                                                        All Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setAllPermissions(dispatcher.userId, "NONE")}
                                                        disabled={saving?.startsWith(dispatcher.userId)}
                                                        title="Remove all access"
                                                    >
                                                        <RotateCcw size={14} />
                                                        Reset
                                                    </button>
                                                </div>
                                            </div>

                                            <div className={styles.permissionsGrid}>
                                                {DISPATCHER_FEATURES.map((feature) => {
                                                    const currentPermission = dispatcher.permissions[feature.key];
                                                    const isSavingThis = saving === `${dispatcher.userId}-${feature.key}`;

                                                    return (
                                                        <div key={feature.key} className={styles.permissionCard}>
                                                            <div className={styles.permissionInfo}>
                                                                <span className={styles.permissionName}>{feature.label}</span>
                                                                <span className={styles.permissionDesc}>{feature.description}</span>
                                                            </div>
                                                            <div className={styles.permissionControls}>
                                                                {(["NONE", "READ", "EDIT"] as PermissionLevel[]).map((level) => (
                                                                    <button
                                                                        key={level}
                                                                        type="button"
                                                                        className={`${styles.permissionBtn} ${
                                                                            currentPermission === level
                                                                                ? level === "NONE"
                                                                                    ? styles.activeNone
                                                                                    : level === "READ"
                                                                                    ? styles.activeRead
                                                                                    : styles.activeEdit
                                                                                : ""
                                                                        }`}
                                                                        onClick={() =>
                                                                            handlePermissionChange(dispatcher.userId, feature.key, level)
                                                                        }
                                                                        disabled={isSavingThis || saving === `${dispatcher.userId}-all`}
                                                                        title={getPermissionLabel(level)}
                                                                    >
                                                                        {isSavingThis && currentPermission !== level ? (
                                                                            "..."
                                                                        ) : (
                                                                            getPermissionIcon(level)
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Analytics Summary */}
                                        {dispatcherAnalytics && (
                                            <div className={styles.section}>
                                                <h3 className={styles.sectionTitle}>This Month&apos;s Activity</h3>
                                                <div className={styles.analyticsGrid}>
                                                    <div className={styles.analyticItem}>
                                                        <span className={styles.analyticValue}>
                                                            {dispatcherAnalytics.stats.shiftsThisMonth}
                                                        </span>
                                                        <span className={styles.analyticLabel}>Shifts</span>
                                                    </div>
                                                    <div className={styles.analyticItem}>
                                                        <span className={styles.analyticValue}>
                                                            {dispatcherAnalytics.stats.hoursThisMonth}h
                                                        </span>
                                                        <span className={styles.analyticLabel}>Hours</span>
                                                    </div>
                                                    <div className={styles.analyticItem}>
                                                        <span className={styles.analyticValue}>
                                                            {dispatcherAnalytics.stats.quotesCreated}
                                                        </span>
                                                        <span className={styles.analyticLabel}>Quotes</span>
                                                    </div>
                                                    <div className={styles.analyticItem}>
                                                        <span className={styles.analyticValue}>
                                                            {dispatcherAnalytics.stats.confirmationsCompleted}
                                                        </span>
                                                        <span className={styles.analyticLabel}>Confirmations</span>
                                                    </div>
                                                    <div className={styles.analyticItem}>
                                                        <span className={styles.analyticValue}>
                                                            {dispatcherAnalytics.stats.reportsSubmitted}
                                                        </span>
                                                        <span className={styles.analyticLabel}>Reports</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
