"use client";

import { ReactNode } from "react";
import styles from "./StatusBadge.module.css";

export type StatusVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "pending";

interface StatusBadgeProps {
  /** Badge label */
  label: string;
  /** Color variant */
  variant?: StatusVariant;
  /** Optional icon */
  icon?: ReactNode;
  /** Size variant */
  size?: "sm" | "md";
  /** Custom className */
  className?: string;
}

/**
 * Consistent status badge for displaying states
 *
 * Usage:
 *   <StatusBadge label="Active" variant="success" icon={<Check size={12} />} />
 *   <StatusBadge label="Pending" variant="warning" />
 */
export default function StatusBadge({
  label,
  variant = "neutral",
  icon,
  size = "sm",
  className = "",
}: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${styles[size]} ${className}`}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {label}
    </span>
  );
}
