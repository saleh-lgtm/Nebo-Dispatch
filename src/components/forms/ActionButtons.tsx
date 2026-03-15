"use client";

import { ReactNode } from "react";
import styles from "./ActionButtons.module.css";

interface ActionButtonsProps {
  /** Primary action button content */
  primary?: {
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    loading?: boolean;
    disabled?: boolean;
  };
  /** Secondary action button content */
  secondary?: {
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  };
  /** Danger action button content */
  danger?: {
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  };
  /** Alignment */
  align?: "left" | "center" | "right" | "space-between";
  /** Custom className */
  className?: string;
}

/**
 * Consistent form action buttons
 *
 * Usage:
 *   <ActionButtons
 *     primary={{ label: "Save", onClick: handleSave, loading: saving }}
 *     secondary={{ label: "Cancel", onClick: handleCancel }}
 *   />
 */
export default function ActionButtons({
  primary,
  secondary,
  danger,
  align = "right",
  className = "",
}: ActionButtonsProps) {
  return (
    <div className={`${styles.actions} ${styles[align]} ${className}`}>
      {secondary && (
        <button
          type="button"
          className={styles.secondary}
          onClick={secondary.onClick}
          disabled={secondary.disabled}
        >
          {secondary.icon}
          <span>{secondary.label}</span>
        </button>
      )}

      {danger && (
        <button
          type="button"
          className={styles.danger}
          onClick={danger.onClick}
          disabled={danger.disabled}
        >
          {danger.icon}
          <span>{danger.label}</span>
        </button>
      )}

      {primary && (
        <button
          type={primary.type || "button"}
          className={styles.primary}
          onClick={primary.onClick}
          disabled={primary.loading || primary.disabled}
        >
          {primary.loading ? (
            <span className={styles.spinner} />
          ) : (
            primary.icon
          )}
          <span>{primary.loading ? "Loading..." : primary.label}</span>
        </button>
      )}
    </div>
  );
}
