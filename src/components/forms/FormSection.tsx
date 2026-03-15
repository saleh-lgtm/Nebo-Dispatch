"use client";

import { ReactNode } from "react";
import styles from "./FormSection.module.css";

interface FormSectionProps {
  /** Section title */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Section content */
  children: ReactNode;
  /** Whether section is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Optional action button in header */
  action?: ReactNode;
  /** Custom className */
  className?: string;
}

/**
 * Reusable form section with consistent styling
 *
 * Usage:
 *   <FormSection title="Contact Information" icon={<User size={18} />}>
 *     <FormInput label="Name" ... />
 *     <FormInput label="Email" ... />
 *   </FormSection>
 */
export default function FormSection({
  title,
  description,
  icon,
  children,
  action,
  className = "",
}: FormSectionProps) {
  return (
    <section className={`${styles.section} ${className}`}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {icon && <div className={styles.icon}>{icon}</div>}
          <div className={styles.titleGroup}>
            <h3 className={styles.title}>{title}</h3>
            {description && <p className={styles.description}>{description}</p>}
          </div>
        </div>
        {action && <div className={styles.action}>{action}</div>}
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
