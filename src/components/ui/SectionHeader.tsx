"use client";

import { ReactNode } from "react";
import styles from "./SectionHeader.module.css";

interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional description */
  description?: string;
  /** Icon component */
  icon?: ReactNode;
  /** Primary action button */
  action?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    variant?: "primary" | "secondary" | "danger";
    disabled?: boolean;
    loading?: boolean;
  };
  /** Additional actions */
  secondaryActions?: ReactNode;
  /** Optional badge/count */
  badge?: string | number;
  /** Badge color */
  badgeColor?: "blue" | "green" | "amber" | "red" | "gray";
  /** Custom className */
  className?: string;
}

/**
 * Consistent section header with icon, title, and actions
 *
 * Usage:
 *   <SectionHeader
 *     title="Users"
 *     icon={<Users size={20} />}
 *     badge={users.length}
 *     action={{ label: "Add User", icon: <Plus size={14} />, onClick: handleAdd }}
 *   />
 */
export default function SectionHeader({
  title,
  description,
  icon,
  action,
  secondaryActions,
  badge,
  badgeColor = "blue",
  className = "",
}: SectionHeaderProps) {
  const actionVariant = action?.variant || "primary";

  return (
    <header className={`${styles.header} ${className}`}>
      <div className={styles.left}>
        {icon && <div className={styles.icon}>{icon}</div>}
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>
            {title}
            {badge !== undefined && (
              <span className={`${styles.badge} ${styles[badgeColor]}`}>
                {badge}
              </span>
            )}
          </h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>

      <div className={styles.actions}>
        {secondaryActions}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            className={`${styles.actionBtn} ${styles[actionVariant]}`}
          >
            {action.loading ? (
              <span className={styles.spinner} />
            ) : (
              action.icon
            )}
            <span>{action.loading ? "Loading..." : action.label}</span>
          </button>
        )}
      </div>
    </header>
  );
}
