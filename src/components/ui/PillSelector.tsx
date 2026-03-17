"use client";

import { ReactNode } from "react";
import styles from "./PillSelector.module.css";

export interface PillOption {
  value: string;
  label: string;
  /** Custom color for the active state */
  color?: string;
  /** Count badge inside the pill */
  count?: number;
  /** Icon element shown before label */
  icon?: ReactNode;
}

interface PillSelectorProps {
  options: PillOption[];
  selected: string | string[];
  onChange: (value: string | string[]) => void;
  /** Enable multi-select mode */
  multiple?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Shared pill/chip selector for filtering and categorization.
 *
 * Usage:
 *   // Single-select:
 *   <PillSelector
 *     options={[{ value: "all", label: "All" }, { value: "active", label: "Active", count: 5 }]}
 *     selected={filter}
 *     onChange={setFilter}
 *   />
 *
 *   // Multi-select:
 *   <PillSelector
 *     options={options}
 *     selected={selectedTags}
 *     onChange={setSelectedTags}
 *     multiple
 *   />
 *
 *   // With icons and colors:
 *   <PillSelector
 *     options={[{ value: "dfw", label: "DFW", icon: <MapPin size={14} />, color: "#E8553A" }]}
 *     selected={market}
 *     onChange={setMarket}
 *   />
 */
export default function PillSelector({
  options,
  selected,
  onChange,
  multiple = false,
  size = "sm",
  className = "",
}: PillSelectorProps) {
  const selectedSet = new Set(Array.isArray(selected) ? selected : [selected]);

  const handleClick = (value: string) => {
    if (multiple) {
      const current = Array.isArray(selected) ? selected : [selected];
      const next = selectedSet.has(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onChange(next);
    } else {
      onChange(value);
    }
  };

  const groupClasses = [
    styles.group,
    size === "md" ? styles.md : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={groupClasses} role="group">
      {options.map((option) => {
        const isActive = selectedSet.has(option.value);
        const hasColor = isActive && option.color;

        const pillClasses = [
          styles.pill,
          isActive ? (hasColor ? styles.activeColored : styles.active) : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            className={pillClasses}
            style={hasColor ? ({ "--pill-color": option.color } as React.CSSProperties) : undefined}
            onClick={() => handleClick(option.value)}
          >
            {option.icon}
            {option.label}
            {option.count !== undefined && (
              <span className={styles.count}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
