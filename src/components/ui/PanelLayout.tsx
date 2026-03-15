"use client";

import { ReactNode } from "react";
import styles from "./PanelLayout.module.css";

interface PanelLayoutProps {
  /** Panel title */
  title: string;
  /** Icon component (from lucide-react) */
  icon?: ReactNode;
  /** Optional count badge */
  count?: number;
  /** Optional action button in header */
  action?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  };
  /** Panel content */
  children: ReactNode;
  /** Optional empty state when no content */
  emptyState?: {
    icon?: ReactNode;
    message: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  /** Show empty state */
  isEmpty?: boolean;
  /** Custom className for the panel */
  className?: string;
  /** Header className */
  headerClassName?: string;
  /** Color variant for the icon */
  iconColor?: "blue" | "green" | "amber" | "red" | "purple" | "gray";
  /** Whether panel is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Loading state */
  loading?: boolean;
}

/**
 * Reusable panel layout for dashboard widgets
 *
 * Usage:
 *   <PanelLayout
 *     title="Tasks"
 *     icon={<CheckSquare size={18} />}
 *     count={tasks.length}
 *     action={{ label: "Add", icon: <Plus size={14} />, onClick: handleAdd }}
 *     isEmpty={tasks.length === 0}
 *     emptyState={{ icon: <CheckSquare />, message: "No tasks" }}
 *   >
 *     {tasks.map(task => <TaskItem key={task.id} task={task} />)}
 *   </PanelLayout>
 */
export default function PanelLayout({
  title,
  icon,
  count,
  action,
  children,
  emptyState,
  isEmpty,
  className = "",
  headerClassName = "",
  iconColor = "blue",
  loading = false,
}: PanelLayoutProps) {
  return (
    <div className={`${styles.panel} ${className}`}>
      <div className={`${styles.header} ${headerClassName}`}>
        <div className={styles.headerLeft}>
          {icon && (
            <div className={`${styles.iconWrapper} ${styles[iconColor]}`}>
              {icon}
            </div>
          )}
          <h3 className={styles.title}>{title}</h3>
          {typeof count === "number" && (
            <span className={styles.count}>{count}</span>
          )}
        </div>

        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={styles.actionBtn}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        )}
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : isEmpty && emptyState ? (
          <div className={styles.emptyState}>
            {emptyState.icon && (
              <div className={styles.emptyIcon}>{emptyState.icon}</div>
            )}
            <p className={styles.emptyMessage}>{emptyState.message}</p>
            {emptyState.action && (
              <button
                type="button"
                onClick={emptyState.action.onClick}
                className={styles.emptyAction}
              >
                {emptyState.action.label}
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
