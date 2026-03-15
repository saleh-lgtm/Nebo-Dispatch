"use client";

import { ReactNode } from "react";
import styles from "./DataCard.module.css";

interface DataCardProps {
  /** Card content */
  children: ReactNode;
  /** Click handler - makes card interactive */
  onClick?: () => void;
  /** Whether card is currently selected */
  selected?: boolean;
  /** Visual variant */
  variant?: "default" | "highlighted" | "muted" | "danger";
  /** Add hover effects */
  interactive?: boolean;
  /** Custom className */
  className?: string;
  /** Header content */
  header?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
}

/**
 * Consistent card component for data display
 *
 * Usage:
 *   <DataCard onClick={handleClick} selected={isSelected}>
 *     <h4>Card Title</h4>
 *     <p>Card content</p>
 *   </DataCard>
 */
export default function DataCard({
  children,
  onClick,
  selected = false,
  variant = "default",
  interactive = false,
  className = "",
  header,
  footer,
}: DataCardProps) {
  const isClickable = !!onClick || interactive;

  return (
    <div
      className={`${styles.card} ${styles[variant]} ${
        selected ? styles.selected : ""
      } ${isClickable ? styles.interactive : ""} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.content}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
