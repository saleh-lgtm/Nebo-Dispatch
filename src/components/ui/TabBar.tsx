"use client";

import { ReactNode } from "react";
import styles from "./TabBar.module.css";

export interface Tab {
  value: string;
  label: string;
  /** Count chip shown next to label */
  count?: number;
  /** Icon element shown before label */
  icon?: ReactNode;
  /** Danger badge (e.g., missed count) — shown as red pill */
  badge?: number;
  /** Loading indicator — shows "..." and disables the tab */
  loading?: boolean;
  /** Explicitly disable this tab */
  disabled?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (value: string) => void;
  variant?: "underline" | "pill";
  className?: string;
}

/**
 * Shared tab navigation bar.
 *
 * Usage:
 *   <TabBar
 *     tabs={[
 *       { value: "all", label: "All", count: 42, icon: <List size={16} /> },
 *       { value: "active", label: "Active" },
 *     ]}
 *     activeTab={tab}
 *     onChange={setTab}
 *   />
 *
 *   // Underline variant:
 *   <TabBar tabs={tabs} activeTab={tab} onChange={setTab} variant="underline" />
 */
export default function TabBar({
  tabs,
  activeTab,
  onChange,
  variant = "pill",
  className = "",
}: TabBarProps) {
  const isPill = variant === "pill";

  const navClass = [
    isPill ? styles.pillNav : styles.underlineNav,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const tabClass = isPill ? styles.pillTab : styles.underlineTab;
  const activeClass = isPill ? styles.pillTabActive : styles.underlineTabActive;

  return (
    <nav className={navClass} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        const isDisabled = tab.disabled || tab.loading;

        const btnClasses = [
          tabClass,
          isActive ? activeClass : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={btnClasses}
            disabled={isDisabled}
            onClick={() => onChange(tab.value)}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`${styles.count} ${!isActive ? styles.countInactive : ""}`}>
                {tab.count}
              </span>
            )}
            {tab.loading && <span className={styles.loading}>...</span>}
            {tab.badge !== undefined && tab.badge > 0 && !tab.loading && (
              <span className={styles.badge}>{tab.badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
